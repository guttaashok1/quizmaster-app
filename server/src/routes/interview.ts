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

// Accept audio blobs for Whisper transcription
const audioUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB — ~5 min of opus audio
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('audio/') || file.mimetype === 'application/octet-stream') {
      cb(null, true);
    } else {
      cb(new Error('Audio files only'));
    }
  },
});

const SYSTEM_PROMPT = `You are helping a candidate answer a live interview question out loud. Write the EXACT words they should say — a realistic, spoken, first-person answer in their own voice.

You will receive a RESUME, a JOB DESCRIPTION, optional SUPPORTING DOCUMENTS, and an INTERVIEW QUESTION. Use the resume and supporting documents for concrete, domain-specific detail; use the job description to keep the answer aligned with what this role cares about — echo their priorities and terminology where it's genuine, so the fit feels natural.

STRUCTURE the answer in three movements:

1. OPEN by restating the question, on its own single line, to confirm understanding and buy a beat to think. Lead with this — it should sound like a real person warming up. Use phrasings like:
   - "You're asking <restated question>."
   - "So you want me to <restated task>."
   - "You'd like to know <restated topic>."
   Restate in your own words — don't parrot the question verbatim. One sentence on its own line.

2. BODY — 2 to 3 short, flowing paragraphs of natural spoken English. This is the heart of the answer:
   - First person throughout ("I", "we", "my").
   - Conversational and warm, the way someone actually talks — use contractions ("I'd", "it's", "we're"), em-dashes for asides, and connectors like "for example", "from there", "instead of".
   - Pull real, concrete detail: name actual tools, systems, processes, roles, projects, steps, or — when the source gives them — numbers and metrics, drawn from the resume/documents and the domain of the question. Be specific, not generic.
   - Walk through it the way you'd explain it to a colleague — narrate the flow, the "when" and the "why," not just a definition. If the question is behavioral, walk through the actual situation, what you did, and what resulted, but as natural spoken narrative.
   - NO bullet points. NO numbered lists. NO "STAR" / "Situation / Task / Action / Result" labels or any headers. It must read as continuous spoken paragraphs.

3. CLOSE with one crisp summary line that lands the point, beginning with "In short," (or "Bottom line," / "So in short,"). One sentence that captures the value or takeaway.

TONE: Sound human and spoken, not written. Confident but not boastful, warm but precise. Avoid corporate filler and buzzword stacking — every sentence should carry real substance. Match the candidate's seniority and domain to the question.

GROUNDING: Anchor claims in the source material. Never invent specifics the source doesn't support — no fabricated API names, method names, internal product details, version numbers, or exact figures. When you don't have a precise detail, stay at a confident, clear CONCEPTUAL level — the way an experienced professional explains something to a peer — rather than inventing specifics to sound impressive. It's better to be accurate and measured than to over-reach.

CADENCE: Keep it calm, clean, and evenly paced — like the measured examples a strong candidate gives. Confident, not eager; substantive, not flashy. Don't pile on jargon or technical trivia; explain the what, the when, and the why in plain professional language.

LENGTH: Roughly 180–260 words total, across 3–4 short paragraphs.

Output ONLY the answer — the restate line, the body paragraphs, and the closing line. No preamble, no labels, no headers, no quotation marks around the whole thing, no meta-commentary.`;

const ONE_LINER_PROMPT = `You are an expert interview coach. Give exactly 4 punchy talking points — one sentence each — that the candidate can weave naturally into their answer.

Each line starts with → and is one first-person sentence, spoken confidently.
At least 2 lines must include a concrete number or outcome.
Pull real specifics from the resume and job description.
Output ONLY the 4 → lines — no intro, no labels, no extra text.`;

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
  mode: z.enum(['answer', 'one-liner', 'hints']).default('answer'),
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

    const chosenPrompt = mode === 'hints' ? HINTS_PROMPT
                       : mode === 'one-liner' ? ONE_LINER_PROMPT
                       : SYSTEM_PROMPT;
    // Full answer is the spoken response the candidate reads aloud — give it room for a
    // realistic 180–260 word, restate→body→summary answer. The two quick-glance aids stay short.
    const maxTokens = mode === 'hints' ? 120 : mode === 'one-liner' ? 150 : 500;
    // Full answer uses Sonnet for the most natural prose (realism is the priority there).
    // The quick-glance aids (talking points / cue cards) use Haiku — much faster TTFT,
    // and their formulaic output doesn't need Sonnet's depth.
    const model = mode === 'answer' ? 'claude-sonnet-4-6' : 'claude-haiku-4-5';

    const stream = client.messages.stream({
      model,
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

// GET /api/interview/transcribe — check if transcription service is configured
router.get('/transcribe', (_req: Request, res: Response) => {
  const groqKey   = process.env.GROQ_API_KEY;
  const openaiKey = process.env.OPENAI_API_KEY;
  if (groqKey || openaiKey) {
    res.json({ available: true, service: groqKey ? 'groq' : 'openai' });
  } else {
    res.status(503).json({
      available: false,
      message: 'Add GROQ_API_KEY (free at groq.com) or OPENAI_API_KEY to Vercel env vars to enable tab-only transcription.',
      code: 'NO_KEY',
    });
  }
});

// POST /api/interview/transcribe — converts audio blob to text via Whisper
// Prefers Groq (free, ~300ms latency) → falls back to OpenAI Whisper
router.post('/transcribe', audioUpload.single('audio'), async (req: Request, res: Response) => {
  if (!req.file) {
    res.status(400).json({ message: 'No audio file', code: 'NO_FILE' });
    return;
  }

  const groqKey   = process.env.GROQ_API_KEY;
  const openaiKey = process.env.OPENAI_API_KEY;
  const apiKey    = groqKey || openaiKey;

  if (!apiKey) {
    res.status(503).json({
      message: 'Add GROQ_API_KEY (free at groq.com) or OPENAI_API_KEY to Vercel env vars.',
      code: 'NO_KEY',
    });
    return;
  }

  try {
    const mimeType = req.file.mimetype || 'audio/webm';
    const filename = mimeType.includes('ogg') ? 'audio.ogg' : 'audio.webm';

    const openai = groqKey
      ? new OpenAI({ apiKey: groqKey, baseURL: 'https://api.groq.com/openai/v1' })
      : new OpenAI({ apiKey: openaiKey! });

    const model = groqKey ? 'whisper-large-v3-turbo' : 'whisper-1';

    // Context priming: tell Whisper this is a job interview so it favours interview
    // vocabulary, punctuates questions, and stops hallucinating "Thank you for watching"
    // / "Please subscribe" on near-silent chunks. temperature:0 makes it deterministic
    // and far less likely to invent words at chunk boundaries.
    const contextPrompt =
      'The following is audio from a live job interview. The interviewer is asking ' +
      'a professional question — transcribe it accurately with correct punctuation.';

    const file   = await toFile(req.file.buffer, filename, { type: mimeType });
    const result = await openai.audio.transcriptions.create({
      file,
      model,
      language: 'en',
      prompt: contextPrompt,
      temperature: 0,
    });

    res.json({ transcript: result.text.trim() });
  } catch (err) {
    console.error('[transcribe] error:', err);
    const msg = err instanceof Error ? err.message : 'Transcription failed';
    res.status(500).json({ message: msg, code: 'TRANSCRIBE_ERROR' });
  }
});

export default router;
