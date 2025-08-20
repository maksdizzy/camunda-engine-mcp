/**
 * Настройка для end-to-end тестов
 */

import axios from 'axios';

// Увеличиваем таймаут для E2E тестов
jest.setTimeout(120000);

// Настройка для E2E тестов с реальным Camunda
beforeAll(async () => {
  const baseUrl = process.env.CAMUNDA_BASE_URL;
  const username = process.env.CAMUNDA_USERNAME;
  const password = process.env.CAMUNDA_PASSWORD;

  if (!baseUrl || !username || !password) {
    throw new Error('E2E тесты требуют настройки Camunda: CAMUNDA_BASE_URL, CAMUNDA_USERNAME, CAMUNDA_PASSWORD');
  }

  try {
    // Проверяем доступность и готовность Camunda
    const engineResponse = await axios.get(`${baseUrl}/engine`, {
      auth: { username, password },
      timeout: 15000
    });
    
    if (engineResponse.status !== 200) {
      throw new Error(`Camunda engine недоступен: ${engineResponse.status}`);
    }

    // Проверяем доступность основных API endpoints
    await axios.get(`${baseUrl}/process-definition`, {
      auth: { username, password },
      params: { maxResults: 1 }
    });

    console.log('✅ Camunda готов для E2E тестов');
  } catch (error) {
    throw new Error(`Не удалось подключиться к Camunda для E2E тестов: ${error instanceof Error ? error.message : error}`);
  }
});

// Очистка после E2E тестов
afterAll(async () => {
  // Очищаем тестовые данные, если они были созданы
  await cleanupTestData();
});

// Утилита для очистки тестовых данных
export const cleanupTestData = async (): Promise<void> => {
  const baseUrl = process.env.CAMUNDA_BASE_URL;
  const username = process.env.CAMUNDA_USERNAME;
  const password = process.env.CAMUNDA_PASSWORD;

  if (!baseUrl || !username || !password) {
    return;
  }

  try {
    // Получаем все deployments с тестовыми именами
    const deploymentsResponse = await axios.get(`${baseUrl}/deployment`, {
      auth: { username, password },
      params: { nameLike: 'test-' }
    });

    const testDeployments = deploymentsResponse.data || [];

    // Удаляем тестовые deployments
    for (const deployment of testDeployments) {
      try {
        await axios.delete(`${baseUrl}/deployment/${deployment.id}`, {
          auth: { username, password },
          params: { cascade: true }
        });
        console.log(`🧹 Удален тестовый deployment: ${deployment.name}`);
      } catch (error) {
        console.warn(`⚠️  Не удалось удалить deployment ${deployment.id}:`, error instanceof Error ? error.message : error);
      }
    }
  } catch (error) {
    console.warn('⚠️  Ошибка при очистке тестовых данных:', error instanceof Error ? error.message : error);
  }
};

// Утилита для создания уникальных имен для тестов
export const generateTestName = (prefix: string = 'test'): string => {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(7);
  return `${prefix}-${timestamp}-${random}`;
};

// Глобальные утилиты для E2E тестов
global.cleanupTestData = cleanupTestData;
global.generateTestName = generateTestName;

declare global {
  function cleanupTestData(): Promise<void>;
  function generateTestName(prefix?: string): string;
}
