#!/usr/bin/env node
/**
 * Health Check utility for Camunda MCP Server
 */

import axios from 'axios';
import { performance } from 'perf_hooks';

interface HealthCheckConfig {
  baseUrl: string;
  username?: string;
  password?: string;
  timeout?: number;
}

interface HealthCheckResult {
  status: 'healthy' | 'unhealthy' | 'degraded';
  timestamp: string;
  responseTime: number;
  checks: {
    [key: string]: {
      status: 'pass' | 'fail' | 'warn';
      message: string;
      responseTime?: number;
      details?: any;
    };
  };
  overall: {
    uptime: number;
    version?: string;
    environment: string;
  };
}

class CamundaHealthChecker {
  private config: HealthCheckConfig;
  private authConfig: any;

  constructor(config: HealthCheckConfig) {
    this.config = {
      timeout: 5000,
      ...config
    };

    this.authConfig = {};
    if (this.config.username && this.config.password) {
      this.authConfig.auth = {
        username: this.config.username,
        password: this.config.password
      };
    }
  }

  async performHealthCheck(): Promise<HealthCheckResult> {
    const startTime = performance.now();
    const timestamp = new Date().toISOString();
    
    const result: HealthCheckResult = {
      status: 'healthy',
      timestamp,
      responseTime: 0,
      checks: {},
      overall: {
        uptime: process.uptime(),
        environment: process.env.NODE_ENV || 'development'
      }
    };

    try {
      // 1. Check Camunda Engine availability
      await this.checkCamundaEngine(result);

      // 2. Check Camunda version
      await this.checkCamundaVersion(result);

      // 3. Check main API endpoints
      await this.checkProcessDefinitions(result);
      await this.checkProcessInstances(result);
      await this.checkTasks(result);
      await this.checkDeployments(result);

      // 4. Performance check
      await this.checkPerformance(result);

      // 5. System resources check
      this.checkSystemResources(result);

    } catch (error) {
      result.checks['general'] = {
        status: 'fail',
        message: `Health check failed: ${error instanceof Error ? error.message : String(error)}`
      };
    }

    // Determine overall status
    const endTime = performance.now();
    result.responseTime = Math.round(endTime - startTime);
    result.status = this.determineOverallStatus(result);

    return result;
  }

