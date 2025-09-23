# API Documentation

## Overview

The Cloudflare Mobile Task Executor API provides a comprehensive RESTful interface for managing tasks, executing code, integrating with GitHub, and maintaining security audit trails. This documentation covers all available endpoints, authentication methods, request/response formats, and error handling.

## Base URL

```
https://tasks.yourdomain.com/api
```

## Authentication

### JWT Token Authentication

Most API endpoints require authentication using JWT tokens. Tokens are obtained through the authentication endpoints and must be included in the `Authorization` header.

**Header Format:**
```
Authorization: Bearer <jwt_token>
```

### GitHub OAuth Authentication

For GitHub integration, OAuth tokens can be obtained through the GitHub authentication endpoint.

## Rate Limiting

API requests are rate-limited to prevent abuse:

- **General API**: 1000 requests per hour per IP
- **Authentication**: 100 requests per hour per IP
- **Task Submission**: 100 requests per hour per user
- **GitHub Integration**: 500 requests per hour per user

Exceeding rate limits will result in a `429 Too Many Requests` response.

## Error Handling

### HTTP Status Codes

| Status Code | Description |
|-------------|-------------|
| 200 | OK - Request successful |
| 201 | Created - Resource created successfully |
| 400 | Bad Request - Invalid request format |
| 401 | Unauthorized - Authentication required |
| 403 | Forbidden - Insufficient permissions |
| 404 | Not Found - Resource not found |
| 429 | Too Many Requests - Rate limit exceeded |
| 500 | Internal Server Error - Server error |

### Error Response Format

```json
{
  "error": "Descriptive error message",
  "code": "ERROR_CODE",
  "details": {
    "field": "specific field error details"
  }
}
```

## Authentication Endpoints

### POST /auth/register

Register a new user account.

**Request:**
```http
POST /api/auth/register
Content-Type: application/json

{
  "username": "string",
  "email": "string",
  "password": "string"
}
```

**Parameters:**
- `username` (required): Unique username (3-50 characters)
- `email` (required): Valid email address
- `password` (required): Password (minimum 12 characters)

**Response:**
```json
{
  "message": "User registered successfully",
  "token": "jwt_token",
  "user": {
    "id": 1,
    "username": "string",
    "email": "string",
    "created_at": "2023-01-01T00:00:00Z"
  }
}
```

**Errors:**
- `400`: Missing required fields
- `400`: Username or email already exists
- `400`: Password does not meet requirements

### POST /auth/login

Authenticate and login a user.

**Request:**
```http
POST /api/auth/login
Content-Type: application/json

{
  "username": "string",
  "password": "string"
}
```

**Parameters:**
- `username` (required): Username or email
- `password` (required): User password

**Response:**
```json
{
  "message": "Login successful",
  "token": "jwt_token",
  "user": {
    "id": 1,
    "username": "string",
    "email": "string"
  }
}
```

**Errors:**
- `400`: Missing required fields
- `401`: Invalid credentials
- `403`: Account locked or inactive

### POST /auth/github

GitHub OAuth authentication.

**Request:**
```http
POST /api/auth/github
Content-Type: application/json
Authorization: Bearer <jwt_token>

{
  "githubId": "string",
  "githubToken": "string",
  "userData": {
    "username": "string",
    "email": "string"
  }
}
```

**Parameters:**
- `githubId` (required): GitHub user ID
- `githubToken` (required): GitHub OAuth token
- `userData` (required): GitHub user data object

**Response:**
```json
{
  "message": "GitHub authentication successful",
  "token": "jwt_token",
  "user": {
    "id": 1,
    "username": "string",
    "email": "string",
    "github_id": "string"
  }
}
```

**Errors:**
- `400`: Missing required fields
- `401`: Invalid GitHub token
- `403`: GitHub authentication failed

## Task Management Endpoints

### POST /tasks

Submit a new task for execution.

**Request:**
```http
POST /api/tasks
Content-Type: application/json
Authorization: Bearer <jwt_token>

{
  "title": "string",
  "description": "string",
  "code": "string",
  "language": "bash|python|javascript|ansible",
  "targetHost": "string",
  "priority": 100
}
```

**Parameters:**
- `title` (required): Task title (max 255 characters)
- `description` (optional): Task description
- `code` (required): Code to execute
- `language` (optional): Programming language (default: bash)
- `targetHost` (optional): Target host (default: localhost)
- `priority` (optional): Task priority 1-1000 (default: 100)

