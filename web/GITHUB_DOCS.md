# GitHub Actions Integration Documentation

## Overview

The Cloudflare Mobile Task Executor provides comprehensive GitHub Actions integration, allowing users to trigger, monitor, and manage GitHub workflows directly from their mobile devices. This integration enables seamless automation of development, deployment, and operational tasks through a secure and user-friendly interface.

## Features

### Core GitHub Actions Features

#### Workflow Triggering
- **Direct Workflow Execution**: Trigger any GitHub Action workflow with custom parameters
- **Repository Selection**: Choose from all accessible repositories
- **Workflow Filtering**: Filter workflows by name, status, or type
- **Parameter Configuration**: Set dynamic input parameters for workflows
- **Scheduled Triggers**: Schedule workflows for future execution

#### Real-time Monitoring
- **Live Status Updates**: Real-time workflow execution status
- **Step-by-Step Progress**: Detailed breakdown of workflow steps
- **Log Streaming**: Real-time log output during execution
- **Completion Notifications**: Push notifications for workflow completion
- **Error Detection**: Automatic error detection and highlighting

#### Comprehensive Management
- **Workflow History**: Browse previously executed workflows
- **Result Analysis**: Detailed execution results and artifacts
- **Retry Mechanisms**: Re-trigger failed workflows with corrected parameters
- **Cancellation Support**: Stop running workflows when needed
- **Bulk Operations**: Manage multiple workflows simultaneously

### Advanced Integration Features

#### Multi-Repository Support
- **Organization Access**: Access to organization repositories
- **Team Permissions**: Respect for team-based repository access
- **Private Repository Support**: Full support for private repositories
- **Cross-Repository Workflows**: Trigger workflows across multiple repositories
- **Repository Grouping**: Organize repositories by teams or projects

#### Parameter Management
- **Dynamic Input Forms**: Generate input forms based on workflow specifications
- **Parameter Validation**: Real-time validation of input parameters
- **Default Values**: Automatic population of default parameter values
- **Parameter Presets**: Save and reuse parameter combinations
- **Environment Variables**: Secure handling of sensitive environment variables

#### Artifact Management
- **Artifact Download**: Download workflow-generated artifacts
- **Artifact Preview**: Preview artifact contents directly in the app
- **Storage Management**: Manage artifact storage and retention
- **Sharing Options**: Share artifacts with team members
- **Version Control**: Track artifact versions and changes

## Technical Implementation

### Authentication Integration

#### OAuth 2.0 Flow
```yaml
# GitHub OAuth App Configuration
name: Cloudflare Task Executor
homepage_url: https://tasks.yourdomain.com
callback_url: https://tasks.yourdomain.com/api/auth/github/callback
scopes:
  - repo
  - workflow
  - user:email
  - read:org
```

#### Token Management
```javascript
class GitHubAuthService {
  constructor() {
    this.clientId = process.env.GITHUB_CLIENT_ID;
    this.clientSecret = process.env.GITHUB_CLIENT_SECRET;
    this.redirectUri = `${process.env.BASE_URL}/api/auth/github/callback`;
  }

  async getOAuthUrl(state) {
    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      state: state,
      scope: 'repo,workflow,user:email,read:org'
    });
    
    return `https://github.com/login/oauth/authorize?${params}`;
  }

  async exchangeCodeForToken(code) {
    const response = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        client_id: this.clientId,
        client_secret: this.clientSecret,
        code: code,
        redirect_uri: this.redirectUri
      })
    });

    const data = await response.json();
    return data.access_token;
  }

  async getUserInfo(token) {
    const response = await fetch('https://api.github.com/user', {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/vnd.github.v3+json'
      }
    });

    return response.json();
  }
}
```

### Workflow Management API

#### Workflow Listing
```javascript
class GitHubWorkflowService {
  constructor() {
    this.octokit = new Octokit();
  }

  async listWorkflows(owner, repo, token) {
    try {
      const octokit = new Octokit({ auth: token });
      
      const response = await octokit.request(
        'GET /repos/{owner}/{repo}/actions/workflows',
        {
          owner,
          repo,
          headers: {
            'X-GitHub-Api-Version': '2022-11-28'
          }
        }
      );

      return response.data.workflows.map(workflow => ({
        id: workflow.id,
        name: workflow.name,
        path: workflow.path,
        state: workflow.state,
        created_at: workflow.created_at,
        updated_at: workflow.updated_at,
        url: workflow.html_url,
        badge_url: workflow.badge_url
      }));
    } catch (error) {
      throw new Error(`Failed to list workflows: ${error.message}`);
    }
  }

