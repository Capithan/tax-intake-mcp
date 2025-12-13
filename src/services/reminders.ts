import {
  Reminder,
  ReminderType,
  ClientProfile,
  Appointment,
  DocumentItem,
} from '../types/index.js';
import { db } from '../database/index.js';
import { getPendingDocuments } from './checklist.js';

function generateReminderId(): string {
  return `reminder-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

export function createDocumentReminder(
  clientId: string,
  appointmentId: string,
  documents: DocumentItem[]
): Reminder[] {
  const client = db.getClient(clientId);
  if (!client) {
    throw new Error('Client not found');
  }

  const reminders: Reminder[] = [];

  // Create personalized reminders for each pending document
  documents.forEach((doc) => {
    const message = generatePersonalizedMessage(client, doc);
    
    const reminder: Reminder = {
      id: generateReminderId(),
      clientId,
      appointmentId,
      type: 'document_reminder',
      message,
      scheduledFor: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours from now
      sent: false,
      channel: 'email',
      documentIds: [doc.id],
    };

    db.createReminder(reminder);
    reminders.push(reminder);
  });

  return reminders;
}

function generatePersonalizedMessage(client: ClientProfile, doc: DocumentItem): string {
  const firstName = client.firstName || 'there';
  
  // Generate contextual, personalized reminders
  const messages: Record<string, string> = {
    'gig_uber': `Hi ${firstName}! 👋 Don't forget your 1099-NEC from Uber. You can download it from your Uber driver dashboard under "Tax Information."`,
    'gig_lyft': `Hi ${firstName}! 👋 Remember to grab your 1099-NEC from Lyft. Check your Lyft driver dashboard under "Tax Info" to download it.`,
    'gig_doordash': `Hi ${firstName}! 👋 Don't forget your 1099-NEC from DoorDash. You can find it in your Dasher app under "Earnings" → "Tax Forms."`,
    'gig_mileage': `Hi ${firstName}! 📱 Do you have your mileage log ready? If you used a mileage tracking app, now's the time to export those records!`,
    'income_crypto': `Hi ${firstName}! 🪙 Don't forget your cryptocurrency transaction records. You can export your transaction history from exchanges like Coinbase, Binance, or Kraken.`,
    'income_1099nec': `Hi ${firstName}! 📄 Remember to collect all your 1099-NEC forms from clients who paid you $600 or more.`,
    'doc_fbar': `Hi ${firstName}! 🌍 Important: You'll need your foreign bank account statements showing the highest balance for each account (FBAR requirement).`,
  };

  // Check for specific document types
  for (const [key, message] of Object.entries(messages)) {
    if (doc.name.toLowerCase().includes(key.replace('_', ' ')) || 
        doc.source?.toLowerCase().includes(key.split('_')[1] || '')) {
      return message;
    }
  }

  // Default personalized message
  return `Hi ${firstName}! 📋 Reminder: Please don't forget to bring your ${doc.name}. ${doc.description}`;
}

export function createAppointmentReminder(
  clientId: string,
  appointmentId: string,
  reminderType: 'appointment_reminder_24h' | 'appointment_reminder_1h',
  scheduledFor: Date
): Reminder {
  const client = db.getClient(clientId);
  const appointment = db.getAppointment(appointmentId);

  if (!client || !appointment) {
    throw new Error('Client or appointment not found');
  }

  const taxPro = db.getTaxPro(appointment.taxProId);
  const taxProName = taxPro?.name || 'your tax professional';

  let message: string;
  if (reminderType === 'appointment_reminder_24h') {
    message = `Hi ${client.firstName}! 📅 Your tax appointment with ${taxProName} is tomorrow at ${formatTime(appointment.scheduledAt)}. Please make sure you have all your documents ready!`;
  } else {
    message = `Hi ${client.firstName}! ⏰ Your tax appointment with ${taxProName} starts in 1 hour. See you soon!`;
  }

  const reminder: Reminder = {
    id: generateReminderId(),
    clientId,
    appointmentId,
    type: reminderType,
    message,
    scheduledFor,
    sent: false,
    channel: 'both',
  };

  db.createReminder(reminder);
  return reminder;
}

