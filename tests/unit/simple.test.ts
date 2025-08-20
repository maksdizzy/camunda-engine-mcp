/**
 * Простые юнит-тесты для проверки настройки Jest
 */

import { describe, test, expect } from '@jest/globals';

describe('Basic Test Suite', () => {
  test('should run basic test', () => {
    expect(1 + 1).toBe(2);
  });

  test('should handle async operations', async () => {
    const result = await Promise.resolve('test');
    expect(result).toBe('test');
  });

  test('should work with objects', () => {
    const obj = { name: 'test', value: 42 };
    expect(obj).toHaveProperty('name', 'test');
    expect(obj).toHaveProperty('value', 42);
  });
});

describe('Environment Tests', () => {
  test('should have test environment', () => {
    expect(process.env.NODE_ENV).toBe('test');
  });

  test('should have camunda config from setup', () => {
    expect(process.env.CAMUNDA_BASE_URL).toBeDefined();
    expect(process.env.CAMUNDA_USERNAME).toBeDefined();
    expect(process.env.CAMUNDA_PASSWORD).toBeDefined();
  });
});
