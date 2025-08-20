# 🧪 **Comprehensive Camunda Engine MCP Server Test Suite**

This guide provides a thorough testing framework for the Camunda Engine MCP Server that provides 21 tools for workflow automation. Use this guide to validate all functionality before deployment or after making changes.

## 📋 **Test Environment Setup**

**MCP Server Location:** `/path/to/camunda-engine-mcp/`
**Camunda Instance:** `http://localhost:8080/engine-rest`
**Credentials:** username=`demo`, password=`demo`

**Available Test Methods:**
1. **Local Testing:** `CAMUNDA_BASE_URL="http://localhost:8080/engine-rest" CAMUNDA_USERNAME="demo" CAMUNDA_PASSWORD="demo" npx @modelcontextprotocol/inspector --cli node build/index.js`
2. **Docker Testing:** `docker exec -i camunda-mcp-server node build/index.js`

## 🎯 **Testing Categories & Objectives**

### **1. 🏗️ Infrastructure & Setup Testing**
- [ ] **Build Process:** Verify `npm run build` works without errors
- [ ] **Docker Build:** Test `docker build -t camunda-engine-mcp .` succeeds
- [ ] **Container Runtime:** Ensure Docker container starts and stays running
- [ ] **Environment Variables:** Confirm CAMUNDA_* env vars are read correctly
- [ ] **MCP Protocol:** Validate JSON-RPC communication works

### **2. 🔧 Core MCP Functionality**
- [ ] **Tool Discovery:** List all 21 available tools using `tools/list`
- [ ] **Tool Schemas:** Verify each tool has proper input/output schemas
- [ ] **Error Handling:** Test behavior with invalid inputs, network issues
- [ ] **Authentication:** Confirm Basic Auth works with Camunda instance
- [ ] **Configuration:** Test both env vars and MCP config approaches

### **3. 📊 Process Definition Management (5 tools)**
Test these tools in sequence:

#### `getProcessDefinitions`
- [ ] List all process definitions
- [ ] Filter by `latestVersionOnly: true`
- [ ] Test pagination with `firstResult` and `maxResults`
- [ ] Verify response contains process keys, IDs, versions

#### `startProcessInstance` 
- [ ] Start instance with `processDefinitionKey`
- [ ] Start instance with `processDefinitionId`
- [ ] Include process variables and businessKey
- [ ] Verify process instance is created and returned

#### `getProcessInstances`
- [ ] List all running process instances
- [ ] Filter by `processDefinitionId`
- [ ] Filter by `businessKey`
- [ ] Test pagination parameters

#### `suspendProcessInstance` & `activateProcessInstance`
- [ ] Suspend a running process instance
- [ ] Verify instance is suspended
- [ ] Reactivate the suspended instance
- [ ] Confirm instance is active again

### **4. 📝 Task Management (4 tools)**

#### `getTasks`
- [ ] List all available tasks
- [ ] Filter by `processInstanceId`
- [ ] Filter by `assignee`
- [ ] Filter by `taskDefinitionKey`

#### `completeTask`
- [ ] Complete a user task without variables
- [ ] Complete a task with form variables
- [ ] Verify task completion advances process

#### `getTaskForm` & `submitTaskForm`
- [ ] Get form definition for a user task
- [ ] Submit form with proper variable format
- [ ] Test form validation and error handling

### **5. 📦 Deployment Management (4 tools)**

#### `deployBpmn`
Create a test BPMN process:
```xml
<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" 
                  xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI"
                  id="TestProcess" targetNamespace="http://example.com">
  <bpmn:process id="test-process" isExecutable="true">
    <bpmn:startEvent id="start"/>
    <bpmn:endEvent id="end"/>
    <bpmn:sequenceFlow id="flow" sourceRef="start" targetRef="end"/>
  </bpmn:process>
</bpmn:definitions>
```

- [ ] Deploy this BPMN with `deploymentName: "Test Process"`
- [ ] Enable `enableDuplicateFiltering: true`
- [ ] Test `deployChangedOnly: true`
- [ ] Verify deployment ID is returned

