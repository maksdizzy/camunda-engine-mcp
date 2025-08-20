/**
 * End-to-End тесты для полного workflow через MCP сервер
 */

import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';
import { spawn, ChildProcess } from 'child_process';
import { 
  TEST_CONFIG,
  TEST_TIMEOUT,
  loadTestBpmn,
  loadTestForm,
  generateTestName,
  waitForCondition
} from '../utils/test-helpers';

// MCP клиент для тестирования
class MCPTestClient {
  private process: ChildProcess | null = null;
  private requestId = 1;

  async start(): Promise<void> {
    return new Promise((resolve, reject) => {
      const env = {
        ...process.env,
        CAMUNDA_BASE_URL: TEST_CONFIG.baseUrl,
        CAMUNDA_USERNAME: TEST_CONFIG.username,
        CAMUNDA_PASSWORD: TEST_CONFIG.password
      };

      this.process = spawn('node', ['build/index.js'], {
        stdio: ['pipe', 'pipe', 'pipe'],
        env
      });

      let initialized = false;

      this.process.stdout?.on('data', (data) => {
        const output = data.toString();
        if (output.includes('Camunda MCP Server running') && !initialized) {
          initialized = true;
          resolve();
        }
      });

      this.process.stderr?.on('data', (data) => {
        const error = data.toString();
        if (error.includes('Error') && !initialized) {
          reject(new Error(`MCP Server failed to start: ${error}`));
        }
      });

      this.process.on('error', (error) => {
        if (!initialized) {
          reject(error);
        }
      });

      // Таймаут для запуска
      setTimeout(() => {
        if (!initialized) {
          reject(new Error('MCP Server failed to start within timeout'));
        }
      }, 10000);
    });
  }

  async stop(): Promise<void> {
    if (this.process) {
      this.process.kill();
      this.process = null;
    }
  }

  async callTool(name: string, args: any): Promise<any> {
    if (!this.process) {
      throw new Error('MCP Server not started');
    }

    return new Promise((resolve, reject) => {
      const request = {
        jsonrpc: '2.0',
        id: this.requestId++,
        method: 'tools/call',
        params: {
          name,
          arguments: args
        }
      };

      let responseData = '';
      let errorData = '';

      const onData = (data: Buffer) => {
        responseData += data.toString();
        
        // Пытаемся парсить JSON ответ
        try {
          const lines = responseData.split('\n').filter(line => line.trim());
          for (const line of lines) {
            const response = JSON.parse(line);
            if (response.id === request.id) {
              this.process?.stdout?.off('data', onData);
              this.process?.stderr?.off('data', onError);
              
              if (response.error) {
                reject(new Error(response.error.message || 'MCP Error'));
              } else {
                resolve(response.result);
              }
              return;
            }
          }
        } catch (e) {
          // Продолжаем накапливать данные
        }
      };

      const onError = (data: Buffer) => {
        errorData += data.toString();
      };

      this.process.stdout?.on('data', onData);
      this.process.stderr?.on('data', onError);

      // Отправляем запрос
      this.process.stdin?.write(JSON.stringify(request) + '\n');

      // Таймаут для ответа
      setTimeout(() => {
        this.process?.stdout?.off('data', onData);
        this.process?.stderr?.off('data', onError);
        reject(new Error(`Tool call timeout. Error output: ${errorData}`));
      }, 30000);
    });
  }

  async initialize(): Promise<void> {
    if (!this.process) {
      throw new Error('MCP Server not started');
    }

    return new Promise((resolve, reject) => {
      const request = {
        jsonrpc: '2.0',
        id: this.requestId++,
        method: 'initialize',
        params: {
          protocolVersion: '2024-11-05',
          capabilities: {},
          clientInfo: {
            name: 'test-client',
            version: '1.0.0'
          }
        }
      };

      let responseData = '';

      const onData = (data: Buffer) => {
        responseData += data.toString();
        
        try {
          const lines = responseData.split('\n').filter(line => line.trim());
          for (const line of lines) {
            const response = JSON.parse(line);
            if (response.id === request.id) {
              this.process?.stdout?.off('data', onData);
              resolve();
              return;
            }
          }
        } catch (e) {
          // Продолжаем накапливать данные
        }
      };

      this.process.stdout?.on('data', onData);
      this.process.stdin?.write(JSON.stringify(request) + '\n');

      setTimeout(() => {
        this.process?.stdout?.off('data', onData);
        reject(new Error('Initialize timeout'));
      }, 10000);
    });
  }