  async getWorkflow(owner, repo, workflowId, token) {
    try {
      const octokit = new Octokit({ auth: token });
      
      const response = await octokit.request(
        'GET /repos/{owner}/{repo}/actions/workflows/{workflow_id}',
        {
          owner,
          repo,
          workflow_id: workflowId,
          headers: {
            'X-GitHub-Api-Version': '2022-11-28'
          }
        }
      );

      return {
        id: response.data.id,
        name: response.data.name,
        path: response.data.path,
        state: response.data.state,
        created_at: response.data.created_at,
        updated_at: response.data.updated_at,
        url: response.data.html_url
      };
    } catch (error) {
      throw new Error(`Failed to get workflow: ${error.message}`);
    }
  }
}
```

#### Workflow Triggering
```javascript
class GitHubWorkflowTrigger {
  async triggerWorkflow(userId, owner, repo, workflowId, inputs = {}) {
    try {
      // Get user's GitHub token
      const token = await this.getUserToken(userId);
      const octokit = new Octokit({ auth: token });

      // Trigger the workflow
      const response = await octokit.request(
        'POST /repos/{owner}/{repo}/actions/workflows/{workflow_id}/dispatches',
        {
          owner,
          repo,
          workflow_id: workflowId,
          ref: 'main',
          inputs: inputs
        }
      );

      // Store action in database
      const actionRecord = await this.createActionRecord(
        userId, 
        `${owner}/${repo}`, 
        workflowId, 
        inputs
      );

      return {
        actionId: actionRecord.id,
        status: 'triggered',
        githubRunId: null,
        message: 'Workflow triggered successfully'
      };
    } catch (error) {
      throw new Error(`Failed to trigger workflow: ${error.message}`);
    }
  }

  async createActionRecord(userId, repoName, workflowId, inputs) {
    const query = `
      INSERT INTO github_actions (
        user_id, repo_name, workflow_name, workflow_id, inputs, status, triggered_at
      ) VALUES ($1, $2, $3, $4, $5, $6, NOW())
      RETURNING id
    `;
    
    const values = [
      userId,
      repoName,
      workflowId,
      workflowId,
      JSON.stringify(inputs),
      'triggered'
    ];
    
    const result = await this.pool.query(query, values);
    return result.rows[0];
  }
}
```

### Real-time Status Monitoring

#### WebSocket Integration
```javascript
class GitHubWorkflowMonitor {
  constructor(io) {
    this.io = io;
    this.monitoringInterval = 30000; // 30 seconds
    this.activeMonitors = new Map();
  }

  async startMonitoring(userId, actionId, githubRunId) {
    const monitorId = `${userId}-${actionId}`;
    
    // Check if already monitoring
    if (this.activeMonitors.has(monitorId)) {
      return;
    }

    // Add to active monitors
    this.activeMonitors.set(monitorId, {
      userId,
      actionId,
      githubRunId,
      interval: setInterval(
        () => this.checkWorkflowStatus(userId, actionId, githubRunId),
        this.monitoringInterval
      )
    });

    // Send initial monitoring start event
    this.io.to(`user-${userId}`).emit('workflowMonitoringStarted', {
      actionId,
      githubRunId,
      message: 'Workflow monitoring started'
    });
  }

  async checkWorkflowStatus(userId, actionId, githubRunId) {
    try {
      // Get user's GitHub token
      const token = await this.getUserToken(userId);
      
      // Get action details
      const action = await this.getActionById(actionId);
      const [owner, repo] = action.repo_name.split('/');
      
      // Check workflow run status
      const octokit = new Octokit({ auth: token });
      const response = await octokit.request(
        'GET /repos/{owner}/{repo}/actions/runs/{run_id}',
        {
          owner,
          repo,
          run_id: githubRunId
        }
      );

      const workflowRun = response.data;
      
      // Update action status
      await this.updateActionStatus(
        actionId,
        workflowRun.status,
        workflowRun.conclusion,
        workflowRun
      );

      // Emit status update
      this.io.to(`user-${userId}`).emit('workflowStatusUpdate', {
        actionId,
        status: workflowRun.status,
        conclusion: workflowRun.conclusion,
        workflowRun
      });

      // Stop monitoring if workflow is complete
      if (workflowRun.status === 'completed') {
        this.stopMonitoring(userId, actionId);
      }
    } catch (error) {
      console.error('Workflow status check failed:', error);
    }
  }

