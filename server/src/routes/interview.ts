import { Router, Request, Response } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { getClient } from '../services/claudeService';
import OpenAI, { toFile } from 'openai';
import mammoth from 'mammoth';
import path from 'path';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfParse: (buffer: Buffer) => Promise<{ text: string }> = require('pdf-parse');

const router = Router();

// Accept PDF and Word documents; reject everything else
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowedMimes = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
      'application/msword',        // .doc (legacy — we'll attempt mammoth)
      'application/octet-stream',  // some browsers send this for .docx
    ];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedMimes.includes(file.mimetype) || ext === '.pdf' || ext === '.docx' || ext === '.doc') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF and Word (.docx) files are supported'));
    }
  },
});

const SYSTEM_PROMPT = `You are an expert interview coach. Given a candidate's resume and a job description, craft a punchy, memorable interview answer as exactly 4 bullet points.

Output format — each line MUST start with the → symbol followed by a space:
→ [Situation: set the scene in one sentence]
→ [Action: what you specifically did — your key decision or approach]
→ [Result: a concrete outcome, ideally with a metric or number]
→ [Connection: why this experience makes you right for THIS specific role]

Rules:
- Write in first person as if YOU are the candidate speaking aloud
- Be specific: reference real details from the resume and job description
- Each bullet is 1–2 tight sentences — confident and direct, no filler
- Include at least one concrete metric or measurable result
- Output ONLY the 4 → lines — no intro text, no title, no extra commentary`;

const HINTS_PROMPT = `You are generating live interview cue cards. Given a resume, job description, and interview question, produce exactly 4 ultra-short cue lines the candidate can glance at in 1–2 seconds while speaking.

Output format — each line MUST start with the → symbol followed by a space:
→ [project or role name + 1 key number/result, e.g. "Payments redesign → 30% drop in errors"]
→ [2–4 keywords for the skill or method used, e.g. "cross-team lead · agile · stakeholder buy-in"]
→ [the specific metric or outcome to say out loud, e.g. "shipped in 6 weeks, under budget"]
→ [1 phrase that ties directly to this job, e.g. "matches their 'customer-first' principle"]

Rules:
- Each line is a fragment, NOT a sentence — keywords, numbers, short phrases only
- No verbs like "mention" or "talk about" — just the raw content to say
- Scannable in under 2 seconds: 6 words max per line
- Pull real specifics from the resume and job description
- Output ONLY the 4 → lines — no intro, no title, no extra commentary`;

// POST /api/interview/parse-resume — accepts PDF or Word (.docx), returns extracted text
router.post('/parse-resume', upload.single('resume'), async (req: Request, res: Response) => {
  if (!req.file) {
    res.status(400).json({ message: 'No file uploaded', code: 'NO_FILE' });
    return;
  }

  const ext = path.extname(req.file.originalname).toLowerCase();
  const isDocx = ext === '.docx' || ext === '.doc'
    || req.file.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    || req.file.mimetype === 'application/msword';
  const isPdf  = ext === '.pdf' || req.file.mimetype === 'application/pdf';

  if (!isDocx && !isPdf) {
    res.status(400).json({ message: 'Only PDF and Word (.docx) files are supported', code: 'INVALID_TYPE' });
    return;
  }

  try {
    if (isDocx) {
      const result = await mammoth.extractRawText({ buffer: req.file.buffer });
      const text = result.value.trim();
      if (!text) throw new Error('Could not extract text from Word document');
      res.json({ text });
    } else {
      const data = await pdfParse(req.file.buffer);
      res.json({ text: data.text.trim() });
    }
  } catch (err) {
    console.error('Document parse error:', err);
    res.status(500).json({ message: 'Failed to parse document — try pasting the text instead', code: 'PARSE_ERROR' });
  }
});

const AnswerSchema = z.object({
  resume: z.string().min(10, 'Resume text is too short'),
  jobDescription: z.string().min(10, 'Job description is too short'),
  question: z.string().min(3, 'Question is too short'),
  supportingDocs: z.string().optional(), // extracted text from extra uploaded PDFs
  mode: z.enum(['answer', 'hints']).default('answer'),
});

