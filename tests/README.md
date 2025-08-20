# 🧪 Test Documentation

Данный документ описывает систему тестирования для Camunda MCP Server.

## 📋 Структура тестов

```
tests/
├── unit/                 # Юнит-тесты
│   ├── server.test.ts           # Основные тесты сервера
│   └── tools-deployment.test.ts # Тесты инструментов развертывания
├── integration/          # Интеграционные тесты
│   └── camunda-api.test.ts      # Тесты с реальным Camunda API
├── e2e/                  # End-to-end тесты
│   └── complete-workflow.test.ts # Полные workflow тесты
├── fixtures/             # Тестовые данные
│   ├── test-process.bpmn        # BPMN процесс для тестов
│   └── test-form.json          # Camunda Form для тестов
├── utils/                # Утилиты для тестов
│   └── test-helpers.ts         # Вспомогательные функции
├── setup.ts              # Глобальная настройка тестов
├── integration/setup.ts  # Настройка интеграционных тестов
└── e2e/setup.ts          # Настройка E2E тестов
```

## 🚀 Запуск тестов

### Все тесты
```bash
npm test                 # Запустить все тесты
npm run test:all         # Запустить все типы тестов последовательно
npm run test:coverage    # Запустить с покрытием кода
```

### По типам
```bash
npm run test:unit        # Только юнит-тесты
npm run test:integration # Только интеграционные тесты
npm run test:e2e         # Только E2E тесты
```

### В режиме разработки
```bash
npm run test:watch       # Запуск в watch режиме
```

## ⚙️ Конфигурация тестов

### Переменные окружения
```bash
# Camunda настройки
CAMUNDA_BASE_URL=http://localhost:8080/engine-rest
CAMUNDA_USERNAME=demo
CAMUNDA_PASSWORD=demo

# Настройки тестов
NODE_ENV=test
TEST_TIMEOUT=30000
```

### Jest конфигурация
- **Timeout**: 30 секунд для обычных тестов, 60 секунд для интеграционных, 120 секунд для E2E
- **Coverage**: 80% порог для всех метрик
- **Parallel execution**: До 50% CPU cores
- **ESM support**: Полная поддержка ES модулей

## 📊 Типы тестов

### 1. 🧪 Юнит-тесты
- **Цель**: Тестирование отдельных функций и компонентов
- **Изоляция**: Полная изоляция с моками
- **Скорость**: Быстрые (< 5 секунд)
- **Покрытие**: Все 21 MCP инструмент

**Что тестируется:**
- Корректность вызовов API
- Обработка ошибок
- Валидация параметров
- Форматирование ответов

### 2. 🔗 Интеграционные тесты
- **Цель**: Тестирование взаимодействия с реальным Camunda
- **Зависимости**: Требует доступного Camunda instance
- **Скорость**: Средние (< 30 секунд)
- **Очистка**: Автоматическая очистка тестовых данных

**Что тестируется:**
- Подключение к Camunda API
- BPMN развертывание
- Жизненный цикл процессов
- Управление задачами

### 3. 🎯 End-to-End тесты
- **Цель**: Тестирование полных workflow через MCP протокол
- **Реализм**: Максимально приближено к реальному использованию
- **Скорость**: Медленные (< 120 секунд)
- **Комплексность**: Полные сценарии от развертывания до завершения

**Что тестируется:**
- Полный MCP протокол
- Все 21 инструмент в связке
- Реальные BPMN процессы
- Обработка форм

## 🛠️ Утилиты тестирования

### Test Helpers
```typescript
// Создание тестовых данных
const processDef = createTestProcessDefinition();
const processInstance = createTestProcessInstance();
const task = createTestTask();

// Загрузка фикстур
const bpmn = loadTestBpmn();
const form = loadTestForm();

// Валидация ответов MCP
validateMCPResponse(response);
const data = parseMCPResponse(response);

// Ожидание условий
await waitForCondition(async () => {
  // проверка условия
  return true;
});
```

### Mock Helpers
```typescript
// Мок Axios ответов
const mockResponse = createMockAxiosResponse(data, 200);
mockedAxios.get.mockResolvedValueOnce(mockResponse);

// Проверка вызовов
expect(mockedAxios.get).toHaveBeenCalledWith(
  'http://test-camunda:8080/engine-rest/process-definition',
  expect.objectContaining({
    auth: { username: 'test', password: 'test' }
  })
);
```

