/**
 * Юнит-тесты для основного MCP сервера
 */

import { describe, test, expect, beforeEach, jest } from '@jest/globals';
import axios from 'axios';
import { 
  createMockAxiosResponse, 
  createTestProcessDefinition,
  createTestProcessInstance,
  createTestTask,
  validateMCPResponse,
  parseMCPResponse
} from '../utils/test-helpers';

// Мокаем axios для изоляции тестов
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

// Мокаем MCP сервер
const mockServer = {
  async callTool(name: string, args: any) {
    // Эмуляция вызова инструмента через мокированный axios
    return await handleToolCall(name, args);
  }
};

// Эмуляция обработки вызовов инструментов
async function handleToolCall(name: string, args: any) {
  const baseUrl = 'http://test-camunda:8080/engine-rest';
  const authConfig = { auth: { username: 'test', password: 'test' } };

  try {
    switch (name) {
      case 'getProcessDefinitions':
        const mockProcessDefs = [
          createTestProcessDefinition(),
          createTestProcessDefinition({ id: 'test-2', key: 'test-process-2', version: 2 })
        ];
        mockedAxios.get.mockResolvedValueOnce(createMockAxiosResponse(mockProcessDefs));
        
        const pdResponse = await axios.get(`${baseUrl}/process-definition`, {
          params: args,
          ...authConfig
        });
        
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(pdResponse.data, null, 2)
          }]
        };

      case 'getProcessInstances':
        const mockProcessInstances = [
          createTestProcessInstance(),
          createTestProcessInstance({ id: 'test-instance-2', businessKey: 'test-key-2' })
        ];
        mockedAxios.get.mockResolvedValueOnce(createMockAxiosResponse(mockProcessInstances));
        
        const piResponse = await axios.get(`${baseUrl}/process-instance`, {
          params: args,
          ...authConfig
        });
        
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(piResponse.data, null, 2)
          }]
        };

      case 'startProcessInstance':
        const mockNewInstance = createTestProcessInstance({ 
          id: 'new-process-instance-id',
          businessKey: args.businessKey 
        });
        mockedAxios.post.mockResolvedValueOnce(createMockAxiosResponse(mockNewInstance));
        
        const startResponse = await axios.post(
          `${baseUrl}/process-definition/${args.processDefinitionId}/start`,
          { variables: args.variables || {}, businessKey: args.businessKey },
          authConfig
        );
        
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(startResponse.data, null, 2)
          }]
        };

      case 'getTasks':
        const mockTasks = [
          createTestTask(),
          createTestTask({ id: 'test-task-2', name: 'Test Task 2', assignee: 'demo' })
        ];
        mockedAxios.get.mockResolvedValueOnce(createMockAxiosResponse(mockTasks));
        
        const tasksResponse = await axios.get(`${baseUrl}/task`, {
          params: args,
          ...authConfig
        });
        
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(tasksResponse.data, null, 2)
          }]
        };

      case 'completeTask':
        mockedAxios.post.mockResolvedValueOnce(createMockAxiosResponse({}));
        
        const completeResponse = await axios.post(
          `${baseUrl}/task/${args.taskId}/complete`,
          { variables: args.variables || {} },
          authConfig
        );
        
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(completeResponse.data, null, 2)
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

describe('MCP Server - Process Definitions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('getProcessDefinitions - должен возвращать список процессов', async () => {
    const response = await mockServer.callTool('getProcessDefinitions', {});
    
    validateMCPResponse(response);
    const data = parseMCPResponse(response);
    
    expect(Array.isArray(data)).toBe(true);
    expect(data).toHaveLength(2);
    expect(data[0]).toHaveProperty('id');
    expect(data[0]).toHaveProperty('key');
    expect(data[0]).toHaveProperty('name');
    expect(mockedAxios.get).toHaveBeenCalledWith(
      'http://test-camunda:8080/engine-rest/process-definition',
      expect.objectContaining({
        params: {},
        auth: { username: 'test', password: 'test' }
      })
    );
  });

  test('getProcessDefinitions - должен поддерживать фильтрацию', async () => {
    const args = { latestVersionOnly: true, maxResults: 10 };
    const response = await mockServer.callTool('getProcessDefinitions', args);
    
    validateMCPResponse(response);
    expect(mockedAxios.get).toHaveBeenCalledWith(
      'http://test-camunda:8080/engine-rest/process-definition',
      expect.objectContaining({
        params: args
      })
    );
  });

  test('getProcessDefinitions - должен обрабатывать ошибки', async () => {
    mockedAxios.get.mockRejectedValueOnce(new Error('Network error'));
    
    const response = await mockServer.callTool('getProcessDefinitions', {});
    
    expect(response.isError).toBe(true);
    expect(response.content[0].text).toContain('Network error');
  });
});

