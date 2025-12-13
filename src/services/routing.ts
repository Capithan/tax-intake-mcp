import {
  ClientProfile,
  TaxProfessional,
  ComplexityLevel,
  Specialization,
  Appointment,
} from '../types/index.js';
import { db } from '../database/index.js';

// Complexity scoring weights
const COMPLEXITY_WEIGHTS = {
  // Filing status complexity
  filingStatus: {
    single: 0,
    married_filing_jointly: 5,
    married_filing_separately: 15,
    head_of_household: 10,
    qualifying_widow: 10,
  },

  // Income type complexity
  incomeTypes: {
    wages_w2: 0,
    self_employment_1099nec: 20,
    freelance_1099misc: 15,
    gig_economy: 15,
    rental_income: 25,
    investment_income: 10,
    dividends: 5,
    capital_gains: 15,
    retirement_distributions: 5,
    social_security: 5,
    unemployment: 5,
    alimony_received: 10,
    gambling_winnings: 10,
    crypto_income: 30,
    foreign_income: 35,
    other: 10,
  },

  // Deduction complexity
  deductions: {
    mortgage_interest: 5,
    property_taxes: 5,
    state_local_taxes: 5,
    charitable_donations: 5,
    medical_expenses: 10,
    student_loan_interest: 0,
    educator_expenses: 0,
    home_office: 15,
    business_expenses: 20,
    hsa_contributions: 5,
    ira_contributions: 5,
    '401k_contributions': 0,
    childcare_expenses: 5,
    alimony_paid: 10,
    moving_expenses: 10,
    none: 0,
  },

  // Special situations
  specialSituations: {
    crypto: 25,
    foreignAccounts: 30,
    rentalProperty: 20,
    businessIncome: 20,
  },

  // Dependents
  dependentsBase: 5, // per dependent
  dependentsMax: 20,
};

// Complexity thresholds
const COMPLEXITY_THRESHOLDS: Record<ComplexityLevel, { min: number; max: number }> = {
  simple: { min: 0, max: 20 },
  moderate: { min: 21, max: 50 },
  complex: { min: 51, max: 80 },
  expert: { min: 81, max: 200 },
};

export function calculateComplexityScore(client: ClientProfile): number {
  let score = 0;

  // Filing status
  score += COMPLEXITY_WEIGHTS.filingStatus[client.filingStatus] || 0;

  // Income types
  client.incomeTypes.forEach((type) => {
    score += COMPLEXITY_WEIGHTS.incomeTypes[type] || 0;
  });

  // Deductions
  client.deductions.forEach((ded) => {
    score += COMPLEXITY_WEIGHTS.deductions[ded] || 0;
  });

  // Special situations
  if (client.hasCrypto) score += COMPLEXITY_WEIGHTS.specialSituations.crypto;
  if (client.hasForeignAccounts) score += COMPLEXITY_WEIGHTS.specialSituations.foreignAccounts;
  if (client.hasRentalProperty) score += COMPLEXITY_WEIGHTS.specialSituations.rentalProperty;
  if (client.hasBusinessIncome) score += COMPLEXITY_WEIGHTS.specialSituations.businessIncome;

  // Dependents
  const dependentScore = Math.min(
    client.dependents.length * COMPLEXITY_WEIGHTS.dependentsBase,
    COMPLEXITY_WEIGHTS.dependentsMax
  );
  score += dependentScore;

  // Cap the score at 100
  return Math.min(score, 100);
}

export function getComplexityLevel(score: number): ComplexityLevel {
  if (score <= COMPLEXITY_THRESHOLDS.simple.max) return 'simple';
  if (score <= COMPLEXITY_THRESHOLDS.moderate.max) return 'moderate';
  if (score <= COMPLEXITY_THRESHOLDS.complex.max) return 'complex';
  return 'expert';
}

export function getRequiredSpecializations(client: ClientProfile): Specialization[] {
  const specs: Set<Specialization> = new Set();

  // Base specialization
  specs.add('individual');

  // Self-employment / Business
  if (
    client.hasBusinessIncome ||
    client.incomeTypes.includes('self_employment_1099nec') ||
    client.incomeTypes.includes('freelance_1099misc') ||
    client.incomeTypes.includes('gig_economy')
  ) {
    specs.add('self_employment');
    if (client.hasBusinessIncome) {
      specs.add('small_business');
    }
  }

  // Investments
  if (
    client.incomeTypes.includes('investment_income') ||
    client.incomeTypes.includes('dividends') ||
    client.incomeTypes.includes('capital_gains')
  ) {
    specs.add('investments');
  }

  // Real Estate
  if (client.hasRentalProperty || client.incomeTypes.includes('rental_income')) {
    specs.add('real_estate');
  }

  // Crypto
  if (client.hasCrypto || client.incomeTypes.includes('crypto_income')) {
    specs.add('crypto');
  }

  // Foreign
  if (client.hasForeignAccounts || client.incomeTypes.includes('foreign_income')) {
    specs.add('foreign_income');
  }

  return Array.from(specs);
}

