const AuditService = require('../../src/auditService');

// Mock dependencies
jest.mock('pg', () => {
  return {
    Pool: jest.fn(() => ({
      query: jest.fn()
    }))
  };
});

describe('AuditService', () => {
  let auditService;
  let mockPool;

  beforeEach(() => {
    auditService = new AuditService();
    mockPool = auditService.pool;
    
    // Mock logger
    auditService.logger = {
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn()
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('logAction', () => {
    it('should log audit action successfully', async () => {
      const mockLogEntry = {
        id: 1,
        user_id: 1,
        action: 'test_action',
        resource_type: 'test',
        resource_id: 1,
        details: JSON.stringify({ test: 'data' }),
        ip_address: '127.0.0.1',
        user_agent: 'test-agent',
        created_at: new Date().toISOString()
      };

      mockPool.query.mockResolvedValueOnce({ rows: [mockLogEntry] });

      const result = await auditService.logAction(
        1,
        'test_action',
        'test',
        1,
        { test: 'data' },
        '127.0.0.1',
        'test-agent'
      );

      expect(result).toEqual(mockLogEntry);
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO audit_log'),
        expect.arrayContaining([
          1, 'test_action', 'test', 1, 
          expect.stringContaining('test'),
          '127.0.0.1', 'test-agent'
        ])
      );
    });
  });

  describe('getUserAuditLog', () => {
    it('should retrieve user audit log successfully', async () => {
      const mockLogs = [
        {
          id: 1,
          user_id: 1,
          action: 'login',
          resource_type: 'auth',
          created_at: new Date().toISOString()
        }
      ];

      mockPool.query.mockResolvedValueOnce({ rows: mockLogs });

      const result = await auditService.getUserAuditLog(1, 100, 0);

      expect(result).toEqual(mockLogs);
      expect(mockPool.query).toHaveBeenCalledWith(
        'SELECT * FROM audit_log WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3',
        [1, 100, 0]
      );
    });
  });

  describe('getAuditSummary', () => {
    it('should retrieve audit summary successfully', async () => {
      const mockSummary = [
        {
          action: 'login',
          count: '5',
          first_occurrence: new Date().toISOString(),
          last_occurrence: new Date().toISOString()
        }
      ];

      mockPool.query.mockResolvedValueOnce({ rows: mockSummary });

      const result = await auditService.getAuditSummary(1);

      expect(result).toEqual(mockSummary);
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT action, COUNT(*) as count'),
        [1]
      );
    });
  });

  describe('searchAuditLog', () => {
    it('should search audit log successfully', async () => {
      const mockResults = [
        {
          id: 1,
          user_id: 1,
          action: 'task_submit',
          details: JSON.stringify({ title: 'Test Task' })
        }
      ];

      mockPool.query.mockResolvedValueOnce({ rows: mockResults });

      const result = await auditService.searchAuditLog(1, 'Test Task', 50);

      expect(result).toEqual(mockResults);
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT * FROM audit_log WHERE (details::text ILIKE $1 OR action ILIKE $1'),
        ['%Test Task%', 1, 50]
      );
    });
  });
});