#### `getDeployments`
- [ ] List all deployments
- [ ] Filter by deployment `name`
- [ ] Filter by deployment `id`
- [ ] Test `nameLike` filtering

#### `getDeploymentResources`
- [ ] Get resources for a specific deployment
- [ ] Verify BPMN file is listed in resources

#### `deleteDeployment`
- [ ] Delete a deployment with `cascade: false`
- [ ] Delete with `cascade: true` (removes instances)
- [ ] Test `skipCustomListeners` and `skipIoMappings`

### **6. 📋 Forms Management (4 tools)**

#### `deployForm`
Create a test Camunda Form:
```json
{
  "components": [
    {
      "key": "customerName",
      "label": "Customer Name",
      "type": "textfield",
      "validate": {"required": true}
    },
    {
      "key": "amount",
      "label": "Amount",
      "type": "number"
    }
  ],
  "type": "default"
}
```

- [ ] Deploy this form with proper JSON content
- [ ] Verify form deployment succeeds

#### `getStartForm` & `submitStartForm`
- [ ] Get start form for a process definition
- [ ] Submit start form with variables
- [ ] Verify process starts with form data

### **7. 🔍 Process Monitoring & Debugging (4 tools)**

#### `getProcessVariables` & `setProcessVariables`
- [ ] Get variables from a running process instance
- [ ] Set/update process variables
- [ ] Verify variable changes are persisted

#### `getActivityInstances`
- [ ] Get activity tree for a process instance
- [ ] Verify activity states and transitions

#### `getIncidents`
- [ ] List process incidents (errors)
- [ ] Filter by `processInstanceId`
- [ ] Filter by `incidentType`

### **8. ⚙️ Process Lifecycle Management (1 tool)**

#### `deleteProcessInstance`
- [ ] Delete a process instance with reason
- [ ] Test `skipCustomListeners: true`
- [ ] Test `skipSubprocesses: true`
- [ ] Verify instance is removed

## 🧪 **Advanced Testing Scenarios**

### **End-to-End Workflow Tests**
1. **Complete Process Lifecycle:**
   - Deploy BPMN → Start Process → Complete Tasks → Monitor Variables → Finish Process

2. **Form-Based Process:**
   - Deploy Form → Deploy BPMN with Form → Start via Form → Complete Task Forms

3. **Error Handling:**
   - Test with invalid process IDs
   - Test with malformed BPMN XML
   - Test network connectivity issues
   - Test authentication failures

### **Performance & Reliability Tests**
- [ ] **Concurrent Operations:** Run multiple tools simultaneously
- [ ] **Large Data Sets:** Test with many process instances/tasks
- [ ] **Memory Usage:** Monitor server resource consumption
- [ ] **Connection Stability:** Test long-running operations

### **Security & Configuration Tests**
- [ ] **Authentication:** Test with wrong credentials
- [ ] **Authorization:** Verify proper access controls
- [ ] **Environment Isolation:** Test Docker vs local execution
- [ ] **Config Priority:** Test MCP config vs environment variables

## 📊 **Expected Results & Success Criteria**

### **✅ Success Indicators:**
- All 21 tools return valid responses
- BPMN processes can be deployed and executed
- Forms integrate properly with processes
- Process variables can be monitored and modified
- Error messages are clear and actionable
- Docker deployment works seamlessly

### **❌ Failure Indicators:**
- Tools return undefined/null responses
- Authentication errors persist
- BPMN deployment fails
- Process instances cannot be started
- Forms don't integrate with processes
- Docker container crashes or exits

## 🚀 **Test Execution Commands**

### **Prerequisites**
```bash
# Ensure you're in the project directory
cd /path/to/camunda-engine-mcp

# Build the project
npm run build
```

### **Basic Tool Testing**
```bash
# Set environment variables
export CAMUNDA_BASE_URL="http://localhost:8080/engine-rest"
export CAMUNDA_USERNAME="demo"
export CAMUNDA_PASSWORD="demo"

# Test all tools list
npx @modelcontextprotocol/inspector --cli node build/index.js --method tools/list

# Test specific tool (example)
npx @modelcontextprotocol/inspector --cli node build/index.js \
  --method tools/call \
  --tool-name getProcessDefinitions \
  --arguments '{}'

# Test with arguments
npx @modelcontextprotocol/inspector --cli node build/index.js \
  --method tools/call \
  --tool-name getProcessDefinitions \
  --arguments '{"latestVersionOnly": true, "maxResults": 10}'
```

