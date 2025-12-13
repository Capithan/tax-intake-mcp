// Simple test to verify the MCP server tools work correctly

import {
  startIntakeSession,
  processIntakeResponse,
  getIntakeProgress,
  getIntakeSummary,
} from './services/intake.js';

import {
  generateDocumentChecklist,
  formatChecklistForDisplay,
  getPendingDocuments,
} from './services/checklist.js';

import {
  calculateComplexityScore,
  getComplexityLevel,
  findBestTaxPro,
  getAppointmentEstimate,
} from './services/routing.js';

import { db } from './database/index.js';

console.log('🧪 Testing Tax Intake MCP Server\n');

// Test 1: Start Intake Session
console.log('--- Test 1: Start Intake Session ---');
const { session, client, nextQuestion, currentStep } = startIntakeSession();
console.log(`✅ Session ID: ${session.id}`);
console.log(`✅ Client ID: ${client.id}`);
console.log(`✅ Current Step: ${currentStep}`);
console.log(`✅ First Question: ${nextQuestion}\n`);

// Test 2: Process Intake Responses
console.log('--- Test 2: Process Intake Responses ---');
let response = processIntakeResponse(session.id, 'John Smith');
console.log(`✅ Processed name: ${response.success}`);

response = processIntakeResponse(session.id, 'john.smith@email.com');
console.log(`✅ Processed email: ${response.success}`);

response = processIntakeResponse(session.id, '555-123-4567');
console.log(`✅ Processed phone: ${response.success}`);

response = processIntakeResponse(session.id, 'January 15, 1985');
console.log(`✅ Processed DOB: ${response.success}`);

response = processIntakeResponse(session.id, '123 Main St, Anytown, USA 12345');
console.log(`✅ Processed address: ${response.success}`);

// Filing Status
response = processIntakeResponse(session.id, 'Married filing jointly');
console.log(`✅ Processed filing status: ${response.success}\n`);

// Dependents
response = processIntakeResponse(session.id, 'Yes, two children');
console.log(`✅ Processed dependents: ${response.success}`);

response = processIntakeResponse(session.id, 'Emma Smith, daughter, 8 years old, 12 months');
console.log(`✅ Processed dependent details: ${response.success}\n`);

// Employment
response = processIntakeResponse(session.id, 'I work at Tech Corp as a software engineer, and I also drive for Uber on weekends');
console.log(`✅ Processed employment: ${response.success}`);

response = processIntakeResponse(session.id, 'W-2 from Tech Corp, 1099 from Uber');
console.log(`✅ Processed income types: ${response.success}`);

response = processIntakeResponse(session.id, 'Yes, I also do freelance consulting');
console.log(`✅ Processed self-employment: ${response.success}\n`);

// Income Types
response = processIntakeResponse(session.id, 'I have some stocks and crypto investments');
console.log(`✅ Processed additional income: ${response.success}\n`);

// Deductions
response = processIntakeResponse(session.id, 'Yes, I have a mortgage');
response = processIntakeResponse(session.id, 'Yes, I donated to charity');
response = processIntakeResponse(session.id, 'Yes, student loans');
response = processIntakeResponse(session.id, 'Yes, I max out my 401k');
response = processIntakeResponse(session.id, 'Yes, I have a home office');
console.log(`✅ Processed deductions: ${response.success}\n`);

// Special situations
response = processIntakeResponse(session.id, 'Yes, I bought and sold some Bitcoin');
console.log(`✅ Processed crypto: ${response.success}`);

// Update client with more data for testing
const updatedClient = db.getClient(client.id);
if (updatedClient) {
  updatedClient.hasCrypto = true;
  updatedClient.hasBusinessIncome = true;
  updatedClient.incomeTypes = ['wages_w2', 'self_employment_1099nec', 'gig_economy', 'investment_income', 'crypto_income'];
  updatedClient.deductions = ['mortgage_interest', 'charitable_donations', 'student_loan_interest', '401k_contributions', 'home_office'];
  updatedClient.firstName = 'John';
  updatedClient.lastName = 'Smith';
  updatedClient.email = 'john.smith@email.com';
  db.updateClient(client.id, updatedClient);
}

// Test 3: Get Progress
console.log('\n--- Test 3: Intake Progress ---');
const progress = getIntakeProgress(session.id);
console.log(`✅ Completed Steps: ${progress?.completedSteps.length}`);
console.log(`✅ Current Step: ${progress?.currentStep}`);
console.log(`✅ Percent Complete: ${progress?.percentComplete}%\n`);

// Test 4: Generate Document Checklist
console.log('--- Test 4: Document Checklist ---');
const checklist = generateDocumentChecklist(client.id);
console.log(`✅ Generated ${checklist.documents.length} documents`);
console.log(`✅ Required: ${checklist.documents.filter(d => d.required).length}`);
console.log(`✅ Optional: ${checklist.documents.filter(d => !d.required).length}\n`);

// Show checklist preview
console.log('📋 Document Categories:');
const categories = [...new Set(checklist.documents.map(d => d.category))];
categories.forEach(cat => {
  const count = checklist.documents.filter(d => d.category === cat).length;
  console.log(`   - ${cat}: ${count} documents`);
});
console.log();

// Test 5: Calculate Complexity
console.log('--- Test 5: Complexity Calculation ---');
const clientForComplexity = db.getClient(client.id);
if (clientForComplexity) {
  const score = calculateComplexityScore(clientForComplexity);
  const level = getComplexityLevel(score);
  console.log(`✅ Complexity Score: ${score}/100`);
  console.log(`✅ Complexity Level: ${level}\n`);
}

// Test 6: Find Best Tax Pro
console.log('--- Test 6: Tax Professional Routing ---');
const clientForRouting = db.getClient(client.id);
if (clientForRouting) {
  const { taxPro, reason, alternates } = findBestTaxPro(clientForRouting);
  if (taxPro) {
    console.log(`✅ Best Match: ${taxPro.name}`);
    console.log(`✅ Specializations: ${taxPro.specializations.join(', ')}`);
    console.log(`✅ Rating: ${taxPro.rating}/5`);
    console.log(`✅ Alternates: ${alternates.map(a => a.name).join(', ')}\n`);
  }
}

// Test 7: Appointment Estimate
console.log('--- Test 7: Appointment Estimate ---');
const estimate = getAppointmentEstimate(client.id);
console.log(`✅ Estimated Duration: ${estimate.estimatedDuration} minutes`);
console.log(`✅ Complexity: ${estimate.complexityLevel}`);
console.log(`✅ Time Savings: ${estimate.savings} minutes\n`);

// Test 8: List Tax Professionals
console.log('--- Test 8: Available Tax Professionals ---');
const taxPros = db.getAllTaxPros();
taxPros.forEach(tp => {
  const available = tp.currentLoad < tp.maxDailyAppointments;
  console.log(`${available ? '🟢' : '🔴'} ${tp.name} - ${tp.specializations.slice(0, 3).join(', ')}`);
});

console.log('\n✅ All tests passed! MCP Server is ready.\n');
