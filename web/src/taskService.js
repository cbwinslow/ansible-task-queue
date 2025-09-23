const { Pool } = require('pg');
const { spawn } = require('child_process');
const fs = require('fs').promises;
const path = require('path');
const winston = require('winston');

class TaskService {
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
        new winston.transports.File({ filename: '../logs/task-service-error.log', level: 'error' }),
        new winston.transports.File({ filename: '../logs/task-service-combined.log' })
      ]
    });
    
    if (process.env.NODE_ENV !== 'production') {
      this.logger.add(new winston.transports.Console({
        format: winston.format.simple()
      }));
    }
  }

  async createTask(userId, taskData) {
    try {
      const { title, description, code, language, targetHost, priority } = taskData;
      
      // Validate input
      if (!code || code.trim().length === 0) {
        throw new Error('Code content is required');
      }
      
      // Insert task into database
      const query = `
        INSERT INTO tasks (
          user_id, title, description, code, language, target_host, priority, 
          status, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
        RETURNING *
      `;
      
      const values = [
        userId, title, description, code, language, targetHost, 
        priority || 100, 'pending'
      ];
      
      const result = await this.pool.query(query, values);
      const task = result.rows[0];
      
      // Log task creation
      await this.logTaskEvent(task.id, 'created', `Task created by user ${userId}`);
      
      this.logger.info(`Task created: ${task.id} for user ${userId}`);
      
      return task;
    } catch (error) {
      this.logger.error('Task creation failed:', error);
      throw new Error(`Task creation failed: ${error.message}`);
    }
  }

  async getTasksByUser(userId, status = null, limit = 50) {
    try {
      let query = 'SELECT * FROM tasks WHERE user_id = $1';
      let values = [userId];
      
      if (status) {
        query += ' AND status = $2';
        values.push(status);
      }
      
      query += ' ORDER BY created_at DESC LIMIT $3';
      values.push(limit);
      
      const result = await this.pool.query(query, values);
      
      this.logger.info(`Retrieved ${result.rows.length} tasks for user ${userId}`);
      
      return result.rows;
    } catch (error) {
      this.logger.error('Task retrieval failed:', error);
      throw new Error(`Task retrieval failed: ${error.message}`);
    }
  }

  async getTaskById(taskId, userId) {
    try {
      const query = 'SELECT * FROM tasks WHERE id = $1 AND user_id = $2';
      const result = await this.pool.query(query, [taskId, userId]);
      
      if (result.rows.length === 0) {
        throw new Error('Task not found');
      }
      
      this.logger.info(`Retrieved task ${taskId} for user ${userId}`);
      
      return result.rows[0];
    } catch (error) {
      this.logger.error('Task retrieval failed:', error);
      throw new Error(`Task retrieval failed: ${error.message}`);
    }
  }

  async updateTaskStatus(taskId, status, result = null, errorMessage = null) {
    try {
      const query = `
        UPDATE tasks 
        SET status = $1, result = $2, error_message = $3, updated_at = NOW(),
            ${status === 'running' ? 'started_at = NOW()' : ''}
            ${status === 'completed' || status === 'failed' ? 'completed_at = NOW()' : ''}
        WHERE id = $4
        RETURNING *
      `;
      
      const values = [status, result, errorMessage, taskId];
      const resultObj = await this.pool.query(query, values);
      
      if (resultObj.rows.length === 0) {
        throw new Error('Task not found');
      }
      
      const task = resultObj.rows[0];
      
      // Log status update
      await this.logTaskEvent(taskId, 'status_update', `Status changed to ${status}`);
      
      this.logger.info(`Task ${taskId} status updated to ${status}`);
      
      return task;
    } catch (error) {
      this.logger.error('Task status update failed:', error);
      throw new Error(`Task status update failed: ${error.message}`);
    }
  }

  async executeTask(taskId) {
    try {
      // Get task details
      const query = 'SELECT * FROM tasks WHERE id = $1';
      const result = await this.pool.query(query, [taskId]);
      
      if (result.rows.length === 0) {
        throw new Error('Task not found');
      }
      
      const task = result.rows[0];
      
      // Update task status to running
      await this.updateTaskStatus(taskId, 'running');
      
      // Log execution start
      await this.logTaskEvent(taskId, 'execution_start', 'Task execution started');
      
      // Execute based on language
      let executionResult;
      switch (task.language) {
        case 'bash':
          executionResult = await this.executeBashScript(task.code, task.timeout);
          break;
        case 'ansible':
          executionResult = await this.executeAnsiblePlaybook(task.code, task.target_host, task.timeout);
          break;
        case 'python':
          executionResult = await this.executePythonScript(task.code, task.timeout);
          break;
        default:
          executionResult = await this.executeBashScript(task.code, task.timeout);
      }
      
      // Update task with result
      await this.updateTaskStatus(taskId, 'completed', executionResult.output);
      
      // Log execution completion
      await this.logTaskEvent(taskId, 'execution_complete', 'Task execution completed successfully');
      
      this.logger.info(`Task ${taskId} executed successfully`);
      
      return executionResult;
    } catch (error) {
      // Update task with error
      await this.updateTaskStatus(taskId, 'failed', null, error.message);
      
      // Log execution error
      await this.logTaskEvent(taskId, 'execution_error', `Task execution failed: ${error.message}`);
      
      this.logger.error(`Task ${taskId} execution failed:`, error);
      
      throw new Error(`Task execution failed: ${error.message}`);
    }
  }

  async executeBashScript(script, timeout = 3600) {
    return new Promise((resolve, reject) => {
      const timeoutMs = timeout * 1000;
      
      // Create temporary script file
      const scriptPath = path.join('/tmp', `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}.sh`);
      
      fs.writeFile(scriptPath, script)
        .then(() => {
          // Make script executable
          return fs.chmod(scriptPath, 0o755);
        })
        .then(() => {
          // Execute script
          const child = spawn('bash', [scriptPath], { timeout: timeoutMs });
          
          let output = '';
          let errorOutput = '';
          
          child.stdout.on('data', (data) => {
            output += data.toString();
          });
          
          child.stderr.on('data', (data) => {
            errorOutput += data.toString();
          });
          
          child.on('close', (code) => {
            // Clean up temporary file
            fs.unlink(scriptPath).catch(err => {
              this.logger.warn(`Failed to clean up temporary script: ${err.message}`);
            });
            
            if (code === 0) {
              resolve({ output, exitCode: code });
            } else {
              reject(new Error(`Script failed with exit code ${code}: ${errorOutput}`));
            }
          });
          
          child.on('error', (error) => {
            // Clean up temporary file
            fs.unlink(scriptPath).catch(err => {
              this.logger.warn(`Failed to clean up temporary script: ${err.message}`);
            });
            
            reject(new Error(`Script execution error: ${error.message}`));
          });
          
          child.on('timeout', () => {
            // Clean up temporary file
            fs.unlink(scriptPath).catch(err => {
              this.logger.warn(`Failed to clean up temporary script: ${err.message}`);
            });
            
            reject(new Error('Script execution timed out'));
          });
        })
        .catch(reject);
    });
  }

  async executeAnsiblePlaybook(playbookYaml, targetHost, timeout = 3600) {
    return new Promise((resolve, reject) => {
      const timeoutMs = timeout * 1000;
      
      // Create temporary playbook file
      const playbookPath = path.join('/tmp', `playbook_${Date.now()}_${Math.random().toString(36).substr(2, 9)}.yml`);
      
      fs.writeFile(playbookPath, playbookYaml)
        .then(() => {
          // Create temporary inventory
          const inventoryPath = path.join('/tmp', `inventory_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`);
          const inventoryContent = `${targetHost} ansible_connection=local`;
          
          return fs.writeFile(inventoryPath, inventoryContent);
        })
        .then((inventoryPath) => {
          // Execute Ansible playbook
          const child = spawn('ansible-playbook', [
            '-i', inventoryPath,
            playbookPath
          ], { timeout: timeoutMs });
          
          let output = '';
          let errorOutput = '';
          
          child.stdout.on('data', (data) => {
            output += data.toString();
          });
          
          child.stderr.on('data', (data) => {
            errorOutput += data.toString();
          });
          
          child.on('close', (code) => {
            // Clean up temporary files
            fs.unlink(playbookPath).catch(err => {
              this.logger.warn(`Failed to clean up temporary playbook: ${err.message}`);
            });
            fs.unlink(inventoryPath).catch(err => {
              this.logger.warn(`Failed to clean up temporary inventory: ${err.message}`);
            });
            
            if (code === 0) {
              resolve({ output, exitCode: code });
            } else {
              reject(new Error(`Ansible playbook failed with exit code ${code}: ${errorOutput}`));
            }
          });
          
          child.on('error', (error) => {
            // Clean up temporary files
            fs.unlink(playbookPath).catch(err => {
              this.logger.warn(`Failed to clean up temporary playbook: ${err.message}`);
            });
            fs.unlink(inventoryPath).catch(err => {
              this.logger.warn(`Failed to clean up temporary inventory: ${err.message}`);
            });
            
            reject(new Error(`Ansible execution error: ${error.message}`));
          });
          
          child.on('timeout', () => {
            // Clean up temporary files
            fs.unlink(playbookPath).catch(err => {
              this.logger.warn(`Failed to clean up temporary playbook: ${err.message}`);
            });
            fs.unlink(inventoryPath).catch(err => {
              this.logger.warn(`Failed to clean up temporary inventory: ${err.message}`);
            });
            
            reject(new Error('Ansible playbook execution timed out'));
          });
        })
        .catch(reject);
    });
  }

  async executePythonScript(script, timeout = 3600) {
    return new Promise((resolve, reject) => {
      const timeoutMs = timeout * 1000;
      
      // Create temporary Python file
      const scriptPath = path.join('/tmp', `script_${Date.now()}_${Math.random().toString(36).substr(2, 9)}.py`);
      
      fs.writeFile(scriptPath, script)
        .then(() => {
          // Execute Python script
          const child = spawn('python3', [scriptPath], { timeout: timeoutMs });
          
          let output = '';
          let errorOutput = '';
          
          child.stdout.on('data', (data) => {
            output += data.toString();
          });
          
          child.stderr.on('data', (data) => {
            errorOutput += data.toString();
          });
          
          child.on('close', (code) => {
            // Clean up temporary file
            fs.unlink(scriptPath).catch(err => {
              this.logger.warn(`Failed to clean up temporary script: ${err.message}`);
            });
            
            if (code === 0) {
              resolve({ output, exitCode: code });
            } else {
              reject(new Error(`Python script failed with exit code ${code}: ${errorOutput}`));
            }
          });
          
          child.on('error', (error) => {
            // Clean up temporary file
            fs.unlink(scriptPath).catch(err => {
              this.logger.warn(`Failed to clean up temporary script: ${err.message}`);
            });
            
            reject(new Error(`Python execution error: ${error.message}`));
          });
          
          child.on('timeout', () => {
            // Clean up temporary file
            fs.unlink(scriptPath).catch(err => {
              this.logger.warn(`Failed to clean up temporary script: ${err.message}`);
            });
            
            reject(new Error('Python script execution timed out'));
          });
        })
        .catch(reject);
    });
  }

  async logTaskEvent(taskId, eventType, message) {
    try {
      const query = `
        INSERT INTO task_execution_log (task_id, log_level, message, timestamp)
        VALUES ($1, $2, $3, NOW())
      `;
      
      const values = [taskId, 'info', message];
      await this.pool.query(query, values);
    } catch (error) {
      this.logger.error('Failed to log task event:', error);
    }
  }

  async getTaskLogs(taskId) {
    try {
      const query = `
        SELECT * FROM task_execution_log 
        WHERE task_id = $1 
        ORDER BY timestamp ASC
      `;
      
      const result = await this.pool.query(query, [taskId]);
      return result.rows;
    } catch (error) {
      this.logger.error('Failed to retrieve task logs:', error);
      throw new Error(`Failed to retrieve task logs: ${error.message}`);
    }
  }

  async lintCode(code, language) {
    try {
      const lintResults = {
        errors: [],
        warnings: [],
        info: []
      };

      // Basic validation
      if (!code || code.trim().length === 0) {
        lintResults.errors.push({ 
          line: 1, 
          column: 1, 
          message: 'Code is empty',
          severity: 'error'
        });
        return lintResults;
      }

      // Language-specific linting rules
      switch (language) {
        case 'javascript':
          if (code.includes('var ')) {
            lintResults.warnings.push({
              line: 1,
              column: 1,
              message: 'Prefer const or let over var',
              severity: 'warning'
            });
          }
          if (!code.includes('use strict')) {
            lintResults.info.push({
              line: 1,
              column: 1,
              message: 'Consider adding "use strict" directive',
              severity: 'info'
            });
          }
          break;
          
        case 'bash':
          if (code.includes('rm -rf /')) {
            lintResults.errors.push({
              line: 1,
              column: 1,
              message: 'Dangerous command detected: rm -rf /',
              severity: 'error'
            });
          }
          break;
          
        case 'python':
          if (code.includes('exec(') || code.includes('eval(')) {
            lintResults.warnings.push({
              line: 1,
              column: 1,
              message: 'Use of exec/eval can be dangerous',
              severity: 'warning'
            });
          }
          break;
      }

      return lintResults;
    } catch (error) {
      this.logger.error('Code linting failed:', error);
      throw new Error(`Code linting failed: ${error.message}`);
    }
  }
}

module.exports = TaskService;