// POST /api/interview/answer-stream — streams a spoken interview answer via SSE
router.post('/answer-stream', async (req: Request, res: Response) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  try {
    const { resume, jobDescription, question, supportingDocs, mode } = AnswerSchema.parse(req.body);
    const client = getClient();

    const docsSection = supportingDocs && supportingDocs.trim()
      ? `\n\nSUPPORTING DOCUMENTS (portfolio, cover letter, certifications, etc.):\n${supportingDocs}`
      : '';

    const chosenPrompt = mode === 'hints' ? HINTS_PROMPT : SYSTEM_PROMPT;
    const maxTokens    = mode === 'hints' ? 200 : 400;

    const stream = client.messages.stream({
      model: 'claude-sonnet-4-6',
      max_tokens: maxTokens,
      // Cache the system prompt — saves ~80% on input token costs after the first call
      system: [{ type: 'text', text: chosenPrompt, cache_control: { type: 'ephemeral' } }],
      messages: [
        {
          role: 'user',
          content: `RESUME:\n${resume}\n\nJOB DESCRIPTION:\n${jobDescription}${docsSection}\n\nINTERVIEW QUESTION: ${question}`,
        },
      ],
    });

    stream.on('text', (text: string) => {
      res.write(`data: ${JSON.stringify({ text })}\n\n`);
    });

    await stream.finalMessage();
    res.write('data: [DONE]\n\n');
    res.end();
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.write(`data: ${JSON.stringify({ error: 'Invalid request: ' + err.errors[0]?.message })}\n\n`);
    } else {
      console.error('Interview stream error:', err);
      // Parse Anthropic API error types into user-friendly messages
      let msg = 'Failed to generate answer — please try again';
      if (err instanceof Error) {
        const raw = err.message;
        if (raw.includes('overloaded_error') || raw.includes('Overloaded')) {
          msg = 'overloaded'; // client will show retry UI
        } else if (raw.includes('rate_limit')) {
          msg = 'Rate limit reached — please wait a moment and try again';
        } else if (raw.includes('invalid_api_key') || raw.includes('authentication')) {
          msg = 'API configuration error — contact support';
        } else if (raw.includes('context_length')) {
          msg = 'Resume or job description is too long — try shortening it';
        } else {
          msg = 'Something went wrong — please try again';
        }
      }
      res.write(`data: ${JSON.stringify({ error: msg })}\n\n`);
    }
    res.end();
  }
});

// POST /api/interview/detect-question — uses Claude Haiku to decide if transcript is an interview question
router.post('/detect-question', async (req: Request, res: Response) => {
  const { transcript } = req.body as { transcript?: string };
  if (!transcript || transcript.trim().length < 8) {
    res.json({ isQuestion: false, question: null, confidence: 'low' });
    return;
  }

  try {
    const client = getClient();
    const response = await client.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 200,
      system: `You analyze audio transcripts from live job interviews. Your job:
1. Determine if the text contains an interview question from the interviewer.
2. If yes, extract the clean, grammatically correct question (fix transcription errors, remove filler words like "um", "uh", "so", "right").
3. Interview questions include: behavioral ("tell me about a time"), technical, situational, opinion-based, role-specific.
4. NOT interview questions: greetings, small talk, acknowledgements ("okay", "great", "sounds good"), mid-sentence fragments, background noise.
Return ONLY valid JSON — no explanation, no markdown.`,
      messages: [{
        role: 'user',
        content: `Transcript: "${transcript.trim()}"

JSON response: {"isQuestion": true/false, "question": "clean question or null", "confidence": "high/medium/low"}`,
      }],
    });

    const raw = response.content[0].type === 'text' ? response.content[0].text.trim() : '{}';
    // Strip markdown code fences if model adds them
    const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
    const result = JSON.parse(cleaned);
    res.json({
      isQuestion: Boolean(result.isQuestion),
      question: result.question || null,
      confidence: result.confidence || 'low',
    });
  } catch (err) {
    console.error('detect-question error:', err);
    // On error fall back to treating it as a question (don't lose user's text)
    res.json({ isQuestion: true, question: transcript.trim(), confidence: 'low' });
  }
});

// POST /api/interview/transcribe — converts audio blob to text via Whisper
router.post('/transcribe', upload.single('audio'), async (req: Request, res: Response) => {
  if (!req.file) {
    res.status(400).json({ message: 'No audio file', code: 'NO_FILE' });
    return;
  }
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    res.status(503).json({ message: 'Transcription not configured — add OPENAI_API_KEY', code: 'NO_KEY' });
    return;
  }
  try {
    const openai = new OpenAI({ apiKey });
    const mimeType = req.file.mimetype || 'audio/webm';
    const file = await toFile(req.file.buffer, 'audio.webm', { type: mimeType });
    const result = await openai.audio.transcriptions.create({
      file,
      model: 'whisper-1',
      language: 'en',
    });
    res.json({ transcript: result.text.trim() });
  } catch (err) {
    console.error('Transcription error:', err);
    const msg = err instanceof Error ? err.message : 'Transcription failed';
    res.status(500).json({ message: msg, code: 'TRANSCRIBE_ERROR' });
  }
});

export default router;
