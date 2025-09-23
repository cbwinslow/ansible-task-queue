const { Octokit } = require('octokit');
const { Pool } = require('pg');
const winston = require('winston');

class GitHubService {
  constructor() {
    this.pool = new Pool({
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 5432,
      database: process.env.DB_NAME || 'task_queue',
      user: process.env.DB_USER || 'task_queue_user',
      password: process.env.DB_PASSWORD || 'secure_task_queue_password',
    });
    
    this.logger = winston.createLogger({
      level: 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      ),
      transports: [
        new winston.transports.File({ filename: '../logs/github-service-error.log', level: 'error' }),
        new winston.transports.File({ filename: '../logs/github-service-combined.log' })
      ]
    });
    
    if (process.env.NODE_ENV !== 'production') {
      this.logger.add(new winston.transports.Console({
        format: winston.format.simple()
      }));
    }
  }

  async getUserToken(userId) {
    try {
      const query = 'SELECT github_token FROM users WHERE id = $1';
      const result = await this.pool.query(query, [userId]);
      
      if (result.rows.length === 0 || !result.rows[0].github_token) {
        throw new Error('GitHub token not found for user');
      }
      
      return result.rows[0].github_token;
    } catch (error) {
      this.logger.error('Failed to get user GitHub token:', error);
      throw new Error(`Failed to get GitHub token: ${error.message}`);
    }
  }

  async triggerWorkflow(userId, repoOwner, repoName, workflowId, inputs = {}) {
    try {
      // Get user's GitHub token
      const token = await this.getUserToken(userId);
      const octokit = new Octokit({ auth: token });
      
      // Trigger the workflow
      const response = await octokit.request(
        'POST /repos/{owner}/{repo}/actions/workflows/{workflow_id}/dispatches',
        {
          owner: repoOwner,
          repo: repoName,
          workflow_id: workflowId,
          ref: 'main', // or 'master' depending on the repository
          inputs: inputs
        }
      );
      
      // Store action in database
      const actionQuery = `
        INSERT INTO github_actions (
          user_id, repo_name, workflow_name, workflow_id, inputs, status, triggered_at
        ) VALUES ($1, $2, $3, $4, $5, $6, NOW())
        RETURNING id
      `;
      
      const actionValues = [
        userId, 
        `${repoOwner}/${repoName}`, 
        workflowId, 
        workflowId, 
        JSON.stringify(inputs), 
        'triggered'
      ];
      
      const actionResult = await this.pool.query(actionQuery, actionValues);
      const actionId = actionResult.rows[0].id;
      
      this.logger.info(`GitHub Action triggered: ${workflowId} in ${repoOwner}/${repoName} by user ${userId}`);
      
      return {
        actionId,
        status: 'triggered',
        message: 'GitHub Action triggered successfully'
      };
    } catch (error) {
      this.logger.error('Failed to trigger GitHub Action:', error);
      throw new Error(`Failed to trigger GitHub Action: ${error.message}`);
    }
  }

  async listWorkflows(userId, repoOwner, repoName) {
    try {
      // Get user's GitHub token
      const token = await this.getUserToken(userId);
      const octokit = new Octokit({ auth: token });
      
      // List workflows
      const response = await octokit.request(
        'GET /repos/{owner}/{repo}/actions/workflows',
        {
          owner: repoOwner,
          repo: repoName
        }
      );
      
      this.logger.info(`Retrieved ${response.data.workflows.length} workflows for ${repoOwner}/${repoName}`);
      
      return response.data.workflows.map(workflow => ({
        id: workflow.id,
        name: workflow.name,
        path: workflow.path,
        state: workflow.state,
        created_at: workflow.created_at,
        updated_at: workflow.updated_at
      }));
    } catch (error) {
      this.logger.error('Failed to list GitHub workflows:', error);
      throw new Error(`Failed to list workflows: ${error.message}`);
    }
  }

  async getWorkflowRunStatus(userId, repoOwner, repoName, runId) {
    try {
      // Get user's GitHub token
      const token = await this.getUserToken(userId);
      const octokit = new Octokit({ auth: token });
      
      // Get workflow run status
      const response = await octokit.request(
        'GET /repos/{owner}/{repo}/actions/runs/{run_id}',
        {
          owner: repoOwner,
          repo: repoName,
          run_id: runId
        }
      );
      
      this.logger.info(`Retrieved workflow run status: ${runId} in ${repoOwner}/${repoName}`);
      
      return {
        id: response.data.id,
        name: response.data.name,
        status: response.data.status,
        conclusion: response.data.conclusion,
        created_at: response.data.created_at,
        updated_at: response.data.updated_at,
        html_url: response.data.html_url
      };
    } catch (error) {
      this.logger.error('Failed to get workflow run status:', error);
      throw new Error(`Failed to get workflow run status: ${error.message}`);
    }
  }

  async listRepoContents(userId, repoOwner, repoName, path = '') {
    try {
      // Get user's GitHub token
      const token = await this.getUserToken(userId);
      const octokit = new Octokit({ auth: token });
      
      // List repository contents
      const response = await octokit.request(
        'GET /repos/{owner}/{repo}/contents/{path}',
        {
          owner: repoOwner,
          repo: repoName,
          path: path
        }
      );
      
      this.logger.info(`Retrieved contents of ${path} in ${repoOwner}/${repoName}`);
      
      return response.data.map(item => ({
        name: item.name,
        path: item.path,
        type: item.type,
        size: item.size,
        download_url: item.download_url,
        html_url: item.html_url
      }));
    } catch (error) {
      this.logger.error('Failed to list repository contents:', error);
      throw new Error(`Failed to list repository contents: ${error.message}`);
    }
  }

  async getUserRepos(userId) {
    try {
      // Get user's GitHub token
      const token = await this.getUserToken(userId);
      const octokit = new Octokit({ auth: token });
      
      // List user repositories
      const response = await octokit.request('GET /user/repos', {
        sort: 'updated',
        direction: 'desc',
        per_page: 100
      });
      
      this.logger.info(`Retrieved ${response.data.length} repositories for user ${userId}`);
      
      return response.data.map(repo => ({
        id: repo.id,
        name: repo.name,
        full_name: repo.full_name,
        private: repo.private,
        html_url: repo.html_url,
        description: repo.description,
        updated_at: repo.updated_at,
        default_branch: repo.default_branch
      }));
    } catch (error) {
      this.logger.error('Failed to list user repositories:', error);
      throw new Error(`Failed to list repositories: ${error.message}`);
    }
  }

  async createGithubActionRecord(userId, repoName, workflowName, workflowId, inputs) {
    try {
      const query = `
        INSERT INTO github_actions (
          user_id, repo_name, workflow_name, workflow_id, inputs, status, triggered_at
        ) VALUES ($1, $2, $3, $4, $5, $6, NOW())
        RETURNING *
      `;
      
      const values = [userId, repoName, workflowName, workflowId, JSON.stringify(inputs), 'pending'];
      const result = await this.pool.query(query, values);
      
      this.logger.info(`GitHub Action record created: ${result.rows[0].id} for user ${userId}`);
      
      return result.rows[0];
    } catch (error) {
      this.logger.error('Failed to create GitHub Action record:', error);
      throw new Error(`Failed to create GitHub Action record: ${error.message}`);
    }
  }

  async updateGithubActionStatus(actionId, status, runId = null, result = null, errorMessage = null) {
    try {
      const query = `
        UPDATE github_actions 
        SET status = $1, github_run_id = $2, result = $3, error_message = $4,
            ${status === 'completed' ? 'completed_at = NOW()' : ''}
        WHERE id = $5
        RETURNING *
      `;
      
      const values = [status, runId, result, errorMessage, actionId];
      const resultObj = await this.pool.query(query, values);
      
      if (resultObj.rows.length === 0) {
        throw new Error('GitHub Action not found');
      }
      
      this.logger.info(`GitHub Action ${actionId} status updated to ${status}`);
      
      return resultObj.rows[0];
    } catch (error) {
      this.logger.error('Failed to update GitHub Action status:', error);
      throw new Error(`Failed to update GitHub Action status: ${error.message}`);
    }
  }

  async getUserActions(userId, limit = 50) {
    try {
      const query = `
        SELECT * FROM github_actions 
        WHERE user_id = $1 
        ORDER BY triggered_at DESC 
        LIMIT $2
      `;
      
      const result = await this.pool.query(query, [userId, limit]);
      
      this.logger.info(`Retrieved ${result.rows.length} GitHub Actions for user ${userId}`);
      
      return result.rows;
    } catch (error) {
      this.logger.error('Failed to retrieve user GitHub Actions:', error);
      throw new Error(`Failed to retrieve GitHub Actions: ${error.message}`);
    }
  }
}

module.exports = GitHubService;