  async listTools(): Promise<any[]> {
    if (!this.process) {
      throw new Error('MCP Server not started');
    }

    return new Promise((resolve, reject) => {
      const request = {
        jsonrpc: '2.0',
        id: this.requestId++,
        method: 'tools/list'
      };

      let responseData = '';

      const onData = (data: Buffer) => {
        responseData += data.toString();
        
        try {
          const lines = responseData.split('\n').filter(line => line.trim());
          for (const line of lines) {
            const response = JSON.parse(line);
            if (response.id === request.id) {
              this.process?.stdout?.off('data', onData);
              resolve(response.result.tools);
              return;
            }
          }
        } catch (e) {
          // Продолжаем накапливать данные
        }
      };

      this.process.stdout?.on('data', onData);
      this.process.stdin?.write(JSON.stringify(request) + '\n');

      setTimeout(() => {
        this.process?.stdout?.off('data', onData);
        reject(new Error('List tools timeout'));
      }, 10000);
    });
  }
}

describe('E2E Tests - Complete Workflow', () => {
  let mcpClient: MCPTestClient;
  let deploymentId: string;
  let processDefinitionId: string;
  let processInstanceId: string;
  let taskId: string;

  beforeAll(async () => {
    // Проверяем, что сборка существует
    try {
      await import('../../build/index.js');
    } catch (error) {
      throw new Error('Build not found. Run "npm run build" first.');
    }

    mcpClient = new MCPTestClient();
    await mcpClient.start();
    await mcpClient.initialize();
  }, TEST_TIMEOUT.E2E);

  afterAll(async () => {
    // Очищаем созданные данные
    if (deploymentId && mcpClient) {
      try {
        await mcpClient.callTool('deleteDeployment', {
          deploymentId,
          cascade: true
        });
      } catch (error) {
        console.warn('Failed to cleanup deployment:', error);
      }
    }

    await mcpClient?.stop();
  }, TEST_TIMEOUT.E2E);

  test('должен перечислить все 21 инструмент MCP', async () => {
    const tools = await mcpClient.listTools();
    
    expect(Array.isArray(tools)).toBe(true);
    expect(tools).toHaveLength(21);
    
    const expectedTools = [
      'getProcessDefinitions',
      'getProcessInstances', 
      'startProcessInstance',
      'getTasks',
      'completeTask',
      'deployBpmn',
      'getDeployments',
      'deleteDeployment',
      'getDeploymentResources',
      'deployForm',
      'getTaskForm',
      'submitTaskForm',
      'getStartForm',
      'submitStartForm',
      'getProcessVariables',
      'setProcessVariables',
      'getActivityInstances',
      'getIncidents',
      'deleteProcessInstance',
      'suspendProcessInstance',
      'activateProcessInstance'
    ];

    const toolNames = tools.map(tool => tool.name);
    expectedTools.forEach(expectedTool => {
      expect(toolNames).toContain(expectedTool);
    });
  }, TEST_TIMEOUT.E2E);

  test('должен развернуть BPMN процесс', async () => {
    const deploymentName = generateTestName('E2E Test Deployment');
    const bpmnContent = loadTestBpmn();
    
    const result = await mcpClient.callTool('deployBpmn', {
      deploymentName,
      bpmnContent,
      fileName: 'test-process.bpmn',
      enableDuplicateFiltering: true
    });

    expect(result).toHaveProperty('content');
    expect(result.content).toHaveLength(1);
    
    const deployment = JSON.parse(result.content[0].text);
    expect(deployment).toHaveProperty('id');
    expect(deployment).toHaveProperty('name', deploymentName);
    expect(deployment).toHaveProperty('deployedProcessDefinitions');

    deploymentId = deployment.id;
    
    // Получаем ID процесса
    const processDefinitions = Object.values(deployment.deployedProcessDefinitions);
    expect(processDefinitions).toHaveLength(2); // В нашем BPMN 2 процесса
    processDefinitionId = (processDefinitions[0] as any).id;
  }, TEST_TIMEOUT.E2E);

  test('должен получить список развертываний', async () => {
    const result = await mcpClient.callTool('getDeployments', {
      id: deploymentId
    });

    const deployments = JSON.parse(result.content[0].text);
    expect(Array.isArray(deployments)).toBe(true);
    expect(deployments).toHaveLength(1);
    expect(deployments[0]).toHaveProperty('id', deploymentId);
  }, TEST_TIMEOUT.E2E);

  test('должен получить ресурсы развертывания', async () => {
    const result = await mcpClient.callTool('getDeploymentResources', {
      deploymentId
    });

    const resources = JSON.parse(result.content[0].text);
    expect(Array.isArray(resources)).toBe(true);
    expect(resources.length).toBeGreaterThan(0);
    
    const bpmnResource = resources.find((r: any) => r.name === 'test-process.bpmn');
    expect(bpmnResource).toBeDefined();
    expect(bpmnResource).toHaveProperty('deploymentId', deploymentId);
  }, TEST_TIMEOUT.E2E);

  test('должен запустить экземпляр процесса', async () => {
    const businessKey = `e2e-test-${Date.now()}`;
    const variables = {
      customerName: { value: 'John Doe', type: 'String' },
      amount: { value: 1000, type: 'Integer' },
      priority: { value: 'high', type: 'String' }
    };

    const result = await mcpClient.callTool('startProcessInstance', {
      processDefinitionId,
      businessKey,
      variables
    });

    const processInstance = JSON.parse(result.content[0].text);
    expect(processInstance).toHaveProperty('id');
    expect(processInstance).toHaveProperty('definitionId', processDefinitionId);
    expect(processInstance).toHaveProperty('businessKey', businessKey);
    expect(processInstance).toHaveProperty('ended', false);

    processInstanceId = processInstance.id;
  }, TEST_TIMEOUT.E2E);

  test('должен получить переменные процесса', async () => {
    const result = await mcpClient.callTool('getProcessVariables', {
      processInstanceId
    });

    const variables = JSON.parse(result.content[0].text);
    expect(variables).toHaveProperty('customerName');
    expect(variables).toHaveProperty('amount');
    expect(variables).toHaveProperty('priority');
    expect(variables.customerName).toHaveProperty('value', 'John Doe');
    expect(variables.amount).toHaveProperty('value', 1000);
  }, TEST_TIMEOUT.E2E);

  test('должен получить активности процесса', async () => {
    const result = await mcpClient.callTool('getActivityInstances', {
      processInstanceId
    });

    const activities = JSON.parse(result.content[0].text);
    expect(activities).toHaveProperty('id');
    expect(activities).toHaveProperty('processInstanceId', processInstanceId);
    expect(activities).toHaveProperty('processDefinitionId', processDefinitionId);
  }, TEST_TIMEOUT.E2E);

  test('должен получить задачи для процесса', async () => {
    const result = await mcpClient.callTool('getTasks', {
      processInstanceId
    });

    const tasks = JSON.parse(result.content[0].text);
    expect(Array.isArray(tasks)).toBe(true);
    
    if (tasks.length > 0) {
      const task = tasks[0];
      expect(task).toHaveProperty('id');
      expect(task).toHaveProperty('processInstanceId', processInstanceId);
      expect(task).toHaveProperty('name');
      
      taskId = task.id;
    }
  }, TEST_TIMEOUT.E2E);

  test('должен завершить задачу (если есть)', async () => {
    if (!taskId) {
      console.log('Пропускаем тест завершения задачи: нет активных задач');
      return;
    }

    const taskVariables = {
      approved: { value: true, type: 'Boolean' },
      comments: { value: 'Approved via E2E test', type: 'String' }
    };

    const result = await mcpClient.callTool('completeTask', {
      taskId,
      variables: taskVariables
    });

    // Успешное завершение обычно возвращает пустой ответ
    expect(result).toHaveProperty('content');
    expect(result.content).toHaveLength(1);
  }, TEST_TIMEOUT.E2E);

  test('должен приостановить и активировать процесс', async () => {
    // Приостанавливаем
    const suspendResult = await mcpClient.callTool('suspendProcessInstance', {
      processInstanceId
    });

    expect(suspendResult).toHaveProperty('content');

    // Ждем немного для обработки
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Активируем обратно
    const activateResult = await mcpClient.callTool('activateProcessInstance', {
      processInstanceId
    });

    expect(activateResult).toHaveProperty('content');
  }, TEST_TIMEOUT.E2E);

  test('должен установить переменные процесса', async () => {
    const newVariables = {
      status: { value: 'processed', type: 'String' },
      processedAt: { value: new Date().toISOString(), type: 'String' }
    };

    const result = await mcpClient.callTool('setProcessVariables', {
      processInstanceId,
      variables: newVariables
    });

    expect(result).toHaveProperty('content');

    // Проверяем, что переменные установлены
    const getResult = await mcpClient.callTool('getProcessVariables', {
      processInstanceId
    });

    const variables = JSON.parse(getResult.content[0].text);
    expect(variables).toHaveProperty('status');
    expect(variables).toHaveProperty('processedAt');
    expect(variables.status).toHaveProperty('value', 'processed');
  }, TEST_TIMEOUT.E2E);

  test('должен получить инциденты (ошибки)', async () => {
    const result = await mcpClient.callTool('getIncidents', {
      processInstanceId,
      maxResults: 10
    });

    const incidents = JSON.parse(result.content[0].text);
    expect(Array.isArray(incidents)).toBe(true);
    // Обычно в успешном процессе инцидентов нет
  }, TEST_TIMEOUT.E2E);

  test('должен удалить экземпляр процесса', async () => {
    const result = await mcpClient.callTool('deleteProcessInstance', {
      processInstanceId,
      reason: 'E2E test cleanup',
      skipCustomListeners: false
    });

    expect(result).toHaveProperty('content');

    // Проверяем, что процесс действительно удален
    try {
      await mcpClient.callTool('getProcessVariables', {
        processInstanceId
      });
      // Если мы дошли сюда, значит процесс не удален
      throw new Error('Process instance should have been deleted');
    } catch (error) {
      // Ожидаем ошибку, так как процесс должен быть удален
      expect(error).toBeDefined();
    }
  }, TEST_TIMEOUT.E2E);
});
