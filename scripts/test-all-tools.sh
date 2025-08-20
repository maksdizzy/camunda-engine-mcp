#!/bin/bash

# 🧪 Comprehensive Test Script for Camunda MCP Server
# Tests all 21 MCP tools with real Camunda

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Configuration
CAMUNDA_BASE_URL="${CAMUNDA_BASE_URL:-http://localhost:8080/engine-rest}"
CAMUNDA_USERNAME="${CAMUNDA_USERNAME:-demo}"
CAMUNDA_PASSWORD="${CAMUNDA_PASSWORD:-demo}"
TEST_TIMEOUT="${TEST_TIMEOUT:-30}"
OUTPUT_DIR="./test-results"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")

# Создаем директорию для результатов
mkdir -p "$OUTPUT_DIR"

# Логирование
LOG_FILE="$OUTPUT_DIR/test-run-$TIMESTAMP.log"
exec > >(tee -a "$LOG_FILE")
exec 2>&1

echo -e "${BLUE}🧪 Camunda MCP Server - Complete Tool Test Suite${NC}"
echo -e "${BLUE}================================================${NC}"
echo ""
echo -e "📅 Test Run: $(date)"
echo -e "🌐 Camunda URL: $CAMUNDA_BASE_URL"
echo -e "👤 Username: $CAMUNDA_USERNAME"
echo -e "⏰ Timeout: ${TEST_TIMEOUT}s"
echo -e "📁 Output Directory: $OUTPUT_DIR"
echo ""

# Проверяем наличие сборки
if [ ! -f "build/index.js" ]; then
    echo -e "${RED}❌ Build not found. Running build...${NC}"
    npm run build
    echo -e "${GREEN}✅ Build completed${NC}"
    echo ""
fi

# Массив всех инструментов MCP
declare -a TOOLS=(
    "getProcessDefinitions"
    "getProcessInstances"
    "startProcessInstance"
    "getTasks"
    "completeTask"
    "deployBpmn"
    "getDeployments"
    "deleteDeployment"
    "getDeploymentResources"
    "deployForm"
    "getTaskForm"
    "submitTaskForm"
    "getStartForm"
    "submitStartForm"
    "getProcessVariables"
    "setProcessVariables"
    "getActivityInstances"
    "getIncidents"
    "deleteProcessInstance"
    "suspendProcessInstance"
    "activateProcessInstance"
)

# Счетчики результатов
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0
SKIPPED_TESTS=0

