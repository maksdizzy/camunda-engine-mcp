/**
 * Юнит-тесты для инструментов развертывания (Deployment Management)
 */

import { describe, test, expect, beforeEach, jest } from '@jest/globals';
import axios from 'axios';
import FormData from 'form-data';
import { 
  createMockAxiosResponse, 
  createTestDeployment,
  validateMCPResponse,
  parseMCPResponse,
  loadTestBpmn,
  loadTestForm
} from '../utils/test-helpers';

// Мокаем axios и FormData
jest.mock('axios');
jest.mock('form-data');
const mockedAxios = axios as jest.Mocked<typeof axios>;
const MockedFormData = FormData as jest.MockedClass<typeof FormData>;

// Эмуляция обработки deployment инструментов
async function handleDeploymentToolCall(name: string, args: any) {
  const baseUrl = 'http://test-camunda:8080/engine-rest';
  const authConfig = { auth: { username: 'test', password: 'test' } };

  try {
    switch (name) {
      case 'deployBpmn':
        const mockDeployment = {
          ...createTestDeployment({ name: args.deploymentName }),
          deployedProcessDefinitions: {
            'test-process': {
              id: 'test-process:1:deployment-id',
              key: 'test-process',
              name: 'Test Process',
              version: 1
            }
          }
        };
        
        mockedAxios.post.mockResolvedValueOnce(createMockAxiosResponse(mockDeployment));
        
        const formData = new MockedFormData();
        const deployResponse = await axios.post(`${baseUrl}/deployment/create`, formData, {
          ...authConfig,
          headers: { 'content-type': 'multipart/form-data' }
        });
        
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(deployResponse.data, null, 2)
          }]
        };

      case 'getDeployments':
        const mockDeployments = [
          createTestDeployment(),
          createTestDeployment({ id: 'test-deployment-2', name: 'Test Deployment 2' })
        ];
        mockedAxios.get.mockResolvedValueOnce(createMockAxiosResponse(mockDeployments));
        
        const deploymentsResponse = await axios.get(`${baseUrl}/deployment`, {
          params: args,
          ...authConfig
        });
        
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(deploymentsResponse.data, null, 2)
          }]
        };

      case 'deleteDeployment':
        mockedAxios.delete.mockResolvedValueOnce(createMockAxiosResponse({}));
        
        const deleteResponse = await axios.delete(`${baseUrl}/deployment/${args.deploymentId}`, {
          params: {
            cascade: args.cascade,
            skipCustomListeners: args.skipCustomListeners,
            skipIoMappings: args.skipIoMappings
          },
          ...authConfig
        });
        
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(deleteResponse.data, null, 2)
          }]
        };

      case 'getDeploymentResources':
        const mockResources = [
          {
            id: 'test-process.bpmn',
            name: 'test-process.bpmn',
            deploymentId: args.deploymentId,
            type: 'bpmn'
          },
          {
            id: 'test-form.form',
            name: 'test-form.form',
            deploymentId: args.deploymentId,
            type: 'form'
          }
        ];
        mockedAxios.get.mockResolvedValueOnce(createMockAxiosResponse(mockResources));
        
        const resourcesResponse = await axios.get(`${baseUrl}/deployment/${args.deploymentId}/resources`, authConfig);
        
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(resourcesResponse.data, null, 2)
          }]
        };

      case 'deployForm':
        const mockFormDeployment = {
          ...createTestDeployment({ name: args.deploymentName }),
          deployedCamundaForms: {
            'test-form': {
              id: 'test-form:1:deployment-id',
              key: 'test-form',
              version: 1
            }
          }
        };
        
        mockedAxios.post.mockResolvedValueOnce(createMockAxiosResponse(mockFormDeployment));
        
        const formFormData = new MockedFormData();
        const deployFormResponse = await axios.post(`${baseUrl}/deployment/create`, formFormData, {
          ...authConfig,
          headers: { 'content-type': 'multipart/form-data' }
        });
        
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(deployFormResponse.data, null, 2)
          }]
        };

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    return {
      content: [{
        type: 'text',
        text: `Error: ${error instanceof Error ? error.message : String(error)}`
      }],
      isError: true
    };
  }
}

const mockServer = {
  async callTool(name: string, args: any) {
    return await handleDeploymentToolCall(name, args);
  }
};

