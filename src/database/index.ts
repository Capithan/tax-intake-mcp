import {
  ClientProfile,
  DocumentChecklist,
  DocumentItem,
  Appointment,
  TaxProfessional,
  Reminder,
  IntakeSession,
} from '../types/index.js';

// In-memory database for demo purposes
// In production, replace with actual database (PostgreSQL, MongoDB, etc.)

class Database {
  private clients: Map<string, ClientProfile> = new Map();
  private checklists: Map<string, DocumentChecklist> = new Map();
  private appointments: Map<string, Appointment> = new Map();
  private taxPros: Map<string, TaxProfessional> = new Map();
  private reminders: Map<string, Reminder> = new Map();
  private sessions: Map<string, IntakeSession> = new Map();

  constructor() {
    this.initializeTaxPros();
  }

  private initializeTaxPros(): void {
    const taxPros: TaxProfessional[] = [
      {
        id: 'tp-001',
        name: 'Sarah Johnson',
        email: 'sarah.johnson@taxfirm.com',
        specializations: ['individual', 'self_employment'],
        maxComplexity: 'moderate',
        currentLoad: 3,
        maxDailyAppointments: 8,
        available: true,
        rating: 4.8,
      },
      {
        id: 'tp-002',
        name: 'Michael Chen',
        email: 'michael.chen@taxfirm.com',
        specializations: ['investments', 'crypto', 'foreign_income'],
        maxComplexity: 'expert',
        currentLoad: 5,
        maxDailyAppointments: 6,
        available: true,
        rating: 4.9,
      },
      {
        id: 'tp-003',
        name: 'Emily Rodriguez',
        email: 'emily.rodriguez@taxfirm.com',
        specializations: ['small_business', 'self_employment', 'real_estate'],
        maxComplexity: 'complex',
        currentLoad: 4,
        maxDailyAppointments: 7,
        available: true,
        rating: 4.7,
      },
      {
        id: 'tp-004',
        name: 'James Wilson',
        email: 'james.wilson@taxfirm.com',
        specializations: ['individual'],
        maxComplexity: 'simple',
        currentLoad: 6,
        maxDailyAppointments: 12,
        available: true,
        rating: 4.5,
      },
      {
        id: 'tp-005',
        name: 'Dr. Patricia Martinez',
        email: 'patricia.martinez@taxfirm.com',
        specializations: ['estate_planning', 'foreign_income', 'audit_representation'],
        maxComplexity: 'expert',
        currentLoad: 2,
        maxDailyAppointments: 4,
        available: true,
        rating: 5.0,
      },
    ];

    taxPros.forEach((tp) => this.taxPros.set(tp.id, tp));
  }

  // Client operations
  createClient(client: ClientProfile): ClientProfile {
    this.clients.set(client.id, client);
    return client;
  }

  getClient(id: string): ClientProfile | undefined {
    return this.clients.get(id);
  }

  updateClient(id: string, updates: Partial<ClientProfile>): ClientProfile | undefined {
    const client = this.clients.get(id);
    if (client) {
      const updated = { ...client, ...updates, updatedAt: new Date() };
      this.clients.set(id, updated);
      return updated;
    }
    return undefined;
  }

  getAllClients(): ClientProfile[] {
    return Array.from(this.clients.values());
  }

  // Checklist operations
  saveChecklist(checklist: DocumentChecklist): DocumentChecklist {
    this.checklists.set(checklist.clientId, checklist);
    return checklist;
  }

  getChecklist(clientId: string): DocumentChecklist | undefined {
    return this.checklists.get(clientId);
  }

  updateChecklistItem(
    clientId: string,
    documentId: string,
    updates: Partial<DocumentItem>
  ): DocumentChecklist | undefined {
    const checklist = this.checklists.get(clientId);
    if (checklist) {
      const docIndex = checklist.documents.findIndex((d) => d.id === documentId);
      if (docIndex >= 0) {
        checklist.documents[docIndex] = {
          ...checklist.documents[docIndex],
          ...updates,
        };
        checklist.lastUpdated = new Date();
        this.checklists.set(clientId, checklist);
        return checklist;
      }
    }
    return undefined;
  }

  // Appointment operations
  createAppointment(appointment: Appointment): Appointment {
    this.appointments.set(appointment.id, appointment);
    return appointment;
  }

  getAppointment(id: string): Appointment | undefined {
    return this.appointments.get(id);
  }

  getAppointmentsByClient(clientId: string): Appointment[] {
    return Array.from(this.appointments.values()).filter(
      (a) => a.clientId === clientId
    );
  }

  getAppointmentsByTaxPro(taxProId: string): Appointment[] {
    return Array.from(this.appointments.values()).filter(
      (a) => a.taxProId === taxProId
    );
  }

  // Tax Professional operations
  getTaxPro(id: string): TaxProfessional | undefined {
    return this.taxPros.get(id);
  }

  getAllTaxPros(): TaxProfessional[] {
    return Array.from(this.taxPros.values());
  }

  getAvailableTaxPros(): TaxProfessional[] {
    return Array.from(this.taxPros.values()).filter(
      (tp) => tp.available && tp.currentLoad < tp.maxDailyAppointments
    );
  }

  updateTaxProLoad(id: string, change: number): TaxProfessional | undefined {
    const taxPro = this.taxPros.get(id);
    if (taxPro) {
      taxPro.currentLoad = Math.max(0, taxPro.currentLoad + change);
      this.taxPros.set(id, taxPro);
      return taxPro;
    }
    return undefined;
  }

  // Reminder operations
  createReminder(reminder: Reminder): Reminder {
    this.reminders.set(reminder.id, reminder);
    return reminder;
  }

  getReminder(id: string): Reminder | undefined {
    return this.reminders.get(id);
  }

  getRemindersByClient(clientId: string): Reminder[] {
    return Array.from(this.reminders.values()).filter(
      (r) => r.clientId === clientId
    );
  }

  getPendingReminders(): Reminder[] {
    const now = new Date();
    return Array.from(this.reminders.values()).filter(
      (r) => !r.sent && r.scheduledFor <= now
    );
  }

  markReminderSent(id: string): Reminder | undefined {
    const reminder = this.reminders.get(id);
    if (reminder) {
      reminder.sent = true;
      reminder.sentAt = new Date();
      this.reminders.set(id, reminder);
      return reminder;
    }
    return undefined;
  }

  // Session operations
  createSession(session: IntakeSession): IntakeSession {
    this.sessions.set(session.id, session);
    return session;
  }

  getSession(id: string): IntakeSession | undefined {
    return this.sessions.get(id);
  }

  getSessionByClient(clientId: string): IntakeSession | undefined {
    return Array.from(this.sessions.values()).find(
      (s) => s.clientId === clientId && s.status === 'in_progress'
    );
  }

  updateSession(id: string, updates: Partial<IntakeSession>): IntakeSession | undefined {
    const session = this.sessions.get(id);
    if (session) {
      const updated = { ...session, ...updates, lastActivityAt: new Date() };
      this.sessions.set(id, updated);
      return updated;
    }
    return undefined;
  }
}

// Export singleton instance
export const db = new Database();