export function findBestTaxPro(client: ClientProfile): {
  taxPro: TaxProfessional | null;
  reason: string;
  alternates: TaxProfessional[];
} {
  // Calculate complexity
  const complexityScore = calculateComplexityScore(client);
  const complexityLevel = getComplexityLevel(complexityScore);
  const requiredSpecs = getRequiredSpecializations(client);

  // Update client's complexity score
  db.updateClient(client.id, { complexityScore });

  // Get available tax pros
  const availablePros = db.getAvailableTaxPros();

  if (availablePros.length === 0) {
    return {
      taxPro: null,
      reason: 'No tax professionals are currently available. Please try again later.',
      alternates: [],
    };
  }

  // Score each tax pro
  const scoredPros = availablePros.map((pro) => {
    let score = 0;
    let reasons: string[] = [];

    // Can handle complexity?
    const proComplexityOrder: ComplexityLevel[] = ['simple', 'moderate', 'complex', 'expert'];
    const proMaxIndex = proComplexityOrder.indexOf(pro.maxComplexity);
    const requiredIndex = proComplexityOrder.indexOf(complexityLevel);

    if (proMaxIndex < requiredIndex) {
      score -= 100; // Can't handle this complexity
      reasons.push('Cannot handle complexity level');
    } else {
      score += 20;
      reasons.push('Can handle complexity');
    }

    // Specialization match
    const matchingSpecs = requiredSpecs.filter((spec) => pro.specializations.includes(spec));
    const specMatchScore = (matchingSpecs.length / requiredSpecs.length) * 50;
    score += specMatchScore;

    if (matchingSpecs.length === requiredSpecs.length) {
      reasons.push('Full specialization match');
    } else if (matchingSpecs.length > 0) {
      reasons.push(`Partial specialization match (${matchingSpecs.length}/${requiredSpecs.length})`);
    }

    // Availability (prefer less loaded pros)
    const loadScore = ((pro.maxDailyAppointments - pro.currentLoad) / pro.maxDailyAppointments) * 20;
    score += loadScore;

    // Rating bonus
    score += pro.rating * 2;

    return {
      pro,
      score,
      reasons,
    };
  });

  // Sort by score
  scoredPros.sort((a, b) => b.score - a.score);

  const best = scoredPros[0];
  const alternates = scoredPros.slice(1, 3).map((s) => s.pro);

  if (best.score < 0) {
    return {
      taxPro: null,
      reason: `No tax professional available can handle your case (Complexity: ${complexityLevel}, Specializations needed: ${requiredSpecs.join(', ')})`,
      alternates: [],
    };
  }

  const reasonText = formatRoutingReason(client, best.pro, complexityLevel, requiredSpecs);

  return {
    taxPro: best.pro,
    reason: reasonText,
    alternates,
  };
}

function formatRoutingReason(
  client: ClientProfile,
  taxPro: TaxProfessional,
  complexity: ComplexityLevel,
  requiredSpecs: Specialization[]
): string {
  let reason = `Based on your tax situation:\n\n`;
  reason += `📊 **Complexity Level:** ${complexity.charAt(0).toUpperCase() + complexity.slice(1)}\n`;
  reason += `🎯 **Specializations Needed:** ${requiredSpecs.map((s) => s.replace(/_/g, ' ')).join(', ')}\n\n`;
  reason += `We've matched you with **${taxPro.name}** because:\n`;
  reason += `- Expertise in: ${taxPro.specializations.map((s) => s.replace(/_/g, ' ')).join(', ')}\n`;
  reason += `- Can handle ${taxPro.maxComplexity} complexity cases\n`;
  reason += `- Rating: ${'⭐'.repeat(Math.floor(taxPro.rating))} (${taxPro.rating}/5)\n`;
  reason += `- Currently has availability\n`;

  return reason;
}

export function routeClientToTaxPro(clientId: string): {
  success: boolean;
  taxPro?: TaxProfessional;
  message: string;
  alternates?: TaxProfessional[];
} {
  const client = db.getClient(clientId);
  if (!client) {
    return { success: false, message: 'Client not found' };
  }

  const { taxPro, reason, alternates } = findBestTaxPro(client);

  if (!taxPro) {
    return { success: false, message: reason, alternates };
  }

  // Update client with assigned tax pro
  db.updateClient(clientId, { assignedTaxPro: taxPro.id });

  // Update tax pro's load
  db.updateTaxProLoad(taxPro.id, 1);

  return {
    success: true,
    taxPro,
    message: reason,
    alternates,
  };
}