**Response:**
```json
{
  "message": "Task submitted successfully",
  "taskId": 1,
  "task": {
    "id": 1,
    "title": "string",
    "description": "string",
    "code": "string",
    "language": "bash",
    "target_host": "localhost",
    "priority": 100,
    "status": "pending",
    "created_at": "2023-01-01T00:00:00Z"
  }
}
```

**Errors:**
- `400`: Missing required fields
- `400`: Invalid language specified
- `400`: Code exceeds maximum size
- `401`: Authentication required

### GET /tasks

Retrieve user's tasks with optional filtering.

**Request:**
```http
GET /api/tasks?status=pending&limit=50&offset=0
Authorization: Bearer <jwt_token>
```

**Query Parameters:**
- `status` (optional): Filter by status (pending, running, completed, failed)
- `limit` (optional): Number of tasks to return (default: 50, max: 100)
- `offset` (optional): Pagination offset (default: 0)

**Response:**
```json
{
  "tasks": [
    {
      "id": 1,
      "title": "string",
      "description": "string",
      "language": "bash",
      "target_host": "localhost",
      "priority": 100,
      "status": "pending",
      "result": "string",
      "error_message": "string",
      "created_at": "2023-01-01T00:00:00Z",
      "updated_at": "2023-01-01T00:00:00Z"
    }
  ]
}
```

**Errors:**
- `401`: Authentication required
- `403`: Insufficient permissions

### GET /tasks/{id}

Retrieve a specific task by ID.

**Request:**
```http
GET /api/tasks/1
Authorization: Bearer <jwt_token>
```

**Path Parameters:**
- `id` (required): Task ID

**Response:**
```json
{
  "task": {
    "id": 1,
    "title": "string",
    "description": "string",
    "code": "string",
    "language": "bash",
    "target_host": "localhost",
    "priority": 100,
    "status": "pending",
    "result": "string",
    "error_message": "string",
    "retry_count": 0,
    "max_retries": 3,
    "timeout": 3600,
    "scheduled_at": "2023-01-01T00:00:00Z",
    "started_at": "2023-01-01T00:00:00Z",
    "completed_at": "2023-01-01T00:00:00Z",
    "created_at": "2023-01-01T00:00:00Z",
    "updated_at": "2023-01-01T00:00:00Z"
  }
}
```

**Errors:**
- `401`: Authentication required
- `403`: Insufficient permissions
- `404`: Task not found

### GET /tasks/{id}/logs

Retrieve execution logs for a specific task.

**Request:**
```http
GET /api/tasks/1/logs
Authorization: Bearer <jwt_token>
```

**Path Parameters:**
- `id` (required): Task ID

**Response:**
```json
{
  "logs": [
    {
      "id": 1,
      "task_id": 1,
      "log_level": "info",
      "message": "string",
      "timestamp": "2023-01-01T00:00:00Z"
    }
  ]
}
```

**Errors:**
- `401`: Authentication required
- `403`: Insufficient permissions
- `404`: Task not found

### POST /tasks/{id}/execute

Execute a task immediately.

**Request:**
```http
POST /api/tasks/1/execute
Authorization: Bearer <jwt_token>
```

**Path Parameters:**
- `id` (required): Task ID

**Response:**
```json
{
  "message": "Task executed successfully",
  "result": {
    "output": "string",
    "exitCode": 0
  }
}
```

**Errors:**
- `401`: Authentication required
- `403`: Insufficient permissions
- `404`: Task not found
- `409`: Task already running
- `500`: Execution failed

### PUT /tasks/{id}

Update an existing task.

**Request:**
```http
PUT /api/tasks/1
Content-Type: application/json
Authorization: Bearer <jwt_token>

{
  "title": "string",
  "description": "string",
  "code": "string",
  "language": "bash",
  "targetHost": "string",
  "priority": 100
}
```

**Path Parameters:**
- `id` (required): Task ID

**Parameters:**
- Same as POST /tasks, but all optional

**Response:**
```json
{
  "message": "Task updated successfully",
  "task": {
    "id": 1,
    "title": "string",
    "description": "string",
    "code": "string",
    "language": "bash",
    "target_host": "localhost",
    "priority": 100,
    "status": "pending",
    "created_at": "2023-01-01T00:00:00Z",
    "updated_at": "2023-01-01T00:00:00Z"
  }
}
```

