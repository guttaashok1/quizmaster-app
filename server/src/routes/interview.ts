import { Router, Request, Response } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { getClient } from '../services/claudeService';
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
});

// POST /api/interview/answer-stream — streams a spoken interview answer via SSE
router.post('/answer-stream', async (req: Request, res: Response) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  try {
    const { resume, jobDescription, question } = AnswerSchema.parse(req.body);
    const client = getClient();

    const stream = client.messages.stream({
      model: 'claude-sonnet-4-6',
      max_tokens: 512,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: `RESUME:\n${resume}\n\nJOB DESCRIPTION:\n${jobDescription}\n\nINTERVIEW QUESTION: ${question}`,
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
      const msg = err instanceof Error ? err.message : 'Failed to generate answer';
      res.write(`data: ${JSON.stringify({ error: msg })}\n\n`);
    }
    res.end();
  }
});

export default router;
