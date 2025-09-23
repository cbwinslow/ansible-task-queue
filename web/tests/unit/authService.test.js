const AuthService = require('../../auth/authService');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// Mock dependencies
jest.mock('pg', () => {
  return {
    Pool: jest.fn(() => ({
      query: jest.fn()
    }))
  };
});

jest.mock('bcryptjs');
jest.mock('jsonwebtoken');

describe('AuthService', () => {
  let authService;
  let mockPool;

  beforeEach(() => {
    authService = new AuthService();
    mockPool = authService.pool;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('registerUser', () => {
    it('should register a new user successfully', async () => {
      const mockUser = {
        id: 1,
        username: 'testuser',
        email: 'test@example.com',
        created_at: new Date().toISOString()
      };

      // Mock user existence check
      mockPool.query.mockResolvedValueOnce({ rows: [] });
      
      // Mock password hashing
      bcrypt.hash.mockResolvedValueOnce('hashed_password');
      
      // Mock user insertion
      mockPool.query.mockResolvedValueOnce({ rows: [mockUser] });
      
      // Mock JWT token generation
      jwt.sign.mockReturnValue('test_token');

      const result = await authService.registerUser('testuser', 'test@example.com', 'password123');

      expect(result.user).toEqual(mockUser);
      expect(result.token).toBe('test_token');
      expect(bcrypt.hash).toHaveBeenCalledWith('password123', 12);
      expect(mockPool.query).toHaveBeenCalledTimes(2);
    });

    it('should throw error if user already exists', async () => {
      const existingUser = { id: 1, username: 'testuser', email: 'test@example.com' };
      
      // Mock user existence check - user already exists
      mockPool.query.mockResolvedValueOnce({ rows: [existingUser] });

      await expect(authService.registerUser('testuser', 'test@example.com', 'password123'))
        .rejects
        .toThrow('User already exists');
    });
  });

  describe('loginUser', () => {
    it('should login user successfully with valid credentials', async () => {
      const mockUser = {
        id: 1,
        username: 'testuser',
        email: 'test@example.com',
        password_hash: 'hashed_password'
      };

      // Mock user lookup
      mockPool.query.mockResolvedValueOnce({ rows: [mockUser] });
      
      // Mock password verification
      bcrypt.compare.mockResolvedValueOnce(true);
      
      // Mock last login update
      mockPool.query.mockResolvedValueOnce({ rows: [] });
      
      // Mock JWT token generation
      jwt.sign.mockReturnValue('test_token');

      const result = await authService.loginUser('testuser', 'password123');

      expect(result.user).toEqual({
        id: 1,
        username: 'testuser',
        email: 'test@example.com'
      });
      expect(result.token).toBe('test_token');
      expect(bcrypt.compare).toHaveBeenCalledWith('password123', 'hashed_password');
    });

    it('should throw error with invalid credentials', async () => {
      // Mock user not found
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      await expect(authService.loginUser('nonexistent', 'password123'))
        .rejects
        .toThrow('Invalid credentials');
    });

    it('should throw error with invalid password', async () => {
      const mockUser = {
        id: 1,
        username: 'testuser',
        email: 'test@example.com',
        password_hash: 'hashed_password'
      };

      // Mock user lookup
      mockPool.query.mockResolvedValueOnce({ rows: [mockUser] });
      
      // Mock password verification - invalid password
      bcrypt.compare.mockResolvedValueOnce(false);

      await expect(authService.loginUser('testuser', 'wrongpassword'))
        .rejects
        .toThrow('Invalid credentials');
    });
  });

  describe('generateToken', () => {
    it('should generate a valid JWT token', () => {
      const mockUser = { id: 1, username: 'testuser' };
      const mockToken = 'generated_token';
      
      jwt.sign.mockReturnValue(mockToken);

      const token = authService.generateToken(mockUser);

      expect(token).toBe(mockToken);
      expect(jwt.sign).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 1,
          username: 'testuser'
        }),
        'your-secret-key-change-in-production'
      );
    });
  });

  describe('verifyToken', () => {
    it('should verify a valid token', () => {
      const mockToken = 'valid_token';
      const mockDecoded = { id: 1, username: 'testuser' };
      
      jwt.verify.mockReturnValue(mockDecoded);

      const result = authService.verifyToken(mockToken);

      expect(result).toEqual(mockDecoded);
      expect(jwt.verify).toHaveBeenCalledWith(mockToken, 'your-secret-key-change-in-production');
    });

    it('should throw error for invalid token', () => {
      const mockToken = 'invalid_token';
      
      jwt.verify.mockImplementation(() => {
        throw new Error('Invalid token');
      });

      expect(() => authService.verifyToken(mockToken))
        .toThrow('Invalid token');
    });
  });
});