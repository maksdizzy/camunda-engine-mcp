/**
 * Global setup for all tests
 */

// Increase timeout for all tests
jest.setTimeout(30000);

// Setup environment variables for tests
process.env.NODE_ENV = 'test';
process.env.CAMUNDA_BASE_URL = process.env.CAMUNDA_BASE_URL || 'http://localhost:8080/engine-rest';
process.env.CAMUNDA_USERNAME = process.env.CAMUNDA_USERNAME || 'demo';
process.env.CAMUNDA_PASSWORD = process.env.CAMUNDA_PASSWORD || 'demo';

// Suppress console.error in tests unless needed
const originalConsoleError = console.error;
console.error = (...args: any[]) => {
  // Show only critical errors
  if (args[0] && typeof args[0] === 'string' && args[0].includes('CRITICAL')) {
    originalConsoleError(...args);
  }
};
