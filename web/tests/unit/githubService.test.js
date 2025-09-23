const GitHubService = require('../../src/githubService');
const { Octokit } = require('octokit');

// Mock dependencies
jest.mock('pg', () => {
  return {
    Pool: jest.fn(() => ({
      query: jest.fn()
    }))
  };
});

jest.mock('octokit');

describe('GitHubService', () => {
  let githubService;
  let mockPool;
  let mockOctokit;

  beforeEach(() => {
    githubService = new GitHubService();
    mockPool = githubService.pool;
    
    // Mock logger
    githubService.logger = {
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn()
    };
    
    // Mock Octokit
    mockOctokit = {
      request: jest.fn()
    };
    Octokit.mockImplementation(() => mockOctokit);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getUserToken', () => {
    it('should retrieve user GitHub token successfully', async () => {
      const mockToken = 'gho_token123';
      mockPool.query.mockResolvedValueOnce({ 
        rows: [{ github_token: mockToken }] 
      });

      const result = await githubService.getUserToken(1);

      expect(result).toBe(mockToken);
      expect(mockPool.query).toHaveBeenCalledWith(
        'SELECT github_token FROM users WHERE id = $1',
        [1]
      );
    });

    it('should throw error if token not found', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      await expect(githubService.getUserToken(1))
        .rejects
        .toThrow('GitHub token not found for user');
    });
  });

  describe('triggerWorkflow', () => {
    it('should trigger GitHub workflow successfully', async () => {
      const mockToken = 'gho_token123';
      const mockResponse = { status: 204 };
      const mockActionId = 1;

      // Mock getUserToken
      mockPool.query.mockResolvedValueOnce({ 
        rows: [{ github_token: mockToken }] 
      });
      
      // Mock Octokit request
      mockOctokit.request.mockResolvedValueOnce(mockResponse);
      
      // Mock action record creation
      mockPool.query.mockResolvedValueOnce({ 
        rows: [{ id: mockActionId }] 
      });

      const result = await githubService.triggerWorkflow(
        1, 
        'testowner', 
        'testrepo', 
        'workflow.yml', 
        { test: 'input' }
      );

      expect(result.actionId).toBe(mockActionId);
      expect(result.status).toBe('triggered');
      expect(mockOctokit.request).toHaveBeenCalledWith(
        'POST /repos/{owner}/{repo}/actions/workflows/{workflow_id}/dispatches',
        expect.objectContaining({
          owner: 'testowner',
          repo: 'testrepo',
          workflow_id: 'workflow.yml',
          ref: 'main',
          inputs: { test: 'input' }
        })
      );
    });
  });

  describe('getUserRepos', () => {
    it('should retrieve user repositories successfully', async () => {
      const mockToken = 'gho_token123';
      const mockRepos = [
        {
          id: 1,
          name: 'test-repo',
          full_name: 'testowner/test-repo',
          private: false,
          html_url: 'https://github.com/testowner/test-repo',
          description: 'Test repository',
          updated_at: new Date().toISOString(),
          default_branch: 'main'
        }
      ];

      // Mock getUserToken
      mockPool.query.mockResolvedValueOnce({ 
        rows: [{ github_token: mockToken }] 
      });
      
      // Mock Octokit request
      mockOctokit.request.mockResolvedValueOnce({ data: mockRepos });

      const result = await githubService.getUserRepos(1);

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        name: 'test-repo',
        full_name: 'testowner/test-repo'
      });
      expect(mockOctokit.request).toHaveBeenCalledWith(
        'GET /user/repos',
        expect.objectContaining({
          sort: 'updated',
          direction: 'desc',
          per_page: 100
        })
      );
    });
  });
});