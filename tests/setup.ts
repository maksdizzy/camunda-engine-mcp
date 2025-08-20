/**
 * Глобальная настройка для всех тестов
 */

// Увеличиваем таймаут для всех тестов
jest.setTimeout(30000);

// Настройка переменных окружения для тестов
process.env.NODE_ENV = 'test';
process.env.CAMUNDA_BASE_URL = process.env.CAMUNDA_BASE_URL || 'http://localhost:8080/engine-rest';
process.env.CAMUNDA_USERNAME = process.env.CAMUNDA_USERNAME || 'demo';
process.env.CAMUNDA_PASSWORD = process.env.CAMUNDA_PASSWORD || 'demo';

// Подавляем console.error в тестах, если не нужно их видеть
const originalConsoleError = console.error;
console.error = (...args: any[]) => {
  // Показываем только критические ошибки
  if (args[0] && typeof args[0] === 'string' && args[0].includes('CRITICAL')) {
    originalConsoleError(...args);
  }
};
