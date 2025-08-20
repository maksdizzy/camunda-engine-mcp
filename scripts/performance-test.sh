#!/bin/bash

# 🚀 Performance Test Script for Camunda MCP Server
# Тестирует производительность и нагрузочные характеристики

set -e

# Цвета для вывода
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Конфигурация
CAMUNDA_BASE_URL="${CAMUNDA_BASE_URL:-http://localhost:8080/engine-rest}"
CAMUNDA_USERNAME="${CAMUNDA_USERNAME:-demo}"
CAMUNDA_PASSWORD="${CAMUNDA_PASSWORD:-demo}"
CONCURRENT_USERS="${CONCURRENT_USERS:-5}"
REQUESTS_PER_USER="${REQUESTS_PER_USER:-10}"
WARMUP_REQUESTS="${WARMUP_REQUESTS:-5}"
OUTPUT_DIR="./performance-results"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")

# Создаем директорию для результатов
mkdir -p "$OUTPUT_DIR"

# Логирование
LOG_FILE="$OUTPUT_DIR/performance-test-$TIMESTAMP.log"
exec > >(tee -a "$LOG_FILE")
exec 2>&1

echo -e "${BLUE}🚀 Camunda MCP Server - Performance Test Suite${NC}"
echo -e "${BLUE}===============================================${NC}"
echo ""
echo -e "📅 Test Run: $(date)"
echo -e "🌐 Camunda URL: $CAMUNDA_BASE_URL"
echo -e "👥 Concurrent Users: $CONCURRENT_USERS"
echo -e "📊 Requests per User: $REQUESTS_PER_USER"
echo -e "🔥 Warmup Requests: $WARMUP_REQUESTS"
echo -e "📁 Output Directory: $OUTPUT_DIR"
echo ""

# Проверяем наличие сборки
if [ ! -f "build/index.js" ]; then
    echo -e "${RED}❌ Build not found. Running build...${NC}"
    npm run build
    echo -e "${GREEN}✅ Build completed${NC}"
    echo ""
fi

# Массивы для хранения результатов
declare -a RESPONSE_TIMES=()
declare -a ERROR_COUNTS=()
declare -a THROUGHPUT=()

# Функция для измерения времени выполнения команды
measure_time() {
    local start_time=$(date +%s%N)
    "$@"
    local end_time=$(date +%s%N)
    local duration=$(( (end_time - start_time) / 1000000 ))
    echo $duration
}

# Функция для выполнения одного запроса
execute_request() {
    local tool_name=$1
    local args=$2
    local request_id=$3
    
    local request=$(cat <<EOF
{
  "jsonrpc": "2.0",
  "id": $request_id,
  "method": "tools/call",
  "params": {
    "name": "$tool_name",
    "arguments": $args
  }
}
EOF
    )
    
    local start_time=$(date +%s%N)
    local output_file="$OUTPUT_DIR/perf_${tool_name}_${request_id}_${TIMESTAMP}.json"
    
    if echo "$request" | timeout 30 node build/index.js > "$output_file" 2>&1; then
        local end_time=$(date +%s%N)
        local duration=$(( (end_time - start_time) / 1000000 ))
        
        if grep -q '"error"' "$output_file"; then
            echo "ERROR:$duration"
        else
            echo "SUCCESS:$duration"
        fi
    else
        echo "TIMEOUT:30000"
    fi
}

# Функция для warmup
warmup_test() {
    echo -e "${PURPLE}🔥 Running warmup requests...${NC}"
    
    for i in $(seq 1 $WARMUP_REQUESTS); do
        echo -n "."
        execute_request "getProcessDefinitions" '{"maxResults": 1}' "warmup_$i" > /dev/null
        sleep 0.1
    done
    
    echo ""
    echo -e "${GREEN}✅ Warmup completed${NC}"
    echo ""
}