  stopMonitoring(userId, actionId) {
    const monitorId = `${userId}-${actionId}`;
    const monitor = this.activeMonitors.get(monitorId);
    
    if (monitor) {
      clearInterval(monitor.interval);
      this.activeMonitors.delete(monitorId);
      
      this.io.to(`user-${userId}`).emit('workflowMonitoringStopped', {
        actionId,
        message: 'Workflow monitoring stopped'
      });
    }
  }
}
```

## Common Workflow Patterns

### CI/CD Integration

#### Build and Test Workflow
```yaml
name: CI/CD Pipeline
on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main ]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v3
    - name: Setup Node.js
      uses: actions/setup-node@v3
      with:
        node-version: '16'
    - name: Install dependencies
      run: npm ci
    - name: Run tests
      run: npm test
    - name: Upload coverage
      uses: codecov/codecov-action@v3

  build:
    needs: test
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v3
    - name: Setup Docker
      uses: docker/setup-buildx-action@v2
    - name: Build and push
      uses: docker/build-push-action@v4
      with:
        context: .
        push: true
        tags: ${{ secrets.DOCKERHUB_USERNAME }}/myapp:${{ github.sha }}

  deploy:
    needs: build
    runs-on: ubuntu-latest
    steps:
    - name: Deploy to production
      run: |
        echo "Deploying to production..."
        # Deployment commands here
```

#### Security Scanning Workflow
```yaml
name: Security Scanning
on:
  schedule:
    - cron: '0 2 * * 1'  # Weekly on Monday at 2 AM
  workflow_dispatch:
    inputs:
      scan_type:
        description: 'Type of security scan to run'
        required: true
        default: 'full'
        type: choice
        options:
          - full
          - dependency
          - container

jobs:
  security-scan:
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v3
    - name: Run security scan
      uses: aquasecurity/trivy-action@master
      with:
        scan-type: ${{ inputs.scan_type }}
        format: 'sarif'
        output: 'results.sarif'
    - name: Upload scan results
      uses: github/codeql-action/upload-sarif@v2
      with:
        sarif_file: 'results.sarif'
```

### Infrastructure Management

#### Terraform Deployment Workflow
```yaml
name: Terraform Deployment
on:
  workflow_dispatch:
    inputs:
      environment:
        description: 'Target environment'
        required: true
        type: choice
        options:
          - development
          - staging
          - production
      action:
        description: 'Terraform action to perform'
        required: true
        type: choice
        options:
          - plan
          - apply
          - destroy

jobs:
  terraform:
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v3
    - name: Setup Terraform
      uses: hashicorp/setup-terraform@v2
    - name: Terraform Init
      run: terraform init
    - name: Terraform ${{ inputs.action }}
      run: terraform ${{ inputs.action }} -var-file=${{ inputs.environment }}.tfvars
```

#### Kubernetes Deployment Workflow
```yaml
name: Kubernetes Deployment
on:
  workflow_dispatch:
    inputs:
      namespace:
        description: 'Kubernetes namespace'
        required: true
        default: 'default'
      image_tag:
        description: 'Docker image tag'
        required: true

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v3
    - name: Set up kubectl
      uses: azure/setup-kubectl@v3
    - name: Deploy to Kubernetes
      run: |
        kubectl set image deployment/myapp \
          myapp=${{ secrets.DOCKERHUB_USERNAME }}/myapp:${{ inputs.image_tag }} \
          -n ${{ inputs.namespace }}
```

## API Endpoints

### Workflow Management

#### POST /api/github/actions
Trigger a GitHub Action workflow.

**Request:**
```http
POST /api/github/actions
Content-Type: application/json
Authorization: Bearer <jwt_token>

