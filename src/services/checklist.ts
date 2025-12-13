import {
  ClientProfile,
  DocumentChecklist,
  DocumentItem,
  DocumentCategory,
  IncomeType,
  DeductionType,
} from '../types/index.js';
import { db } from '../database/index.js';

// Document templates based on income and deduction types
const DOCUMENT_TEMPLATES: Record<string, Omit<DocumentItem, 'id' | 'collected' | 'reminderSent'>> = {
  // Identity documents
  id_primary: {
    name: 'Government-issued Photo ID',
    description: 'Valid driver\'s license, state ID, or passport',
    category: 'identity',
    required: true,
  },
  id_ssn_card: {
    name: 'Social Security Card',
    description: 'SSN card for yourself and all dependents',
    category: 'identity',
    required: true,
  },
  id_prior_return: {
    name: 'Prior Year Tax Return',
    description: 'Complete copy of last year\'s federal and state tax returns',
    category: 'identity',
    required: false,
  },

  // W-2 Income
  income_w2: {
    name: 'W-2 Forms',
    description: 'W-2 from each employer showing wages and withholdings',
    category: 'income',
    required: true,
  },

  // 1099 Income
  income_1099nec: {
    name: '1099-NEC Forms',
    description: 'Non-employee compensation from clients/companies (Uber, freelance work, etc.)',
    category: 'income',
    required: true,
  },
  income_1099misc: {
    name: '1099-MISC Forms',
    description: 'Miscellaneous income including royalties, prizes, awards',
    category: 'income',
    required: true,
  },
  income_1099k: {
    name: '1099-K Forms',
    description: 'Payment card and third-party network transactions (PayPal, Venmo, etc.)',
    category: 'income',
    required: true,
  },

  // Investment Income
  income_1099div: {
    name: '1099-DIV Forms',
    description: 'Dividend income from investments',
    category: 'investments',
    required: true,
  },
  income_1099int: {
    name: '1099-INT Forms',
    description: 'Interest income from banks and investments',
    category: 'investments',
    required: true,
  },
  income_1099b: {
    name: '1099-B Forms',
    description: 'Proceeds from broker and barter exchange transactions',
    category: 'investments',
    required: true,
  },

  // Retirement Income
  income_1099r: {
    name: '1099-R Forms',
    description: 'Distributions from pensions, annuities, retirement plans, IRAs',
    category: 'income',
    required: true,
  },
  income_ssa1099: {
    name: 'SSA-1099',
    description: 'Social Security benefit statement',
    category: 'income',
    required: true,
  },

  // Unemployment
  income_1099g: {
    name: '1099-G Forms',
    description: 'Unemployment compensation and state tax refunds',
    category: 'income',
    required: true,
  },

  // Crypto
  income_crypto: {
    name: 'Cryptocurrency Transaction Records',
    description: 'Complete transaction history from all crypto exchanges (Coinbase, Binance, etc.)',
    category: 'investments',
    required: true,
  },
  income_crypto_1099: {
    name: 'Crypto 1099 Forms',
    description: '1099-MISC or 1099-B from cryptocurrency exchanges',
    category: 'investments',
    required: false,
  },

  // Rental Property
  income_rental: {
    name: 'Rental Income Records',
    description: 'Annual rental income summary for each property',
    category: 'property',
    required: true,
  },
  expense_rental: {
    name: 'Rental Expense Records',
    description: 'Receipts for repairs, maintenance, property management, insurance',
    category: 'property',
    required: true,
  },
  doc_1098_rental: {
    name: '1098 Mortgage Interest (Rental)',
    description: 'Mortgage interest statement for rental properties',
    category: 'property',
    required: true,
  },

  // Foreign Income
  income_foreign: {
    name: 'Foreign Income Documentation',
    description: 'Income statements from foreign employers or sources',
    category: 'income',
    required: true,
  },
  doc_fbar: {
    name: 'Foreign Bank Account Records',
    description: 'Statements showing highest balances for all foreign accounts (FBAR requirement)',
    category: 'other',
    required: true,
  },

  // Business Income
  income_business: {
    name: 'Business Income Records',
    description: 'Profit & Loss statement or income summary for your business',
    category: 'business',
    required: true,
  },
  expense_business: {
    name: 'Business Expense Records',
    description: 'Receipts and records for all business expenses',
    category: 'business',
    required: true,
  },
  doc_business_assets: {
    name: 'Business Asset Records',
    description: 'Records of equipment, vehicles, and other assets purchased for business',
    category: 'business',
    required: false,
  },

  // Deductions - Mortgage
  ded_1098: {
    name: '1098 Mortgage Interest Statement',
    description: 'Shows mortgage interest paid during the year',
    category: 'property',
    required: true,
  },
  ded_property_tax: {
    name: 'Property Tax Statements',
    description: 'Annual property tax bills or statements',
    category: 'property',
    required: true,
  },

  // Deductions - Charitable
  ded_charity_cash: {
    name: 'Charitable Donation Receipts',
    description: 'Receipts for cash donations to qualified charities',
    category: 'expenses',
    required: true,
  },
  ded_charity_noncash: {
    name: 'Non-Cash Donation Records',
    description: 'Receipts and fair market value for donated items',
    category: 'expenses',
    required: false,
  },

  // Deductions - Student Loans
  ded_1098e: {
    name: '1098-E Student Loan Interest',
    description: 'Statement showing student loan interest paid',
    category: 'education',
    required: true,
  },

  // Deductions - Education
  ded_1098t: {
    name: '1098-T Tuition Statement',
    description: 'Statement of tuition paid for higher education',
    category: 'education',
    required: true,
  },

  // Deductions - Retirement
  ded_401k: {
    name: '401(k) Contribution Records',
    description: 'Year-end statement showing 401(k) contributions (usually on W-2)',
    category: 'other',
    required: false,
  },
  ded_ira: {
    name: 'IRA Contribution Records',
    description: 'Form 5498 or statements showing IRA contributions',
    category: 'other',
    required: true,
  },

  // Deductions - HSA
  ded_hsa: {
    name: 'HSA Contribution Records',
    description: 'Form 5498-SA or statements showing HSA contributions',
    category: 'healthcare',
    required: true,
  },
  ded_1099sa: {
    name: '1099-SA HSA Distributions',
    description: 'Statement of HSA distributions',
    category: 'healthcare',
    required: true,
  },

  // Deductions - Medical
  ded_medical: {
    name: 'Medical Expense Records',
    description: 'Receipts for out-of-pocket medical expenses',
    category: 'healthcare',
    required: false,
  },

  // Deductions - Childcare
  ded_childcare: {
    name: 'Childcare Provider Information',
    description: 'Provider name, address, tax ID, and amount paid',
    category: 'expenses',
    required: true,
  },

  // Healthcare
  hc_1095a: {
    name: '1095-A Health Insurance Marketplace',
    description: 'Statement from Healthcare.gov if you had marketplace insurance',
    category: 'healthcare',
    required: true,
  },
  hc_1095b: {
    name: '1095-B Health Coverage',
    description: 'Statement from health insurance provider',
    category: 'healthcare',
    required: false,
  },

  // Home Office
  ded_home_office: {
    name: 'Home Office Records',
    description: 'Square footage of home and office, home expenses (utilities, rent/mortgage, etc.)',
    category: 'business',
    required: true,
  },

  // Gig Economy Specifics
  gig_uber: {
    name: '1099-NEC from Uber',
    description: 'Non-employee compensation from Uber',
    category: 'income',
    required: true,
    source: 'Uber',
  },
  gig_lyft: {
    name: '1099-NEC from Lyft',
    description: 'Non-employee compensation from Lyft',
    category: 'income',
    required: true,
    source: 'Lyft',
  },
  gig_doordash: {
    name: '1099-NEC from DoorDash',
    description: 'Non-employee compensation from DoorDash',
    category: 'income',
    required: true,
    source: 'DoorDash',
  },
  gig_mileage: {
    name: 'Mileage Log',
    description: 'Record of business miles driven for gig work',
    category: 'business',
    required: true,
  },
};

