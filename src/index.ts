#!/usr/bin/env node
/**
 * Simple MCP Server for Camunda Platform REST API
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  InitializeRequestSchema,
  type Tool,
  type InitializeRequest
} from '@modelcontextprotocol/sdk/types.js';
import axios from 'axios';
import FormData from 'form-data';
import { promises as fs } from 'fs';
import path from 'path';

/**
 * Server configuration interface
 */
interface CamundaConfig {
  baseUrl: string;
  username?: string;
  password?: string;
}

/**
 * Global configuration
 */
const config: CamundaConfig = {
  baseUrl: process.env.CAMUNDA_BASE_URL || 'http://localhost:8080/engine-rest',
  username: process.env.CAMUNDA_USERNAME,
  password: process.env.CAMUNDA_PASSWORD
};

/**
 * File handling utilities
 */

/**
 * Check if a string looks like a file path
 */
function isFilePath(content: string): boolean {
  // Simple heuristics: short string that looks like a path and ends with BPMN extension
  return (
    content.length < 500 &&
    (content.includes('/') || content.includes('\\')) &&
    /\.(bpmn|bpmn20\.xml)$/i.test(content)
  );
}

/**
 * Check if a string looks like a form file path
 */
function isFormFilePath(content: string): boolean {
  // Simple heuristics: short string that looks like a path and ends with form extension
  return (
    content.length < 500 &&
    (content.includes('/') || content.includes('\\')) &&
    /\.(form|json)$/i.test(content)
  );
}

/**
 * Read and validate BPMN file
 */
async function readBpmnFile(filePath: string): Promise<{ content: string; fileName: string }> {
  try {
    // Read file content
    const content = await fs.readFile(filePath, 'utf8');

    // Basic BPMN validation
    if (!content.includes('<?xml') || !content.includes('bpmn')) {
      throw new Error('File does not appear to be a valid BPMN file');
    }

    // Extract filename from path
    const fileName = path.basename(filePath);

    return { content, fileName };
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Cannot read BPMN file '${filePath}': ${error.message}`);
    }
    throw new Error(`Cannot read BPMN file '${filePath}': Unknown error`);
  }
}

/**
 * Read and validate Camunda Form file
 */
async function readFormFile(filePath: string): Promise<{ content: string; fileName: string }> {
  try {
    // Read file content
    const content = await fs.readFile(filePath, 'utf8');

    // Basic form validation - try to parse as JSON
    try {
      JSON.parse(content);
    } catch {
      throw new Error('File does not appear to be a valid JSON form file');
    }

    // Extract filename from path
    const fileName = path.basename(filePath);

    return { content, fileName };
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Cannot read form file '${filePath}': ${error.message}`);
    }
    throw new Error(`Cannot read form file '${filePath}': Unknown error`);
  }
}

/**
 * Server configuration
 */
export const SERVER_NAME = 'camunda-platform-rest-api-simple';
export const SERVER_VERSION = '1.0.0';

/**
 * MCP Server instance
 */
const server = new Server(
  { name: SERVER_NAME, version: SERVER_VERSION },
  { capabilities: { tools: {} } }
);

/**
 * Simple tools for Camunda API
 */