**Errors:**
- `400`: Invalid parameters
- `401`: Authentication required
- `403`: Insufficient permissions
- `404`: Task not found
- `409`: Task cannot be updated (already running/completed)

### DELETE /tasks/{id}

Delete a task.

**Request:**
```http
DELETE /api/tasks/1
Authorization: Bearer <jwt_token>
```

**Path Parameters:**
- `id` (required): Task ID

**Response:**
```json
{
  "message": "Task deleted successfully"
}
```

**Errors:**
- `401`: Authentication required
- `403`: Insufficient permissions
- `404`: Task not found
- `409`: Task cannot be deleted (running/executed)

## Code Quality Endpoints

### POST /lint

Lint and validate code for security and quality issues.

**Request:**
```http
POST /api/lint
Content-Type: application/json
Authorization: Bearer <jwt_token>

{
  "code": "string",
  "language": "bash|python|javascript|ansible"
}
```

**Parameters:**
- `code` (required): Code to lint
- `language` (required): Programming language

**Response:**
```json
{
  "lintResults": {
    "errors": [
      {
        "line": 1,
        "column": 1,
        "message": "string",
        "severity": "error"
      }
    ],
    "warnings": [
      {
        "line": 1,
        "column": 1,
        "message": "string",
        "severity": "warning"
      }
    ],
    "info": [
      {
        "line": 1,
        "column": 1,
        "message": "string",
        "severity": "info"
      }
    ]
  }
}
```

**Errors:**
- `400`: Missing required fields
- `400`: Invalid language specified
- `401`: Authentication required

## GitHub Integration Endpoints

### POST /github/actions

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
    "key": "value"
  }
}
```

**Parameters:**
- `repoOwner` (required): Repository owner
- `repoName` (required): Repository name
- `workflowId` (required): Workflow ID or filename
- `inputs` (optional): Workflow input parameters

**Response:**
```json
{
  "message": "GitHub Action triggered successfully",
  "actionId": 1,
  "status": "triggered",
  "githubRunId": "string"
}
```

**Errors:**
- `400`: Missing required fields
- `401`: Authentication required
- `403`: GitHub token not available
- `404`: Repository or workflow not found
- `500`: GitHub API error

### GET /github/repos

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
      "id": 1,
      "name": "string",
      "full_name": "owner/repo",
      "private": false,
      "html_url": "string",
      "description": "string",
      "updated_at": "2023-01-01T00:00:00Z",
      "default_branch": "main"
    }
  ]
}
```

**Errors:**
- `401`: Authentication required
- `403`: GitHub token not available
- `500`: GitHub API error

### GET /github/repos/{owner}/{repo}/workflows

List repository workflows.

**Request:**
```http
GET /api/github/repos/owner/repo/workflows
Authorization: Bearer <jwt_token>
```

**Path Parameters:**
- `owner` (required): Repository owner
- `repo` (required): Repository name

**Response:**
```json
{
  "workflows": [
    {
      "id": 1,
      "name": "string",
      "path": ".github/workflows/workflow.yml",
      "state": "active",
      "created_at": "2023-01-01T00:00:00Z",
      "updated_at": "2023-01-01T00:00:00Z"
    }
  ]
}
```

**Errors:**
- `401`: Authentication required
- `403`: GitHub token not available
- `404`: Repository not found
- `500`: GitHub API error

### GET /github/actions

List user's GitHub Actions.

**Request:**
```http
GET /api/github/actions?limit=50&offset=0
Authorization: Bearer <jwt_token>
```

**Query Parameters:**
- `limit` (optional): Number of actions to return (default: 50, max: 100)
- `offset` (optional): Pagination offset (default: 0)

**Response:**
```json
{
  "actions": [
    {
      "id": 1,
      "user_id": 1,
      "repo_name": "string",
      "workflow_name": "string",
      "workflow_id": "string",
      "inputs": {},
      "status": "pending",
      "github_run_id": "string",
      "triggered_at": "2023-01-01T00:00:00Z",
      "completed_at": "2023-01-01T00:00:00Z",
      "result": "string",
      "error_message": "string"
    }
  ]
}
```

**Errors:**
- `401`: Authentication required
- `403`: GitHub token not available

