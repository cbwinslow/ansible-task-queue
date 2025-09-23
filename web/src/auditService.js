const { Pool } = require('pg');
const winston = require('winston');

class AuditService {
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
        new winston.transports.File({ filename: '../logs/audit-service-error.log', level: 'error' }),
        new winston.transports.File({ filename: '../logs/audit-service-combined.log' })
      ]
    });
    
    if (process.env.NODE_ENV !== 'production') {
      this.logger.add(new winston.transports.Console({
        format: winston.format.simple()
      }));
    }
  }

  async logAction(userId, action, resourceType, resourceId, details = {}, ipAddress = null, userAgent = null) {
    try {
      const query = `
        INSERT INTO audit_log (
          user_id, action, resource_type, resource_id, details, ip_address, user_agent, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
        RETURNING *
      `;
      
      const values = [
        userId,
        action,
        resourceType,
        resourceId,
        JSON.stringify(details),
        ipAddress,
        userAgent
      ];
      
      const result = await this.pool.query(query, values);
      
      // Also log to application logs
      this.logger.info(`Audit log: ${action} on ${resourceType} ${resourceId} by user ${userId}`, {
        details,
        ip: ipAddress,
        userAgent
      });
      
      return result.rows[0];
    } catch (error) {
      this.logger.error('Failed to log audit action:', error);
      throw new Error(`Failed to log audit action: ${error.message}`);
    }
  }

  async getUserAuditLog(userId, limit = 100, offset = 0) {
    try {
      const query = `
        SELECT * FROM audit_log 
        WHERE user_id = $1 
        ORDER BY created_at DESC 
        LIMIT $2 OFFSET $3
      `;
      
      const result = await this.pool.query(query, [userId, limit, offset]);
      
      this.logger.info(`Retrieved audit log for user ${userId}: ${result.rows.length} records`);
      
      return result.rows;
    } catch (error) {
      this.logger.error('Failed to retrieve user audit log:', error);
      throw new Error(`Failed to retrieve audit log: ${error.message}`);
    }
  }

  async getSystemAuditLog(limit = 100, offset = 0, filters = {}) {
    try {
      let query = 'SELECT * FROM audit_log WHERE 1=1';
      let values = [];
      let valueIndex = 1;
      
      // Apply filters
      if (filters.userId) {
        query += ` AND user_id = $${valueIndex++}`;
        values.push(filters.userId);
      }
      
      if (filters.action) {
        query += ` AND action = $${valueIndex++}`;
        values.push(filters.action);
      }
      
      if (filters.resourceType) {
        query += ` AND resource_type = $${valueIndex++}`;
        values.push(filters.resourceType);
      }
      
      if (filters.startDate) {
        query += ` AND created_at >= $${valueIndex++}`;
        values.push(filters.startDate);
      }
      
      if (filters.endDate) {
        query += ` AND created_at <= $${valueIndex++}`;
        values.push(filters.endDate);
      }
      
      query += ` ORDER BY created_at DESC LIMIT $${valueIndex++} OFFSET $${valueIndex++}`;
      values.push(limit, offset);
      
      const result = await this.pool.query(query, values);
      
      this.logger.info(`Retrieved system audit log: ${result.rows.length} records`);
      
      return result.rows;
    } catch (error) {
      this.logger.error('Failed to retrieve system audit log:', error);
      throw new Error(`Failed to retrieve system audit log: ${error.message}`);
    }
  }

  async getAuditLogById(logId) {
    try {
      const query = 'SELECT * FROM audit_log WHERE id = $1';
      const result = await this.pool.query(query, [logId]);
      
      if (result.rows.length === 0) {
        throw new Error('Audit log entry not found');
      }
      
      return result.rows[0];
    } catch (error) {
      this.logger.error('Failed to retrieve audit log entry:', error);
      throw new Error(`Failed to retrieve audit log entry: ${error.message}`);
    }
  }

  async getAuditSummary(userId = null) {
    try {
      let query = `
        SELECT 
          action,
          COUNT(*) as count,
          MIN(created_at) as first_occurrence,
          MAX(created_at) as last_occurrence
        FROM audit_log
      `;
      
      let values = [];
      
      if (userId) {
        query += ' WHERE user_id = $1';
        values.push(userId);
      }
      
      query += ' GROUP BY action ORDER BY count DESC LIMIT 20';
      
      const result = await this.pool.query(query, values);
      
      return result.rows;
    } catch (error) {
      this.logger.error('Failed to retrieve audit summary:', error);
      throw new Error(`Failed to retrieve audit summary: ${error.message}`);
    }
  }

  async searchAuditLog(userId = null, searchTerm = '', limit = 50) {
    try {
      let query = `
        SELECT * FROM audit_log 
        WHERE (details::text ILIKE $1 OR action ILIKE $1 OR resource_type ILIKE $1)
      `;
      
      let values = [`%${searchTerm}%`];
      
      if (userId) {
        query += ' AND user_id = $2';
        values.push(userId);
      }
      
      query += ' ORDER BY created_at DESC LIMIT $3';
      values.push(limit);
      
      const result = await this.pool.query(query, values);
      
      return result.rows;
    } catch (error) {
      this.logger.error('Failed to search audit log:', error);
      throw new Error(`Failed to search audit log: ${error.message}`);
    }
  }

  async getSecurityEvents(limit = 100) {
    try {
      const securityActions = [
        'login', 'login_failed', 'logout', 'password_change', 
        'user_create', 'user_delete', 'permission_change',
        'task_submit', 'task_execute', 'github_action'
      ];
      
      const query = `
        SELECT * FROM audit_log 
        WHERE action = ANY($1)
        ORDER BY created_at DESC 
        LIMIT $2
      `;
      
      const result = await this.pool.query(query, [securityActions, limit]);
      
      return result.rows;
    } catch (error) {
      this.logger.error('Failed to retrieve security events:', error);
      throw new Error(`Failed to retrieve security events: ${error.message}`);
    }
  }

  async exportAuditLog(userId = null, startDate = null, endDate = null, format = 'json') {
    try {
      let query = 'SELECT * FROM audit_log WHERE 1=1';
      let values = [];
      let valueIndex = 1;
      
      if (userId) {
        query += ` AND user_id = $${valueIndex++}`;
        values.push(userId);
      }
      
      if (startDate) {
        query += ` AND created_at >= $${valueIndex++}`;
        values.push(startDate);
      }
      
      if (endDate) {
        query += ` AND created_at <= $${valueIndex++}`;
        values.push(endDate);
      }
      
      query += ' ORDER BY created_at ASC';
      
      const result = await this.pool.query(query, values);
      
      if (format === 'csv') {
        // Convert to CSV format
        const headers = ['id', 'user_id', 'action', 'resource_type', 'resource_id', 'details', 'ip_address', 'user_agent', 'created_at'];
        const csvRows = [headers.join(',')];
        
        result.rows.forEach(row => {
          const values = headers.map(header => {
            const value = row[header];
            return typeof value === 'object' ? JSON.stringify(value) : `"${value}"`;
          });
          csvRows.push(values.join(','));
        });
        
        return csvRows.join('\n');
      } else {
        // Return as JSON
        return JSON.stringify(result.rows, null, 2);
      }
    } catch (error) {
      this.logger.error('Failed to export audit log:', error);
      throw new Error(`Failed to export audit log: ${error.message}`);
    }
  }

  // Convenience methods for common audit actions
  async logLogin(userId, ipAddress = null, userAgent = null, success = true) {
    return this.logAction(
      userId, 
      success ? 'login' : 'login_failed', 
      'auth', 
      null, 
      { success }, 
      ipAddress, 
      userAgent
    );
  }

  async logLogout(userId, ipAddress = null, userAgent = null) {
    return this.logAction(
      userId, 
      'logout', 
      'auth', 
      null, 
      {}, 
      ipAddress, 
      userAgent
    );
  }

  async logTaskSubmission(userId, taskId, taskDetails, ipAddress = null, userAgent = null) {
    return this.logAction(
      userId, 
      'task_submit', 
      'task', 
      taskId, 
      taskDetails, 
      ipAddress, 
      userAgent
    );
  }

  async logTaskExecution(userId, taskId, executionDetails, ipAddress = null, userAgent = null) {
    return this.logAction(
      userId, 
      'task_execute', 
      'task', 
      taskId, 
      executionDetails, 
      ipAddress, 
      userAgent
    );
  }

  async logGitHubAction(userId, actionId, actionDetails, ipAddress = null, userAgent = null) {
    return this.logAction(
      userId, 
      'github_action', 
      'github', 
      actionId, 
      actionDetails, 
      ipAddress, 
      userAgent
    );
  }

  async logSecurityEvent(userId, eventType, details, ipAddress = null, userAgent = null) {
    return this.logAction(
      userId, 
      eventType, 
      'security', 
      null, 
      details, 
      ipAddress, 
      userAgent
    );
  }
}

module.exports = AuditService;