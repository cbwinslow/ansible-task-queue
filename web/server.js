const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const dotenv = require('dotenv');
const multer = require('multer');
const winston = require('winston');
const http = require('http');
const socketIo = require('socket.io');

// Load environment variables
dotenv.config();

// Import services
const AuthService = require('./auth/authService');
const TaskService = require('./src/taskService');
const GitHubService = require('./src/githubService');
const AuditService = require('./src/auditService');

// Create Express app
const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// File upload configuration
const upload = multer({ 
  dest: 'uploads/',
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  }
});

// Winston logger configuration
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: '../logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: '../logs/combined.log' }),
  ]
});

if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.simple()
  }));
}

// Initialize services
const authService = new AuthService();
const taskService = new TaskService();
const githubService = new GitHubService();
const auditService = new AuditService();

// Authentication middleware
const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({ error: 'Access token required' });
    }

    const decoded = authService.verifyToken(token);
    req.user = decoded;
    next();
  } catch (error) {
    logger.error('Authentication error:', error);
    return res.status(403).json({ error: 'Invalid or expired token' });
  }
};

// Get client IP middleware
const getClientIP = (req) => {
  return req.headers['x-forwarded-for'] || 
         req.headers['x-real-ip'] || 
         req.connection.remoteAddress || 
         req.socket.remoteAddress || 
         (req.connection.socket ? req.connection.socket.remoteAddress : null);
};

// Routes

// Health check
app.get('/api/health', (req, res) => {
  logger.info('Health check requested');
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// User registration
app.post('/api/auth/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({ error: 'Username, email, and password are required' });
    }

    const result = await authService.registerUser(username, email, password);
    
    // Log registration
    await auditService.logAction(
      result.user.id, 
      'user_register', 
      'user', 
      result.user.id, 
      { username: result.user.username },
      getClientIP(req),
      req.headers['user-agent']
    );
    
    logger.info(`User registered: ${username}`);
    
    res.status(201).json({
      message: 'User registered successfully',
      token: result.token,
      user: result.user
    });
  } catch (error) {
    logger.error('Registration error:', error);
    res.status(400).json({ error: error.message });
  }
});

// User login
app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    const result = await authService.loginUser(username, password);
    
    // Log login
    await auditService.logLogin(
      result.user.id, 
      getClientIP(req), 
      req.headers['user-agent'], 
      true
    );
    
    logger.info(`User logged in: ${username}`);
    
    res.json({
      message: 'Login successful',
      token: result.token,
      user: result.user
    });
  } catch (error) {
    logger.error('Login error:', error);
    res.status(401).json({ error: error.message });
  }
});

// GitHub OAuth (simplified for demo - in production, use proper OAuth flow)
app.post('/api/auth/github', async (req, res) => {
  try {
    const { githubId, githubToken, userData } = req.body;

    if (!githubId || !githubToken || !userData) {
      return res.status(400).json({ error: 'GitHub ID, token, and user data are required' });
    }

    const result = await authService.githubAuth(githubId, githubToken, userData);
    
    // Log GitHub auth
    await auditService.logAction(
      result.user.id, 
      'github_auth', 
      'auth', 
      null, 
      { githubId: result.user.github_id },
      getClientIP(req),
      req.headers['user-agent']
    );
    
    logger.info(`GitHub user authenticated: ${result.user.username}`);
    
    res.json({
      message: 'GitHub authentication successful',
      token: result.token,
      user: result.user
    });
  } catch (error) {
    logger.error('GitHub authentication error:', error);
    res.status(400).json({ error: error.message });
  }
});