  private async checkCamundaEngine(result: HealthCheckResult): Promise<void> {
    const startTime = performance.now();
    
    try {
      const response = await axios.get(`${this.config.baseUrl}/engine`, {
        ...this.authConfig,
        timeout: this.config.timeout
      });

      const endTime = performance.now();
      const responseTime = Math.round(endTime - startTime);

      if (response.status === 200) {
        result.checks['camunda-engine'] = {
          status: 'pass',
          message: 'Camunda Engine is accessible',
          responseTime,
          details: response.data
        };
      } else {
        result.checks['camunda-engine'] = {
          status: 'fail',
          message: `Unexpected status code: ${response.status}`,
          responseTime
        };
      }
    } catch (error) {
      result.checks['camunda-engine'] = {
        status: 'fail',
        message: `Failed to connect to Camunda Engine: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }

  private async checkCamundaVersion(result: HealthCheckResult): Promise<void> {
    try {
      const response = await axios.get(`${this.config.baseUrl}/version`, {
        ...this.authConfig,
        timeout: this.config.timeout
      });

      if (response.status === 200) {
        result.overall.version = response.data.version;
        result.checks['version'] = {
          status: 'pass',
          message: `Camunda version: ${response.data.version}`,
          details: response.data
        };
      }
    } catch (error) {
      result.checks['version'] = {
        status: 'warn',
        message: `Could not retrieve version: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }

  private async checkProcessDefinitions(result: HealthCheckResult): Promise<void> {
    const startTime = performance.now();
    
    try {
      const response = await axios.get(`${this.config.baseUrl}/process-definition`, {
        ...this.authConfig,
        params: { maxResults: 1 },
        timeout: this.config.timeout
      });

      const endTime = performance.now();
      const responseTime = Math.round(endTime - startTime);

      if (response.status === 200) {
        result.checks['process-definitions'] = {
          status: 'pass',
          message: `Process definitions API accessible (${Array.isArray(response.data) ? response.data.length : 0} definitions)`,
          responseTime
        };
      }
    } catch (error) {
      result.checks['process-definitions'] = {
        status: 'fail',
        message: `Process definitions API failed: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }

  private async checkProcessInstances(result: HealthCheckResult): Promise<void> {
    try {
      const response = await axios.get(`${this.config.baseUrl}/process-instance`, {
        ...this.authConfig,
        params: { maxResults: 1 },
        timeout: this.config.timeout
      });

      if (response.status === 200) {
        result.checks['process-instances'] = {
          status: 'pass',
          message: `Process instances API accessible (${Array.isArray(response.data) ? response.data.length : 0} instances)`
        };
      }
    } catch (error) {
      result.checks['process-instances'] = {
        status: 'fail',
        message: `Process instances API failed: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }

  private async checkTasks(result: HealthCheckResult): Promise<void> {
    try {
      const response = await axios.get(`${this.config.baseUrl}/task`, {
        ...this.authConfig,
        params: { maxResults: 1 },
        timeout: this.config.timeout
      });

      if (response.status === 200) {
        result.checks['tasks'] = {
          status: 'pass',
          message: `Tasks API accessible (${Array.isArray(response.data) ? response.data.length : 0} tasks)`
        };
      }
    } catch (error) {
      result.checks['tasks'] = {
        status: 'fail',
        message: `Tasks API failed: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }

  private async checkDeployments(result: HealthCheckResult): Promise<void> {
    try {
      const response = await axios.get(`${this.config.baseUrl}/deployment`, {
        ...this.authConfig,
        params: { maxResults: 1 },
        timeout: this.config.timeout
      });

      if (response.status === 200) {
        result.checks['deployments'] = {
          status: 'pass',
          message: `Deployments API accessible (${Array.isArray(response.data) ? response.data.length : 0} deployments)`
        };
      }
    } catch (error) {
      result.checks['deployments'] = {
        status: 'fail',
        message: `Deployments API failed: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }

  private async checkPerformance(result: HealthCheckResult): Promise<void> {
    const startTime = performance.now();
    
    try {
      // Test performance with multiple requests
      const promises = [
        axios.get(`${this.config.baseUrl}/process-definition`, { ...this.authConfig, params: { maxResults: 5 } }),
        axios.get(`${this.config.baseUrl}/process-instance`, { ...this.authConfig, params: { maxResults: 5 } }),
        axios.get(`${this.config.baseUrl}/task`, { ...this.authConfig, params: { maxResults: 5 } })
      ];

      await Promise.all(promises);
      
      const endTime = performance.now();
      const responseTime = Math.round(endTime - startTime);

      if (responseTime < 2000) {
        result.checks['performance'] = {
          status: 'pass',
          message: `Good performance: ${responseTime}ms for multiple API calls`,
          responseTime
        };
      } else if (responseTime < 5000) {
        result.checks['performance'] = {
          status: 'warn',
          message: `Acceptable performance: ${responseTime}ms for multiple API calls`,
          responseTime
        };
      } else {
        result.checks['performance'] = {
          status: 'fail',
          message: `Poor performance: ${responseTime}ms for multiple API calls`,
          responseTime
        };
      }
    } catch (error) {
      result.checks['performance'] = {
        status: 'fail',
        message: `Performance test failed: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }

  private checkSystemResources(result: HealthCheckResult): void {
    try {
      const memoryUsage = process.memoryUsage();
      const memoryUsageMB = Math.round(memoryUsage.rss / 1024 / 1024);
      
      // Check memory usage (warning at >100MB, error at >500MB)
      if (memoryUsageMB < 100) {
        result.checks['memory'] = {
          status: 'pass',
          message: `Memory usage is healthy: ${memoryUsageMB}MB`,
          details: memoryUsage
        };
      } else if (memoryUsageMB < 500) {
        result.checks['memory'] = {
          status: 'warn',
          message: `Memory usage is elevated: ${memoryUsageMB}MB`,
          details: memoryUsage
        };
      } else {
        result.checks['memory'] = {
          status: 'fail',
          message: `Memory usage is high: ${memoryUsageMB}MB`,
          details: memoryUsage
        };
      }

      // Check uptime
      const uptime = process.uptime();
      result.checks['uptime'] = {
        status: 'pass',
        message: `Process uptime: ${Math.round(uptime)}s`,
        details: { uptime }
      };

    } catch (error) {
      result.checks['system'] = {
        status: 'warn',
        message: `Could not check system resources: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }

  private determineOverallStatus(result: HealthCheckResult): 'healthy' | 'unhealthy' | 'degraded' {
    const checks = Object.values(result.checks);
    const failedChecks = checks.filter(check => check.status === 'fail');
    const warnChecks = checks.filter(check => check.status === 'warn');

    if (failedChecks.length > 0) {
      // If there are critical errors (engine, process-definitions), then unhealthy
      const criticalFailures = failedChecks.filter(check => 
        result.checks['camunda-engine'] === check || 
        result.checks['process-definitions'] === check
      );
      
      if (criticalFailures.length > 0) {
        return 'unhealthy';
      }
      
      return 'degraded';
    }

    if (warnChecks.length > 0) {
      return 'degraded';
    }

    return 'healthy';
  }
}

// CLI interface
async function main() {
  const config: HealthCheckConfig = {
    baseUrl: process.env.CAMUNDA_BASE_URL || 'http://localhost:8080/engine-rest',
    username: process.env.CAMUNDA_USERNAME,
    password: process.env.CAMUNDA_PASSWORD,
    timeout: parseInt(process.env.HEALTH_CHECK_TIMEOUT || '5000')
  };

  console.log('🏥 Starting Camunda MCP Server Health Check...\n');

  const checker = new CamundaHealthChecker(config);
  
  try {
    const result = await checker.performHealthCheck();
    
    // Output results
    console.log(`📊 Health Check Results (${result.timestamp})`);
    console.log(`⏱️  Total Response Time: ${result.responseTime}ms`);
    console.log(`🎯 Overall Status: ${getStatusEmoji(result.status)} ${result.status.toUpperCase()}\n`);

    // Detailed results
    console.log('📋 Detailed Checks:');
    for (const [name, check] of Object.entries(result.checks)) {
      const emoji = getStatusEmoji(check.status === 'pass' ? 'healthy' : check.status === 'warn' ? 'degraded' : 'unhealthy');
      console.log(`  ${emoji} ${name}: ${check.message}`);
      if (check.responseTime) {
        console.log(`    ⏱️  Response Time: ${check.responseTime}ms`);
      }
    }

    console.log(`\n🔧 System Info:`);
    console.log(`  📦 Version: ${result.overall.version || 'Unknown'}`);
    console.log(`  🌍 Environment: ${result.overall.environment}`);
    console.log(`  ⏰ Uptime: ${Math.round(result.overall.uptime)}s`);

    // JSON output for CI/CD
    if (process.env.OUTPUT_FORMAT === 'json') {
      console.log('\n--- JSON OUTPUT ---');
      console.log(JSON.stringify(result, null, 2));
    }

    // Exit code for CI/CD
    process.exit(result.status === 'healthy' ? 0 : result.status === 'degraded' ? 1 : 2);

  } catch (error) {
    console.error('❌ Health check failed:', error instanceof Error ? error.message : String(error));
    process.exit(3);
  }
}

function getStatusEmoji(status: string): string {
  switch (status) {
    case 'healthy':
    case 'pass':
      return '✅';
    case 'degraded':
    case 'warn':
      return '⚠️';
    case 'unhealthy':
    case 'fail':
      return '❌';
    default:
      return '❓';
  }
}

// Run if this is the main module (ES module compatible)
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    console.error('Fatal error:', error);
    process.exit(4);
  });
}

export { CamundaHealthChecker, type HealthCheckResult, type HealthCheckConfig };