describe('MCP Server - BPMN Deployment', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Настройка мока FormData
    const mockFormData = {
      append: jest.fn(),
      getHeaders: jest.fn().mockReturnValue({ 'content-type': 'multipart/form-data' })
    };
    MockedFormData.mockImplementation(() => mockFormData as any);
  });

  test('deployBpmn - должен развертывать BPMN процесс', async () => {
    const bpmnContent = loadTestBpmn();
    const args = {
      deploymentName: 'Test Deployment',
      bpmnContent,
      fileName: 'test-process.bpmn',
      enableDuplicateFiltering: true,
      deployChangedOnly: false
    };
    
    const response = await mockServer.callTool('deployBpmn', args);
    
    validateMCPResponse(response);
    const data = parseMCPResponse(response);
    
    expect(data).toHaveProperty('id');
    expect(data).toHaveProperty('name', args.deploymentName);
    expect(data).toHaveProperty('deployedProcessDefinitions');
    expect(mockedAxios.post).toHaveBeenCalledWith(
      'http://test-camunda:8080/engine-rest/deployment/create',
      expect.any(MockedFormData),
      expect.objectContaining({
        auth: { username: 'test', password: 'test' },
        headers: { 'content-type': 'multipart/form-data' }
      })
    );
  });

  test('deployBpmn - должен настраивать FormData правильно', async () => {
    const bpmnContent = loadTestBpmn();
    const args = {
      deploymentName: 'Test Deployment',
      bpmnContent,
      fileName: 'test-process.bpmn',
      enableDuplicateFiltering: true,
      deployChangedOnly: false
    };
    
    await mockServer.callTool('deployBpmn', args);
    
    const formDataInstance = MockedFormData.mock.instances[0];
    expect(formDataInstance.append).toHaveBeenCalledWith('deployment-name', args.deploymentName);
    expect(formDataInstance.append).toHaveBeenCalledWith('enable-duplicate-filtering', 'true');
    expect(formDataInstance.append).toHaveBeenCalledWith('deploy-changed-only', 'false');
    expect(formDataInstance.append).toHaveBeenCalledWith(
      args.fileName,
      args.bpmnContent,
      expect.objectContaining({
        filename: args.fileName,
        contentType: 'application/xml'
      })
    );
  });

  test('deployBpmn - должен требовать обязательные параметры', async () => {
    const response = await mockServer.callTool('deployBpmn', {});
    
    expect(response.isError).toBe(true);
    expect(response.content[0].text).toContain('Error');
  });

  test('deployBpmn - должен обрабатывать ошибки развертывания', async () => {
    const axiosError = {
      isAxiosError: true,
      response: {
        status: 400,
        statusText: 'Bad Request',
        data: { message: 'Invalid BPMN content' }
      }
    };
    
    mockedAxios.post.mockRejectedValueOnce(axiosError);
    mockedAxios.isAxiosError = jest.fn().mockReturnValue(true);
    
    const args = {
      deploymentName: 'Test Deployment',
      bpmnContent: '<invalid>xml</invalid>',
      fileName: 'invalid.bpmn'
    };
    
    const response = await mockServer.callTool('deployBpmn', args);
    
    expect(response.isError).toBe(true);
    expect(response.content[0].text).toContain('HTTP Error: 400');
  });
});

