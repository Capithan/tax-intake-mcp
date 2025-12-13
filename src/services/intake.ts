import { randomUUID } from 'crypto';
import {
  ClientProfile,
  IntakeSession,
  IntakeStep,
  IntakeResponse,
  FilingStatus,
  IncomeType,
  DeductionType,
  Dependent,
  EmploymentInfo,
} from '../types/index.js';
import { db } from '../database/index.js';

// Intake step order
const INTAKE_STEPS: IntakeStep[] = [
  'personal_info',
  'filing_status',
  'dependents',
  'employment',
  'income_types',
  'deductions',
  'special_situations',
  'document_upload',
  'review',
  'complete',
];

// Questions for each step
const INTAKE_QUESTIONS: Record<IntakeStep, string[]> = {
  personal_info: [
    "What is your full legal name?",
    "What is your email address?",
    "What is your phone number?",
    "What is your date of birth?",
    "What is your current address?",
  ],
  filing_status: [
    "What is your filing status? (Single, Married Filing Jointly, Married Filing Separately, Head of Household, Qualifying Widow/Widower)",
  ],
  dependents: [
    "Do you have any dependents to claim?",
    "For each dependent, please provide: name, relationship, date of birth, and months lived with you.",
  ],
  employment: [
    "Who were your employers in 2024?",
    "For each employer, were you a W-2 employee or 1099 contractor?",
    "Did you have any self-employment or freelance income?",
  ],
  income_types: [
    "Besides employment, what other types of income did you receive? (investments, rental property, retirement distributions, etc.)",
  ],
  deductions: [
    "Do you own a home and pay mortgage interest?",
    "Did you make any charitable donations?",
    "Do you have student loans?",
    "Did you contribute to retirement accounts (401k, IRA)?",
    "Do you have any business expenses or home office deductions?",
  ],
  special_situations: [
    "Did you buy or sell cryptocurrency?",
    "Do you have any foreign bank accounts or foreign income?",
    "Did you buy or sell real estate?",
    "Did you have any major life changes (marriage, divorce, new baby, etc.)?",
  ],
  document_upload: [
    "Please upload or confirm you have gathered all required documents from your checklist.",
  ],
  review: [
    "Please review all your information and confirm it's accurate.",
  ],
  complete: [],
};