// Mapping from income/deduction types to required documents
const INCOME_TO_DOCUMENTS: Record<IncomeType, string[]> = {
  wages_w2: ['income_w2'],
  self_employment_1099nec: ['income_1099nec', 'income_1099k', 'expense_business'],
  freelance_1099misc: ['income_1099misc', 'income_1099nec', 'expense_business'],
  gig_economy: ['income_1099nec', 'income_1099k', 'gig_mileage'],
  rental_income: ['income_rental', 'expense_rental', 'doc_1098_rental'],
  investment_income: ['income_1099b', 'income_1099int'],
  dividends: ['income_1099div'],
  capital_gains: ['income_1099b'],
  retirement_distributions: ['income_1099r'],
  social_security: ['income_ssa1099'],
  unemployment: ['income_1099g'],
  alimony_received: [],
  gambling_winnings: [],
  crypto_income: ['income_crypto', 'income_crypto_1099'],
  foreign_income: ['income_foreign', 'doc_fbar'],
  other: [],
};

const DEDUCTION_TO_DOCUMENTS: Record<DeductionType, string[]> = {
  mortgage_interest: ['ded_1098'],
  property_taxes: ['ded_property_tax'],
  state_local_taxes: [],
  charitable_donations: ['ded_charity_cash', 'ded_charity_noncash'],
  medical_expenses: ['ded_medical'],
  student_loan_interest: ['ded_1098e'],
  educator_expenses: [],
  home_office: ['ded_home_office'],
  business_expenses: ['expense_business', 'doc_business_assets'],
  hsa_contributions: ['ded_hsa', 'ded_1099sa'],
  ira_contributions: ['ded_ira'],
  '401k_contributions': ['ded_401k'],
  childcare_expenses: ['ded_childcare'],
  alimony_paid: [],
  moving_expenses: [],
  none: [],
};