## 🔧 Настройка тестовой среды

### Глобальные настройки (setup.ts)
- Увеличение timeout для всех тестов
- Настройка переменных окружения
- Глобальные моки и утилиты
- Подавление не критичных console.error

### Интеграционные тесты (integration/setup.ts)
- Проверка доступности Camunda
- Утилиты для пропуска тестов при недоступности
- Увеличенный timeout

### E2E тесты (e2e/setup.ts)
- Строгая проверка доступности Camunda
- Автоматическая очистка тестовых данных
- Максимальный timeout

## 📈 Покрытие кода

### Цели покрытия
- **Branches**: 80%
- **Functions**: 80%
- **Lines**: 80%
- **Statements**: 80%

### Исключения
- Файлы типов (*.d.ts)
- Тестовые файлы (*.test.ts, *.spec.ts)

### Отчеты
- **Text**: Консольный вывод
- **LCOV**: Для CI/CD интеграции
- **HTML**: Детальный веб-отчет в `coverage/`
- **JSON**: Машиночитаемый формат

## 🚨 Обработка ошибок в тестах

### Пропуск тестов
```typescript
// Интеграционные тесты
if (await skipIfCamundaUnavailable('Test Name')) {
  return;
}

// Условный пропуск
test.skipIf(condition)('test name', () => {
  // тест
});
```

### Ожидаемые ошибки
```typescript
// Тестирование ошибок
expect(() => {
  // код который должен упасть
}).toThrow('Expected error message');

// Асинхронные ошибки
await expect(async () => {
  await someAsyncFunction();
}).rejects.toThrow();
```

## 🔄 Continuous Integration

### GitHub Actions
- Автоматический запуск на push/PR
- Параллельное выполнение разных типов тестов
- Загрузка отчетов покрытия в Codecov
- Уведомления о неудачных тестах

### Pre-commit hooks
- Запуск юнит-тестов перед коммитом
- Проверка форматирования и линтинг
- Type checking

### Pre-push hooks
- Полная валидация проекта
- Health check системы

## 📝 Написание тестов

### Именование
```typescript
describe('MCP Server - Process Definitions', () => {
  test('должен возвращать список процессов', async () => {
    // тест
  });
  
  test('должен поддерживать фильтрацию', async () => {
    // тест
  });
});
```

### Структура теста
```typescript
test('описание теста', async () => {
  // Arrange - подготовка данных
  const args = { maxResults: 10 };
  const expectedData = [createTestProcessDefinition()];
  
  // Act - выполнение действия
  const response = await mockServer.callTool('getProcessDefinitions', args);
  
  // Assert - проверка результатов
  validateMCPResponse(response);
  const data = parseMCPResponse(response);
  expect(data).toEqual(expectedData);
});
```

### Best Practices
1. **Изоляция**: Каждый тест должен быть независимым
2. **Очистка**: Всегда очищайте созданные данные
3. **Моки**: Используйте моки для внешних зависимостей в юнит-тестах
4. **Timeout**: Устанавливайте разумные timeout'ы
5. **Описание**: Четкие и понятные описания тестов
6. **Группировка**: Логическая группировка тестов в describe блоки

## 🐛 Отладка тестов

### Логирование
```typescript
// В тестах можно использовать console.log
console.log('Debug info:', data);

// Или специальные утилиты
console.error('CRITICAL: This will be shown');
```

### Запуск отдельных тестов
```bash
# Один файл
npm test -- server.test.ts

# Один тест
npm test -- --testNamePattern="должен возвращать список процессов"

# С отладкой
npm test -- --verbose
```

### Анализ покрытия
```bash
npm run test:coverage
# Откройте coverage/lcov-report/index.html в браузере
```

## 📚 Дополнительные ресурсы

- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [Testing Library](https://testing-library.com/)
- [Camunda REST API](https://docs.camunda.org/manual/latest/reference/rest/)
- [MCP Protocol](https://modelcontextprotocol.io/)

---

**💡 Совет**: Начинайте с юнит-тестов, затем переходите к интеграционным, и завершайте E2E тестами для максимальной эффективности разработки.
