# 📋 Setup Guide

## 🛠️ Available MCP Tools (21 total)

### Process Management (5 tools)
- `getProcessDefinitions` - Retrieve process definitions with filtering
- `getProcessInstances` - List and filter process instances  
- `startProcessInstance` - Launch new process instances
- `suspendProcessInstance` - Pause process execution
- `activateProcessInstance` - Resume suspended processes

### Task Management (4 tools)
- `getTasks` - Query tasks with advanced filtering
- `completeTask` - Complete user tasks with variables
- `getTaskForm` - Retrieve task form definitions
- `submitTaskForm` - Submit task forms with validation

### Deployment Management (4 tools)
- `deployBpmn` - Deploy BPMN process definitions (supports large files)
- `getDeployments` - List and filter deployments
- `deleteDeployment` - Remove deployments and resources
- `getDeploymentResources` - Inspect deployment contents

### Forms Management (4 tools)
- `deployForm` - Deploy Camunda Forms (supports large files)
- `getStartForm` - Retrieve process start forms
- `submitStartForm` - Submit start forms to launch processes
- `getTaskForm` - Get forms for specific tasks

### Process Monitoring (4 tools)
- `getProcessVariables` - Retrieve process instance variables
- `setProcessVariables` - Update process variables
- `getActivityInstances` - Monitor process execution state
- `getIncidents` - Track and resolve process errors

## 📁 Large File Support

### **File-based Deployment**
For large BPMN files (>1MB), use the file-based approach:

```bash
# Place files in mounted directories
./bpmn-files/
  ├── large-process.bpmn     # Your big BPMN files
  └── complex-workflow.bpmn

./forms/
  ├── user-registration.form
  └── approval-form.form
```

### **Usage Examples**
```typescript
// Small files - pass content directly
deployBpmn({
  deploymentName: "Simple Process",
  bpmnContent: "<?xml version='1.0'>...",
  fileName: "simple.bpmn"
});

// Large files - pass file path (MCP will ask for permission)
deployBpmn({
  deploymentName: "Complex Process", 
  bpmnContent: "/workspace/bpmn/large-process.bpmn"  // File path instead of content
});

// Forms work the same way
deployForm({
  deploymentName: "User Form",
  formContent: "/workspace/forms/user-form.form"  // File path
});
```

### **Docker Volume Setup**
```yaml
# docker-compose.yml
volumes:
  - ./bpmn-files:/workspace/bpmn:ro      # Your BPMN files
  - ./forms:/workspace/forms:ro          # Your form files
```

## ⚙️ Configuration

### Environment Variables

```bash
# Required
CAMUNDA_BASE_URL=https://your-camunda-instance.com/engine-rest
CAMUNDA_USERNAME=your-username  
CAMUNDA_PASSWORD=your-password

# Optional
NODE_ENV=production
```

### Local Development (.env file)
```bash
CAMUNDA_BASE_URL=http://localhost:8080/engine-rest
CAMUNDA_USERNAME=demo
CAMUNDA_PASSWORD=demo
```

## 🧪 Testing

### Run All Tests
```bash
npm test                    # Unit tests
npm run test:integration    # Integration tests  
npm run test:e2e           # End-to-end tests
npm run test:all           # All tests
```

### Manual Testing
```bash
# Test individual tools
npm run test:tools

# Performance testing
npm run test:performance

# Health check
npm run health-check
```

## 🔧 Development

### Local Setup
```bash
git clone <repo-url>
cd camunda-engine-mcp
npm install
npm run build
```

### Code Quality
```bash
npm run lint              # ESLint
npm run format           # Prettier
npm run typecheck        # TypeScript
npm run validate         # All checks
```

## 📊 Monitoring

### Health Checks
```bash
# Manual health check
npm run health-check

# Docker health check
docker exec camunda-mcp-server npm run health-check
```

### Performance Monitoring
- Response time tracking
- Error rate monitoring  
- Connection status
- Resource utilization

## 🐳 Production Deployment

### Docker Compose (Recommended)
```bash
# Production deployment
docker-compose up -d

# View logs
docker-compose logs -f

# Scale if needed
docker-compose up -d --scale camunda-mcp=3
```

### Environment Setup
```bash
# Set production variables
export CAMUNDA_BASE_URL=https://prod-camunda.company.com/engine-rest
export CAMUNDA_USERNAME=prod-user
export CAMUNDA_PASSWORD=secure-password

# Deploy
docker-compose up -d
```