## Audit & Security Endpoints

### GET /audit

Retrieve user's audit logs.

**Request:**
```http
GET /api/audit?limit=100&offset=0
Authorization: Bearer <jwt_token>
```

**Query Parameters:**
- `limit` (optional): Number of logs to return (default: 100, max: 500)
- `offset` (optional): Pagination offset (default: 0)

**Response:**
```json
{
  "auditLogs": [
    {
      "id": 1,
      "user_id": 1,
      "action": "string",
      "resource_type": "string",
      "resource_id": 1,
      "details": {},
      "ip_address": "127.0.0.1",
      "user_agent": "string",
      "created_at": "2023-01-01T00:00:00Z"
    }
  ]
}
```

**Errors:**
- `401`: Authentication required
- `403`: Insufficient permissions

### GET /audit/summary

Get audit log summary.

**Request:**
```http
GET /api/audit/summary
Authorization: Bearer <jwt_token>
```

**Response:**
```json
{
  "summary": [
    {
      "action": "string",
      "count": "5",
      "first_occurrence": "2023-01-01T00:00:00Z",
      "last_occurrence": "2023-01-01T00:00:00Z"
    }
  ]
}
```

**Errors:**
- `401`: Authentication required
- `403`: Insufficient permissions

### GET /audit/search

Search audit logs.

**Request:**
```http
GET /api/audit/search?q=search_term&limit=50
Authorization: Bearer <jwt_token>
```

**Query Parameters:**
- `q` (required): Search term
- `limit` (optional): Number of results to return (default: 50, max: 100)

**Response:**
```json
{
  "results": [
    {
      "id": 1,
      "user_id": 1,
      "action": "string",
      "resource_type": "string",
      "resource_id": 1,
      "details": {},
      "ip_address": "127.0.0.1",
      "user_agent": "string",
      "created_at": "2023-01-01T00:00:00Z"
    }
  ]
}
```

**Errors:**
- `400`: Missing search term
- `401`: Authentication required
- `403`: Insufficient permissions

### GET /metrics

Get system metrics and statistics.

**Request:**
```http
GET /api/metrics
Authorization: Bearer <jwt_token>
```

**Response:**
```json
{
  "metrics": {
    "total_users": 10,
    "active_users": 8,
    "recently_active_users": 5,
    "total_tasks": 100,
    "pending_tasks": 10,
    "running_tasks": 5,
    "completed_tasks": 80,
    "failed_tasks": 5,
    "total_github_actions": 25,
    "system_uptime": "7 days",
    "average_response_time": "150ms"
  }
}
```

**Errors:**
- `401`: Authentication required
- `403`: Insufficient permissions

## Health Check Endpoints

### GET /health

System health check.

**Request:**
```http
GET /api/health
```

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2023-01-01T00:00:00Z",
  "version": "1.0.0",
  "services": {
    "database": "ok",
    "github": "ok",
    "cloudflare": "ok"
  }
}
```

### GET /health/database

Database health check.

**Request:**
```http
GET /api/health/database
```

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2023-01-01T00:00:00Z",
  "connection": "established",
  "latency": "5ms"
}
```

## WebSocket Events

The API supports real-time communication through WebSocket connections for live updates.

### Connection Endpoint
```
ws://tasks.yourdomain.com/socket.io/
```

### Supported Events

**Task Events:**
- `taskCreated`: New task submitted
- `taskUpdated`: Task status changed
- `taskCompleted`: Task execution finished
- `taskFailed`: Task execution failed

**GitHub Events:**
- `githubActionTriggered`: GitHub Action started
- `githubActionCompleted`: GitHub Action finished
- `githubActionFailed`: GitHub Action failed

**System Events:**
- `systemHealthChanged`: System health status updated
- `userLoggedIn`: User authentication event
- `securityAlert`: Security-related event

### Event Payload Format

```json
{
  "event": "taskUpdated",
  "data": {
    "taskId": 1,
    "status": "running",
    "updatedAt": "2023-01-01T00:00:00Z"
  },
  "timestamp": "2023-01-01T00:00:00Z"
}
```

## API Versioning

The API uses semantic versioning:

- **Major versions**: Breaking changes (v1.0.0 → v2.0.0)
- **Minor versions**: Backward-compatible features (v1.0.0 → v1.1.0)
- **Patch versions**: Backward-compatible fixes (v1.0.0 → v1.0.1)

