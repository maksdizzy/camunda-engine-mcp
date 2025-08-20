/**
 * Интеграционные тесты с реальным Camunda API
 */

import { describe, test, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import axios from 'axios';
import { 
  TEST_CONFIG,
  TEST_TIMEOUT,
  loadTestBpmn,
  loadTestForm,
  generateTestId,
  generateTestName,
  cleanupCamundaData
} from '../utils/test-helpers';

// Конфигурация для интеграционных тестов
const { baseUrl, username, password } = TEST_CONFIG;
const authConfig = { auth: { username: username!, password: password! } };

// Массив для отслеживания созданных deployments для очистки
let createdDeployments: string[] = [];

describe('Integration Tests - Camunda API Connection', () => {
  beforeAll(async () => {
    // Проверяем доступность Camunda перед запуском тестов
    if (await global.skipIfCamundaUnavailable('Camunda API Connection')) {
      return;
    }
  }, TEST_TIMEOUT.INTEGRATION);

  afterAll(async () => {
    // Очищаем созданные данные
    await cleanupCamundaData(createdDeployments);
  });

  beforeEach(() => {
    createdDeployments = [];
  });

  test('должен подключаться к Camunda Engine', async () => {
    const response = await axios.get(`${baseUrl}/engine`, authConfig);
    
    expect(response.status).toBe(200);
    expect(response.data).toHaveProperty('name');
  }, TEST_TIMEOUT.INTEGRATION);

  test('должен получать информацию о версии', async () => {
    const response = await axios.get(`${baseUrl}/version`, authConfig);
    
    expect(response.status).toBe(200);
    expect(response.data).toHaveProperty('version');
    expect(response.data).toHaveProperty('edition');
  }, TEST_TIMEOUT.INTEGRATION);

  test('должен получать список процессов', async () => {
    const response = await axios.get(`${baseUrl}/process-definition`, {
      ...authConfig,
      params: { maxResults: 5 }
    });
    
    expect(response.status).toBe(200);
    expect(Array.isArray(response.data)).toBe(true);
    
    if (response.data.length > 0) {
      const processDef = response.data[0];
      expect(processDef).toHaveProperty('id');
      expect(processDef).toHaveProperty('key');
      expect(processDef).toHaveProperty('name');
      expect(processDef).toHaveProperty('version');
    }
  }, TEST_TIMEOUT.INTEGRATION);

  test('должен получать список экземпляров процессов', async () => {
    const response = await axios.get(`${baseUrl}/process-instance`, {
      ...authConfig,
      params: { maxResults: 5 }
    });
    
    expect(response.status).toBe(200);
    expect(Array.isArray(response.data)).toBe(true);
  }, TEST_TIMEOUT.INTEGRATION);

  test('должен получать список задач', async () => {
    const response = await axios.get(`${baseUrl}/task`, {
      ...authConfig,
      params: { maxResults: 5 }
    });
    
    expect(response.status).toBe(200);
    expect(Array.isArray(response.data)).toBe(true);
  }, TEST_TIMEOUT.INTEGRATION);
});

describe('Integration Tests - BPMN Deployment', () => {
  beforeAll(async () => {
    if (await global.skipIfCamundaUnavailable('BPMN Deployment')) {
      return;
    }
  });

  afterAll(async () => {
    await cleanupCamundaData(createdDeployments);
  });

  test('должен развертывать BPMN процесс', async () => {
    const deploymentName = generateTestName('Integration Test Deployment');
    const bpmnContent = loadTestBpmn();
    
    const FormData = (await import('form-data')).default;
    const formData = new FormData();
    formData.append('deployment-name', deploymentName);
    formData.append('test-process.bpmn', bpmnContent, {
      filename: 'test-process.bpmn',
      contentType: 'application/xml'
    });

    const response = await axios.post(`${baseUrl}/deployment/create`, formData, {
      ...authConfig,
      headers: formData.getHeaders()
    });

    expect(response.status).toBe(200);
    expect(response.data).toHaveProperty('id');
    expect(response.data).toHaveProperty('name', deploymentName);
    expect(response.data).toHaveProperty('deploymentTime');
    expect(response.data).toHaveProperty('deployedProcessDefinitions');

    // Сохраняем ID для очистки
    createdDeployments.push(response.data.id);

    // Проверяем, что процесс действительно развернут
    const processDefsResponse = await axios.get(`${baseUrl}/process-definition`, {
      ...authConfig,
      params: { deploymentId: response.data.id }
    });

    expect(processDefsResponse.status).toBe(200);
    expect(processDefsResponse.data.length).toBeGreaterThan(0);
  }, TEST_TIMEOUT.INTEGRATION);

  test('должен получать список развертываний', async () => {
    const response = await axios.get(`${baseUrl}/deployment`, {
      ...authConfig,
      params: { maxResults: 10 }
    });

    expect(response.status).toBe(200);
    expect(Array.isArray(response.data)).toBe(true);
    
    if (response.data.length > 0) {
      const deployment = response.data[0];
      expect(deployment).toHaveProperty('id');
      expect(deployment).toHaveProperty('name');
      expect(deployment).toHaveProperty('deploymentTime');
    }
  }, TEST_TIMEOUT.INTEGRATION);

  test('должен получать ресурсы развертывания', async () => {
    // Сначала создаем развертывание
    const deploymentName = generateTestName('Resource Test Deployment');
    const bpmnContent = loadTestBpmn();
    
    const FormData = (await import('form-data')).default;
    const formData = new FormData();
    formData.append('deployment-name', deploymentName);
    formData.append('test-process.bpmn', bpmnContent, {
      filename: 'test-process.bpmn',
      contentType: 'application/xml'
    });

    const deployResponse = await axios.post(`${baseUrl}/deployment/create`, formData, {
      ...authConfig,
      headers: formData.getHeaders()
    });

    createdDeployments.push(deployResponse.data.id);

    // Получаем ресурсы
    const resourcesResponse = await axios.get(`${baseUrl}/deployment/${deployResponse.data.id}/resources`, authConfig);

    expect(resourcesResponse.status).toBe(200);
    expect(Array.isArray(resourcesResponse.data)).toBe(true);
    expect(resourcesResponse.data.length).toBeGreaterThan(0);
    
    const resource = resourcesResponse.data[0];
    expect(resource).toHaveProperty('id');
    expect(resource).toHaveProperty('name');
    expect(resource).toHaveProperty('deploymentId', deployResponse.data.id);
  }, TEST_TIMEOUT.INTEGRATION);
});

describe('Integration Tests - Process Lifecycle', () => {
  let deploymentId: string;
  let processDefinitionId: string;
  let processInstanceId: string;

  beforeAll(async () => {
    if (await global.skipIfCamundaUnavailable('Process Lifecycle')) {
      return;
    }

    // Создаем тестовый процесс для lifecycle тестов
    const deploymentName = generateTestName('Lifecycle Test Deployment');
    const bpmnContent = loadTestBpmn();
    
    const FormData = (await import('form-data')).default;
    const formData = new FormData();
    formData.append('deployment-name', deploymentName);
    formData.append('test-process.bpmn', bpmnContent, {
      filename: 'test-process.bpmn',
      contentType: 'application/xml'
    });

    const deployResponse = await axios.post(`${baseUrl}/deployment/create`, formData, {
      ...authConfig,
      headers: formData.getHeaders()
    });

    deploymentId = deployResponse.data.id;
    createdDeployments.push(deploymentId);

    // Получаем ID процесса
    const processDefsResponse = await axios.get(`${baseUrl}/process-definition`, {
      ...authConfig,
      params: { deploymentId }
    });

    processDefinitionId = processDefsResponse.data[0].id;
  }, TEST_TIMEOUT.INTEGRATION);

  afterAll(async () => {
    await cleanupCamundaData(createdDeployments);
  });

  test('должен запускать экземпляр процесса', async () => {
    const businessKey = generateTestId('business-key');
    const variables = {
      testVar: { value: 'test-value', type: 'String' },
      testNumber: { value: 42, type: 'Integer' }
    };

    const response = await axios.post(`${baseUrl}/process-definition/${processDefinitionId}/start`, {
      businessKey,
      variables
    }, authConfig);

    expect(response.status).toBe(200);
    expect(response.data).toHaveProperty('id');
    expect(response.data).toHaveProperty('definitionId', processDefinitionId);
    expect(response.data).toHaveProperty('businessKey', businessKey);
    expect(response.data).toHaveProperty('ended', false);

    processInstanceId = response.data.id;
  }, TEST_TIMEOUT.INTEGRATION);

  test('должен получать переменные процесса', async () => {
    if (!processInstanceId) {
      console.log('Пропускаем тест: нет активного экземпляра процесса');
      return;
    }

    const response = await axios.get(`${baseUrl}/process-instance/${processInstanceId}/variables`, authConfig);

    expect(response.status).toBe(200);
    expect(response.data).toHaveProperty('testVar');
    expect(response.data).toHaveProperty('testNumber');
    expect(response.data.testVar).toHaveProperty('value', 'test-value');
    expect(response.data.testNumber).toHaveProperty('value', 42);
  }, TEST_TIMEOUT.INTEGRATION);

  test('должен получать активности экземпляра процесса', async () => {
    if (!processInstanceId) {
      console.log('Пропускаем тест: нет активного экземпляра процесса');
      return;
    }

    const response = await axios.get(`${baseUrl}/process-instance/${processInstanceId}/activity-instances`, authConfig);

    expect(response.status).toBe(200);
    expect(response.data).toHaveProperty('id');
    expect(response.data).toHaveProperty('processInstanceId', processInstanceId);
    expect(response.data).toHaveProperty('processDefinitionId', processDefinitionId);
  }, TEST_TIMEOUT.INTEGRATION);

  test('должен получать задачи для экземпляра процесса', async () => {
    if (!processInstanceId) {
      console.log('Пропускаем тест: нет активного экземпляра процесса');
      return;
    }

    const response = await axios.get(`${baseUrl}/task`, {
      ...authConfig,
      params: { processInstanceId }
    });

    expect(response.status).toBe(200);
    expect(Array.isArray(response.data)).toBe(true);
    
    // Если есть задачи, проверяем их структуру
    if (response.data.length > 0) {
      const task = response.data[0];
      expect(task).toHaveProperty('id');
      expect(task).toHaveProperty('processInstanceId', processInstanceId);
      expect(task).toHaveProperty('processDefinitionId', processDefinitionId);
    }
  }, TEST_TIMEOUT.INTEGRATION);

  test('должен приостанавливать и активировать экземпляр процесса', async () => {
    if (!processInstanceId) {
      console.log('Пропускаем тест: нет активного экземпляра процесса');
      return;
    }

    // Приостанавливаем
    const suspendResponse = await axios.put(`${baseUrl}/process-instance/${processInstanceId}/suspended`, {
      suspended: true
    }, authConfig);

    expect(suspendResponse.status).toBe(204);

    // Проверяем, что процесс приостановлен
    const instanceResponse = await axios.get(`${baseUrl}/process-instance/${processInstanceId}`, authConfig);
    expect(instanceResponse.data).toHaveProperty('suspended', true);

    // Активируем обратно
    const activateResponse = await axios.put(`${baseUrl}/process-instance/${processInstanceId}/suspended`, {
      suspended: false
    }, authConfig);

    expect(activateResponse.status).toBe(204);

    // Проверяем, что процесс активен
    const activeInstanceResponse = await axios.get(`${baseUrl}/process-instance/${processInstanceId}`, authConfig);
    expect(activeInstanceResponse.data).toHaveProperty('suspended', false);
  }, TEST_TIMEOUT.INTEGRATION);
});