function generateDocumentId(): string {
  return `doc-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

export function generateDocumentChecklist(clientId: string): DocumentChecklist {
  const client = db.getClient(clientId);
  if (!client) {
    throw new Error('Client not found');
  }

  const documentSet = new Set<string>();
  const documents: DocumentItem[] = [];

  // Always include identity documents
  ['id_primary', 'id_ssn_card', 'id_prior_return'].forEach((docKey) => {
    documentSet.add(docKey);
  });

  // Add documents based on income types
  client.incomeTypes.forEach((incomeType) => {
    const docKeys = INCOME_TO_DOCUMENTS[incomeType] || [];
    docKeys.forEach((key) => documentSet.add(key));
  });

  // Add documents based on deductions
  client.deductions.forEach((deductionType) => {
    const docKeys = DEDUCTION_TO_DOCUMENTS[deductionType] || [];
    docKeys.forEach((key) => documentSet.add(key));
  });

  // Add special situation documents
  if (client.hasCrypto) {
    documentSet.add('income_crypto');
    documentSet.add('income_crypto_1099');
  }

  if (client.hasForeignAccounts) {
    documentSet.add('income_foreign');
    documentSet.add('doc_fbar');
  }

  if (client.hasRentalProperty) {
    documentSet.add('income_rental');
    documentSet.add('expense_rental');
    documentSet.add('doc_1098_rental');
  }

  if (client.hasBusinessIncome) {
    documentSet.add('income_business');
    documentSet.add('expense_business');
    documentSet.add('doc_business_assets');
    documentSet.add('ded_home_office');
  }

  if (client.hasHealthInsurance) {
    documentSet.add('hc_1095a');
    documentSet.add('hc_1095b');
  }

  // Convert to DocumentItem array
  documentSet.forEach((docKey) => {
    const template = DOCUMENT_TEMPLATES[docKey];
    if (template) {
      documents.push({
        id: generateDocumentId(),
        ...template,
        collected: client.documentsCollected.includes(docKey),
        reminderSent: false,
      });
    }
  });

  // Sort by category and required status
  documents.sort((a, b) => {
    if (a.required !== b.required) return a.required ? -1 : 1;
    return a.category.localeCompare(b.category);
  });

  const checklist: DocumentChecklist = {
    clientId,
    documents,
    generatedAt: new Date(),
    lastUpdated: new Date(),
  };

  // Update client with pending documents
  client.documentsPending = documents
    .filter((d) => !d.collected && d.required)
    .map((d) => d.id);
  db.updateClient(clientId, { documentsPending: client.documentsPending });

  // Save checklist
  db.saveChecklist(checklist);

  return checklist;
}

export function getDocumentChecklist(clientId: string): DocumentChecklist | null {
  return db.getChecklist(clientId) || null;
}

export function markDocumentCollected(
  clientId: string,
  documentId: string
): { success: boolean; message: string } {
  const checklist = db.getChecklist(clientId);
  if (!checklist) {
    return { success: false, message: 'Checklist not found' };
  }

  const document = checklist.documents.find((d) => d.id === documentId);
  if (!document) {
    return { success: false, message: 'Document not found in checklist' };
  }

  db.updateChecklistItem(clientId, documentId, { collected: true });

  // Update client's collected documents
  const client = db.getClient(clientId);
  if (client) {
    if (!client.documentsCollected.includes(documentId)) {
      client.documentsCollected.push(documentId);
    }
    client.documentsPending = client.documentsPending.filter((id) => id !== documentId);
    db.updateClient(clientId, {
      documentsCollected: client.documentsCollected,
      documentsPending: client.documentsPending,
    });
  }

  return { success: true, message: `Marked "${document.name}" as collected` };
}

export function formatChecklistForDisplay(checklist: DocumentChecklist): string {
  let output = `# Document Checklist\n\n`;
  output += `Generated: ${checklist.generatedAt.toLocaleDateString()}\n\n`;

  const categories = [...new Set(checklist.documents.map((d) => d.category))];

  categories.forEach((category) => {
    const categoryDocs = checklist.documents.filter((d) => d.category === category);
    output += `## ${formatCategory(category)}\n\n`;

    categoryDocs.forEach((doc) => {
      const status = doc.collected ? '✅' : doc.required ? '⬜ **Required**' : '⬜ Optional';
      output += `${status} **${doc.name}**\n`;
      output += `   ${doc.description}\n`;
      if (doc.source) {
        output += `   📍 Source: ${doc.source}\n`;
      }
      output += '\n';
    });
  });

  const required = checklist.documents.filter((d) => d.required);
  const collected = checklist.documents.filter((d) => d.collected);
  const pending = required.filter((d) => !d.collected);

  output += `---\n`;
  output += `**Progress:** ${collected.length}/${required.length} required documents collected\n`;
  output += `**Pending:** ${pending.length} required documents remaining\n`;

  return output;
}

