import express from 'express';
import cors from 'cors';
import { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Get __dirname in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Import from compiled dist directory
import {
  startIntakeSession,
  processIntakeResponse,
  getIntakeProgress,
  getIntakeSummary,
} from '../dist/services/intake.js';
import {
  generateDocumentChecklist,
  getDocumentChecklist,
  markDocumentCollected,
  getPendingDocuments,
  formatChecklistForDisplay,
} from '../dist/services/checklist.js';
import {
  createDocumentReminder,
  getClientReminders,
  sendReminder,
  formatRemindersForDisplay,
} from '../dist/services/reminders.js';
import {
  routeClientToTaxPro,
  createAppointment,
  getAppointmentEstimate,
  getTaxProRecommendations,
} from '../dist/services/routing.js';
import { db } from '../dist/database/index.js';

const app = express();

// Enhanced CORS configuration for ChatGPT
app.use(cors({
  origin: true,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
}));

// Add explicit CORS headers middleware
app.use((_req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS,PATCH');
  res.header('Access-Control-Allow-Headers', 'Content-Type,Authorization,X-Requested-With');
  res.header('Access-Control-Allow-Credentials', 'true');
  next();
});

// Handle preflight requests
app.options('*', cors());

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check (API route - BEFORE static files)
app.get('/health', (_req, res) => {
  res.json({ ok: true, platform: 'vercel', service: 'tax-intake-mcp-bridge' });
});

// Intake
app.post('/intake/start', (req: Request, res: Response) => {
  const { clientId } = req.body || {};
  const result = startIntakeSession(clientId);
  res.json({
    sessionId: result.session.id,
    clientId: result.client.id,
    currentStep: result.currentStep,
    nextQuestion: result.nextQuestion,
  });
});

app.post('/intake/respond', (req: Request, res: Response) => {
  const { sessionId, answer } = req.body || {};
  const result = processIntakeResponse(sessionId, answer);
  res.json(result);
});

app.get('/intake/progress/:sessionId', (req: Request, res: Response) => {
  const { sessionId } = req.params;
  const progress = getIntakeProgress(sessionId);
  res.json(progress || { error: 'Session not found' });
});

app.get('/client/:clientId/summary', (req: Request, res: Response) => {
  const { clientId } = req.params;
  const summary = getIntakeSummary(clientId);
  res.type('text/plain').send(summary);
});

// Checklist
app.post('/client/:clientId/checklist/generate', (req: Request, res: Response) => {
  const { clientId } = req.params;
  const checklist = generateDocumentChecklist(clientId);
  res.type('text/plain').send(formatChecklistForDisplay(checklist));
});

app.get('/client/:clientId/checklist', (req: Request, res: Response) => {
  const { clientId } = req.params;
  const checklist = getDocumentChecklist(clientId);
  if (!checklist) return res.status(404).json({ error: 'Checklist not found' });
  res.type('text/plain').send(formatChecklistForDisplay(checklist));
});

app.post('/client/:clientId/checklist/collect', (req: Request, res: Response) => {
  const { clientId } = req.params;
  const { documentId } = req.body || {};
  const result = markDocumentCollected(clientId, documentId);
  res.json(result);
});

app.get('/client/:clientId/checklist/pending', (req: Request, res: Response) => {
  const { clientId } = req.params;
  const pending = getPendingDocuments(clientId);
  res.json(pending);
});

// Reminders
app.post('/client/:clientId/reminders/documents', (req: Request, res: Response) => {
  const { clientId } = req.params;
  const { appointmentId } = req.body || {};
  const pending = getPendingDocuments(clientId);
  if (pending.length === 0) return res.json({ message: 'No pending documents' });
  const reminders = createDocumentReminder(clientId, appointmentId, pending);
  res.type('text/plain').send(
    reminders.map((r) => `- ${r.message}`).join('\n')
  );
});

app.get('/client/:clientId/reminders', (req: Request, res: Response) => {
  const { clientId } = req.params;
  const reminders = getClientReminders(clientId);
  res.type('text/plain').send(formatRemindersForDisplay(reminders));
});

app.post('/reminders/send', (req: Request, res: Response) => {
  const { reminderId } = req.body || {};
  const result = sendReminder(reminderId);
  res.json(result);
});

// Routing + appointments
app.post('/client/:clientId/route', (req: Request, res: Response) => {
  const { clientId } = req.params;
  const result = routeClientToTaxPro(clientId);
  res.json(result);
});

app.post('/appointments', (req: Request, res: Response) => {
  const { clientId, taxProId, scheduledAt, type } = req.body || {};
  const appointment = createAppointment(clientId, taxProId, new Date(scheduledAt), type);
  res.json(appointment);
});

app.get('/client/:clientId/appointment/estimate', (req: Request, res: Response) => {
  const { clientId } = req.params;
  const estimate = getAppointmentEstimate(clientId);
  res.type('text/plain').send(estimate.message);
});

app.get('/client/:clientId/recommendations', (req: Request, res: Response) => {
  const { clientId } = req.params;
  const recs = getTaxProRecommendations(clientId);
  res.type('text/plain').send(recs);
});

// Minimal SSE for Vercel (will be proxied, note: Vercel may buffer SSE)
app.get('/sse', (req: Request, res: Response) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  (res as any).flushHeaders?.();
  const ping = setInterval(() => {
    res.write(`event: ping\n`);
    res.write(`data: {"ts": ${Date.now()}}\n\n`);
  }, 25000);
  req.on('close', () => {
    clearInterval(ping);
    try { res.end(); } catch {}
  });
  res.write(`event: ready\n`);
  res.write(`data: {"service":"tax-intake-mcp-bridge-vercel"}\n\n`);
});

// Serve index.html on root only
app.get('/', (_req, res) => {
  try {
    const publicDir = path.join(__dirname, '..', 'public');
    const indexPath = path.join(publicDir, 'index.html');
    const html = fs.readFileSync(indexPath, 'utf-8');
    res.type('text/html').send(html);
  } catch (e) {
    res.type('text/plain').send('Tax Intake MCP Bridge - Vercel');
  }
});

export default app;
