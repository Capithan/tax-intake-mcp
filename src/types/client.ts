// Client profile and intake data types

export interface ClientProfile {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  ssn?: string;
  dateOfBirth?: string;
  address?: Address;
  filingStatus: FilingStatus;
  dependents: Dependent[];
  employmentInfo: EmploymentInfo[];
  incomeTypes: IncomeType[];
  deductions: DeductionType[];
  previousYearAGI?: number;
  hasHealthInsurance: boolean;
  hasCrypto: boolean;
  hasForeignAccounts: boolean;
  hasRentalProperty: boolean;
  hasBusinessIncome: boolean;
  appointmentId?: string;
  intakeCompleted: boolean;
  intakeCompletedAt?: Date;
  documentsCollected: string[];
  documentsPending: string[];
  complexityScore: number;
  assignedTaxPro?: string;
  notes: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface Address {
  street: string;
  city: string;
  state: string;
  zipCode: string;
}

export type FilingStatus = 
  | 'single'
  | 'married_filing_jointly'
  | 'married_filing_separately'
  | 'head_of_household'
  | 'qualifying_widow';

export interface Dependent {
  firstName: string;
  lastName: string;
  relationship: string;
  dateOfBirth: string;
  ssn?: string;
  livesWithClient: boolean;
  monthsLivedWithClient: number;
}

export interface EmploymentInfo {
  employerName: string;
  employerEIN?: string;
  jobTitle: string;
  isCurrentJob: boolean;
  startDate: string;
  endDate?: string;
  incomeType: 'W2' | '1099' | 'both';
  estimatedIncome?: number;
}

export type IncomeType = 
  | 'wages_w2'
  | 'self_employment_1099nec'
  | 'freelance_1099misc'
  | 'gig_economy'
  | 'rental_income'
  | 'investment_income'
  | 'dividends'
  | 'capital_gains'
  | 'retirement_distributions'
  | 'social_security'
  | 'unemployment'
  | 'alimony_received'
  | 'gambling_winnings'
  | 'crypto_income'
  | 'foreign_income'
  | 'other';

export type DeductionType =
  | 'mortgage_interest'
  | 'property_taxes'
  | 'state_local_taxes'
  | 'charitable_donations'
  | 'medical_expenses'
  | 'student_loan_interest'
  | 'educator_expenses'
  | 'home_office'
  | 'business_expenses'
  | 'hsa_contributions'
  | 'ira_contributions'
  | '401k_contributions'
  | 'childcare_expenses'
  | 'alimony_paid'
  | 'moving_expenses'
  | 'none';

export interface DocumentChecklist {
  clientId: string;
  documents: DocumentItem[];
  generatedAt: Date;
  lastUpdated: Date;
}

export interface DocumentItem {
  id: string;
  name: string;
  description: string;
  category: DocumentCategory;
  required: boolean;
  collected: boolean;
  source?: string;
  reminderSent: boolean;
  reminderSentAt?: Date;
  notes?: string;
}

export type DocumentCategory =
  | 'identity'
  | 'income'
  | 'expenses'
  | 'investments'
  | 'property'
  | 'business'
  | 'healthcare'
  | 'education'
  | 'other';

export interface Appointment {
  id: string;
  clientId: string;
  taxProId: string;
  scheduledAt: Date;
  duration: number; // minutes
  status: AppointmentStatus;
  type: 'virtual' | 'in_person';
  notes?: string;
  intakeScore: number;
  estimatedComplexity: ComplexityLevel;
}

export type AppointmentStatus = 
  | 'scheduled'
  | 'confirmed'
  | 'in_progress'
  | 'completed'
  | 'cancelled'
  | 'no_show';

export type ComplexityLevel = 'simple' | 'moderate' | 'complex' | 'expert';

export interface TaxProfessional {
  id: string;
  name: string;
  email: string;
  specializations: Specialization[];
  maxComplexity: ComplexityLevel;
  currentLoad: number;
  maxDailyAppointments: number;
  available: boolean;
  rating: number;
}

export type Specialization =
  | 'individual'
  | 'self_employment'
  | 'small_business'
  | 'investments'
  | 'real_estate'
  | 'crypto'
  | 'foreign_income'
  | 'estate_planning'
  | 'audit_representation';

export interface Reminder {
  id: string;
  clientId: string;
  appointmentId: string;
  type: ReminderType;
  message: string;
  scheduledFor: Date;
  sent: boolean;
  sentAt?: Date;
  channel: 'email' | 'sms' | 'both';
  documentIds?: string[];
}

export type ReminderType = 
  | 'appointment_confirmation'
  | 'document_reminder'
  | 'appointment_reminder_24h'
  | 'appointment_reminder_1h'
  | 'follow_up';

export interface IntakeSession {
  id: string;
  clientId: string;
  startedAt: Date;
  lastActivityAt: Date;
  currentStep: IntakeStep;
  completedSteps: IntakeStep[];
  responses: IntakeResponse[];
  status: 'in_progress' | 'completed' | 'abandoned';
}

export type IntakeStep =
  | 'personal_info'
  | 'filing_status'
  | 'dependents'
  | 'employment'
  | 'income_types'
  | 'deductions'
  | 'special_situations'
  | 'document_upload'
  | 'review'
  | 'complete';

export interface IntakeResponse {
  step: IntakeStep;
  question: string;
  answer: string | boolean | number | string[];
  timestamp: Date;
}