// Submit code for execution
app.post('/api/tasks', authenticateToken, upload.single('codeFile'), async (req, res) => {
  try {
    const { title, description, code, language, targetHost, priority } = req.body;
    const userId = req.user.id;

    // Validate input
    if (!code && !req.file) {
      return res.status(400).json({ error: 'Code content or file is required' });
    }

    const taskData = {
      title: title || 'Untitled Task',
      description: description || 'Submitted via mobile app',
      code: code || (req.file ? (await require('fs').promises.readFile(req.file.path, 'utf8')) : ''),
      language: language || 'bash',
      targetHost: targetHost || 'localhost',
      priority: parseInt(priority) || 100
    };

    const task = await taskService.createTask(userId, taskData);
    
    // Clean up uploaded file if exists
    if (req.file) {
      await require('fs').promises.unlink(req.file.path).catch(err => {
        logger.warn(`Failed to clean up uploaded file: ${err.message}`);
      });
    }
    
    // Log task submission
    await auditService.logTaskSubmission(
      userId, 
      task.id, 
      { title: task.title, language: task.language },
      getClientIP(req),
      req.headers['user-agent']
    );
    
    // Emit task update via WebSocket
    io.emit('taskCreated', task);
    
    logger.info(`Task submitted: ${task.id} by user ${userId}`);
    
    res.status(201).json({
      message: 'Task submitted successfully',
      taskId: task.id,
      task
    });
  } catch (error) {
    logger.error('Task submission error:', error);
    
    // Clean up uploaded file if exists
    if (req.file) {
      await require('fs').promises.unlink(req.file.path).catch(err => {
        logger.warn(`Failed to clean up uploaded file: ${err.message}`);
      });
    }
    
    res.status(500).json({ error: error.message });
  }
});