{
  "repoOwner": "string",
  "repoName": "string",
  "workflowId": "string",
  "inputs": {
    "parameter1": "value1",
    "parameter2": "value2"
  }
}
```

**Response:**
```json
{
  "message": "GitHub Action triggered successfully",
  "actionId": 1,
  "status": "triggered",
  "githubRunId": "123456789"
}
```

#### GET /api/github/repos
List user's GitHub repositories.

**Request:**
```http
GET /api/github/repos
Authorization: Bearer <jwt_token>
```

**Response:**
```json
{
  "repos": [
    {
      "id": 123456,
      "name": "repository-name",
      "full_name": "owner/repository-name",
      "private": false,
      "html_url": "https://github.com/owner/repository-name",
      "description": "Repository description",
      "updated_at": "2023-01-01T00:00:00Z",
      "default_branch": "main",
      "permissions": {
        "admin": true,
        "push": true,
        "pull": true
      }
    }
  ]
}
```

#### GET /api/github/repos/{owner}/{repo}/workflows
List repository workflows.

**Request:**
```http
GET /api/github/repos/owner/repository-name/workflows
Authorization: Bearer <jwt_token>
```

**Response:**
```json
{
  "workflows": [
    {
      "id": 12345,
      "name": "CI/CD Pipeline",
      "path": ".github/workflows/ci-cd.yml",
      "state": "active",
      "created_at": "2023-01-01T00:00:00Z",
      "updated_at": "2023-01-01T00:00:00Z",
      "url": "https://github.com/owner/repository-name/actions/workflows/ci-cd.yml",
      "badge_url": "https://github.com/owner/repository-name/workflows/CI/CD%20Pipeline/badge.svg"
    }
  ]
}
```

#### GET /api/github/actions
List user's GitHub Actions.

**Request:**
```http
GET /api/github/actions?limit=50&offset=0
Authorization: Bearer <jwt_token>
```

**Response:**
```json
{
  "actions": [
    {
      "id": 1,
      "user_id": 1,
      "repo_name": "owner/repository-name",
      "workflow_name": "CI/CD Pipeline",
      "workflow_id": "ci-cd.yml",
      "inputs": {
        "environment": "production"
      },
      "status": "completed",
      "github_run_id": "123456789",
      "triggered_at": "2023-01-01T00:00:00Z",
      "completed_at": "2023-01-01T00:05:00Z",
      "result": "success",
      "error_message": null
    }
  ]
}
```

## Security Considerations

### GitHub Token Management

#### Token Scopes
- **repo**: Full control of repositories
- **workflow**: Update GitHub Actions workflows
- **user:email**: Access user email addresses
- **read:org**: Read organization membership

#### Token Security
```javascript
class GitHubTokenManager {
  async rotateToken(userId) {
    // Revoke old token
    await this.revokeUserToken(userId);
    
    // Generate new token through OAuth flow
    const newToken = await this.initiateOAuthFlow(userId);
    
    // Store encrypted token
    await this.storeUserToken(userId, newToken);
    
    return newToken;
  }

