#!/bin/bash

# 🛠️ Development Environment Setup Script
# Sets up development environment for Camunda MCP Server

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m' # No Color

echo -e "${BLUE}🛠️ Camunda MCP Server - Development Setup${NC}"
echo -e "${BLUE}==========================================${NC}"
echo ""

# Проверяем версию Node.js
echo -e "${PURPLE}🟢 Checking Node.js version...${NC}"
if ! command -v node >/dev/null; then
    echo -e "${RED}❌ Node.js not found. Please install Node.js 20 or higher.${NC}"
    exit 1
fi

NODE_VERSION=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 20 ]; then
    echo -e "${RED}❌ Node.js version $NODE_VERSION is too old. Please install Node.js 20 or higher.${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Node.js $(node --version) detected${NC}"

# Проверяем npm
echo -e "${PURPLE}📦 Checking npm...${NC}"
if ! command -v npm >/dev/null; then
    echo -e "${RED}❌ npm not found. Please install npm.${NC}"
    exit 1
fi
echo -e "${GREEN}✅ npm $(npm --version) detected${NC}"

# Устанавливаем зависимости
echo -e "${PURPLE}📦 Installing dependencies...${NC}"
npm install

# Настраиваем Husky
echo -e "${PURPLE}🪝 Setting up Git hooks...${NC}"
npx husky install
chmod +x .husky/pre-commit
chmod +x .husky/pre-push

# Создаем .env файл для разработки
if [ ! -f ".env" ]; then
    echo -e "${PURPLE}⚙️ Creating .env file...${NC}"
    cat > .env <<EOF
# Camunda MCP Server Configuration
CAMUNDA_BASE_URL=http://localhost:8080/engine-rest
CAMUNDA_USERNAME=demo
CAMUNDA_PASSWORD=demo

# Development settings
NODE_ENV=development
LOG_LEVEL=debug

# Health check settings
HEALTH_CHECK_TIMEOUT=5000

# Test settings
TEST_TIMEOUT=30000
OUTPUT_FORMAT=json
EOF
    echo -e "${GREEN}✅ .env file created${NC}"
else
    echo -e "${YELLOW}⚠️ .env file already exists, skipping...${NC}"
fi

# Собираем проект
echo -e "${PURPLE}🏗️ Building project...${NC}"
npm run build

# Запускаем проверки
echo -e "${PURPLE}🔍 Running initial checks...${NC}"
npm run typecheck
npm run lint

# Запускаем юнит-тесты
echo -e "${PURPLE}🧪 Running unit tests...${NC}"
npm run test:unit

# Проверяем health check
echo -e "${PURPLE}🏥 Testing health check...${NC}"
npm run health-check || echo -e "${YELLOW}⚠️ Health check failed - this is normal if Camunda is not accessible${NC}"

echo ""
echo -e "${GREEN}🎉 Development environment setup completed!${NC}"
echo ""
echo -e "${BLUE}📋 Next steps:${NC}"
echo -e "1. ${CYAN}npm run dev${NC} - Start development mode with watch"
echo -e "2. ${CYAN}npm run test:watch${NC} - Run tests in watch mode"
echo -e "3. ${CYAN}npm run test:all${NC} - Run all test suites"
echo -e "4. ${CYAN}npm run health-check${NC} - Check system health"
echo -e "5. ${CYAN}./scripts/test-all-tools.sh${NC} - Test all MCP tools"
echo -e "6. ${CYAN}./scripts/performance-test.sh${NC} - Run performance tests"
echo ""
echo -e "${BLUE}📚 Documentation:${NC}"
echo -e "- ${CYAN}README.md${NC} - Main documentation"
echo -e "- ${CYAN}TESTING_GUIDE.md${NC} - Testing guide"
echo -e "- ${CYAN}tests/README.md${NC} - Test documentation"
echo ""
