/**
 * Utilities for testing Camunda MCP server
 */

import { readFileSync } from 'fs';
import { join } from 'path';
import axios from 'axios';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';

// Testing types
export interface TestConfig {
  baseUrl: string;
  username?: string;
  password?: string;
}

export interface MockAxiosResponse {
  data: any;
  status: number;
  statusText: string;
  headers: any;
  config: any;
}

// Testing constants
export const TEST_CONFIG: TestConfig = {
  baseUrl: process.env.CAMUNDA_BASE_URL || 'http://localhost:8080/engine-rest',
  username: process.env.CAMUNDA_USERNAME || 'demo',
  password: process.env.CAMUNDA_PASSWORD || 'demo'
};

export const TEST_TIMEOUT = {
  UNIT: 5000,
  INTEGRATION: 30000,
  E2E: 120000
};

// Load test files
export const loadTestBpmn = (filename: string = 'test-process.bpmn'): string => {
  const filePath = join(__dirname, '..', 'fixtures', filename);
  return readFileSync(filePath, 'utf-8');
};

export const loadTestForm = (filename: string = 'test-form.json'): string => {
  const filePath = join(__dirname, '..', 'fixtures', filename);
  return readFileSync(filePath, 'utf-8');
};

// Create mock responses
export const createMockAxiosResponse = (data: any, status: number = 200): MockAxiosResponse => ({
  data,
  status,
  statusText: status === 200 ? 'OK' : 'Error',
  headers: { 'content-type': 'application/json' },
  config: {}
});

// Create test data
export const createTestProcessDefinition = (overrides: Partial<any> = {}) => ({
  id: 'test-process-definition-id',
  key: 'test-process',
  name: 'Test Process',
  version: 1,
  category: 'test',
  deploymentId: 'test-deployment-id',
  resource: 'test-process.bpmn',
  suspended: false,
  tenantId: null,
  versionTag: null,
  historyTimeToLive: null,
  isStartableInTasklist: true,
  ...overrides
});

export const createTestProcessInstance = (overrides: Partial<any> = {}) => ({
  id: 'test-process-instance-id',
  definitionId: 'test-process-definition-id',
  businessKey: 'test-business-key',
  caseInstanceId: null,
  ended: false,
  suspended: false,
  tenantId: null,
  ...overrides
});

export const createTestTask = (overrides: Partial<any> = {}) => ({
  id: 'test-task-id',
  name: 'Test Task',
  assignee: null,
  created: new Date().toISOString(),
  due: null,
  followUp: null,
  delegationState: null,
  description: 'Test task description',
  executionId: 'test-execution-id',
  owner: null,
  parentTaskId: null,
  priority: 50,
  processDefinitionId: 'test-process-definition-id',
  processInstanceId: 'test-process-instance-id',
  taskDefinitionKey: 'test-task-key',
  caseExecutionId: null,
  caseInstanceId: null,
  caseDefinitionId: null,
  suspended: false,
  formKey: null,
  tenantId: null,
  ...overrides
});

export const createTestDeployment = (overrides: Partial<any> = {}) => ({
  id: 'test-deployment-id',
  name: 'Test Deployment',
  deploymentTime: new Date().toISOString(),
  source: 'process application',
  tenantId: null,
  ...overrides
});

// MCP response validation
export const validateMCPResponse = (response: CallToolResult): void => {
  expect(response).toBeDefined();
  expect(response.content).toBeDefined();
  expect(Array.isArray(response.content)).toBe(true);
  expect(response.content.length).toBeGreaterThan(0);
  
  const content = response.content[0];
  expect(content.type).toBe('text');
  expect(content.text).toBeDefined();
};

export const validateMCPErrorResponse = (response: CallToolResult): void => {
  expect(response).toBeDefined();
  expect(response.isError).toBe(true);
  expect(response.content).toBeDefined();
  expect(Array.isArray(response.content)).toBe(true);
};

export const parseMCPResponse = (response: CallToolResult): any => {
  validateMCPResponse(response);
  const content = response.content[0] as { text: string };
  return JSON.parse(content.text);
};

// Integration test utilities
export const waitForCondition = async (
  condition: () => Promise<boolean>,
  timeout: number = 10000,
  interval: number = 1000
): Promise<void> => {
  const startTime = Date.now();
  
  while (Date.now() - startTime < timeout) {
    if (await condition()) {
      return;
    }
    await new Promise(resolve => setTimeout(resolve, interval));
  }
  
  throw new Error(`Condition not met within ${timeout}ms`);
};

export const cleanupCamundaData = async (deploymentIds: string[]): Promise<void> => {
  const { baseUrl, username, password } = TEST_CONFIG;
  
  for (const deploymentId of deploymentIds) {
    try {
      await axios.delete(`${baseUrl}/deployment/${deploymentId}`, {
        auth: { username: username!, password: password! },
        params: { cascade: true }
      });
    } catch (error) {
      console.warn(`Failed to cleanup deployment ${deploymentId}:`, error);
    }
  }
};

// Generate unique test identifiers
export const generateTestId = (prefix: string = 'test'): string => {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(7);
  return `${prefix}-${timestamp}-${random}`;
};

export const generateTestName = (prefix: string = 'Test'): string => {
  return `${prefix} ${Date.now()}`;
};

// Check Camunda availability
export const checkCamundaAvailability = async (): Promise<boolean> => {
  const { baseUrl, username, password } = TEST_CONFIG;
  
  try {
    const response = await axios.get(`${baseUrl}/engine`, {
      auth: { username: username!, password: password! },
      timeout: 5000
    });
    return response.status === 200;
  } catch {
    return false;
  }
};

// Create test process in Camunda
export const deployTestProcess = async (processName?: string): Promise<string> => {
  const { baseUrl, username, password } = TEST_CONFIG;
  const deploymentName = processName || generateTestName('Test Process');
  const bpmnContent = loadTestBpmn();
  
  const FormData = (await import('form-data')).default;
  const formData = new FormData();
  formData.append('deployment-name', deploymentName);
  formData.append('test-process.bpmn', bpmnContent, {
    filename: 'test-process.bpmn',
    contentType: 'application/xml'
  });

  const response = await axios.post(`${baseUrl}/deployment/create`, formData, {
    auth: { username: username!, password: password! },
    headers: formData.getHeaders()
  });

  return response.data.id;
};

// Export all utilities
export * from './test-helpers';