  async encryptToken(token) {
    const algorithm = 'aes-256-gcm';
    const key = crypto.scryptSync(process.env.ENCRYPTION_KEY, 'salt', 32);
    const iv = crypto.randomBytes(16);
    
    const cipher = crypto.createCipher(algorithm, key);
    let encrypted = cipher.update(token, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    return {
      encrypted,
      iv: iv.toString('hex'),
      authTag: cipher.getAuthTag().toString('hex')
    };
  }

  async decryptToken(encryptedToken) {
    const algorithm = 'aes-256-gcm';
    const key = crypto.scryptSync(process.env.ENCRYPTION_KEY, 'salt', 32);
    const iv = Buffer.from(encryptedToken.iv, 'hex');
    
    const decipher = crypto.createDecipher(algorithm, key);
    decipher.setAuthTag(Buffer.from(encryptedToken.authTag, 'hex'));
    
    let decrypted = decipher.update(encryptedToken.encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  }
}
```

### Input Validation and Sanitization

#### Parameter Validation
```javascript
class WorkflowParameterValidator {
  validateInputs(workflowSpec, inputs) {
    const errors = [];

    // Validate required parameters
    if (workflowSpec.inputs) {
      for (const [paramName, paramSpec] of Object.entries(workflowSpec.inputs)) {
        if (paramSpec.required && !(paramName in inputs)) {
          errors.push(`Required parameter '${paramName}' is missing`);
        }
      }
    }

    // Validate parameter types
    for (const [paramName, value] of Object.entries(inputs)) {
      const paramSpec = workflowSpec.inputs?.[paramName];
      if (paramSpec) {
        if (!this.validateParameterType(value, paramSpec.type)) {
          errors.push(`Invalid type for parameter '${paramName}'`);
        }
        
        if (paramSpec.options && !paramSpec.options.includes(value)) {
          errors.push(`Invalid value for parameter '${paramName}'`);
        }
      }
    }

    return errors;
  }

  validateParameterType(value, type) {
    switch (type) {
      case 'string':
        return typeof value === 'string';
      case 'number':
        return typeof value === 'number' && !isNaN(value);
      case 'boolean':
        return typeof value === 'boolean';
      case 'choice':
        return typeof value === 'string';
      default:
        return true;
    }
  }
}
```

## Performance Optimization

### Caching Strategy

#### Repository Cache
```javascript
class GitHubCacheManager {
  constructor() {
    this.redis = new Redis(process.env.REDIS_URL);
    this.defaultTTL = 300; // 5 minutes
  }

  async getCachedRepositories(userId) {
    const cacheKey = `github:repos:${userId}`;
    const cached = await this.redis.get(cacheKey);
    
    if (cached) {
      return JSON.parse(cached);
    }
    
    return null;
  }

  async cacheRepositories(userId, repositories) {
    const cacheKey = `github:repos:${userId}`;
    await this.redis.setex(
      cacheKey,
      this.defaultTTL,
      JSON.stringify(repositories)
    );
  }

  async invalidateRepositoryCache(userId) {
    const cacheKey = `github:repos:${userId}`;
    await this.redis.del(cacheKey);
  }

  async getCachedWorkflows(userId, owner, repo) {
    const cacheKey = `github:workflows:${userId}:${owner}/${repo}`;
    const cached = await this.redis.get(cacheKey);
    
    if (cached) {
      return JSON.parse(cached);
    }
    
    return null;
  }
}
```

### Rate Limiting

#### GitHub API Rate Limiting
```javascript
class GitHubRateLimiter {
  constructor() {
    this.rateLimits = new Map();
  }

  async checkRateLimit(userId) {
    const limitKey = `github:${userId}`;
    const current = await this.redis.get(limitKey) || 0;
    
    if (current >= 5000) { // GitHub API hourly limit
      throw new Error('GitHub API rate limit exceeded');
    }
  }

  async incrementRateLimit(userId) {
    const limitKey = `github:${userId}`;
    const current = await this.redis.incr(limitKey);
    
    if (current === 1) {
      await this.redis.expire(limitKey, 3600); // 1 hour TTL
    }
  }

  async getRateLimitStatus(userId) {
    const limitKey = `github:${userId}`;
    const remaining = 5000 - (await this.redis.get(limitKey) || 0);
    return {
      limit: 5000,
      remaining,
      reset: await this.redis.ttl(limitKey)
    };
  }
}
```

## Error Handling and Recovery

### Comprehensive Error Handling
```javascript
class GitHubErrorHandler {
  constructor() {
    this.errorPatterns = {
      'rate_limit_exceeded': /^API rate limit exceeded/,
      'resource_not_found': /^Not Found$/,
      'permission_denied': /^Forbidden$/,
      'authentication_failed': /^Bad credentials$/,
      'server_error': /^(Server Error|Internal Server Error)/
    };
  }

  async handleError(error, userId, actionId) {
    const errorType = this.identifyErrorType(error.message);
    
    switch (errorType) {
      case 'rate_limit_exceeded':
        await this.handleRateLimitError(userId, actionId);
        break;
      case 'resource_not_found':
        await this.handleResourceNotFoundError(userId, actionId);
        break;
      case 'permission_denied':
        await this.handlePermissionError(userId, actionId);
        break;
      case 'authentication_failed':
        await this.handleAuthenticationError(userId, actionId);
        break;
      default:
        await this.handleGenericError(error, userId, actionId);
    }
  }

  identifyErrorType(errorMessage) {
    for (const [type, pattern] of Object.entries(this.errorPatterns)) {
      if (pattern.test(errorMessage)) {
        return type;
      }
    }
    return 'generic';
  }

  async handleRateLimitError(userId, actionId) {
    // Pause monitoring and retry later
    await this.updateActionStatus(actionId, 'queued', 'Rate limit exceeded');
    
    // Schedule retry after rate limit reset
    setTimeout(() => {
      this.resumeMonitoring(userId, actionId);
    }, 3600000); // 1 hour
  }
}
```

## Monitoring and Analytics

### GitHub Actions Analytics

#### Execution Metrics
```javascript
class GitHubAnalytics {
  async recordWorkflowExecution(userId, actionId, executionData) {
    const metrics = {
      userId,
      actionId,
      executionTime: executionData.completed_at - executionData.started_at,
      success: executionData.conclusion === 'success',
      steps: executionData.steps?.length || 0,
      artifacts: executionData.artifacts?.length || 0,
      timestamp: new Date()
    };

    // Store metrics
    await this.storeMetrics(metrics);
    
    // Update user statistics
    await this.updateUserStatistics(userId, metrics);
  }

  async getUserWorkflowStatistics(userId) {
    const query = `
      SELECT 
        COUNT(*) as total_executions,
        AVG(EXTRACT(EPOCH FROM (completed_at - triggered_at))) as avg_duration,
        COUNT(CASE WHEN result = 'success' THEN 1 END) as successful_executions,
        COUNT(CASE WHEN result = 'failure' THEN 1 END) as failed_executions,
        MAX(triggered_at) as last_execution
      FROM github_actions 
      WHERE user_id = $1
    `;
    
    const result = await this.pool.query(query, [userId]);
    return result.rows[0];
  }
}
```

## Integration Examples

### Mobile App Integration

#### React Native Component
```jsx
import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, TouchableOpacity } from 'react-native';

const GitHubWorkflowsScreen = ({ navigation }) => {
  const [workflows, setWorkflows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedRepo, setSelectedRepo] = useState(null);

  useEffect(() => {
    loadRepositories();
  }, []);

  const loadRepositories = async () => {
    try {
      const response = await fetch('/api/github/repos', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      const data = await response.json();
      setRepositories(data.repos);
      setLoading(false);
    } catch (error) {
      console.error('Failed to load repositories:', error);
      setLoading(false);
    }
  };

  const loadWorkflows = async (owner, repo) => {
    try {
      setLoading(true);
      const response = await fetch(`/api/github/repos/${owner}/${repo}/workflows`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      const data = await response.json();
      setWorkflows(data.workflows);
      setLoading(false);
    } catch (error) {
      console.error('Failed to load workflows:', error);
      setLoading(false);
    }
  };

  const triggerWorkflow = async (workflowId) => {
    try {
      const response = await fetch('/api/github/actions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          repoOwner: selectedRepo.owner,
          repoName: selectedRepo.name,
          workflowId: workflowId,
          inputs: {}
        })
      });

      const data = await response.json();
      navigation.navigate('WorkflowStatus', { actionId: data.actionId });
    } catch (error) {
      console.error('Failed to trigger workflow:', error);
    }
  };