### **Docker Testing**
```bash
# Build Docker image
docker build -t camunda-engine-mcp .

# Run container for testing
docker run -d --name camunda-mcp-test \
  -e CAMUNDA_BASE_URL="http://localhost:8080/engine-rest" \
  -e CAMUNDA_USERNAME="demo" \
  -e CAMUNDA_PASSWORD="demo" \
  camunda-engine-mcp tail -f /dev/null

# Test via Docker exec
echo '{"jsonrpc": "2.0", "id": 1, "method": "tools/list"}' | \
  docker exec -i camunda-mcp-test node build/index.js

# Test specific tool via Docker
echo '{"jsonrpc": "2.0", "id": 2, "method": "tools/call", "params": {"name": "getProcessDefinitions", "arguments": {}}}' | \
  docker exec -i camunda-mcp-test node build/index.js

# Clean up test container
docker rm -f camunda-mcp-test
```

### **Batch Testing Script**
Create a test script `test-all-tools.sh`:
```bash
#!/bin/bash
set -e

export CAMUNDA_BASE_URL="http://localhost:8080/engine-rest"
export CAMUNDA_USERNAME="demo"
export CAMUNDA_PASSWORD="demo"

echo "🧪 Testing all MCP tools..."

# Array of all tool names
tools=(
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

# Test each tool
for tool in "${tools[@]}"; do
  echo "Testing $tool..."
  npx @modelcontextprotocol/inspector --cli node build/index.js \
    --method tools/call \
    --tool-name "$tool" \
    --arguments '{}' || echo "❌ $tool failed"
done

echo "✅ All tools tested!"
```

## 📝 **Test Report Template**

For each category, document:

### **Test Results Summary**
- **Date:** [Test execution date]
- **Environment:** [Local/Docker/Production]
- **Camunda Version:** [Version info]
- **Total Tools Tested:** 21

### **Category Results**
For each category, provide:
1. **Test Results:** ✅ Pass / ❌ Fail / ⚠️ Issues
2. **Response Times:** Average execution time
3. **Error Analysis:** Any errors encountered
4. **Data Validation:** Response format and content accuracy
5. **Recommendations:** Improvements or fixes needed

### **Sample Test Record**
```markdown
#### getProcessDefinitions
- ✅ **Basic Listing:** Returns array of process definitions
- ✅ **Filtering:** latestVersionOnly works correctly
- ✅ **Pagination:** firstResult and maxResults work
- ⚠️ **Performance:** Response time 2.3s (acceptable)
- **Notes:** All expected fields present in response
```

## 🔧 **Troubleshooting Common Issues**

### **Connection Errors**
```bash
# Test Camunda connectivity
curl -u demo:demo http://localhost:8080/engine-rest/engine

# Check environment variables
echo $CAMUNDA_BASE_URL
echo $CAMUNDA_USERNAME
```

### **Build Errors**
```bash
# Clean build
rm -rf build/ node_modules/
npm install
npm run build
```

### **Docker Issues**
```bash
# Check container logs
docker logs camunda-mcp-test

# Interactive debugging
docker exec -it camunda-mcp-test sh
```

## 📚 **Additional Resources**

- **Camunda REST API Documentation:** [https://docs.camunda.org/manual/latest/reference/rest/](https://docs.camunda.org/manual/latest/reference/rest/)
- **MCP Protocol Specification:** [https://modelcontextprotocol.io/](https://modelcontextprotocol.io/)
- **BPMN 2.0 Specification:** [https://www.omg.org/spec/BPMN/2.0/](https://www.omg.org/spec/BPMN/2.0/)

---

**🎯 Goal:** Ensure the Camunda Engine MCP Server is production-ready and all 21 tools work correctly with the live Camunda instance.

**💡 Tip:** Run this test suite after any code changes, before releases, and periodically in production to ensure system health.