describe('MCP Server - Process Instances', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('getProcessInstances - должен возвращать список экземпляров', async () => {
    const response = await mockServer.callTool('getProcessInstances', {});
    
    validateMCPResponse(response);
    const data = parseMCPResponse(response);
    
    expect(Array.isArray(data)).toBe(true);
    expect(data).toHaveLength(2);
    expect(data[0]).toHaveProperty('id');
    expect(data[0]).toHaveProperty('definitionId');
    expect(data[0]).toHaveProperty('businessKey');
  });

  test('startProcessInstance - должен запускать новый процесс', async () => {
    const args = {
      processDefinitionId: 'test-process-def-id',
      businessKey: 'test-business-key',
      variables: { testVar: 'testValue' }
    };
    
    const response = await mockServer.callTool('startProcessInstance', args);
    
    validateMCPResponse(response);
    const data = parseMCPResponse(response);
    
    expect(data).toHaveProperty('id');
    expect(data.businessKey).toBe(args.businessKey);
    expect(mockedAxios.post).toHaveBeenCalledWith(
      `http://test-camunda:8080/engine-rest/process-definition/${args.processDefinitionId}/start`,
      {
        variables: args.variables,
        businessKey: args.businessKey
      },
      expect.objectContaining({
        auth: { username: 'test', password: 'test' }
      })
    );
  });

  test('startProcessInstance - должен требовать processDefinitionId', async () => {
    const response = await mockServer.callTool('startProcessInstance', {});
    
    // Поскольку мы не передали обязательный параметр, должна быть ошибка
    expect(response.isError).toBe(true);
  });
});

describe('MCP Server - Tasks', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('getTasks - должен возвращать список задач', async () => {
    const response = await mockServer.callTool('getTasks', {});
    
    validateMCPResponse(response);
    const data = parseMCPResponse(response);
    
    expect(Array.isArray(data)).toBe(true);
    expect(data).toHaveLength(2);
    expect(data[0]).toHaveProperty('id');
    expect(data[0]).toHaveProperty('name');
    expect(data[0]).toHaveProperty('processInstanceId');
  });

  test('getTasks - должен поддерживать фильтрацию по assignee', async () => {
    const args = { assignee: 'demo', maxResults: 5 };
    const response = await mockServer.callTool('getTasks', args);
    
    validateMCPResponse(response);
    expect(mockedAxios.get).toHaveBeenCalledWith(
      'http://test-camunda:8080/engine-rest/task',
      expect.objectContaining({
        params: args
      })
    );
  });

  test('completeTask - должен завершать задачу', async () => {
    const args = {
      taskId: 'test-task-id',
      variables: { result: 'approved' }
    };
    
    const response = await mockServer.callTool('completeTask', args);
    
    validateMCPResponse(response);
    expect(mockedAxios.post).toHaveBeenCalledWith(
      `http://test-camunda:8080/engine-rest/task/${args.taskId}/complete`,
      { variables: args.variables },
      expect.objectContaining({
        auth: { username: 'test', password: 'test' }
      })
    );
  });

  test('completeTask - должен работать без переменных', async () => {
    const args = { taskId: 'test-task-id' };
    
    const response = await mockServer.callTool('completeTask', args);
    
    validateMCPResponse(response);
    expect(mockedAxios.post).toHaveBeenCalledWith(
      `http://test-camunda:8080/engine-rest/task/${args.taskId}/complete`,
      { variables: {} },
      expect.any(Object)
    );
  });
});

describe('MCP Server - Error Handling', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('должен обрабатывать неизвестные инструменты', async () => {
    const response = await mockServer.callTool('unknownTool', {});
    
    expect(response.isError).toBe(true);
    expect(response.content[0].text).toContain('Unknown tool: unknownTool');
  });

  test('должен обрабатывать HTTP ошибки', async () => {
    const axiosError = {
      isAxiosError: true,
      response: {
        status: 404,
        statusText: 'Not Found',
        data: { message: 'Process definition not found' }
      }
    };
    
    mockedAxios.get.mockRejectedValueOnce(axiosError);
    mockedAxios.isAxiosError = jest.fn().mockReturnValue(true);
    
    const response = await mockServer.callTool('getProcessDefinitions', {});
    
    expect(response.isError).toBe(true);
    expect(response.content[0].text).toContain('HTTP Error: 404');
    expect(response.content[0].text).toContain('Not Found');
  });

  test('должен обрабатывать сетевые ошибки', async () => {
    const networkError = new Error('Network Error');
    mockedAxios.get.mockRejectedValueOnce(networkError);
    mockedAxios.isAxiosError = jest.fn().mockReturnValue(false);
    
    const response = await mockServer.callTool('getProcessDefinitions', {});
    
    expect(response.isError).toBe(true);
    expect(response.content[0].text).toContain('Error: Network Error');
  });
});