  return (
    <View style={styles.container}>
      {repositories.map(repo => (
        <TouchableOpacity
          key={repo.id}
          style={styles.repoItem}
          onPress={() => {
            setSelectedRepo(repo);
            loadWorkflows(repo.owner, repo.name);
          }}
        >
          <Text style={styles.repoName}>{repo.full_name}</Text>
          <Text style={styles.repoDescription}>{repo.description}</Text>
        </TouchableOpacity>
      ))}

      <FlatList
        data={workflows}
        renderItem={({ item: workflow }) => (
          <View style={styles.workflowItem}>
            <Text style={styles.workflowName}>{workflow.name}</Text>
            <Text style={styles.workflowPath}>{workflow.path}</Text>
            <Text style={styles.workflowStatus}>{workflow.state}</Text>
            <TouchableOpacity
              style={styles.triggerButton}
              onPress={() => triggerWorkflow(workflow.id)}
            >
              <Text style={styles.triggerButtonText}>Trigger</Text>
            </TouchableOpacity>
          </View>
        )}
        keyExtractor={item => item.id.toString()}
        refreshing={loading}
        onRefresh={loadRepositories}
      />
    </View>
  );
};
```

### Web Dashboard Integration

#### Vue.js Component
```vue
<template>
  <div class="github-dashboard">
    <div class="dashboard-header">
      <h2>GitHub Actions Dashboard</h2>
      <div class="controls">
        <select v-model="selectedRepository" @change="loadWorkflows">
          <option value="">Select a repository</option>
          <option v-for="repo in repositories" :key="repo.id" :value="repo.full_name">
            {{ repo.full_name }}
          </option>
        </select>
        <button @click="refreshData" :disabled="loading">
          {{ loading ? 'Loading...' : 'Refresh' }}
        </button>
      </div>
    </div>

    <div class="workflows-section" v-if="selectedRepository">
      <h3>Workflows</h3>
      <div class="workflow-grid">
        <div 
          v-for="workflow in workflows" 
          :key="workflow.id" 
          class="workflow-card"
          :class="workflow.state"
        >
          <div class="workflow-header">
            <h4>{{ workflow.name }}</h4>
            <span class="workflow-status">{{ workflow.state }}</span>
          </div>
          <div class="workflow-details">
            <p><strong>Path:</strong> {{ workflow.path }}</p>
            <p><strong>Updated:</strong> {{ formatDate(workflow.updated_at) }}</p>
          </div>
          <div class="workflow-actions">
            <button @click="triggerWorkflow(workflow)" class="primary">
              Trigger
            </button>
            <button @click="viewWorkflowHistory(workflow)" class="secondary">
              History
            </button>
          </div>
        </div>
      </div>
    </div>

    <div class="recent-actions" v-if="recentActions.length">
      <h3>Recent Actions</h3>
      <div class="actions-list">
        <div 
          v-for="action in recentActions" 
          :key="action.id" 
          class="action-item"
          :class="action.status"
        >
          <div class="action-info">
            <span class="action-repo">{{ action.repo_name }}</span>
            <span class="action-workflow">{{ action.workflow_name }}</span>
            <span class="action-status">{{ action.status }}</span>
            <span class="action-time">{{ formatDate(action.triggered_at) }}</span>
          </div>
          <div class="action-result" v-if="action.result">
            <span :class="`result-${action.result}`">{{ action.result }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'GitHubDashboard',
  data() {
    return {
      repositories: [],
      workflows: [],
      recentActions: [],
      selectedRepository: '',
      loading: false
    };
  },
  mounted() {
    this.loadRepositories();
    this.loadRecentActions();
  },
  methods: {
    async loadRepositories() {
      this.loading = true;
      try {
        const response = await fetch('/api/github/repos', {
          headers: {
            'Authorization': `Bearer ${this.$store.state.token}`
          }
        });
        const data = await response.json();
        this.repositories = data.repos;
      } catch (error) {
        console.error('Failed to load repositories:', error);
      } finally {
        this.loading = false;
      }
    },
    
    async loadWorkflows() {
      if (!this.selectedRepository) return;
      
      this.loading = true;
      try {
        const [owner, repo] = this.selectedRepository.split('/');
        const response = await fetch(`/api/github/repos/${owner}/${repo}/workflows`, {
          headers: {
            'Authorization': `Bearer ${this.$store.state.token}`
          }
        });
        const data = await response.json();
        this.workflows = data.workflows;
      } catch (error) {
        console.error('Failed to load workflows:', error);
      } finally {
        this.loading = false;
      }
    },
    
    async triggerWorkflow(workflow) {
      try {
        const [owner, repo] = this.selectedRepository.split('/');
        const response = await fetch('/api/github/actions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.$store.state.token}`
          },
          body: JSON.stringify({
            repoOwner: owner,
            repoName: repo,
            workflowId: workflow.id,
            inputs: {}
          })
        });
        
        const data = await response.json();
        this.$router.push(`/workflow/${data.actionId}`);
      } catch (error) {
        console.error('Failed to trigger workflow:', error);
      }
    },
    
    formatDate(dateString) {
      return new Date(dateString).toLocaleDateString();
    }
  }
};
</script>

<style scoped>
.github-dashboard {
  padding: 20px;
}

.dashboard-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 30px;
}

.controls {
  display: flex;
  gap: 10px;
}

.workflow-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 20px;
}

.workflow-card {
  border: 1px solid #ddd;
  border-radius: 8px;
  padding: 20px;
  background: white;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

.workflow-card.active {
  border-left: 4px solid #28a745;
}

.workflow-card.disabled {
  border-left: 4px solid #dc3545;
  opacity: 0.7;
}

.workflow-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 15px;
}

.workflow-status {
  padding: 4px 8px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: bold;
  text-transform: uppercase;
}

.actions-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.action-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 15px;
  border: 1px solid #eee;
  border-radius: 6px;
  background: white;
}

.action-info {
  display: flex;
  gap: 20px;
  align-items: center;
}

.action-status {
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 12px;
  background: #f8f9fa;
}
</style>
</template>
```

This comprehensive GitHub Actions integration documentation provides developers with all the information needed to understand, implement, and maintain the GitHub Actions features within the Cloudflare Mobile Task Executor platform.