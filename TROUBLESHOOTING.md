# 🔧 Troubleshooting Guide

## 🚨 Common Issues

### Docker Issues

#### Container Won't Start
```bash
# Check logs
docker-compose logs camunda-mcp

# Common fixes
docker-compose down --volumes
docker-compose up -d
```

#### Environment Variables Not Working
```bash
# ❌ Wrong (env section doesn't work with docker exec)
"env": {
  "CAMUNDA_BASE_URL": "https://your-instance.com"
}

# ✅ Correct (use -e flags)
"args": [
  "exec", "-i",
  "-e", "CAMUNDA_BASE_URL=https://your-instance.com",
  "-e", "CAMUNDA_USERNAME=your-username", 
  "-e", "CAMUNDA_PASSWORD=your-password",
  "camunda-mcp-server", "node", "build/index.js"
]
```

#### Volume Mount Issues
```bash
# Ensure directories exist
mkdir -p bpmn-files forms

# Check permissions
ls -la bpmn-files/ forms/

# Fix permissions if needed
chmod 755 bpmn-files/ forms/
```

### MCP Connection Issues

#### "Connection closed" Error
1. **Check container status:**
   ```bash
   docker ps
   docker-compose logs
   ```

2. **Verify environment variables:**
   ```bash
   docker exec camunda-mcp-server env | grep CAMUNDA
   ```

3. **Test connectivity:**
   ```bash
   docker exec camunda-mcp-server npm run health-check
   ```

#### Tools Not Appearing in Claude Desktop
1. **Restart Claude Desktop completely**
2. **Check MCP configuration syntax**
3. **Verify container is running**
4. **Check Claude Desktop logs**

### Camunda Connection Issues

#### Authentication Errors
```bash
# Test credentials manually
curl -u username:password https://your-camunda.com/engine-rest/engine

# Common issues:
# - Wrong credentials
# - Network restrictions
# - SSL certificate issues
```

#### Network Connectivity
```bash
# Test from container
docker exec camunda-mcp-server curl https://your-camunda.com/engine-rest/engine

# Test DNS resolution
docker exec camunda-mcp-server nslookup your-camunda.com
```

### File Deployment Issues

#### "File not found" Errors
```bash
# Check file exists in container
docker exec camunda-mcp-server ls -la /workspace/bpmn/
docker exec camunda-mcp-server ls -la /workspace/forms/

# Verify volume mounts
docker exec camunda-mcp-server mount | grep workspace
```

#### "Invalid BPMN" Errors
```bash
# Check file content
docker exec camunda-mcp-server head -5 /workspace/bpmn/your-file.bpmn

# Validate BPMN syntax
# - Must start with <?xml
# - Must contain <bpmn:definitions>
# - Must have targetNamespace attribute
```

## 🔍 Debugging

### Enable Debug Logging
```bash
# Set debug environment
export DEBUG=camunda-mcp:*

# Or in docker-compose.yml
environment:
  - DEBUG=camunda-mcp:*
```

### Health Check Details
```bash
# Comprehensive health check
npm run health-check

# Check specific components
docker exec camunda-mcp-server node -e "
const axios = require('axios');
axios.get('${CAMUNDA_BASE_URL}/engine')
  .then(r => console.log('✅ Camunda OK'))
  .catch(e => console.log('❌ Camunda Error:', e.message));
"
```

### Performance Issues
```bash
# Check memory usage
docker stats camunda-mcp-server

# Check response times
time docker exec camunda-mcp-server npm run health-check

# Monitor network
docker exec camunda-mcp-server netstat -tuln
```

## 📞 Getting Help

### Collect Debug Information
```bash
# System info
docker --version
docker-compose --version
node --version

# Container status
docker ps -a
docker-compose logs --tail=50

# Configuration
cat docker-compose.yml
echo $CAMUNDA_BASE_URL
```

### Test Minimal Configuration
```json
{
  "mcpServers": {
    "camunda-test": {
      "command": "docker",
      "args": [
        "exec", "-i",
        "-e", "CAMUNDA_BASE_URL=http://localhost:8080/engine-rest",
        "-e", "CAMUNDA_USERNAME=demo",
        "-e", "CAMUNDA_PASSWORD=demo",
        "camunda-mcp-server",
        "node", "build/index.js"
      ]
    }
  }
}
```

### Support Channels
- **GitHub Issues**: Technical problems and bugs
- **Documentation**: Check SETUP_GUIDE.md and README.md
- **Health Check**: Run `npm run health-check` first
