const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { Pool } = require('pg');

class AuthService {
  constructor() {
    this.pool = new Pool({
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 5432,
      database: process.env.DB_NAME || 'task_queue',
      user: process.env.DB_USER || 'task_queue_user',
      password: process.env.DB_PASSWORD || 'secure_task_queue_password',
    });
    this.jwtSecret = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
    this.jwtExpiry = process.env.JWT_EXPIRY || '24h';
  }

  async registerUser(username, email, password) {
    try {
      // Check if user already exists
      const existingUser = await this.findUserByUsername(username);
      if (existingUser) {
        throw new Error('User already exists');
      }

      // Hash password
      const saltRounds = 12;
      const passwordHash = await bcrypt.hash(password, saltRounds);

      // Insert user into database
      const query = `
        INSERT INTO users (username, email, password_hash, created_at, updated_at)
        VALUES ($1, $2, $3, NOW(), NOW())
        RETURNING id, username, email, created_at
      `;
      
      const values = [username, email, passwordHash];
      const result = await this.pool.query(query, values);
      
      const user = result.rows[0];
      
      // Generate JWT token
      const token = this.generateToken(user);
      
      return { user, token };
    } catch (error) {
      throw new Error(`Registration failed: ${error.message}`);
    }
  }

  async loginUser(username, password) {
    try {
      // Find user
      const query = 'SELECT id, username, email, password_hash FROM users WHERE username = $1';
      const result = await this.pool.query(query, [username]);
      
      if (result.rows.length === 0) {
        throw new Error('Invalid credentials');
      }
      
      const user = result.rows[0];
      
      // Verify password
      const isValidPassword = await bcrypt.compare(password, user.password_hash);
      if (!isValidPassword) {
        throw new Error('Invalid credentials');
      }
      
      // Update last login
      await this.pool.query('UPDATE users SET last_login = NOW(), updated_at = NOW() WHERE id = $1', [user.id]);
      
      // Remove password hash from user object
      delete user.password_hash;
      
      // Generate JWT token
      const token = this.generateToken(user);
      
      return { user, token };
    } catch (error) {
      throw new Error(`Login failed: ${error.message}`);
    }
  }

  async findUserByUsername(username) {
    try {
      const query = 'SELECT id, username, email, created_at FROM users WHERE username = $1';
      const result = await this.pool.query(query, [username]);
      return result.rows[0] || null;
    } catch (error) {
      throw new Error(`Database error: ${error.message}`);
    }
  }

  async findUserById(userId) {
    try {
      const query = 'SELECT id, username, email, created_at FROM users WHERE id = $1';
      const result = await this.pool.query(query, [userId]);
      return result.rows[0] || null;
    } catch (error) {
      throw new Error(`Database error: ${error.message}`);
    }
  }

  generateToken(user) {
    const payload = {
      id: user.id,
      username: user.username,
      exp: Math.floor(Date.now() / 1000) + (24 * 60 * 60) // 24 hours
    };
    return jwt.sign(payload, this.jwtSecret);
  }

  verifyToken(token) {
    try {
      return jwt.verify(token, this.jwtSecret);
    } catch (error) {
      throw new Error('Invalid token');
    }
  }

  async githubAuth(githubId, githubToken, userData) {
    try {
      // Check if user exists with this GitHub ID
      let query = 'SELECT id, username, email FROM users WHERE github_id = $1';
      let result = await this.pool.query(query, [githubId]);
      
      if (result.rows.length > 0) {
        // User exists, update GitHub token
        const user = result.rows[0];
        query = 'UPDATE users SET github_token = $1, last_login = NOW(), updated_at = NOW() WHERE id = $2 RETURNING *';
        result = await this.pool.query(query, [githubToken, user.id]);
        const updatedUser = result.rows[0];
        
        const token = this.generateToken(updatedUser);
        return { user: updatedUser, token };
      } else {
        // Create new user
        const username = userData.username || `github_${githubId}`;
        const email = userData.email || `${githubId}@github.com`;
        
        query = `
          INSERT INTO users (username, email, github_id, github_token, created_at, updated_at, last_login)
          VALUES ($1, $2, $3, $4, NOW(), NOW(), NOW())
          RETURNING id, username, email, github_id, created_at
        `;
        
        result = await this.pool.query(query, [username, email, githubId, githubToken]);
        const user = result.rows[0];
        
        const token = this.generateToken(user);
        return { user, token };
      }
    } catch (error) {
      throw new Error(`GitHub authentication failed: ${error.message}`);
    }
  }

  async updatePassword(userId, oldPassword, newPassword) {
    try {
      // Get current password hash
      const query = 'SELECT password_hash FROM users WHERE id = $1';
      const result = await this.pool.query(query, [userId]);
      
      if (result.rows.length === 0) {
        throw new Error('User not found');
      }
      
      const user = result.rows[0];
      
      // Verify old password
      const isValidPassword = await bcrypt.compare(oldPassword, user.password_hash);
      if (!isValidPassword) {
        throw new Error('Invalid current password');
      }
      
      // Hash new password
      const saltRounds = 12;
      const newPasswordHash = await bcrypt.hash(newPassword, saltRounds);
      
      // Update password
      const updateQuery = 'UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2';
      await this.pool.query(updateQuery, [newPasswordHash, userId]);
      
      return { success: true, message: 'Password updated successfully' };
    } catch (error) {
      throw new Error(`Password update failed: ${error.message}`);
    }
  }
}

module.exports = AuthService;