const tools: Tool[] = [
  {
    name: 'getProcessDefinitions',
    description: 'Get a list of process definitions',
    inputSchema: {
      type: 'object',
      properties: {
        latestVersionOnly: {
          type: 'boolean',
          description: 'Only include those process definitions that are latest versions'
        },
        firstResult: {
          type: 'number',
          description: 'Pagination of results. Specifies the index of the first result to return.'
        },
        maxResults: {
          type: 'number',
          description: 'Pagination of results. Specifies the maximum number of results to return.'
        }
      }
    }
  },
  {
    name: 'getProcessInstances',
    description: 'Get a list of process instances',
    inputSchema: {
      type: 'object',
      properties: {
        processDefinitionId: {
          type: 'string',
          description: 'Filter by the process definition the instances run on.'
        },
        processDefinitionKey: {
          type: 'string',
          description: 'Filter by the key of the process definition the instances run on.'
        },
        businessKey: {
          type: 'string',
          description: 'Filter by process instance business key.'
        },
        firstResult: {
          type: 'number',
          description: 'Pagination of results. Specifies the index of the first result to return.'
        },
        maxResults: {
          type: 'number',
          description: 'Pagination of results. Specifies the maximum number of results to return.'
        }
      }
    }
  },
  {
    name: 'startProcessInstance',
    description: 'Start a new process instance',
    inputSchema: {
      type: 'object',
      properties: {
        processDefinitionId: {
          type: 'string',
          description: 'The id of the process definition to start a new process instance for.'
        },
        processDefinitionKey: {
          type: 'string',
          description: 'The key of the process definition to start a new process instance for.'
        },
        variables: {
          type: 'object',
          description: 'A JSON object containing variable key-value pairs.'
        },
        businessKey: {
          type: 'string',
          description: 'The business key the process instance is to be initialized with.'
        }
      },
      required: ['processDefinitionId']
    }
  },
  {
    name: 'getTasks',
    description: 'Get a list of tasks',
    inputSchema: {
      type: 'object',
      properties: {
        processInstanceId: {
          type: 'string',
          description: 'Filter by process instance id.'
        },
        taskDefinitionKey: {
          type: 'string',
          description: 'Filter by key of the task.'
        },
        assignee: {
          type: 'string',
          description: 'Filter by assignee.'
        },
        firstResult: {
          type: 'number',
          description: 'Pagination of results. Specifies the index of the first result to return.'
        },
        maxResults: {
          type: 'number',
          description: 'Pagination of results. Specifies the maximum number of results to return.'
        }
      }
    }
  },
  {
    name: 'completeTask',
    description: 'Complete a task',
    inputSchema: {
      type: 'object',
      properties: {
        taskId: {
          type: 'string',
          description: 'The id of the task to complete.'
        },
        variables: {
          type: 'object',
          description: 'A JSON object containing variable key-value pairs.'
        }
      },
      required: ['taskId']
    }
  },
  {
    name: 'deployBpmn',
    description: 'Deploy a BPMN process definition from content or file',
    inputSchema: {
      type: 'object',
      properties: {
        deploymentName: {
          type: 'string',
          description: 'The name of the deployment.'
        },
        bpmnContent: {
          type: 'string',
          description:
            "The BPMN XML content as a string, OR path to a BPMN file (e.g., '/workspace/process.bpmn')."
        },
        fileName: {
          type: 'string',
          description:
            "The name of the BPMN file (e.g., 'process.bpmn'). Auto-detected from file path if not provided."
        },
        enableDuplicateFiltering: {
          type: 'boolean',
          description: 'Enable duplicate filtering to avoid redeploying unchanged resources.'
        },
        deployChangedOnly: {
          type: 'boolean',
          description: 'Deploy only changed resources.'
        }
      },
      required: ['deploymentName', 'bpmnContent']
    }
  },
  {
    name: 'getDeployments',
    description: 'Get a list of deployments',
    inputSchema: {
      type: 'object',
      properties: {
        id: {
          type: 'string',
          description: 'Filter by deployment id.'
        },
        name: {
          type: 'string',
          description: 'Filter by deployment name.'
        },
        nameLike: {
          type: 'string',
          description: 'Filter by deployment name that the parameter is a substring of.'
        },
        source: {
          type: 'string',
          description: 'Filter by deployment source.'
        },
        firstResult: {
          type: 'number',
          description: 'Pagination of results. Specifies the index of the first result to return.'
        },
        maxResults: {
          type: 'number',
          description: 'Pagination of results. Specifies the maximum number of results to return.'
        }
      }
    }
  },
  {
    name: 'deleteDeployment',
    description: 'Delete a deployment by id',
    inputSchema: {
      type: 'object',
      properties: {
        deploymentId: {
          type: 'string',
          description: 'The id of the deployment to delete.'
        },
        cascade: {
          type: 'boolean',
          description:
            'If true, cascade deletion to process instances, history process instances and jobs.'
        },
        skipCustomListeners: {
          type: 'boolean',
          description: 'If true, custom listeners will not be invoked.'
        },
        skipIoMappings: {
          type: 'boolean',
          description: 'If true, input/output mappings will not be invoked.'
        }
      },
      required: ['deploymentId']
    }
  },
  {
    name: 'getDeploymentResources',
    description: 'Get resources of a deployment',
    inputSchema: {
      type: 'object',
      properties: {
        deploymentId: {
          type: 'string',
          description: 'The id of the deployment.'
        }
      },
      required: ['deploymentId']
    }
  },
  {
    name: 'deployForm',
    description: 'Deploy a Camunda Form from content or file',
    inputSchema: {
      type: 'object',
      properties: {
        deploymentName: {
          type: 'string',
          description: 'The name of the deployment.'
        },
        formContent: {
          type: 'string',
          description:
            "The Camunda Form JSON content as a string, OR path to a form file (e.g., '/workspace/form.form')."
        },
        fileName: {
          type: 'string',
          description:
            "The name of the form file (e.g., 'form.form'). Auto-detected from file path if not provided."
        }
      },
      required: ['deploymentName', 'formContent']
    }
  },
  {
    name: 'getTaskForm',
    description: 'Get the form for a task',
    inputSchema: {
      type: 'object',
      properties: {
        taskId: {
          type: 'string',
          description: 'The id of the task.'
        }
      },
      required: ['taskId']
    }
  },
  {
    name: 'submitTaskForm',
    description: 'Submit a task form',
    inputSchema: {
      type: 'object',
      properties: {
        taskId: {
          type: 'string',
          description: 'The id of the task.'
        },
        variables: {
          type: 'object',
          description: 'The form variables to submit.'
        }
      },
      required: ['taskId', 'variables']
    }
  },
  {
    name: 'getStartForm',
    description: 'Get the start form for a process definition',
    inputSchema: {
      type: 'object',
      properties: {
        processDefinitionId: {
          type: 'string',
          description: 'The id of the process definition.'
        },
        processDefinitionKey: {
          type: 'string',
          description: 'The key of the process definition.'
        }
      }
    }
  },
  {
    name: 'submitStartForm',
    description: 'Submit a start form and start process instance',
    inputSchema: {
      type: 'object',
      properties: {
        processDefinitionId: {
          type: 'string',
          description: 'The id of the process definition.'
        },
        processDefinitionKey: {
          type: 'string',
          description: 'The key of the process definition.'
        },
        variables: {
          type: 'object',
          description: 'The form variables to submit.'
        },
        businessKey: {
          type: 'string',
          description: 'The business key for the process instance.'
        }
      }
    }
  },
  {
    name: 'getProcessVariables',
    description: 'Get variables of a process instance',
    inputSchema: {
      type: 'object',
      properties: {
        processInstanceId: {
          type: 'string',
          description: 'The id of the process instance.'
        }
      },
      required: ['processInstanceId']
    }
  },
  {
    name: 'setProcessVariables',
    description: 'Set/update variables of a process instance',
    inputSchema: {
      type: 'object',
      properties: {
        processInstanceId: {
          type: 'string',
          description: 'The id of the process instance.'
        },
        variables: {
          type: 'object',
          description: 'The variables to set/update.'
        }
      },
      required: ['processInstanceId', 'variables']
    }
  },
  {
    name: 'getActivityInstances',
    description: 'Get activity instances for a process instance',
    inputSchema: {
      type: 'object',
      properties: {
        processInstanceId: {
          type: 'string',
          description: 'The id of the process instance.'
        }
      },
      required: ['processInstanceId']
    }
  },
  {
    name: 'getIncidents',
    description: 'Get incidents (errors) in processes',
    inputSchema: {
      type: 'object',
      properties: {
        processInstanceId: {
          type: 'string',
          description: 'Filter by process instance id.'
        },
        incidentType: {
          type: 'string',
          description: 'Filter by incident type.'
        },
        maxResults: {
          type: 'number',
          description: 'Maximum number of results.'
        }
      }
    }
  },
  {
    name: 'deleteProcessInstance',
    description: 'Delete a process instance',
    inputSchema: {
      type: 'object',
      properties: {
        processInstanceId: {
          type: 'string',
          description: 'The id of the process instance to delete.'
        },
        reason: {
          type: 'string',
          description: 'A reason for deletion.'
        },
        skipCustomListeners: {
          type: 'boolean',
          description: 'If true, custom listeners will not be invoked.'
        },
        skipIoMappings: {
          type: 'boolean',
          description: 'If true, input/output mappings will not be invoked.'
        },
        skipSubprocesses: {
          type: 'boolean',
          description: 'If true, subprocesses will not be deleted.'
        }
      },
      required: ['processInstanceId']
    }
  },
  {
    name: 'suspendProcessInstance',
    description: 'Suspend a process instance',
    inputSchema: {
      type: 'object',
      properties: {
        processInstanceId: {
          type: 'string',
          description: 'The id of the process instance to suspend.'
        }
      },
      required: ['processInstanceId']
    }
  },
  {
    name: 'activateProcessInstance',
    description: 'Activate a suspended process instance',
    inputSchema: {
      type: 'object',
      properties: {
        processInstanceId: {
          type: 'string',
          description: 'The id of the process instance to activate.'
        }
      },
      required: ['processInstanceId']
    }
  }
];

