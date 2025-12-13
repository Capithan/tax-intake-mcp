#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListPromptsRequestSchema,
  GetPromptRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

import {
  startIntakeSession,
  processIntakeResponse,
  getIntakeProgress,
  getIntakeSummary,
} from './services/intake.js';

import {
  generateDocumentChecklist,
  getDocumentChecklist,
  markDocumentCollected,
  formatChecklistForDisplay,
  getPendingDocuments,
} from './services/checklist.js';

import {
  createDocumentReminder,
  createBatchDocumentReminder,
  getClientReminders,
  sendReminder,
  formatRemindersForDisplay,
  scheduleAppointmentReminders,
} from './services/reminders.js';

import {
  calculateComplexityScore,
  getComplexityLevel,
  findBestTaxPro,
  routeClientToTaxPro,
  createAppointment,
  getAppointmentEstimate,
  getTaxProRecommendations,
} from './services/routing.js';

import { db } from './database/index.js';

// Create the MCP server
const server = new Server(
  {
    name: 'tax-intake-mcp',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
      prompts: {},
    },
  }
);

// Define all available tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      // Intake Tools
      {
        name: 'start_intake',
        description: 'Start a new client intake session or resume an existing one. This begins the conversational intake process to collect all necessary information before the tax appointment.',
        inputSchema: {
          type: 'object',
          properties: {
            clientId: {
              type: 'string',
              description: 'Optional existing client ID to resume intake',
            },
          },
          required: [],
        },
      },
      {
        name: 'process_intake_response',
        description: 'Process a client response during the intake conversation. Send the client\'s answer to continue gathering information.',
        inputSchema: {
          type: 'object',
          properties: {
            sessionId: {
              type: 'string',
              description: 'The intake session ID',
            },
            answer: {
              type: 'string',
              description: 'The client\'s response to the current intake question',
            },
          },
          required: ['sessionId', 'answer'],
        },
      },
      {
        name: 'get_intake_progress',
        description: 'Get the current progress of an intake session, including completed steps and remaining questions.',
        inputSchema: {
          type: 'object',
          properties: {
            sessionId: {
              type: 'string',
              description: 'The intake session ID',
            },
          },
          required: ['sessionId'],
        },
      },
      {
        name: 'get_client_summary',
        description: 'Get a complete summary of a client\'s intake information, including personal details, income types, deductions, and special situations.',
        inputSchema: {
          type: 'object',
          properties: {
            clientId: {
              type: 'string',
              description: 'The client ID',
            },
          },
          required: ['clientId'],
        },
      },

      // Document Checklist Tools
      {
        name: 'generate_document_checklist',
        description: 'Generate a personalized document checklist based on the client\'s tax situation. This analyzes income types, deductions, and special situations to create a tailored list of required documents.',
        inputSchema: {
          type: 'object',
          properties: {
            clientId: {
              type: 'string',
              description: 'The client ID',
            },
          },
          required: ['clientId'],
        },
      },
      {
        name: 'get_document_checklist',
        description: 'Retrieve the current document checklist for a client, showing which documents have been collected and which are still pending.',
        inputSchema: {
          type: 'object',
          properties: {
            clientId: {
              type: 'string',
              description: 'The client ID',
            },
          },
          required: ['clientId'],
        },
      },
      {
        name: 'mark_document_collected',
        description: 'Mark a specific document as collected/received from the client.',
        inputSchema: {
          type: 'object',
          properties: {
            clientId: {
              type: 'string',
              description: 'The client ID',
            },
            documentId: {
              type: 'string',
              description: 'The document ID to mark as collected',
            },
          },
          required: ['clientId', 'documentId'],
        },
      },
      {
        name: 'get_pending_documents',
        description: 'Get a list of required documents that the client has not yet provided.',
        inputSchema: {
          type: 'object',
          properties: {
            clientId: {
              type: 'string',
              description: 'The client ID',
            },
          },
          required: ['clientId'],
        },
      },

      // Reminder Tools
      {
        name: 'create_document_reminders',
        description: 'Create personalized reminders for pending documents. Generates contextual messages like "Don\'t forget your 1099-NEC from Uber".',
        inputSchema: {
          type: 'object',
          properties: {
            clientId: {
              type: 'string',
              description: 'The client ID',
            },
            appointmentId: {
              type: 'string',
              description: 'The appointment ID to associate reminders with',
            },
          },
          required: ['clientId', 'appointmentId'],
        },
      },
      {
        name: 'get_client_reminders',
        description: 'Get all scheduled and sent reminders for a client.',
        inputSchema: {
          type: 'object',
          properties: {
            clientId: {
              type: 'string',
              description: 'The client ID',
            },
          },
          required: ['clientId'],
        },
      },
      {
        name: 'send_reminder',
        description: 'Send a specific reminder to the client via email/SMS.',
        inputSchema: {
          type: 'object',
          properties: {
            reminderId: {
              type: 'string',
              description: 'The reminder ID to send',
            },
          },
          required: ['reminderId'],
        },
      },

      // Routing Tools
      {
        name: 'calculate_complexity',
        description: 'Calculate the complexity score for a client\'s tax situation. Returns a score from 0-100 and a complexity level (simple, moderate, complex, expert).',
        inputSchema: {
          type: 'object',
          properties: {
            clientId: {
              type: 'string',
              description: 'The client ID',
            },
          },
          required: ['clientId'],
        },
      },
      {
        name: 'route_to_tax_pro',
        description: 'Automatically route a client to the best-matched tax professional based on their complexity level and required specializations.',
        inputSchema: {
          type: 'object',
          properties: {
            clientId: {
              type: 'string',
              description: 'The client ID',
            },
          },
          required: ['clientId'],
        },
      },
      {
        name: 'get_tax_pro_recommendations',
        description: 'Get recommended tax professionals for a client without automatically assigning one.',
        inputSchema: {
          type: 'object',
          properties: {
            clientId: {
              type: 'string',
              description: 'The client ID',
            },
          },
          required: ['clientId'],
        },
      },
      {
        name: 'create_appointment',
        description: 'Create an appointment for a client with a specific tax professional.',
        inputSchema: {
          type: 'object',
          properties: {
            clientId: {
              type: 'string',
              description: 'The client ID',
            },
            taxProId: {
              type: 'string',
              description: 'The tax professional ID',
            },
            scheduledAt: {
              type: 'string',
              description: 'The appointment date and time (ISO 8601 format)',
            },
            type: {
              type: 'string',
              enum: ['virtual', 'in_person'],
              description: 'The type of appointment',
            },
          },
          required: ['clientId', 'taxProId', 'scheduledAt'],
        },
      },
      {
        name: 'get_appointment_estimate',
        description: 'Get an estimate of appointment duration and time savings based on intake completion status.',
        inputSchema: {
          type: 'object',
          properties: {
            clientId: {
              type: 'string',
              description: 'The client ID',
            },
          },
          required: ['clientId'],
        },
      },

      // Utility Tools
      {
        name: 'list_tax_professionals',
        description: 'List all available tax professionals with their specializations and current availability.',
        inputSchema: {
          type: 'object',
          properties: {},
          required: [],
        },
      },
      {
        name: 'get_client',
        description: 'Get complete client profile information.',
        inputSchema: {
          type: 'object',
          properties: {
            clientId: {
              type: 'string',
              description: 'The client ID',
            },
          },
          required: ['clientId'],
        },
      },
    ],
  };
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      // Intake Tools
      case 'start_intake': {
        const result = startIntakeSession(args?.clientId as string | undefined);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                sessionId: result.session.id,
                clientId: result.client.id,
                currentStep: result.currentStep,
                nextQuestion: result.nextQuestion,
                message: 'Intake session started. Ask the client the next question.',
              }, null, 2),
            },
          ],
        };
      }

      case 'process_intake_response': {
        const result = processIntakeResponse(
          args?.sessionId as string,
          args?.answer as string
        );
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case 'get_intake_progress': {
        const progress = getIntakeProgress(args?.sessionId as string);
        return {
          content: [
            {
              type: 'text',
              text: progress
                ? JSON.stringify(progress, null, 2)
                : 'Session not found',
            },
          ],
        };
      }

      case 'get_client_summary': {
        const summary = getIntakeSummary(args?.clientId as string);
        return {
          content: [
            {
              type: 'text',
              text: summary,
            },
          ],
        };
      }

      // Document Checklist Tools
      case 'generate_document_checklist': {
        const checklist = generateDocumentChecklist(args?.clientId as string);
        const formatted = formatChecklistForDisplay(checklist);
        return {
          content: [
            {
              type: 'text',
              text: formatted,
            },
          ],
        };
      }

      case 'get_document_checklist': {
        const checklist = getDocumentChecklist(args?.clientId as string);
        if (!checklist) {
          return {
            content: [
              {
                type: 'text',
                text: 'No checklist found. Generate one first using generate_document_checklist.',
              },
            ],
          };
        }
        return {
          content: [
            {
              type: 'text',
              text: formatChecklistForDisplay(checklist),
            },
          ],
        };
      }

      case 'mark_document_collected': {
        const result = markDocumentCollected(
          args?.clientId as string,
          args?.documentId as string
        );
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case 'get_pending_documents': {
        const pending = getPendingDocuments(args?.clientId as string);
        return {
          content: [
            {
              type: 'text',
              text: pending.length > 0
                ? `Pending Documents (${pending.length}):\n\n${pending.map((d) => `- ${d.name}: ${d.description}`).join('\n')}`
                : 'All required documents have been collected! ✅',
            },
          ],
        };
      }

      // Reminder Tools
      case 'create_document_reminders': {
        const pending = getPendingDocuments(args?.clientId as string);
        if (pending.length === 0) {
          return {
            content: [
              {
                type: 'text',
                text: 'No pending documents to create reminders for.',
              },
            ],
          };
        }
        const reminders = createDocumentReminder(
          args?.clientId as string,
          args?.appointmentId as string,
          pending
        );
        return {
          content: [
            {
              type: 'text',
              text: `Created ${reminders.length} personalized reminders:\n\n${reminders.map((r) => `- ${r.message}`).join('\n\n')}`,
            },
          ],
        };
      }

      case 'get_client_reminders': {
        const reminders = getClientReminders(args?.clientId as string);
        return {
          content: [
            {
              type: 'text',
              text: formatRemindersForDisplay(reminders),
            },
          ],
        };
      }

      case 'send_reminder': {
        const result = sendReminder(args?.reminderId as string);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      // Routing Tools
      case 'calculate_complexity': {
        const client = db.getClient(args?.clientId as string);
        if (!client) {
          return {
            content: [
              {
                type: 'text',
                text: 'Client not found',
              },
            ],
          };
        }
        const score = calculateComplexityScore(client);
        const level = getComplexityLevel(score);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                clientId: client.id,
                complexityScore: score,
                complexityLevel: level,
                interpretation: getComplexityInterpretation(level),
              }, null, 2),
            },
          ],
        };
      }

      case 'route_to_tax_pro': {
        const result = routeClientToTaxPro(args?.clientId as string);
        return {
          content: [
            {
              type: 'text',
              text: result.success
                ? `✅ Client routed successfully!\n\n${result.message}`
                : `❌ Routing failed: ${result.message}`,
            },
          ],
        };
      }

      case 'get_tax_pro_recommendations': {
        const recommendations = getTaxProRecommendations(args?.clientId as string);
        return {
          content: [
            {
              type: 'text',
              text: recommendations,
            },
          ],
        };
      }

      case 'create_appointment': {
        const appointment = createAppointment(
          args?.clientId as string,
          args?.taxProId as string,
          new Date(args?.scheduledAt as string),
          (args?.type as 'virtual' | 'in_person') || 'virtual'
        );

        // Schedule reminders for the appointment
        const reminders = scheduleAppointmentReminders(appointment);

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: true,
                appointment: {
                  id: appointment.id,
                  scheduledAt: appointment.scheduledAt,
                  duration: appointment.duration,
                  type: appointment.type,
                  estimatedComplexity: appointment.estimatedComplexity,
                },
                remindersScheduled: reminders.length,
                message: `Appointment created for ${appointment.duration} minutes. ${reminders.length} reminders scheduled.`,
              }, null, 2),
            },
          ],
        };
      }

      case 'get_appointment_estimate': {
        const estimate = getAppointmentEstimate(args?.clientId as string);
        return {
          content: [
            {
              type: 'text',
              text: estimate.message,
            },
          ],
        };
      }

      // Utility Tools
      case 'list_tax_professionals': {
        const taxPros = db.getAllTaxPros();
        let output = '# Available Tax Professionals\n\n';
        taxPros.forEach((tp) => {
          const available = tp.currentLoad < tp.maxDailyAppointments;
          output += `## ${tp.name} ${available ? '🟢' : '🔴'}\n`;
          output += `- **ID:** ${tp.id}\n`;
          output += `- **Email:** ${tp.email}\n`;
          output += `- **Specializations:** ${tp.specializations.map((s) => s.replace(/_/g, ' ')).join(', ')}\n`;
          output += `- **Max Complexity:** ${tp.maxComplexity}\n`;
          output += `- **Availability:** ${tp.maxDailyAppointments - tp.currentLoad} slots remaining\n`;
          output += `- **Rating:** ${'⭐'.repeat(Math.floor(tp.rating))} (${tp.rating}/5)\n\n`;
        });
        return {
          content: [
            {
              type: 'text',
              text: output,
            },
          ],
        };
      }

      case 'get_client': {
        const client = db.getClient(args?.clientId as string);
        if (!client) {
          return {
            content: [
              {
                type: 'text',
                text: 'Client not found',
              },
            ],
          };
        }
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(client, null, 2),
            },
          ],
        };
      }

      default:
        return {
          content: [
            {
              type: 'text',
              text: `Unknown tool: ${name}`,
            },
          ],
          isError: true,
        };
    }
  } catch (error) {
    return {
      content: [
        {
          type: 'text',
          text: `Error: ${error instanceof Error ? error.message : String(error)}`,
        },
      ],
      isError: true,
    };
  }
});