function formatCategory(category: DocumentCategory): string {
  const categoryNames: Record<DocumentCategory, string> = {
    identity: '📋 Identity Documents',
    income: '💰 Income Documents',
    expenses: '💳 Expense Records',
    investments: '📈 Investment Documents',
    property: '🏠 Property Documents',
    business: '💼 Business Documents',
    healthcare: '🏥 Healthcare Documents',
    education: '🎓 Education Documents',
    other: '📁 Other Documents',
  };
  return categoryNames[category] || category;
}

export function getPendingDocuments(clientId: string): DocumentItem[] {
  const checklist = db.getChecklist(clientId);
  if (!checklist) return [];

  return checklist.documents.filter((d) => !d.collected && d.required);
}

export function getGigEconomyDocuments(employers: string[]): DocumentItem[] {
  const documents: DocumentItem[] = [];
  const normalizedEmployers = employers.map((e) => e.toLowerCase());

  if (normalizedEmployers.some((e) => e.includes('uber'))) {
    const template = DOCUMENT_TEMPLATES['gig_uber'];
    documents.push({
      id: generateDocumentId(),
      ...template,
      collected: false,
      reminderSent: false,
    });
  }

  if (normalizedEmployers.some((e) => e.includes('lyft'))) {
    const template = DOCUMENT_TEMPLATES['gig_lyft'];
    documents.push({
      id: generateDocumentId(),
      ...template,
      collected: false,
      reminderSent: false,
    });
  }

  if (normalizedEmployers.some((e) => e.includes('doordash'))) {
    const template = DOCUMENT_TEMPLATES['gig_doordash'];
    documents.push({
      id: generateDocumentId(),
      ...template,
      collected: false,
      reminderSent: false,
    });
  }

  // Always add mileage log for gig workers
  if (documents.length > 0) {
    const mileageTemplate = DOCUMENT_TEMPLATES['gig_mileage'];
    documents.push({
      id: generateDocumentId(),
      ...mileageTemplate,
      collected: false,
      reminderSent: false,
    });
  }

  return documents;
}