// Handle initialization
server.setRequestHandler(InitializeRequestSchema, async (request: InitializeRequest) => {
  const initParams = request.params;

  // Extract configuration from initialization parameters
  if (initParams && typeof initParams === 'object' && 'camunda' in initParams) {
    const camundaConfig = (initParams as any).camunda;
    if (camundaConfig) {
      if (camundaConfig.baseUrl) config.baseUrl = camundaConfig.baseUrl;
      if (camundaConfig.username) config.username = camundaConfig.username;
      if (camundaConfig.password) config.password = camundaConfig.password;
    }
  }

  // Fallback to environment variables if not provided in config
  config.baseUrl =
    config.baseUrl || process.env.CAMUNDA_BASE_URL || 'http://localhost:8080/engine-rest';
  config.username = config.username || process.env.CAMUNDA_USERNAME;
  config.password = config.password || process.env.CAMUNDA_PASSWORD;

  return {
    protocolVersion: '2024-11-05',
    capabilities: {
      tools: {}
    },
    serverInfo: {
      name: SERVER_NAME,
      version: SERVER_VERSION
    }
  };
});

// Register tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: tools
  };
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async request => {
  const { name, arguments: args } = request.params;

  if (!args) {
    throw new Error('Arguments are required');
  }

  // Use global configuration
  const baseUrl = config.baseUrl;

  // Setup authentication if provided
  const authConfig: any = {};
  if (config.username && config.password) {
    authConfig.auth = {
      username: config.username,
      password: config.password
    };
  }

  try {
    switch (name) {
      case 'getProcessDefinitions':
        const pdResponse = await axios.get(`${baseUrl}/process-definition`, {
          params: args,
          ...authConfig
        });
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(pdResponse.data, null, 2)
            }
          ]
        };

      case 'getProcessInstances':
        const piResponse = await axios.get(`${baseUrl}/process-instance`, {
          params: args,
          ...authConfig
        });
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(piResponse.data, null, 2)
            }
          ]
        };

      case 'startProcessInstance':
        const startResponse = await axios.post(
          `${baseUrl}/process-definition/${args.processDefinitionId}/start`,
          {
            variables: args.variables || {},
            businessKey: args.businessKey
          },
          authConfig
        );
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(startResponse.data, null, 2)
            }
          ]
        };

      case 'getTasks':
        const tasksResponse = await axios.get(`${baseUrl}/task`, {
          params: args,
          ...authConfig
        });
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(tasksResponse.data, null, 2)
            }
          ]
        };

      case 'completeTask':
        const completeResponse = await axios.post(
          `${baseUrl}/task/${args.taskId}/complete`,
          {
            variables: args.variables || {}
          },
          authConfig
        );
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(completeResponse.data, null, 2)
            }
          ]
        };

      case 'deployBpmn':
        let bpmnContent: string;
        let fileName: string;

        // Check if bpmnContent is a file path or actual content
        if (isFilePath(args.bpmnContent as string)) {
          try {
            const fileData = await readBpmnFile(args.bpmnContent as string);
            bpmnContent = fileData.content;
            fileName = (args.fileName as string) || fileData.fileName;

            console.error(
              `📁 Successfully read BPMN file: ${args.bpmnContent} (${Math.round(bpmnContent.length / 1024)}KB)`
            );
          } catch (error) {
            return {
              isError: true,
              content: [
                {
                  type: 'text',
                  text: `❌ ${error instanceof Error ? error.message : 'Unknown error reading file'}\n\n💡 Tip: Make sure the file exists and is accessible, or provide BPMN content directly.`
                }
              ]
            };
          }
        } else {
          // Use provided content directly
          bpmnContent = args.bpmnContent as string;
          fileName = args.fileName as string;
        }

        const formData = new FormData();
        formData.append('deployment-name', args.deploymentName);
        formData.append(
          'enable-duplicate-filtering',
          args.enableDuplicateFiltering?.toString() || 'false'
        );
        formData.append('deploy-changed-only', args.deployChangedOnly?.toString() || 'false');
        formData.append(fileName, bpmnContent, {
          filename: fileName,
          contentType: 'application/xml'
        });

        const deployResponse = await axios.post(`${baseUrl}/deployment/create`, formData, {
          ...authConfig,
          headers: {
            ...formData.getHeaders(),
            ...(authConfig.headers || {})
          }
        });

        const deploymentData = deployResponse.data;
        const contentSize = Math.round(bpmnContent.length / 1024);

        return {
          content: [
            {
              type: 'text',
              text: `✅ Successfully deployed BPMN process!\n\n📊 Deployment Details:\n${JSON.stringify(deploymentData, null, 2)}\n\n📁 File: ${fileName}\n📏 Size: ${contentSize}KB`
            }
          ]
        };

      case 'getDeployments':
        const deploymentsResponse = await axios.get(`${baseUrl}/deployment`, {
          params: args,
          ...authConfig
        });
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(deploymentsResponse.data, null, 2)
            }
          ]
        };

      case 'deleteDeployment':
        const deleteDeploymentResponse = await axios.delete(
          `${baseUrl}/deployment/${args.deploymentId}`,
          {
            params: {
              cascade: args.cascade,
              skipCustomListeners: args.skipCustomListeners,
              skipIoMappings: args.skipIoMappings
            },
            ...authConfig
          }
        );
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(deleteDeploymentResponse.data, null, 2)
            }
          ]
        };

      case 'getDeploymentResources':
        const resourcesResponse = await axios.get(
          `${baseUrl}/deployment/${args.deploymentId}/resources`,
          authConfig
        );
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(resourcesResponse.data, null, 2)
            }
          ]
        };

      case 'deployForm':
        let formContent: string;
        let formFileName: string;

        // Check if formContent is a file path or actual content
        if (isFormFilePath(args.formContent as string)) {
          try {
            const fileData = await readFormFile(args.formContent as string);
            formContent = fileData.content;
            formFileName = (args.fileName as string) || fileData.fileName;

            console.error(
              `📄 Successfully read form file: ${args.formContent} (${Math.round(formContent.length / 1024)}KB)`
            );
          } catch (error) {
            return {
              isError: true,
              content: [
                {
                  type: 'text',
                  text: `❌ ${error instanceof Error ? error.message : 'Unknown error reading file'}\n\n💡 Tip: Make sure the file exists and is accessible, or provide form content directly.`
                }
              ]
            };
          }
        } else {
          // Use provided content directly
          formContent = args.formContent as string;
          formFileName = args.fileName as string;
        }

        const formFormData = new FormData();
        formFormData.append('deployment-name', args.deploymentName);
        formFormData.append(formFileName, formContent, {
          filename: formFileName,
          contentType: 'application/json'
        });

        const deployFormResponse = await axios.post(`${baseUrl}/deployment/create`, formFormData, {
          ...authConfig,
          headers: {
            ...formFormData.getHeaders(),
            ...(authConfig.headers || {})
          }
        });

        const formDeploymentData = deployFormResponse.data;
        const formContentSize = Math.round(formContent.length / 1024);

        return {
          content: [
            {
              type: 'text',
              text: `✅ Successfully deployed Camunda Form!\n\n📊 Deployment Details:\n${JSON.stringify(formDeploymentData, null, 2)}\n\n📄 File: ${formFileName}\n📏 Size: ${formContentSize}KB`
            }
          ]
        };

      case 'getTaskForm':
        const taskFormResponse = await axios.get(`${baseUrl}/task/${args.taskId}/form`, authConfig);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(taskFormResponse.data, null, 2)
            }
          ]
        };

      case 'submitTaskForm':
        const submitTaskFormResponse = await axios.post(
          `${baseUrl}/task/${args.taskId}/submit-form`,
          {
            variables: args.variables
          },
          authConfig
        );
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(submitTaskFormResponse.data, null, 2)
            }
          ]
        };

      case 'getStartForm':
        const startFormUrl = args.processDefinitionId
          ? `${baseUrl}/process-definition/${args.processDefinitionId}/startForm`
          : `${baseUrl}/process-definition/key/${args.processDefinitionKey}/startForm`;
        const startFormResponse = await axios.get(startFormUrl, authConfig);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(startFormResponse.data, null, 2)
            }
          ]
        };

      case 'submitStartForm':
        const submitStartFormUrl = args.processDefinitionId
          ? `${baseUrl}/process-definition/${args.processDefinitionId}/submit-form`
          : `${baseUrl}/process-definition/key/${args.processDefinitionKey}/submit-form`;
        const submitStartFormResponse = await axios.post(
          submitStartFormUrl,
          {
            variables: args.variables,
            businessKey: args.businessKey
          },
          authConfig
        );
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(submitStartFormResponse.data, null, 2)
            }
          ]
        };

      case 'getProcessVariables':
        const variablesResponse = await axios.get(
          `${baseUrl}/process-instance/${args.processInstanceId}/variables`,
          authConfig
        );
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(variablesResponse.data, null, 2)
            }
          ]
        };

      case 'setProcessVariables':
        const setVariablesResponse = await axios.post(
          `${baseUrl}/process-instance/${args.processInstanceId}/variables`,
          {
            modifications: args.variables
          },
          authConfig
        );
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(setVariablesResponse.data, null, 2)
            }
          ]
        };

      case 'getActivityInstances':
        const activityResponse = await axios.get(
          `${baseUrl}/process-instance/${args.processInstanceId}/activity-instances`,
          authConfig
        );
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(activityResponse.data, null, 2)
            }
          ]
        };

      case 'getIncidents':
        const incidentsResponse = await axios.get(`${baseUrl}/incident`, {
          params: args,
          ...authConfig
        });
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(incidentsResponse.data, null, 2)
            }
          ]
        };

      case 'deleteProcessInstance':
        const deleteProcessResponse = await axios.delete(
          `${baseUrl}/process-instance/${args.processInstanceId}`,
          {
            params: {
              reason: args.reason,
              skipCustomListeners: args.skipCustomListeners,
              skipIoMappings: args.skipIoMappings,
              skipSubprocesses: args.skipSubprocesses
            },
            ...authConfig
          }
        );
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(deleteProcessResponse.data, null, 2)
            }
          ]
        };

      case 'suspendProcessInstance':
        const suspendResponse = await axios.put(
          `${baseUrl}/process-instance/${args.processInstanceId}/suspended`,
          {
            suspended: true
          },
          authConfig
        );
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(suspendResponse.data, null, 2)
            }
          ]
        };

      case 'activateProcessInstance':
        const activateResponse = await axios.put(
          `${baseUrl}/process-instance/${args.processInstanceId}/suspended`,
          {
            suspended: false
          },
          authConfig
        );
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(activateResponse.data, null, 2)
            }
          ]
        };

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const status = error.response?.status || 'Unknown';
      const statusText = error.response?.statusText || 'Unknown Error';
      const data = error.response?.data || error.message || 'No additional information';

      return {
        content: [
          {
            type: 'text',
            text: `HTTP Error: ${status} - ${statusText}\n${JSON.stringify(data, null, 2)}`
          }
        ],
        isError: true
      };
    }

    return {
      content: [
        {
          type: 'text',
          text: `Error: ${error instanceof Error ? error.message : String(error)}`
        }
      ],
      isError: true
    };
  }
});

// Start the server with STDIO transport
const transport = new StdioServerTransport();
await server.connect(transport);
console.error('Camunda MCP Server running on stdio');