function generateClientId(): string {
  return `client-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

function generateSessionId(): string {
  return `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

export function startIntakeSession(clientId?: string): {
  session: IntakeSession;
  client: ClientProfile;
  nextQuestion: string;
  currentStep: IntakeStep;
} {
  // Create or get client
  let client: ClientProfile;
  
  if (clientId) {
    const existing = db.getClient(clientId);
    if (existing) {
      client = existing;
    } else {
      client = createNewClient(clientId);
    }
  } else {
    client = createNewClient(generateClientId());
  }

  // Check for existing session
  const existingSession = db.getSessionByClient(client.id);
  if (existingSession) {
    const stepIndex = INTAKE_STEPS.indexOf(existingSession.currentStep);
    const questions = INTAKE_QUESTIONS[existingSession.currentStep];
    return {
      session: existingSession,
      client,
      nextQuestion: questions[0] || "Let's continue where we left off.",
      currentStep: existingSession.currentStep,
    };
  }

  // Create new session
  const session: IntakeSession = {
    id: generateSessionId(),
    clientId: client.id,
    startedAt: new Date(),
    lastActivityAt: new Date(),
    currentStep: 'personal_info',
    completedSteps: [],
    responses: [],
    status: 'in_progress',
  };

  db.createSession(session);

  return {
    session,
    client,
    nextQuestion: INTAKE_QUESTIONS['personal_info'][0],
    currentStep: 'personal_info',
  };
}

function createNewClient(id: string): ClientProfile {
  const client: ClientProfile = {
    id,
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    filingStatus: 'single',
    dependents: [],
    employmentInfo: [],
    incomeTypes: [],
    deductions: [],
    hasHealthInsurance: false,
    hasCrypto: false,
    hasForeignAccounts: false,
    hasRentalProperty: false,
    hasBusinessIncome: false,
    intakeCompleted: false,
    documentsCollected: [],
    documentsPending: [],
    complexityScore: 0,
    notes: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  return db.createClient(client);
}

export function processIntakeResponse(
  sessionId: string,
  answer: string
): {
  success: boolean;
  nextQuestion?: string;
  currentStep?: IntakeStep;
  stepCompleted?: boolean;
  intakeCompleted?: boolean;
  client?: ClientProfile;
  message?: string;
} {
  const session = db.getSession(sessionId);
  if (!session) {
    return { success: false, message: 'Session not found' };
  }

  const client = db.getClient(session.clientId);
  if (!client) {
    return { success: false, message: 'Client not found' };
  }

  // Store the response
  const response: IntakeResponse = {
    step: session.currentStep,
    question: getCurrentQuestion(session),
    answer,
    timestamp: new Date(),
  };
  session.responses.push(response);

  // Process the response and update client profile
  updateClientFromResponse(client, session.currentStep, answer);

  // Check if current step is complete
  const stepQuestions = INTAKE_QUESTIONS[session.currentStep];
  const stepResponses = session.responses.filter((r) => r.step === session.currentStep);

  if (stepResponses.length >= stepQuestions.length || isStepComplete(session.currentStep, answer)) {
    // Move to next step
    session.completedSteps.push(session.currentStep);
    const currentIndex = INTAKE_STEPS.indexOf(session.currentStep);
    
    if (currentIndex < INTAKE_STEPS.length - 1) {
      session.currentStep = INTAKE_STEPS[currentIndex + 1];
      
      if (session.currentStep === 'complete') {
        session.status = 'completed';
        client.intakeCompleted = true;
        client.intakeCompletedAt = new Date();
        db.updateClient(client.id, client);
        db.updateSession(sessionId, session);
        
        return {
          success: true,
          intakeCompleted: true,
          client,
          message: 'Congratulations! Your intake is complete. We will now generate your personalized document checklist.',
        };
      }

      db.updateSession(sessionId, session);
      
      return {
        success: true,
        nextQuestion: INTAKE_QUESTIONS[session.currentStep][0],
        currentStep: session.currentStep,
        stepCompleted: true,
        client,
      };
    }
  }

  db.updateSession(sessionId, session);

  // Get next question in current step
  const nextQuestionIndex = stepResponses.length;
  if (nextQuestionIndex < stepQuestions.length) {
    return {
      success: true,
      nextQuestion: stepQuestions[nextQuestionIndex],
      currentStep: session.currentStep,
      stepCompleted: false,
      client,
    };
  }

  return {
    success: true,
    nextQuestion: "Please provide more details.",
    currentStep: session.currentStep,
    client,
  };
}

function getCurrentQuestion(session: IntakeSession): string {
  const stepQuestions = INTAKE_QUESTIONS[session.currentStep];
  const stepResponses = session.responses.filter((r) => r.step === session.currentStep);
  const index = Math.min(stepResponses.length, stepQuestions.length - 1);
  return stepQuestions[index] || '';
}

function isStepComplete(step: IntakeStep, answer: string): boolean {
  // Simple heuristics - can be enhanced with more sophisticated logic
  const lowerAnswer = answer.toLowerCase();
  
  if (step === 'dependents' && (lowerAnswer.includes('no') || lowerAnswer.includes('none'))) {
    return true;
  }
  
  if (step === 'special_situations' && lowerAnswer.includes('no') && lowerAnswer.includes('none')) {
    return true;
  }

  return false;
}

function updateClientFromResponse(
  client: ClientProfile,
  step: IntakeStep,
  answer: string
): void {
  const lowerAnswer = answer.toLowerCase();

  switch (step) {
    case 'personal_info':
      // Parse name, email, phone from answer
      if (answer.includes('@')) {
        client.email = answer.trim();
      } else if (/\d{3}[-.\s]?\d{3}[-.\s]?\d{4}/.test(answer)) {
        client.phone = answer.trim();
      } else if (answer.includes(' ')) {
        const parts = answer.trim().split(' ');
        client.firstName = parts[0];
        client.lastName = parts.slice(1).join(' ');
      }
      break;

    case 'filing_status':
      if (lowerAnswer.includes('single')) {
        client.filingStatus = 'single';
      } else if (lowerAnswer.includes('jointly')) {
        client.filingStatus = 'married_filing_jointly';
      } else if (lowerAnswer.includes('separately')) {
        client.filingStatus = 'married_filing_separately';
      } else if (lowerAnswer.includes('head')) {
        client.filingStatus = 'head_of_household';
      } else if (lowerAnswer.includes('widow')) {
        client.filingStatus = 'qualifying_widow';
      }
      break;

    case 'income_types':
      const incomeTypes: IncomeType[] = [];
      if (lowerAnswer.includes('w2') || lowerAnswer.includes('w-2')) {
        incomeTypes.push('wages_w2');
      }
      if (lowerAnswer.includes('1099') || lowerAnswer.includes('freelance') || lowerAnswer.includes('contractor')) {
        incomeTypes.push('self_employment_1099nec');
      }
      if (lowerAnswer.includes('uber') || lowerAnswer.includes('lyft') || lowerAnswer.includes('doordash') || lowerAnswer.includes('gig')) {
        incomeTypes.push('gig_economy');
      }
      if (lowerAnswer.includes('rental') || lowerAnswer.includes('property')) {
        incomeTypes.push('rental_income');
        client.hasRentalProperty = true;
      }
      if (lowerAnswer.includes('invest') || lowerAnswer.includes('stock') || lowerAnswer.includes('dividend')) {
        incomeTypes.push('investment_income');
        incomeTypes.push('dividends');
      }
      if (lowerAnswer.includes('crypto') || lowerAnswer.includes('bitcoin')) {
        incomeTypes.push('crypto_income');
        client.hasCrypto = true;
      }
      if (lowerAnswer.includes('retirement') || lowerAnswer.includes('pension') || lowerAnswer.includes('401k')) {
        incomeTypes.push('retirement_distributions');
      }
      if (lowerAnswer.includes('social security')) {
        incomeTypes.push('social_security');
      }
      client.incomeTypes = [...new Set([...client.incomeTypes, ...incomeTypes])];
      break;

    case 'deductions':
      const deductions: DeductionType[] = [];
      if (lowerAnswer.includes('mortgage')) {
        deductions.push('mortgage_interest');
      }
      if (lowerAnswer.includes('property tax')) {
        deductions.push('property_taxes');
      }
      if (lowerAnswer.includes('charit') || lowerAnswer.includes('donat')) {
        deductions.push('charitable_donations');
      }
      if (lowerAnswer.includes('student loan')) {
        deductions.push('student_loan_interest');
      }
      if (lowerAnswer.includes('401k') || lowerAnswer.includes('ira') || lowerAnswer.includes('retirement')) {
        deductions.push('401k_contributions');
        deductions.push('ira_contributions');
      }
      if (lowerAnswer.includes('home office')) {
        deductions.push('home_office');
      }
      if (lowerAnswer.includes('business expense')) {
        deductions.push('business_expenses');
        client.hasBusinessIncome = true;
      }
      if (lowerAnswer.includes('childcare') || lowerAnswer.includes('daycare')) {
        deductions.push('childcare_expenses');
      }
      client.deductions = [...new Set([...client.deductions, ...deductions])];
      break;

    case 'special_situations':
      if (lowerAnswer.includes('crypto') || lowerAnswer.includes('bitcoin')) {
        client.hasCrypto = true;
        if (!client.incomeTypes.includes('crypto_income')) {
          client.incomeTypes.push('crypto_income');
        }
      }
      if (lowerAnswer.includes('foreign')) {
        client.hasForeignAccounts = true;
        if (!client.incomeTypes.includes('foreign_income')) {
          client.incomeTypes.push('foreign_income');
        }
      }
      if (lowerAnswer.includes('rental') || lowerAnswer.includes('real estate')) {
        client.hasRentalProperty = true;
      }
      break;

    case 'employment':
      // Parse employment info
      if (lowerAnswer.includes('self-employ') || lowerAnswer.includes('freelance') || lowerAnswer.includes('own business')) {
        client.hasBusinessIncome = true;
        if (!client.incomeTypes.includes('self_employment_1099nec')) {
          client.incomeTypes.push('self_employment_1099nec');
        }
      }
      break;
  }

  db.updateClient(client.id, client);
}

export function getIntakeProgress(sessionId: string): {
  currentStep: IntakeStep;
  completedSteps: IntakeStep[];
  totalSteps: number;
  percentComplete: number;
  remainingSteps: IntakeStep[];
} | null {
  const session = db.getSession(sessionId);
  if (!session) return null;

  const currentIndex = INTAKE_STEPS.indexOf(session.currentStep);
  const remainingSteps = INTAKE_STEPS.slice(currentIndex + 1);

  return {
    currentStep: session.currentStep,
    completedSteps: session.completedSteps,
    totalSteps: INTAKE_STEPS.length,
    percentComplete: Math.round((session.completedSteps.length / INTAKE_STEPS.length) * 100),
    remainingSteps,
  };
}

export function getIntakeSummary(clientId: string): string {
  const client = db.getClient(clientId);
  if (!client) return 'Client not found';

  let summary = `## Client Intake Summary\n\n`;
  summary += `**Name:** ${client.firstName} ${client.lastName}\n`;
  summary += `**Email:** ${client.email}\n`;
  summary += `**Phone:** ${client.phone}\n`;
  summary += `**Filing Status:** ${client.filingStatus.replace(/_/g, ' ')}\n\n`;

  if (client.dependents.length > 0) {
    summary += `**Dependents:** ${client.dependents.length}\n`;
    client.dependents.forEach((d) => {
      summary += `  - ${d.firstName} ${d.lastName} (${d.relationship})\n`;
    });
    summary += '\n';
  }

  if (client.incomeTypes.length > 0) {
    summary += `**Income Types:**\n`;
    client.incomeTypes.forEach((type) => {
      summary += `  - ${type.replace(/_/g, ' ')}\n`;
    });
    summary += '\n';
  }

  if (client.deductions.length > 0) {
    summary += `**Potential Deductions:**\n`;
    client.deductions.forEach((ded) => {
      summary += `  - ${ded.replace(/_/g, ' ')}\n`;
    });
    summary += '\n';
  }

  summary += `**Special Situations:**\n`;
  if (client.hasCrypto) summary += `  - Cryptocurrency transactions\n`;
  if (client.hasForeignAccounts) summary += `  - Foreign accounts/income\n`;
  if (client.hasRentalProperty) summary += `  - Rental property\n`;
  if (client.hasBusinessIncome) summary += `  - Business income\n`;

  summary += `\n**Complexity Score:** ${client.complexityScore}/100\n`;
  summary += `**Intake Completed:** ${client.intakeCompleted ? 'Yes' : 'No'}\n`;

  return summary;
}