# Функция для тестирования одного инструмента
performance_test_tool() {
    local tool_name=$1
    local args=$2
    local test_name=$3
    
    echo -e "${CYAN}🔧 Performance testing: $tool_name ($test_name)${NC}"
    
    local total_requests=$(( CONCURRENT_USERS * REQUESTS_PER_USER ))
    local success_count=0
    local error_count=0
    local timeout_count=0
    local total_time=0
    local min_time=999999
    local max_time=0
    
    declare -a response_times=()
    
    # Запускаем concurrent тесты
    local pids=()
    local temp_files=()
    
    local start_test_time=$(date +%s%N)
    
    for user in $(seq 1 $CONCURRENT_USERS); do
        local temp_file="$OUTPUT_DIR/temp_user_${user}_${TIMESTAMP}.txt"
        temp_files+=("$temp_file")
        
        (
            for req in $(seq 1 $REQUESTS_PER_USER); do
                local request_id="${user}_${req}"
                local result=$(execute_request "$tool_name" "$args" "$request_id")
                echo "$result" >> "$temp_file"
            done
        ) &
        
        pids+=($!)
    done
    
    # Ждем завершения всех процессов
    for pid in "${pids[@]}"; do
        wait $pid
    done
    
    local end_test_time=$(date +%s%N)
    local total_test_time=$(( (end_test_time - start_test_time) / 1000000 ))
    
    # Обрабатываем результаты
    for temp_file in "${temp_files[@]}"; do
        if [ -f "$temp_file" ]; then
            while IFS=: read -r status time; do
                case $status in
                    "SUCCESS")
                        success_count=$((success_count + 1))
                        response_times+=($time)
                        total_time=$((total_time + time))
                        if [ $time -lt $min_time ]; then min_time=$time; fi
                        if [ $time -gt $max_time ]; then max_time=$time; fi
                        ;;
                    "ERROR")
                        error_count=$((error_count + 1))
                        ;;
                    "TIMEOUT")
                        timeout_count=$((timeout_count + 1))
                        ;;
                esac
            done < "$temp_file"
            rm -f "$temp_file"
        fi
    done
    
    # Вычисляем статистику
    local avg_time=0
    local throughput_rps=0
    local success_rate=0
    
    if [ $success_count -gt 0 ]; then
        avg_time=$((total_time / success_count))
        throughput_rps=$(( (success_count * 1000) / (total_test_time / 1000) ))
        success_rate=$(( (success_count * 100) / total_requests ))
    fi
    
    # Вычисляем медиану и перцентили
    local median=0
    local p95=0
    local p99=0
    
    if [ ${#response_times[@]} -gt 0 ]; then
        # Сортируем массив
        IFS=$'\n' response_times=($(sort -n <<<"${response_times[*]}"))
        unset IFS
        
        local count=${#response_times[@]}
        median=${response_times[$((count / 2))]}
        p95=${response_times[$((count * 95 / 100))]}
        p99=${response_times[$((count * 99 / 100))]}
    fi
    
    # Выводим результаты
    echo -e "  📊 Results:"
    echo -e "    ✅ Successful: $success_count/$total_requests (${success_rate}%)"
    echo -e "    ❌ Errors: $error_count"
    echo -e "    ⏰ Timeouts: $timeout_count"
    echo -e "    🚀 Throughput: ${throughput_rps} RPS"
    echo -e "    ⏱️  Response Times:"
    echo -e "       Average: ${avg_time}ms"
    echo -e "       Median: ${median}ms"
    echo -e "       Min: ${min_time}ms"
    echo -e "       Max: ${max_time}ms"
    echo -e "       95th percentile: ${p95}ms"
    echo -e "       99th percentile: ${p99}ms"
    
    # Сохраняем результаты в JSON
    local results_file="$OUTPUT_DIR/perf_${tool_name}_${test_name}_${TIMESTAMP}.json"
    cat > "$results_file" <<EOF
{
  "tool": "$tool_name",
  "test_name": "$test_name",
  "timestamp": "$(date -Iseconds)",
  "config": {
    "concurrent_users": $CONCURRENT_USERS,
    "requests_per_user": $REQUESTS_PER_USER,
    "total_requests": $total_requests
  },
  "results": {
    "success_count": $success_count,
    "error_count": $error_count,
    "timeout_count": $timeout_count,
    "success_rate": $success_rate,
    "throughput_rps": $throughput_rps,
    "total_test_time_ms": $total_test_time,
    "response_times": {
      "average": $avg_time,
      "median": $median,
      "min": $min_time,
      "max": $max_time,
      "p95": $p95,
      "p99": $p99
    }
  }
}
EOF
    
    # Оценка производительности
    if [ $success_rate -ge 95 ] && [ $avg_time -le 1000 ]; then
        echo -e "  ${GREEN}✅ EXCELLENT performance${NC}"
    elif [ $success_rate -ge 90 ] && [ $avg_time -le 2000 ]; then
        echo -e "  ${YELLOW}⚠️  GOOD performance${NC}"
    elif [ $success_rate -ge 80 ] && [ $avg_time -le 5000 ]; then
        echo -e "  ${YELLOW}⚠️  ACCEPTABLE performance${NC}"
    else
        echo -e "  ${RED}❌ POOR performance${NC}"
    fi
    
    echo ""
}

# Функция для стресс-теста
stress_test() {
    echo -e "${PURPLE}💪 Running stress test with gradual load increase...${NC}"
    
    local original_concurrent=$CONCURRENT_USERS
    local original_requests=$REQUESTS_PER_USER
    
    for load_level in 1 3 5 10 15; do
        echo -e "${CYAN}🔥 Testing with $load_level concurrent users...${NC}"
        
        CONCURRENT_USERS=$load_level
        REQUESTS_PER_USER=5
        
        performance_test_tool "getProcessDefinitions" '{"maxResults": 10}' "stress_${load_level}_users"
        
        # Небольшая пауза между уровнями нагрузки
        sleep 2
    done
    
    # Восстанавливаем исходные значения
    CONCURRENT_USERS=$original_concurrent
    REQUESTS_PER_USER=$original_requests
    
    echo -e "${GREEN}✅ Stress test completed${NC}"
    echo ""
}

# Функция для тестирования памяти
memory_test() {
    echo -e "${PURPLE}🧠 Running memory usage test...${NC}"
    
    # Запускаем MCP сервер в фоне и мониторим память
    export CAMUNDA_BASE_URL
    export CAMUNDA_USERNAME  
    export CAMUNDA_PASSWORD
    
    # Создаем файл для мониторинга памяти
    local memory_log="$OUTPUT_DIR/memory_usage_$TIMESTAMP.log"
    
    # Запускаем сервер в фоне
    node build/index.js > /dev/null 2>&1 &
    local server_pid=$!
    
    # Мониторим память в течение теста
    (
        while kill -0 $server_pid 2>/dev/null; do
            if command -v ps >/dev/null; then
                ps -p $server_pid -o pid,vsz,rss,pmem,pcpu --no-headers >> "$memory_log" 2>/dev/null || break
            fi
            sleep 1
        done
    ) &
    local monitor_pid=$!
    
    # Даем серверу время запуститься
    sleep 3
    
    # Выполняем нагрузочные запросы
    echo -e "  🔄 Executing memory-intensive requests..."
    
    for i in $(seq 1 50); do
        echo '{"jsonrpc": "2.0", "id": '$i', "method": "tools/call", "params": {"name": "getProcessDefinitions", "arguments": {}}}' | \
        timeout 10 node build/index.js > /dev/null 2>&1 &
        
        if [ $((i % 10)) -eq 0 ]; then
            echo -n "."
            wait  # Ждем завершения batch'а
        fi
    done
    
    echo ""
    
    # Останавливаем мониторинг
    kill $server_pid 2>/dev/null || true
    kill $monitor_pid 2>/dev/null || true
    wait $server_pid 2>/dev/null || true
    wait $monitor_pid 2>/dev/null || true
    
    # Анализируем использование памяти
    if [ -f "$memory_log" ] && [ -s "$memory_log" ]; then
        local max_memory=$(awk '{print $3}' "$memory_log" | sort -n | tail -1)
        local avg_memory=$(awk '{sum+=$3; count++} END {if(count>0) print int(sum/count)}' "$memory_log")
        
        echo -e "  📊 Memory Usage Results:"
        echo -e "    Maximum RSS: ${max_memory}KB ($((max_memory / 1024))MB)"
        echo -e "    Average RSS: ${avg_memory}KB ($((avg_memory / 1024))MB)"
        
        # Оценка использования памяти
        local max_memory_mb=$((max_memory / 1024))
        if [ $max_memory_mb -le 100 ]; then
            echo -e "    ${GREEN}✅ EXCELLENT memory usage${NC}"
        elif [ $max_memory_mb -le 250 ]; then
            echo -e "    ${YELLOW}⚠️  ACCEPTABLE memory usage${NC}"
        else
            echo -e "    ${RED}❌ HIGH memory usage${NC}"
        fi
    else
        echo -e "    ${YELLOW}⚠️  Could not monitor memory usage${NC}"
    fi
    
    echo ""
}

# Главная функция тестирования
run_performance_tests() {
    echo -e "${PURPLE}🚀 Starting performance test suite...${NC}"
    echo ""
    
    # Warmup
    warmup_test
    
    # 1. Базовые тесты производительности
    echo -e "${BLUE}📋 Phase 1: Basic Performance Tests${NC}"
    performance_test_tool "getProcessDefinitions" '{}' "basic"
    performance_test_tool "getProcessDefinitions" '{"maxResults": 50}' "with_limit"
    performance_test_tool "getProcessInstances" '{"maxResults": 20}' "basic"
    performance_test_tool "getTasks" '{"maxResults": 20}' "basic"
    performance_test_tool "getDeployments" '{"maxResults": 10}' "basic"
    
    # 2. Стресс-тест
    echo -e "${BLUE}💪 Phase 2: Stress Testing${NC}"
    stress_test
    
    # 3. Тест памяти
    echo -e "${BLUE}🧠 Phase 3: Memory Testing${NC}"
    memory_test
    
    # 4. Тест устойчивости к ошибкам
    echo -e "${BLUE}🚫 Phase 4: Error Resilience Testing${NC}"
    performance_test_tool "startProcessInstance" '{"processDefinitionId": "non-existent"}' "error_handling"
    performance_test_tool "completeTask" '{"taskId": "non-existent"}' "error_handling"
}

# Функция генерации отчета
generate_performance_report() {
    echo ""
    echo -e "${BLUE}📊 Performance Test Summary${NC}"
    echo -e "${BLUE}===========================${NC}"
    echo ""
    
    # Собираем все JSON результаты
    local summary_file="$OUTPUT_DIR/performance-summary-$TIMESTAMP.json"
    local all_results="$OUTPUT_DIR/perf_*_$TIMESTAMP.json"
    
    echo -e "📅 Test Completed: $(date)"
    echo -e "⚙️  Configuration:"
    echo -e "   👥 Concurrent Users: $CONCURRENT_USERS"
    echo -e "   📊 Requests per User: $REQUESTS_PER_USER"
    echo -e "   🌐 Target: $CAMUNDA_BASE_URL"
    echo ""
    
    # Создаем суммарный отчет
    cat > "$summary_file" <<EOF
{
  "timestamp": "$(date -Iseconds)",
  "config": {
    "camunda_url": "$CAMUNDA_BASE_URL",
    "concurrent_users": $CONCURRENT_USERS,
    "requests_per_user": $REQUESTS_PER_USER,
    "warmup_requests": $WARMUP_REQUESTS
  },
  "test_files": [
EOF
    
    # Добавляем ссылки на все файлы результатов
    local first=true
    for file in $all_results; do
        if [ -f "$file" ]; then
            if [ "$first" = true ]; then
                first=false
            else
                echo "," >> "$summary_file"
            fi
            echo -n "    \"$(basename "$file")\"" >> "$summary_file"
        fi
    done
    
    cat >> "$summary_file" <<EOF

  ],
  "log_file": "$LOG_FILE"
}
EOF
    
    echo -e "📄 Detailed logs: $LOG_FILE"
    echo -e "📄 Summary report: $summary_file"
    echo -e "📁 All results in: $OUTPUT_DIR"
    echo ""
    
    echo -e "${GREEN}🎉 Performance testing completed!${NC}"
    echo -e "${CYAN}💡 Review the individual JSON files for detailed metrics${NC}"
    echo ""
}

# Функция проверки зависимостей
check_dependencies() {
    echo -e "${PURPLE}🔍 Checking dependencies...${NC}"
    
    # Проверяем наличие необходимых команд
    local missing_deps=()
    
    if ! command -v node >/dev/null; then
        missing_deps+=("node")
    fi
    
    if ! command -v timeout >/dev/null; then
        missing_deps+=("timeout")
    fi
    
    if [ ${#missing_deps[@]} -gt 0 ]; then
        echo -e "${RED}❌ Missing dependencies: ${missing_deps[*]}${NC}"
        return 1
    fi
    
    echo -e "${GREEN}✅ All dependencies available${NC}"
    return 0
}

# Главная функция
main() {
    # Проверяем зависимости
    if ! check_dependencies; then
        exit 1
    fi
    
    # Проверяем переменные окружения
    export CAMUNDA_BASE_URL
    export CAMUNDA_USERNAME
    export CAMUNDA_PASSWORD
    
    # Проверяем доступность Camunda
    echo -e "${PURPLE}🔍 Checking Camunda availability...${NC}"
    if ! curl -s -f -u "$CAMUNDA_USERNAME:$CAMUNDA_PASSWORD" "$CAMUNDA_BASE_URL/engine" > /dev/null; then
        echo -e "${RED}❌ Camunda is not accessible. Performance tests may fail.${NC}"
        echo -e "${YELLOW}⚠️  Continuing anyway for testing purposes...${NC}"
    else
        echo -e "${GREEN}✅ Camunda is accessible${NC}"
    fi
    echo ""
    
    # Запускаем тесты производительности
    run_performance_tests
    
    # Генерируем отчет
    generate_performance_report
}

# Запуск
main "$@"
