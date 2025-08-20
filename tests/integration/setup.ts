/**
 * Настройка для интеграционных тестов
 */

import axios from 'axios';

// Увеличиваем таймаут для интеграционных тестов
jest.setTimeout(60000);

// Проверяем доступность Camunda перед запуском интеграционных тестов
beforeAll(async () => {
  const baseUrl = process.env.CAMUNDA_BASE_URL;
  const username = process.env.CAMUNDA_USERNAME;
  const password = process.env.CAMUNDA_PASSWORD;

  if (!baseUrl || !username || !password) {
    console.warn('⚠️  Пропускаем интеграционные тесты: отсутствуют настройки Camunda');
    return;
  }

  try {
    // Проверяем доступность Camunda engine
    const response = await axios.get(`${baseUrl}/engine`, {
      auth: { username, password },
      timeout: 10000
    });
    
    if (response.status === 200) {
      console.log('✅ Camunda engine доступен для интеграционных тестов');
    }
  } catch (error) {
    console.error('❌ Camunda engine недоступен:', error instanceof Error ? error.message : error);
    console.warn('⚠️  Некоторые интеграционные тесты могут быть пропущены');
  }
});

// Утилита для проверки доступности Camunda в тестах
export const isCamundaAvailable = async (): Promise<boolean> => {
  const baseUrl = process.env.CAMUNDA_BASE_URL;
  const username = process.env.CAMUNDA_USERNAME;
  const password = process.env.CAMUNDA_PASSWORD;

  if (!baseUrl || !username || !password) {
    return false;
  }

  try {
    const response = await axios.get(`${baseUrl}/engine`, {
      auth: { username, password },
      timeout: 5000
    });
    return response.status === 200;
  } catch {
    return false;
  }
};

// Глобальная функция для пропуска тестов если Camunda недоступен
global.skipIfCamundaUnavailable = async (testName?: string) => {
  const available = await isCamundaAvailable();
  if (!available) {
    console.log(`⏭️  Пропускаем тест ${testName || ''}: Camunda недоступен`);
    return true;
  }
  return false;
};

declare global {
  function skipIfCamundaUnavailable(testName?: string): Promise<boolean>;
}
