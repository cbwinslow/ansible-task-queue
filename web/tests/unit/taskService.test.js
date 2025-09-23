const TaskService = require('../../src/taskService');
const fs = require('fs').promises;
const { spawn } = require('child_process');

// Mock dependencies
jest.mock('pg', () => {
  return {
    Pool: jest.fn(() => ({
      query: jest.fn()
    }))
  };
});

jest.mock('fs').promises;
jest.mock('child_process');

describe('TaskService', () => {
  let taskService;
  let mockPool;

  beforeEach(() => {
    taskService = new TaskService();
    mockPool = taskService.pool;
    
    // Mock logger
    taskService.logger = {
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn()
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createTask', () => {
    it('should create a new task successfully', async () => {
      const mockTask = {
        id: 1,
        user_id: 1,
        title: 'Test Task',
        description: 'Test Description',
        code: 'echo "Hello World"',
        language: 'bash',
        target_host: 'localhost',
        priority: 100,
        status: 'pending',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      mockPool.query.mockResolvedValueOnce({ rows: [mockTask] });
      mockPool.query.mockResolvedValueOnce({ rows: [] }); // logTaskEvent

      const taskData = {
        title: 'Test Task',
        description: 'Test Description',
        code: 'echo "Hello World"',
        language: 'bash',
        targetHost: 'localhost',
        priority: 100
      };

      const result = await taskService.createTask(1, taskData);

      expect(result).toEqual(mockTask);
      expect(mockPool.query).toHaveBeenCalledTimes(2);
    });

    it('should throw error if code is empty', async () => {
      const taskData = {
        title: 'Test Task',
        description: 'Test Description',
        code: '',
        language: 'bash'
      };

      await expect(taskService.createTask(1, taskData))
        .rejects
        .toThrow('Code content is required');
    });
  });

  describe('getTasksByUser', () => {
    it('should retrieve tasks for a user', async () => {
      const mockTasks = [
        { id: 1, user_id: 1, title: 'Task 1', status: 'pending' },
        { id: 2, user_id: 1, title: 'Task 2', status: 'completed' }
      ];

      mockPool.query.mockResolvedValueOnce({ rows: mockTasks });

      const result = await taskService.getTasksByUser(1, null, 50);

      expect(result).toEqual(mockTasks);
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT * FROM tasks WHERE user_id = $1 ORDER BY created_at DESC LIMIT $3'),
        [1, null, 50]
      );
    });
  });

  describe('executeBashScript', () => {
    it('should execute bash script successfully', async () => {
      const mockScript = 'echo "Hello World"';
      const mockChildProcess = {
        stdout: { on: jest.fn() },
        stderr: { on: jest.fn() },
        on: jest.fn((event, callback) => {
          if (event === 'close') {
            setTimeout(() => callback(0), 10);
          }
          return mockChildProcess;
        })
      };

      fs.writeFile.mockResolvedValueOnce();
      fs.chmod.mockResolvedValueOnce();
      spawn.mockReturnValue(mockChildProcess);
      fs.unlink.mockResolvedValueOnce();

      const result = await taskService.executeBashScript(mockScript, 30);

      expect(result).toHaveProperty('output');
      expect(result).toHaveProperty('exitCode', 0);
      expect(spawn).toHaveBeenCalledWith('bash', expect.any(Array), { timeout: 30000 });
    });

    it('should handle script execution errors', async () => {
      const mockScript = 'invalid_command';
      const mockChildProcess = {
        stdout: { on: jest.fn() },
        stderr: { on: jest.fn() },
        on: jest.fn((event, callback) => {
          if (event === 'close') {
            setTimeout(() => callback(1), 10);
          }
          return mockChildProcess;
        })
      };

      fs.writeFile.mockResolvedValueOnce();
      fs.chmod.mockResolvedValueOnce();
      spawn.mockReturnValue(mockChildProcess);
      fs.unlink.mockResolvedValueOnce();

      await expect(taskService.executeBashScript(mockScript, 30))
        .rejects
        .toThrow('Script failed with exit code 1');
    });
  });

  describe('lintCode', () => {
    it('should lint JavaScript code', async () => {
      const code = 'var x = 1;\nconsole.log(x);';
      const language = 'javascript';

      const result = await taskService.lintCode(code, language);

      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0]).toMatchObject({
        message: 'Prefer const or let over var'
      });
    });

    it('should lint bash code for dangerous commands', async () => {
      const code = 'rm -rf /';
      const language = 'bash';

      const result = await taskService.lintCode(code, language);

      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toMatchObject({
        message: 'Dangerous command detected: rm -rf /'
      });
    });

    it('should return error for empty code', async () => {
      const code = '';
      const language = 'bash';

      const result = await taskService.lintCode(code, language);

      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toMatchObject({
        message: 'Code is empty'
      });
    });
  });
});