export function createBatchDocumentReminder(clientId: string, appointmentId: string): Reminder | null {
  const client = db.getClient(clientId);
  if (!client) return null;

  const pendingDocs = getPendingDocuments(clientId);
  if (pendingDocs.length === 0) return null;

  const firstName = client.firstName || 'there';
  
  let message = `Hi ${firstName}! 📋 Your tax appointment is coming up. Here are the documents you still need to gather:\n\n`;
  
  pendingDocs.forEach((doc, index) => {
    message += `${index + 1}. **${doc.name}**\n`;
    if (doc.source) {
      message += `   📍 Get it from: ${doc.source}\n`;
    }
  });

  message += `\nHaving these ready will help us complete your taxes faster! 🚀`;

  const reminder: Reminder = {
    id: generateReminderId(),
    clientId,
    appointmentId,
    type: 'document_reminder',
    message,
    scheduledFor: new Date(Date.now() + 48 * 60 * 60 * 1000), // 48 hours from now
    sent: false,
    channel: 'email',
    documentIds: pendingDocs.map((d) => d.id),
  };

  db.createReminder(reminder);
  return reminder;
}

export function getClientReminders(clientId: string): Reminder[] {
  return db.getRemindersByClient(clientId);
}

export function getPendingReminders(): Reminder[] {
  return db.getPendingReminders();
}

export function sendReminder(reminderId: string): { success: boolean; message: string } {
  const reminder = db.getReminder(reminderId);
  if (!reminder) {
    return { success: false, message: 'Reminder not found' };
  }

  if (reminder.sent) {
    return { success: false, message: 'Reminder already sent' };
  }

  const client = db.getClient(reminder.clientId);
  if (!client) {
    return { success: false, message: 'Client not found' };
  }

  // In production, this would integrate with email/SMS services
  // For now, we just mark it as sent
  console.log(`[REMINDER] Sending to ${client.email}:`);
  console.log(reminder.message);

  db.markReminderSent(reminderId);

  return {
    success: true,
    message: `Reminder sent to ${client.email} via ${reminder.channel}`,
  };
}

export function scheduleAppointmentReminders(appointment: Appointment): Reminder[] {
  const reminders: Reminder[] = [];
  const appointmentTime = new Date(appointment.scheduledAt);

  // 24-hour reminder
  const reminder24h = new Date(appointmentTime);
  reminder24h.setHours(reminder24h.getHours() - 24);
  
  if (reminder24h > new Date()) {
    reminders.push(
      createAppointmentReminder(
        appointment.clientId,
        appointment.id,
        'appointment_reminder_24h',
        reminder24h
      )
    );
  }

  // 1-hour reminder
  const reminder1h = new Date(appointmentTime);
  reminder1h.setHours(reminder1h.getHours() - 1);
  
  if (reminder1h > new Date()) {
    reminders.push(
      createAppointmentReminder(
        appointment.clientId,
        appointment.id,
        'appointment_reminder_1h',
        reminder1h
      )
    );
  }

  // Document reminder 48 hours before
  const docReminder = createBatchDocumentReminder(appointment.clientId, appointment.id);
  if (docReminder) {
    reminders.push(docReminder);
  }

  return reminders;
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

export function formatRemindersForDisplay(reminders: Reminder[]): string {
  if (reminders.length === 0) {
    return 'No reminders scheduled.';
  }

  let output = '# Scheduled Reminders\n\n';

  const pending = reminders.filter((r) => !r.sent);
  const sent = reminders.filter((r) => r.sent);

  if (pending.length > 0) {
    output += '## Pending Reminders\n\n';
    pending.forEach((r) => {
      output += `- **${r.type.replace(/_/g, ' ')}** - Scheduled for ${r.scheduledFor.toLocaleString()}\n`;
      output += `  Channel: ${r.channel}\n`;
    });
    output += '\n';
  }

  if (sent.length > 0) {
    output += '## Sent Reminders\n\n';
    sent.forEach((r) => {
      output += `- ✅ **${r.type.replace(/_/g, ' ')}** - Sent at ${r.sentAt?.toLocaleString()}\n`;
    });
  }

  return output;
}