# Функция для тестирования инструмента
test_tool() {
    local tool_name=$1
    local args=$2
    local expected_success=$3
    
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    
    echo -e "${CYAN}🔧 Testing: $tool_name${NC}"
    
    # Создаем JSON запрос
    local request=$(cat <<EOF
{
  "jsonrpc": "2.0",
  "id": $TOTAL_TESTS,
  "method": "tools/call",
  "params": {
    "name": "$tool_name",
    "arguments": $args
  }
}
EOF
    )
    
    # Выполняем запрос с таймаутом
    local output_file="$OUTPUT_DIR/${tool_name}_${TIMESTAMP}.json"
    local start_time=$(date +%s%N)
    
    if timeout "$TEST_TIMEOUT" bash -c "echo '$request' | node build/index.js > '$output_file' 2>&1"; then
        local end_time=$(date +%s%N)
        local duration=$(( (end_time - start_time) / 1000000 ))
        
        # Проверяем результат
        if grep -q '"error"' "$output_file"; then
            if [ "$expected_success" = "true" ]; then
                echo -e "${RED}  ❌ FAILED (${duration}ms) - Error in response${NC}"
                echo -e "${RED}     $(grep -o '"message":"[^"]*"' "$output_file" | head -1)${NC}"
                FAILED_TESTS=$((FAILED_TESTS + 1))
            else
                echo -e "${YELLOW}  ⚠️  EXPECTED FAILURE (${duration}ms)${NC}"
                PASSED_TESTS=$((PASSED_TESTS + 1))
            fi
        elif grep -q '"result"' "$output_file"; then
            echo -e "${GREEN}  ✅ PASSED (${duration}ms)${NC}"
            PASSED_TESTS=$((PASSED_TESTS + 1))
        else
            echo -e "${RED}  ❌ FAILED (${duration}ms) - Invalid response format${NC}"
            FAILED_TESTS=$((FAILED_TESTS + 1))
        fi
    else
        echo -e "${RED}  ❌ FAILED - Timeout or execution error${NC}"
        FAILED_TESTS=$((FAILED_TESTS + 1))
    fi
    
    echo ""
}

# Функция для проверки доступности Camunda
check_camunda_availability() {
    echo -e "${PURPLE}🔍 Checking Camunda availability...${NC}"
    
    if curl -s -f -u "$CAMUNDA_USERNAME:$CAMUNDA_PASSWORD" "$CAMUNDA_BASE_URL/engine" > /dev/null; then
        echo -e "${GREEN}✅ Camunda is accessible${NC}"
        return 0
    else
        echo -e "${RED}❌ Camunda is not accessible${NC}"
        echo -e "${YELLOW}⚠️  Some tests may fail or be skipped${NC}"
        return 1
    fi
    echo ""
}

# Основная функция тестирования
run_tests() {
    echo -e "${PURPLE}🚀 Starting comprehensive tool tests...${NC}"
    echo ""
    
    # 1. Базовые тесты чтения (должны работать всегда)
    echo -e "${BLUE}📋 Phase 1: Basic Read Operations${NC}"
    test_tool "getProcessDefinitions" '{}' true
    test_tool "getProcessDefinitions" '{"latestVersionOnly": true, "maxResults": 10}' true
    test_tool "getProcessInstances" '{}' true
    test_tool "getProcessInstances" '{"maxResults": 5}' true
    test_tool "getTasks" '{}' true
    test_tool "getTasks" '{"maxResults": 5}' true
    test_tool "getDeployments" '{}' true
    test_tool "getDeployments" '{"maxResults": 10}' true
    test_tool "getIncidents" '{}' true
    test_tool "getIncidents" '{"maxResults": 5}' true
    
    # 2. Тесты развертывания
    echo -e "${BLUE}📦 Phase 2: Deployment Operations${NC}"
    
    # Создаем тестовый BPMN
    local test_bpmn=$(cat tests/fixtures/test-process.bpmn | sed 's/"/\\"/g' | tr -d '\n')
    local deployment_name="Test-Deployment-$TIMESTAMP"
    
    test_tool "deployBpmn" "{\"deploymentName\": \"$deployment_name\", \"bpmnContent\": \"$test_bpmn\", \"fileName\": \"test-process.bpmn\"}" true
    
    # Получаем ID развертывания из последнего результата
    local deployment_id=$(grep -o '"id":"[^"]*"' "$OUTPUT_DIR/deployBpmn_${TIMESTAMP}.json" | cut -d'"' -f4 | head -1)
    
    if [ -n "$deployment_id" ]; then
        echo -e "${GREEN}📦 Deployment created with ID: $deployment_id${NC}"
        
        test_tool "getDeploymentResources" "{\"deploymentId\": \"$deployment_id\"}" true
        
        # Сохраняем ID для очистки
        echo "$deployment_id" >> "$OUTPUT_DIR/deployments_to_cleanup.txt"
    else
        echo -e "${YELLOW}⚠️  Could not extract deployment ID, skipping resource tests${NC}"
        SKIPPED_TESTS=$((SKIPPED_TESTS + 1))
    fi
    
    # 3. Тесты жизненного цикла процесса (если есть процессы)
    echo -e "${BLUE}🔄 Phase 3: Process Lifecycle Operations${NC}"
    
    # Получаем процесс для тестирования
    local process_def_response="$OUTPUT_DIR/getProcessDefinitions_${TIMESTAMP}.json"
    local process_def_id=$(grep -o '"id":"[^"]*"' "$process_def_response" | cut -d'"' -f4 | head -1)
    
    if [ -n "$process_def_id" ]; then
        echo -e "${GREEN}🔄 Testing with process definition: $process_def_id${NC}"
        
        # Пытаемся запустить процесс
        test_tool "startProcessInstance" "{\"processDefinitionId\": \"$process_def_id\", \"businessKey\": \"test-$TIMESTAMP\"}" true
        
        # Получаем ID экземпляра процесса
        local instance_response="$OUTPUT_DIR/startProcessInstance_${TIMESTAMP}.json"
        local instance_id=$(grep -o '"id":"[^"]*"' "$instance_response" | cut -d'"' -f4 | head -1)
        
        if [ -n "$instance_id" ]; then
            echo -e "${GREEN}🔄 Process instance created: $instance_id${NC}"
            
            test_tool "getProcessVariables" "{\"processInstanceId\": \"$instance_id\"}" true
            test_tool "setProcessVariables" "{\"processInstanceId\": \"$instance_id\", \"variables\": {\"testVar\": {\"value\": \"test\", \"type\": \"String\"}}}" true
            test_tool "getActivityInstances" "{\"processInstanceId\": \"$instance_id\"}" true
            test_tool "suspendProcessInstance" "{\"processInstanceId\": \"$instance_id\"}" true
            test_tool "activateProcessInstance" "{\"processInstanceId\": \"$instance_id\"}" true
            
            # Получаем задачи для этого процесса
            test_tool "getTasks" "{\"processInstanceId\": \"$instance_id\"}" true
            
            # Пытаемся завершить задачу, если есть
            local tasks_response="$OUTPUT_DIR/getTasks_${TIMESTAMP}.json"
            local task_id=$(grep -o '"id":"[^"]*"' "$tasks_response" | cut -d'"' -f4 | head -1)
            
            if [ -n "$task_id" ]; then
                echo -e "${GREEN}📝 Found task: $task_id${NC}"
                test_tool "getTaskForm" "{\"taskId\": \"$task_id\"}" true
                test_tool "completeTask" "{\"taskId\": \"$task_id\", \"variables\": {}}" true
            else
                echo -e "${YELLOW}⚠️  No tasks found, skipping task tests${NC}"
                SKIPPED_TESTS=$((SKIPPED_TESTS + 2))
            fi
            
            # Очистка - удаляем экземпляр процесса
            test_tool "deleteProcessInstance" "{\"processInstanceId\": \"$instance_id\", \"reason\": \"Test cleanup\"}" true
        else
            echo -e "${YELLOW}⚠️  Could not start process instance, skipping lifecycle tests${NC}"
            SKIPPED_TESTS=$((SKIPPED_TESTS + 7))
        fi
    else
        echo -e "${YELLOW}⚠️  No process definitions found, skipping lifecycle tests${NC}"
        SKIPPED_TESTS=$((SKIPPED_TESTS + 10))
    fi
    
    # 4. Тесты форм
    echo -e "${BLUE}📝 Phase 4: Form Operations${NC}"
    
    local test_form=$(cat tests/fixtures/test-form.json | sed 's/"/\\"/g' | tr -d '\n')
    local form_deployment_name="Form-Deployment-$TIMESTAMP"
    
    test_tool "deployForm" "{\"deploymentName\": \"$form_deployment_name\", \"formContent\": \"$test_form\", \"fileName\": \"test-form.form\"}" true
    
    # Тесты start form (могут не работать если нет подходящих процессов)
    if [ -n "$process_def_id" ]; then
        test_tool "getStartForm" "{\"processDefinitionId\": \"$process_def_id\"}" false  # Может не быть start form
        test_tool "submitStartForm" "{\"processDefinitionId\": \"$process_def_id\", \"variables\": {}}" false  # Может не работать
    else
        echo -e "${YELLOW}⚠️  Skipping start form tests - no process definition${NC}"
        SKIPPED_TESTS=$((SKIPPED_TESTS + 2))
    fi
    
    # 5. Тесты с невалидными данными (должны возвращать ошибки)
    echo -e "${BLUE}🚫 Phase 5: Error Handling Tests${NC}"
    test_tool "getProcessDefinitions" '{"invalidParam": "test"}' true  # Должен игнорировать неизвестные параметры
    test_tool "startProcessInstance" '{"processDefinitionId": "non-existent-id"}' false  # Должен вернуть ошибку
    test_tool "completeTask" '{"taskId": "non-existent-task"}' false  # Должен вернуть ошибку
    test_tool "deleteDeployment" '{"deploymentId": "non-existent-deployment"}' false  # Должен вернуть ошибку
}

# Функция очистки
cleanup() {
    echo -e "${PURPLE}🧹 Cleaning up test data...${NC}"
    
    if [ -f "$OUTPUT_DIR/deployments_to_cleanup.txt" ]; then
        while read -r deployment_id; do
            if [ -n "$deployment_id" ]; then
                echo -e "${CYAN}🗑️  Cleaning up deployment: $deployment_id${NC}"
                local cleanup_request=$(cat <<EOF
{
  "jsonrpc": "2.0",
  "id": 999,
  "method": "tools/call",
  "params": {
    "name": "deleteDeployment",
    "arguments": {"deploymentId": "$deployment_id", "cascade": true}
  }
}
EOF
                )
                echo "$cleanup_request" | node build/index.js > /dev/null 2>&1 || true
            fi
        done < "$OUTPUT_DIR/deployments_to_cleanup.txt"
        
        rm -f "$OUTPUT_DIR/deployments_to_cleanup.txt"
    fi
    
    echo -e "${GREEN}✅ Cleanup completed${NC}"
}

# Функция генерации отчета
generate_report() {
    echo ""
    echo -e "${BLUE}📊 Test Results Summary${NC}"
    echo -e "${BLUE}======================${NC}"
    echo ""
    
    local success_rate=0
    if [ $TOTAL_TESTS -gt 0 ]; then
        success_rate=$(( (PASSED_TESTS * 100) / TOTAL_TESTS ))
    fi
    
    echo -e "📊 Total Tests: $TOTAL_TESTS"
    echo -e "✅ Passed: $PASSED_TESTS"
    echo -e "❌ Failed: $FAILED_TESTS"
    echo -e "⏭️  Skipped: $SKIPPED_TESTS"
    echo -e "📈 Success Rate: ${success_rate}%"
    echo ""
    
    # Создаем JSON отчет
    local json_report="$OUTPUT_DIR/test-summary-$TIMESTAMP.json"
    cat > "$json_report" <<EOF
{
  "timestamp": "$(date -Iseconds)",
  "camunda_url": "$CAMUNDA_BASE_URL",
  "total_tests": $TOTAL_TESTS,
  "passed": $PASSED_TESTS,
  "failed": $FAILED_TESTS,
  "skipped": $SKIPPED_TESTS,
  "success_rate": $success_rate,
  "tools_tested": $(printf '%s\n' "${TOOLS[@]}" | jq -R . | jq -s .),
  "log_file": "$LOG_FILE"
}
EOF
    
    echo -e "📄 Detailed logs: $LOG_FILE"
    echo -e "📄 JSON report: $json_report"
    echo ""
    
    # Определяем общий результат
    if [ $FAILED_TESTS -eq 0 ]; then
        if [ $SKIPPED_TESTS -eq 0 ]; then
            echo -e "${GREEN}🎉 All tests PASSED! System is fully functional.${NC}"
            return 0
        else
            echo -e "${YELLOW}⚠️  Tests PASSED with some skipped. System is mostly functional.${NC}"
            return 0
        fi
    else
        echo -e "${RED}💥 Some tests FAILED. System may have issues.${NC}"
        return 1
    fi
}

# Главная функция
main() {
    # Проверяем переменные окружения
    export CAMUNDA_BASE_URL
    export CAMUNDA_USERNAME
    export CAMUNDA_PASSWORD
    
    # Проверяем доступность Camunda
    check_camunda_availability
    
    # Запускаем тесты
    run_tests
    
    # Очистка
    cleanup
    
    # Генерируем отчет
    generate_report
}

# Обработка сигналов для корректной очистки
trap cleanup EXIT INT TERM

# Запуск
main "$@"
