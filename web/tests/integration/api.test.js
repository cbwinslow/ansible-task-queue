const request = require('supertest');
const app = require('../../web/server');

// Mock all services
jest.mock('../../web/auth/authService');
jest.mock('../../web/src/taskService');
jest.mock('../../web/src/githubService');
jest.mock('../../web/src/auditService');

const AuthService = require('../../web/auth/authService');
const TaskService = require('../../web/src/taskService');
const GitHubService = require('../../web/src/githubService');
const AuditService = require('../../web/src/auditService');

describe('API Integration Tests', () => {
  let mockAuthService;
  let mockTaskService;
  let mockGitHubService;
  let mockAuditService;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();
    
    // Create mock instances
    mockAuthService = new AuthService();
    mockTaskService = new TaskService();
    mockGitHubService = new GitHubService();
    mockAuditService = new AuditService();
    
    // Mock constructor returns
    AuthService.mockImplementation(() => mockAuthService);
    TaskService.mockImplementation(() => mockTaskService);
    GitHubService.mockImplementation(() => mockGitHubService);
    AuditService.mockImplementation(() => mockAuditService);
  });

  describe('Authentication Routes', () => {
    describe('POST /api/auth/register', () => {
      it('should register user successfully', async () => {
        const mockResult = {
          user: { id: 1, username: 'testuser', email: 'test@example.com' },
          token: 'test_token'
        };
        
        mockAuthService.registerUser.mockResolvedValueOnce(mockResult);

        const response = await request(app)
          .post('/api/auth/register')
          .send({
            username: 'testuser',
            email: 'test@example.com',
            password: 'password123'
          })
          .expect(201);

        expect(response.body.message).toBe('User registered successfully');
        expect(response.body.token).toBe('test_token');
        expect(response.body.user.username).toBe('testuser');
      });

      it('should return 400 for missing required fields', async () => {
        const response = await request(app)
          .post('/api/auth/register')
          .send({
            username: 'testuser'
            // missing email and password
          })
          .expect(400);

        expect(response.body.error).toBe('Username, email, and password are required');
      });
    });

    describe('POST /api/auth/login', () => {
      it('should login user successfully', async () => {
        const mockResult = {
          user: { id: 1, username: 'testuser', email: 'test@example.com' },
          token: 'test_token'
        };
        
        mockAuthService.loginUser.mockResolvedValueOnce(mockResult);

        const response = await request(app)
          .post('/api/auth/login')
          .send({
            username: 'testuser',
            password: 'password123'
          })
          .expect(200);

        expect(response.body.message).toBe('Login successful');
        expect(response.body.token).toBe('test_token');
      });

      it('should return 401 for invalid credentials', async () => {
        mockAuthService.loginUser.mockRejectedValueOnce(new Error('Invalid credentials'));

        const response = await request(app)
          .post('/api/auth/login')
          .send({
            username: 'testuser',
            password: 'wrongpassword'
          })
          .expect(401);

        expect(response.body.error).toBe('Invalid credentials');
      });
    });
  });

  describe('Task Routes', () => {
    const validToken = 'Bearer valid_token';
    const mockUser = { id: 1, username: 'testuser' };

    beforeEach(() => {
      // Mock token verification
      mockAuthService.verifyToken.mockReturnValue(mockUser);
    });

    describe('POST /api/tasks', () => {
      it('should create task successfully', async () => {
        const mockTask = {
          id: 1,
          user_id: 1,
          title: 'Test Task',
          description: 'Test Description',
          code: 'echo "Hello World"',
          language: 'bash',
          status: 'pending'
        };
        
        mockTaskService.createTask.mockResolvedValueOnce(mockTask);

        const response = await request(app)
          .post('/api/tasks')
          .set('Authorization', validToken)
          .send({
            title: 'Test Task',
            description: 'Test Description',
            code: 'echo "Hello World"',
            language: 'bash'
          })
          .expect(201);

        expect(response.body.message).toBe('Task submitted successfully');
        expect(response.body.task.id).toBe(1);
      });

      it('should return 401 for missing token', async () => {
        const response = await request(app)
          .post('/api/tasks')
          .send({
            title: 'Test Task',
            code: 'echo "Hello World"'
          })
          .expect(401);

        expect(response.body.error).toBe('Access token required');
      });
    });

    describe('GET /api/tasks', () => {
      it('should retrieve user tasks successfully', async () => {
        const mockTasks = [
          { id: 1, title: 'Task 1', status: 'pending' },
          { id: 2, title: 'Task 2', status: 'completed' }
        ];
        
        mockTaskService.getTasksByUser.mockResolvedValueOnce(mockTasks);

        const response = await request(app)
          .get('/api/tasks')
          .set('Authorization', validToken)
          .expect(200);

        expect(response.body.tasks).toHaveLength(2);
        expect(response.body.tasks[0].title).toBe('Task 1');
      });
    });
  });

  describe('GitHub Routes', () => {
    const validToken = 'Bearer valid_token';
    const mockUser = { id: 1, username: 'testuser' };

    beforeEach(() => {
      mockAuthService.verifyToken.mockReturnValue(mockUser);
    });

    describe('POST /api/github/actions', () => {
      it('should trigger GitHub action successfully', async () => {
        const mockResult = {
          actionId: 1,
          status: 'triggered'
        };
        
        mockGitHubService.triggerWorkflow.mockResolvedValueOnce(mockResult);

        const response = await request(app)
          .post('/api/github/actions')
          .set('Authorization', validToken)
          .send({
            repoOwner: 'testowner',
            repoName: 'testrepo',
            workflowId: 'workflow.yml',
            inputs: { test: 'input' }
          })
          .expect(200);

        expect(response.body.message).toBe('GitHub Action triggered successfully');
        expect(response.body.actionId).toBe(1);
      });

      it('should return 400 for missing required fields', async () => {
        const response = await request(app)
          .post('/api/github/actions')
          .set('Authorization', validToken)
          .send({
            repoOwner: 'testowner'
            // missing repoName and workflowId
          })
          .expect(400);

        expect(response.body.error).toBe('Repository owner, name, and workflow ID are required');
      });
    });
  });

  describe('Audit Routes', () => {
    const validToken = 'Bearer valid_token';
    const mockUser = { id: 1, username: 'testuser' };

    beforeEach(() => {
      mockAuthService.verifyToken.mockReturnValue(mockUser);
    });

    describe('GET /api/audit', () => {
      it('should retrieve audit logs successfully', async () => {
        const mockLogs = [
          { id: 1, action: 'login', created_at: new Date().toISOString() }
        ];
        
        mockAuditService.getUserAuditLog.mockResolvedValueOnce(mockLogs);

        const response = await request(app)
          .get('/api/audit')
          .set('Authorization', validToken)
          .expect(200);

        expect(response.body.auditLogs).toHaveLength(1);
        expect(response.body.auditLogs[0].action).toBe('login');
      });
    });
  });

  describe('Health Check', () => {
    it('should return health status', async () => {
      const response = await request(app)
        .get('/api/health')
        .expect(200);

      expect(response.body.status).toBe('ok');
      expect(response.body.version).toBe('1.0.0');
    });
  });
});