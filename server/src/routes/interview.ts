import { Router, Request, Response } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { getClient } from '../services/claudeService';
import OpenAI, { toFile } from 'openai';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfParse: (buffer: Buffer) => Promise<{ text: string }> = require('pdf-parse');

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

const SYSTEM_PROMPT = `You are an expert interview coach. Given a candidate's resume and a job description, answer interview questions exactly as the candidate should speak them aloud.

Rules:
- Write in first person as if YOU are the candidate speaking
- Keep answers to 3–5 sentences (about 30–60 seconds of speech)
- Be specific: reference real details from the resume and job description
- Use the STAR method (Situation, Task, Action, Result) for behavioral questions — but stay concise
- Sound natural and confident, not like a written essay
- No bullet points, no headers — just flowing spoken words
- End with a brief connector that ties back to the role`;

// POST /api/interview/parse-resume — accepts PDF, returns extracted text
router.post('/parse-resume', upload.single('resume'), async (req: Request, res: Response) => {
  if (!req.file) {
    res.status(400).json({ message: 'No file uploaded', code: 'NO_FILE' });
    return;
  }
  if (req.file.mimetype !== 'application/pdf') {
    res.status(400).json({ message: 'Only PDF files are supported', code: 'INVALID_TYPE' });
    return;
  }
  try {
    const data = await pdfParse(req.file.buffer);
    res.json({ text: data.text.trim() });
  } catch (err) {
    console.error('PDF parse error:', err);
    res.status(500).json({ message: 'Failed to parse PDF', code: 'PARSE_ERROR' });
  }
});

const AnswerSchema = z.object({
  resume: z.string().min(10, 'Resume text is too short'),
  jobDescription: z.string().min(10, 'Job description is too short'),
  question: z.string().min(3, 'Question is too short'),
  supportingDocs: z.string().optional(), // extracted text from extra uploaded PDFs
});

// POST /api/interview/answer-stream — streams a spoken interview answer via SSE
router.post('/answer-stream', async (req: Request, res: Response) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  try {
    const { resume, jobDescription, question, supportingDocs } = AnswerSchema.parse(req.body);
    const client = getClient();

    const docsSection = supportingDocs && supportingDocs.trim()
      ? `\n\nSUPPORTING DOCUMENTS (portfolio, cover letter, certifications, etc.):\n${supportingDocs}`
      : '';

    const stream = client.messages.stream({
      model: 'claude-sonnet-4-6',
      max_tokens: 512,
      // Cache the system prompt — saves ~80% on input token costs after the first call
      system: [{ type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
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