// Define prompts for common workflows
server.setRequestHandler(ListPromptsRequestSchema, async () => {
  return {
    prompts: [
      {
        name: 'new_client_intake',
        description: 'Start a complete intake process for a new tax client',
        arguments: [],
      },
      {
        name: 'prepare_for_appointment',
        description: 'Help a client prepare all documents for their upcoming appointment',
        arguments: [
          {
            name: 'clientId',
            description: 'The client ID',
            required: true,
          },
        ],
      },
      {
        name: 'send_document_reminders',
        description: 'Send reminders for all pending documents',
        arguments: [
          {
            name: 'clientId',
            description: 'The client ID',
            required: true,
          },
        ],
      },
    ],
  };
});

server.setRequestHandler(GetPromptRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  switch (name) {
    case 'new_client_intake':
      return {
        messages: [
          {
            role: 'user',
            content: {
              type: 'text',
              text: `You are a friendly tax intake assistant. Start a new intake session and guide the client through the process conversationally. 

Your goals:
1. Collect all necessary personal and tax information
2. Understand their income sources (W-2, 1099, self-employment, investments, etc.)
3. Identify potential deductions
4. Uncover any special situations (crypto, foreign accounts, rental properties)
5. Generate a personalized document checklist
6. Route them to the right tax professional

Be conversational, helpful, and explain why you're asking each question. Start by introducing yourself and asking for their name.`,
            },
          },
        ],
      };

    case 'prepare_for_appointment':
      return {
        messages: [
          {
            role: 'user',
            content: {
              type: 'text',
              text: `Help the client with ID "${args?.clientId}" prepare for their tax appointment.

1. First, get their document checklist
2. Review which documents are still pending
3. Provide helpful tips on where to find each document
4. Create personalized reminders
5. Show them the estimated appointment time and any time savings from being prepared`,
            },
          },
        ],
      };

    case 'send_document_reminders':
      return {
        messages: [
          {
            role: 'user',
            content: {
              type: 'text',
              text: `Create and send personalized document reminders for client "${args?.clientId}".

1. Get the list of pending documents
2. Create personalized, contextual reminders (e.g., "Don't forget your 1099-NEC from Uber")
3. Send the reminders via the client's preferred channel`,
            },
          },
        ],
      };

    default:
      throw new Error(`Unknown prompt: ${name}`);
  }
});

function getComplexityInterpretation(level: string): string {
  switch (level) {
    case 'simple':
      return 'Standard return with W-2 income and basic deductions. Quick appointment expected.';
    case 'moderate':
      return 'Multiple income sources or itemized deductions. May require additional documentation.';
    case 'complex':
      return 'Business income, rental properties, or investments. Requires experienced tax professional.';
    case 'expert':
      return 'Advanced situations like foreign accounts, crypto, or audit representation. Requires specialist.';
    default:
      return 'Unknown complexity level';
  }
}

// Start the server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Tax Intake MCP Server running on stdio');
}

main().catch(console.error);