describe('MCP Server - Deployment Management', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('getDeployments - должен возвращать список развертываний', async () => {
    const response = await mockServer.callTool('getDeployments', {});
    
    validateMCPResponse(response);
    const data = parseMCPResponse(response);
    
    expect(Array.isArray(data)).toBe(true);
    expect(data).toHaveLength(2);
    expect(data[0]).toHaveProperty('id');
    expect(data[0]).toHaveProperty('name');
    expect(data[0]).toHaveProperty('deploymentTime');
    expect(mockedAxios.get).toHaveBeenCalledWith(
      'http://test-camunda:8080/engine-rest/deployment',
      expect.objectContaining({
        params: {},
        auth: { username: 'test', password: 'test' }
      })
    );
  });

  test('getDeployments - должен поддерживать фильтрацию', async () => {
    const args = { 
      name: 'Test Deployment',
      nameLike: 'Test%',
      maxResults: 10 
    };
    
    const response = await mockServer.callTool('getDeployments', args);
    
    validateMCPResponse(response);
    expect(mockedAxios.get).toHaveBeenCalledWith(
      'http://test-camunda:8080/engine-rest/deployment',
      expect.objectContaining({
        params: args
      })
    );
  });

  test('deleteDeployment - должен удалять развертывание', async () => {
    const args = {
      deploymentId: 'test-deployment-id',
      cascade: true,
      skipCustomListeners: false,
      skipIoMappings: false
    };
    
    const response = await mockServer.callTool('deleteDeployment', args);
    
    validateMCPResponse(response);
    expect(mockedAxios.delete).toHaveBeenCalledWith(
      `http://test-camunda:8080/engine-rest/deployment/${args.deploymentId}`,
      expect.objectContaining({
        params: {
          cascade: args.cascade,
          skipCustomListeners: args.skipCustomListeners,
          skipIoMappings: args.skipIoMappings
        },
        auth: { username: 'test', password: 'test' }
      })
    );
  });

  test('deleteDeployment - должен работать с минимальными параметрами', async () => {
    const args = { deploymentId: 'test-deployment-id' };
    
    const response = await mockServer.callTool('deleteDeployment', args);
    
    validateMCPResponse(response);
    expect(mockedAxios.delete).toHaveBeenCalledWith(
      `http://test-camunda:8080/engine-rest/deployment/${args.deploymentId}`,
      expect.objectContaining({
        params: {
          cascade: undefined,
          skipCustomListeners: undefined,
          skipIoMappings: undefined
        }
      })
    );
  });

  test('getDeploymentResources - должен возвращать ресурсы развертывания', async () => {
    const args = { deploymentId: 'test-deployment-id' };
    
    const response = await mockServer.callTool('getDeploymentResources', args);
    
    validateMCPResponse(response);
    const data = parseMCPResponse(response);
    
    expect(Array.isArray(data)).toBe(true);
    expect(data).toHaveLength(2);
    expect(data[0]).toHaveProperty('id');
    expect(data[0]).toHaveProperty('name');
    expect(data[0]).toHaveProperty('deploymentId', args.deploymentId);
    expect(data[0]).toHaveProperty('type');
    expect(mockedAxios.get).toHaveBeenCalledWith(
      `http://test-camunda:8080/engine-rest/deployment/${args.deploymentId}/resources`,
      expect.objectContaining({
        auth: { username: 'test', password: 'test' }
      })
    );
  });
});

describe('MCP Server - Form Deployment', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Настройка мока FormData
    const mockFormData = {
      append: jest.fn(),
      getHeaders: jest.fn().mockReturnValue({ 'content-type': 'multipart/form-data' })
    };
    MockedFormData.mockImplementation(() => mockFormData as any);
  });

  test('deployForm - должен развертывать Camunda Form', async () => {
    const formContent = loadTestForm();
    const args = {
      deploymentName: 'Test Form Deployment',
      formContent,
      fileName: 'test-form.form'
    };
    
    const response = await mockServer.callTool('deployForm', args);
    
    validateMCPResponse(response);
    const data = parseMCPResponse(response);
    
    expect(data).toHaveProperty('id');
    expect(data).toHaveProperty('name', args.deploymentName);
    expect(data).toHaveProperty('deployedCamundaForms');
    expect(mockedAxios.post).toHaveBeenCalledWith(
      'http://test-camunda:8080/engine-rest/deployment/create',
      expect.any(MockedFormData),
      expect.objectContaining({
        auth: { username: 'test', password: 'test' },
        headers: { 'content-type': 'multipart/form-data' }
      })
    );
  });

  test('deployForm - должен настраивать FormData для форм', async () => {
    const formContent = loadTestForm();
    const args = {
      deploymentName: 'Test Form Deployment',
      formContent,
      fileName: 'test-form.form'
    };
    
    await mockServer.callTool('deployForm', args);
    
    const formDataInstance = MockedFormData.mock.instances[0];
    expect(formDataInstance.append).toHaveBeenCalledWith('deployment-name', args.deploymentName);
    expect(formDataInstance.append).toHaveBeenCalledWith(
      args.fileName,
      args.formContent,
      expect.objectContaining({
        filename: args.fileName,
        contentType: 'application/json'
      })
    );
  });

  test('deployForm - должен требовать обязательные параметры', async () => {
    const response = await mockServer.callTool('deployForm', { deploymentName: 'Test' });
    
    expect(response.isError).toBe(true);
  });

  test('deployForm - должен обрабатывать ошибки валидации формы', async () => {
    const axiosError = {
      isAxiosError: true,
      response: {
        status: 400,
        statusText: 'Bad Request',
        data: { message: 'Invalid form schema' }
      }
    };
    
    mockedAxios.post.mockRejectedValueOnce(axiosError);
    mockedAxios.isAxiosError = jest.fn().mockReturnValue(true);
    
    const args = {
      deploymentName: 'Test Form Deployment',
      formContent: '{"invalid": "schema"}',
      fileName: 'invalid.form'
    };
    
    const response = await mockServer.callTool('deployForm', args);
    
    expect(response.isError).toBe(true);
    expect(response.content[0].text).toContain('HTTP Error: 400');
    expect(response.content[0].text).toContain('Invalid form schema');
  });
});
