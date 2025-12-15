import express from 'express';
import cors from 'cors';
import { Request, Response } from 'express';
import {
  startIntakeSession,
  processIntakeResponse,
  getIntakeProgress,
  getIntakeSummary,
} from '../services/intake.js';
import {
  generateDocumentChecklist,
  getDocumentChecklist,
  markDocumentCollected,
  getPendingDocuments,
  formatChecklistForDisplay,
} from '../services/checklist.js';
import {
  createDocumentReminder,
  createBatchDocumentReminder,
  getClientReminders,
  sendReminder,
  formatRemindersForDisplay,
} from '../services/reminders.js';
import {
  calculateComplexityScore,
  getComplexityLevel,
  routeClientToTaxPro,
  createAppointment,
  getAppointmentEstimate,
  getTaxProRecommendations,
} from '../services/routing.js';
import { db } from '../database/index.js';

const app = express();
app.use(cors({ origin: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

// Simple health check
app.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'tax-intake-mcp-bridge' });
});

// Intake endpoints
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

// Checklist endpoints
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

// Reminder endpoints
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

app.get('/tax-pros', (_req: Request, res: Response) => {
  const pros = db.getAllTaxPros();
  res.json(pros);
});

// Minimal SSE endpoint: emits heartbeat and can later be extended to stream tool outputs
app.get('/sse', (req: Request, res: Response) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  const ping = setInterval(() => {
    res.write(`event: ping\n`);
    res.write(`data: {"ts": ${Date.now()}}\n\n`);
  }, 25000);

  req.on('close', () => {
    clearInterval(ping);
    try { res.end(); } catch {}
  });

  res.write(`event: ready\n`);
  res.write(`data: {"service":"tax-intake-mcp-bridge"}\n\n`);
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Tax Intake UI & HTTP Bridge running on http://localhost:${PORT}`);
  console.log(`Open your browser to: http://localhost:${PORT}`);
});