// Get user tasks
app.get('/api/tasks', authenticateToken, async (req, res) => {
  try {
    const { status, limit = 50 } = req.query;
    const userId = req.user.id;
    
    const tasks = await taskService.getTasksByUser(userId, status, parseInt(limit));
    
    logger.info(`Tasks retrieved for user ${userId}: ${tasks.length} tasks`);
    
    res.json({ tasks });
  } catch (error) {
    logger.error('Task retrieval error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get specific task
app.get('/api/tasks/:id', authenticateToken, async (req, res) => {
  try {
    const taskId = parseInt(req.params.id);
    const userId = req.user.id;
    
    const task = await taskService.getTaskById(taskId, userId);
    
    logger.info(`Task retrieved: ${taskId} by user ${userId}`);
    
    res.json({ task });
  } catch (error) {
    logger.error('Task retrieval error:', error);
    res.status(404).json({ error: error.message });
  }
});

// Get task execution logs
app.get('/api/tasks/:id/logs', authenticateToken, async (req, res) => {
  try {
    const taskId = parseInt(req.params.id);
    const userId = req.user.id;
    
    // Verify user has access to this task
    await taskService.getTaskById(taskId, userId);
    
    const logs = await taskService.getTaskLogs(taskId);
    
    logger.info(`Task logs retrieved: ${taskId} by user ${userId}`);
    
    res.json({ logs });
  } catch (error) {
    logger.error('Task logs retrieval error:', error);
    res.status(404).json({ error: error.message });
  }
});

// Execute task (admin only in production)
app.post('/api/tasks/:id/execute', authenticateToken, async (req, res) => {
  try {
    const taskId = parseInt(req.params.id);
    const userId = req.user.id;
    
    // In production, you might want to add authorization checks here
    // For now, we'll allow the task owner to execute their own tasks
    
    const result = await taskService.executeTask(taskId);
    
    // Log task execution
    await auditService.logTaskExecution(
      userId, 
      taskId, 
      { result: 'success' },
      getClientIP(req),
      req.headers['user-agent']
    );
    
    logger.info(`Task executed: ${taskId} by user ${userId}`);
    
    res.json({
      message: 'Task executed successfully',
      result
    });
  } catch (error) {
    logger.error('Task execution error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Lint code
app.post('/api/lint', authenticateToken, async (req, res) => {
  try {
    const { code, language } = req.body;
    
    if (!code) {
      return res.status(400).json({ error: 'Code content is required' });
    }
    
    const lintResults = await taskService.lintCode(code, language);
    
    logger.info(`Code linted for user ${req.user.id}`);
    
    res.json({ lintResults });
  } catch (error) {
    logger.error('Linting error:', error);
    res.status(500).json({ error: error.message });
  }
});

// GitHub Actions integration
app.post('/api/github/actions', authenticateToken, async (req, res) => {
  try {
    const { repoOwner, repoName, workflowId, inputs } = req.body;
    const userId = req.user.id;

    if (!repoOwner || !repoName || !workflowId) {
      return res.status(400).json({ error: 'Repository owner, name, and workflow ID are required' });
    }

    const result = await githubService.triggerWorkflow(userId, repoOwner, repoName, workflowId, inputs || {});
    
    // Log GitHub action
    await auditService.logGitHubAction(
      userId, 
      result.actionId, 
      { repo: `${repoOwner}/${repoName}`, workflowId },
      getClientIP(req),
      req.headers['user-agent']
    );
    
    logger.info(`GitHub Action triggered: ${workflowId} in ${repoOwner}/${repoName} by user ${userId}`);
    
    res.json({
      message: 'GitHub Action triggered successfully',
      actionId: result.actionId,
      status: result.status
    });
  } catch (error) {
    logger.error('GitHub Action error:', error);
    res.status(500).json({ error: error.message });
  }
});

// List user repositories
app.get('/api/github/repos', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const repos = await githubService.getUserRepos(userId);
    
    logger.info(`GitHub repositories retrieved for user ${userId}`);
    
    res.json({ repos });
  } catch (error) {
    logger.error('GitHub repositories error:', error);
    res.status(500).json({ error: error.message });
  }
});

// List repository workflows
app.get('/api/github/repos/:owner/:repo/workflows', authenticateToken, async (req, res) => {
  try {
    const { owner, repo } = req.params;
    const userId = req.user.id;
    
    const workflows = await githubService.listWorkflows(userId, owner, repo);
    
    logger.info(`GitHub workflows retrieved for ${owner}/${repo} by user ${userId}`);
    
    res.json({ workflows });
  } catch (error) {
    logger.error('GitHub workflows error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get user GitHub Actions
app.get('/api/github/actions', authenticateToken, async (req, res) => {
  try {
    const { limit = 50 } = req.query;
    const userId = req.user.id;
    
    const actions = await githubService.getUserActions(userId, parseInt(limit));
    
    logger.info(`GitHub Actions retrieved for user ${userId}`);
    
    res.json({ actions });
  } catch (error) {
    logger.error('GitHub Actions error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Audit log endpoints
app.get('/api/audit', authenticateToken, async (req, res) => {
  try {
    const { limit = 100, offset = 0 } = req.query;
    const userId = req.user.id;
    
    const auditLogs = await auditService.getUserAuditLog(userId, parseInt(limit), parseInt(offset));
    
    logger.info(`Audit logs retrieved for user ${userId}`);
    
    res.json({ auditLogs });
  } catch (error) {
    logger.error('Audit log error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/audit/summary', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const summary = await auditService.getAuditSummary(userId);
    
    logger.info(`Audit summary retrieved for user ${userId}`);
    
    res.json({ summary });
  } catch (error) {
    logger.error('Audit summary error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/audit/search', authenticateToken, async (req, res) => {
  try {
    const { q, limit = 50 } = req.query;
    const userId = req.user.id;
    
    const results = await auditService.searchAuditLog(userId, q, parseInt(limit));
    
    logger.info(`Audit search performed for user ${userId}: ${q}`);
    
    res.json({ results });
  } catch (error) {
    logger.error('Audit search error:', error);
    res.status(500).json({ error: error.message });
  }
});

// System metrics (admin only)
app.get('/api/metrics', authenticateToken, async (req, res) => {
  try {
    // In production, you'd want to check if user is admin
    const metrics = await taskService.pool.query('SELECT * FROM system_metrics');
    
    logger.info(`System metrics retrieved by user ${req.user.id}`);
    
    res.json({ metrics: metrics.rows[0] });
  } catch (error) {
    logger.error('Metrics error:', error);
    res.status(500).json({ error: error.message });
  }
});

// WebSocket connection handling
io.on('connection', (socket) => {
  logger.info('WebSocket client connected');
  
  socket.on('disconnect', () => {
    logger.info('WebSocket client disconnected');
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  logger.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// 404 handler
app.use((req, res) => {
  logger.warn(`404 - Route not found: ${req.url}`);
  res.status(404).json({ error: 'Route not found' });
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  server.close(() => {
    logger.info('Process terminated');
    process.exit(0);
  });
});

// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  logger.info(`🚀 Cloudflare Mobile Task Executor API running on port ${PORT}`);
  console.log(`🚀 Cloudflare Mobile Task Executor API running on port ${PORT}`);
});

module.exports = app;