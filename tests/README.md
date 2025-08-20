# 🧪 Test Documentation

This document describes the testing system for the Camunda MCP Server.

## 📋 Test Structure

```
tests/
├── unit/                 # Unit tests
│   ├── server.test.ts           # Core server tests
│   └── tools-deployment.test.ts # Deployment tools tests
├── integration/          # Integration tests
│   └── camunda-api.test.ts      # Tests with real Camunda API
├── e2e/                  # End-to-end tests
│   └── complete-workflow.test.ts # Complete workflow tests
├── fixtures/             # Test data
│   ├── test-process.bpmn        # BPMN process for tests
│   └── test-form.json          # Camunda Form for tests
├── utils/                # Test utilities
│   └── test-helpers.ts         # Helper functions
├── setup.ts              # Global test setup
├── integration/setup.ts  # Integration test setup
└── e2e/setup.ts          # E2E test setup
```

## 🚀 Running Tests

### All tests
```bash
npm test                 # Run all tests
npm run test:all         # Run all test types sequentially
npm run test:coverage    # Run with code coverage
```

### By type
```bash
npm run test:unit        # Unit tests only
npm run test:integration # Integration tests only
npm run test:e2e         # E2E tests only
```

### Development mode
```bash
npm run test:watch       # Run in watch mode
```

## ⚙️ Test Configuration

### Environment Variables
```bash
# Camunda settings
CAMUNDA_BASE_URL=http://localhost:8080/engine-rest
CAMUNDA_USERNAME=demo
CAMUNDA_PASSWORD=demo

# Test settings
NODE_ENV=test
TEST_TIMEOUT=30000
```

### Jest Configuration
- **Timeout**: 30 seconds for regular tests, 60 seconds for integration, 120 seconds for E2E
- **Coverage**: 80% threshold for all metrics
- **Parallel execution**: Up to 50% CPU cores
- **ESM support**: Full ES modules support

## 📊 Test Types

### 1. 🧪 Unit Tests
- **Purpose**: Testing individual functions and components
- **Isolation**: Complete isolation with mocks
- **Speed**: Fast (< 5 seconds)
- **Coverage**: All 21 MCP tools

**What is tested:**
- API call correctness
- Error handling
- Parameter validation
- Response formatting

### 2. 🔗 Integration Tests
- **Purpose**: Testing interaction with real Camunda
- **Dependencies**: Requires available Camunda instance
- **Speed**: Medium (< 30 seconds)
- **Cleanup**: Automatic test data cleanup

**What is tested:**
- Camunda API connection
- BPMN deployment
- Process lifecycle
- Task management

### 3. 🎯 End-to-End Tests
- **Purpose**: Testing complete workflows through MCP protocol
- **Realism**: Maximum similarity to real usage
- **Speed**: Slow (< 120 seconds)
- **Complexity**: Complete scenarios from deployment to completion

**What is tested:**
- Complete MCP protocol
- All 21 tools working together
- Real BPMN processes
- Form handling

## 🛠️ Testing Utilities

### Test Helpers
```typescript
// Creating test data
const processDef = createTestProcessDefinition();
const processInstance = createTestProcessInstance();
const task = createTestTask();

// Loading fixtures
const bpmn = loadTestBpmn();
const form = loadTestForm();

// MCP response validation
validateMCPResponse(response);
const data = parseMCPResponse(response);

// Waiting for conditions
await waitForCondition(async () => {
  // condition check
  return true;
});
```

### Mock Helpers
```typescript
// Mock Axios responses
const mockResponse = createMockAxiosResponse(data, 200);
mockedAxios.get.mockResolvedValueOnce(mockResponse);

// Verify calls
expect(mockedAxios.get).toHaveBeenCalledWith(
  'http://test-camunda:8080/engine-rest/process-definition',
  expect.objectContaining({
    auth: { username: 'test', password: 'test' }
  })
);
```

## 🔧 Test Environment Setup

### Global Settings (setup.ts)
- Increase timeout for all tests
- Environment variable setup
- Global mocks and utilities
- Suppress non-critical console.error

### Integration Tests (integration/setup.ts)
- Check Camunda availability
- Utilities for skipping tests when unavailable
- Increased timeout

### E2E Tests (e2e/setup.ts)
- Strict Camunda availability check
- Automatic test data cleanup
- Maximum timeout

## 📈 Code Coverage

### Coverage Targets
- **Branches**: 80%
- **Functions**: 80%
- **Lines**: 80%
- **Statements**: 80%

### Exclusions
- Type files (*.d.ts)
- Test files (*.test.ts, *.spec.ts)

### Reports
- **Text**: Console output
- **LCOV**: For CI/CD integration
- **HTML**: Detailed web report in `coverage/`
- **JSON**: Machine-readable format

## 🚨 Error Handling in Tests

### Skipping Tests
```typescript
// Integration tests
if (await skipIfCamundaUnavailable('Test Name')) {
  return;
}

// Conditional skip
test.skipIf(condition)('test name', () => {
  // test
});
```

### Expected Errors
```typescript
// Testing errors
expect(() => {
  // code that should fail
}).toThrow('Expected error message');

// Async errors
await expect(async () => {
  await someAsyncFunction();
}).rejects.toThrow();
```

## 🔄 Continuous Integration

### GitHub Actions
- Automatic execution on push/PR
- Parallel execution of different test types
- Coverage report upload to Codecov
- Failed test notifications

### Pre-commit hooks
- Run unit tests before commit
- Format checking and linting
- Type checking

### Pre-push hooks
- Full project validation
- System health check

## 📝 Writing Tests

### Naming
```typescript
describe('MCP Server - Process Definitions', () => {
  test('should return list of processes', async () => {
    // test
  });
  
  test('should support filtering', async () => {
    // test
  });
});
```

### Test Structure
```typescript
test('test description', async () => {
  // Arrange - prepare data
  const args = { maxResults: 10 };
  const expectedData = [createTestProcessDefinition()];
  
  // Act - execute action
  const response = await mockServer.callTool('getProcessDefinitions', args);
  
  // Assert - verify results
  validateMCPResponse(response);
  const data = parseMCPResponse(response);
  expect(data).toEqual(expectedData);
});
```

### Best Practices
1. **Isolation**: Each test should be independent
2. **Cleanup**: Always clean up created data
3. **Mocks**: Use mocks for external dependencies in unit tests
4. **Timeout**: Set reasonable timeouts
5. **Description**: Clear and understandable test descriptions
6. **Grouping**: Logical grouping of tests in describe blocks

## 🐛 Debugging Tests

### Logging
```typescript
// Use console.log in tests
console.log('Debug info:', data);

// Or special utilities
console.error('CRITICAL: This will be shown');
```

### Running Individual Tests
```bash
# Single file
npm test -- server.test.ts

# Single test
npm test -- --testNamePattern="should return list of processes"

# With debugging
npm test -- --verbose
```

### Coverage Analysis
```bash
npm run test:coverage
# Open coverage/lcov-report/index.html in browser
```

## 📚 Additional Resources

- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [Testing Library](https://testing-library.com/)
- [Camunda REST API](https://docs.camunda.org/manual/latest/reference/rest/)
- [MCP Protocol](https://modelcontextprotocol.io/)

---

**💡 Tip**: Start with unit tests, then move to integration tests, and finish with E2E tests for maximum development efficiency.