Current version: `v1`

## Client Libraries

### JavaScript/Node.js
```javascript
const axios = require('axios');

class TaskExecutorClient {
  constructor(baseUrl, token) {
    this.client = axios.create({
      baseURL: baseUrl,
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
  }

  async getTasks(options = {}) {
    const response = await this.client.get('/tasks', { params: options });
    return response.data;
  }

  async createTask(taskData) {
    const response = await this.client.post('/tasks', taskData);
    return response.data;
  }

  async executeTask(taskId) {
    const response = await this.client.post(`/tasks/${taskId}/execute`);
    return response.data;
  }
}
```

### Python
```python
import requests

class TaskExecutorClient:
    def __init__(self, base_url, token):
        self.base_url = base_url
        self.headers = {
            'Authorization': f'Bearer {token}',
            'Content-Type': 'application/json'
        }

    def get_tasks(self, **params):
        response = requests.get(
            f'{self.base_url}/tasks',
            headers=self.headers,
            params=params
        )
        response.raise_for_status()
        return response.json()

    def create_task(self, task_data):
        response = requests.post(
            f'{self.base_url}/tasks',
            headers=self.headers,
            json=task_data
        )
        response.raise_for_status()
        return response.json()
```

### cURL Examples

**Get tasks:**
```bash
curl -H "Authorization: Bearer YOUR_TOKEN" \
     https://tasks.yourdomain.com/api/tasks
```

**Create task:**
```bash
curl -X POST \
     -H "Authorization: Bearer YOUR_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{
           "title": "System Update",
           "code": "apt update && apt upgrade -y",
           "language": "bash",
           "priority": 100
         }' \
     https://tasks.yourdomain.com/api/tasks
```

**Execute task:**
```bash
curl -X POST \
     -H "Authorization: Bearer YOUR_TOKEN" \
     https://tasks.yourdomain.com/api/tasks/1/execute
```

## Rate Limit Headers

All API responses include rate limit information in headers:

```
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 999
X-RateLimit-Reset: 1640995200
X-RateLimit-Used: 1
```

## CORS Policy

The API supports Cross-Origin Resource Sharing for the following origins:

- `https://*.yourdomain.com`
- `http://localhost:*`
- `https://tasks.yourdomain.com`

Allowed methods: `GET`, `POST`, `PUT`, `DELETE`, `OPTIONS`

Allowed headers: `Authorization`, `Content-Type`, `X-Requested-With`

## Content Negotiation

The API supports JSON content type:

- **Request Content-Type**: `application/json`
- **Response Content-Type**: `application/json`

## Error Codes

### Authentication Errors
- `AUTH_INVALID_TOKEN`: Invalid JWT token
- `AUTH_EXPIRED_TOKEN`: Expired JWT token
- `AUTH_MISSING_HEADER`: Missing Authorization header
- `AUTH_GITHUB_FAILED`: GitHub authentication failed

### Task Errors
- `TASK_NOT_FOUND`: Task with specified ID not found
- `TASK_ALREADY_RUNNING`: Task is already executing
- `TASK_CANNOT_UPDATE`: Task cannot be modified in current state
- `TASK_EXECUTION_FAILED`: Task execution encountered an error
- `TASK_SIZE_EXCEEDED`: Code exceeds maximum allowed size

### GitHub Errors
- `GITHUB_REPO_NOT_FOUND`: Repository not found
- `GITHUB_WORKFLOW_NOT_FOUND`: Workflow not found
- `GITHUB_API_ERROR`: GitHub API returned an error
- `GITHUB_PERMISSION_DENIED`: Insufficient GitHub permissions

### Validation Errors
- `VALIDATION_REQUIRED_FIELD`: Required field is missing
- `VALIDATION_INVALID_FORMAT`: Field format is invalid
- `VALIDATION_OUT_OF_RANGE`: Value is outside acceptable range
- `VALIDATION_DUPLICATE_RESOURCE`: Resource already exists

### Rate Limit Errors
- `RATE_LIMIT_EXCEEDED`: Too many requests in timeframe
- `RATE_LIMIT_USER_EXCEEDED`: User-specific rate limit exceeded

This comprehensive API documentation provides developers with all the information needed to integrate with the Cloudflare Mobile Task Executor platform effectively and securely.