function generateAppointmentId(): string {
  return `apt-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

export function createAppointment(
  clientId: string,
  taxProId: string,
  scheduledAt: Date,
  type: 'virtual' | 'in_person' = 'virtual'
): Appointment {
  const client = db.getClient(clientId);
  if (!client) {
    throw new Error('Client not found');
  }

  const complexityLevel = getComplexityLevel(client.complexityScore);

  // Determine duration based on complexity and intake completion
  let duration: number;
  if (client.intakeCompleted) {
    // Reduced time for completed intake
    switch (complexityLevel) {
      case 'simple':
        duration = 15;
        break;
      case 'moderate':
        duration = 20;
        break;
      case 'complex':
        duration = 30;
        break;
      case 'expert':
        duration = 45;
        break;
    }
  } else {
    // Standard time without intake
    switch (complexityLevel) {
      case 'simple':
        duration = 30;
        break;
      case 'moderate':
        duration = 45;
        break;
      case 'complex':
        duration = 60;
        break;
      case 'expert':
        duration = 90;
        break;
    }
  }

  const appointment: Appointment = {
    id: generateAppointmentId(),
    clientId,
    taxProId,
    scheduledAt,
    duration,
    status: 'scheduled',
    type,
    intakeScore: client.intakeCompleted ? 100 : 0,
    estimatedComplexity: complexityLevel,
  };

  db.createAppointment(appointment);
  db.updateClient(clientId, { appointmentId: appointment.id });

  return appointment;
}

export function getAppointmentEstimate(clientId: string): {
  estimatedDuration: number;
  savings: number;
  complexityLevel: ComplexityLevel;
  message: string;
} {
  const client = db.getClient(clientId);
  if (!client) {
    throw new Error('Client not found');
  }

  const complexityLevel = getComplexityLevel(client.complexityScore);

  // Calculate time savings
  const standardDurations: Record<ComplexityLevel, number> = {
    simple: 30,
    moderate: 45,
    complex: 60,
    expert: 90,
  };

  const optimizedDurations: Record<ComplexityLevel, number> = {
    simple: 15,
    moderate: 20,
    complex: 30,
    expert: 45,
  };

  const standardTime = standardDurations[complexityLevel];
  const optimizedTime = optimizedDurations[complexityLevel];
  const savings = standardTime - optimizedTime;

  let message = `## Appointment Time Estimate\n\n`;
  message += `📊 **Your Tax Complexity:** ${complexityLevel.charAt(0).toUpperCase() + complexityLevel.slice(1)}\n\n`;

  if (client.intakeCompleted) {
    message += `✅ **Intake Status:** Complete\n\n`;
    message += `⏱️ **Estimated Appointment Time:** ${optimizedTime} minutes\n`;
    message += `💪 **Time Saved:** ${savings} minutes (compared to ${standardTime} min without pre-intake)\n\n`;
    message += `Thanks to completing your intake and gathering documents ahead of time, we can focus on what matters during your appointment!`;
  } else {
    message += `⚠️ **Intake Status:** Incomplete\n\n`;
    message += `⏱️ **Current Estimated Time:** ${standardTime} minutes\n`;
    message += `💡 **Complete your intake to reduce to:** ${optimizedTime} minutes\n`;
    message += `📈 **Potential Time Savings:** ${savings} minutes\n`;
  }

  return {
    estimatedDuration: client.intakeCompleted ? optimizedTime : standardTime,
    savings: client.intakeCompleted ? savings : 0,
    complexityLevel,
    message,
  };
}

export function getTaxProRecommendations(clientId: string): string {
  const client = db.getClient(clientId);
  if (!client) {
    return 'Client not found';
  }

  const { taxPro, reason, alternates } = findBestTaxPro(client);

  let output = `# Tax Professional Recommendations\n\n`;
  output += reason + '\n\n';

  if (alternates.length > 0) {
    output += `## Alternative Options\n\n`;
    alternates.forEach((alt, index) => {
      output += `${index + 1}. **${alt.name}**\n`;
      output += `   - Specialties: ${alt.specializations.map((s) => s.replace(/_/g, ' ')).join(', ')}\n`;
      output += `   - Rating: ${'⭐'.repeat(Math.floor(alt.rating))} (${alt.rating}/5)\n\n`;
    });
  }

  return output;
}
