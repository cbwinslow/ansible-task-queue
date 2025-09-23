-- Database Schema for Cloudflare Mobile Task Executor
-- PostgreSQL Migration Script

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(255) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    github_id VARCHAR(255),
    github_token TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP,
    is_active BOOLEAN DEFAULT true
);

-- Create index on username and email for faster lookups
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_github_id ON users(github_id);

-- Tasks table
CREATE TABLE IF NOT EXISTS tasks (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    code TEXT NOT NULL,
    language VARCHAR(50) DEFAULT 'bash',
    target_host VARCHAR(255) DEFAULT 'localhost',
    priority INTEGER DEFAULT 100,
    status VARCHAR(50) DEFAULT 'pending',
    result TEXT,
    error_message TEXT,
    retry_count INTEGER DEFAULT 0,
    max_retries INTEGER DEFAULT 3,
    timeout INTEGER DEFAULT 3600,
    scheduled_at TIMESTAMP,
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for task queries
CREATE INDEX IF NOT EXISTS idx_tasks_user_id ON tasks(user_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_priority ON tasks(priority);
CREATE INDEX IF NOT EXISTS idx_tasks_created_at ON tasks(created_at);

-- GitHub Actions table
CREATE TABLE IF NOT EXISTS github_actions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    repo_name VARCHAR(255) NOT NULL,
    workflow_name VARCHAR(255) NOT NULL,
    workflow_id VARCHAR(255),
    inputs JSONB,
    status VARCHAR(50) DEFAULT 'pending',
    github_run_id VARCHAR(255),
    triggered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP,
    result TEXT,
    error_message TEXT
);

-- Create indexes for GitHub Actions
CREATE INDEX IF NOT EXISTS idx_github_actions_user_id ON github_actions(user_id);
CREATE INDEX IF NOT EXISTS idx_github_actions_status ON github_actions(status);
CREATE INDEX IF NOT EXISTS idx_github_actions_triggered_at ON github_actions(triggered_at);

-- Audit log table
CREATE TABLE IF NOT EXISTS audit_log (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    action VARCHAR(100) NOT NULL,
    resource_type VARCHAR(50),
    resource_id INTEGER,
    details JSONB,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for audit log
CREATE INDEX IF NOT EXISTS idx_audit_log_user_id ON audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_action ON audit_log(action);
CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON audit_log(created_at);

-- Task execution log table
CREATE TABLE IF NOT EXISTS task_execution_log (
    id SERIAL PRIMARY KEY,
    task_id INTEGER REFERENCES tasks(id) ON DELETE CASCADE,
    log_level VARCHAR(20) DEFAULT 'info',
    message TEXT NOT NULL,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for task execution log
CREATE INDEX IF NOT EXISTS idx_task_execution_log_task_id ON task_execution_log(task_id);
CREATE INDEX IF NOT EXISTS idx_task_execution_log_timestamp ON task_execution_log(timestamp);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at columns
DROP TRIGGER IF EXISTS update_users_updated_at ON users;
CREATE TRIGGER update_users_updated_at 
    BEFORE UPDATE ON users 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_tasks_updated_at ON tasks;
CREATE TRIGGER update_tasks_updated_at 
    BEFORE UPDATE ON tasks 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Create views for monitoring
CREATE OR REPLACE VIEW user_task_summary AS
SELECT 
    u.id as user_id,
    u.username,
    COUNT(t.id) as total_tasks,
    COUNT(CASE WHEN t.status = 'completed' THEN 1 END) as completed_tasks,
    COUNT(CASE WHEN t.status = 'failed' THEN 1 END) as failed_tasks,
    COUNT(CASE WHEN t.status = 'pending' THEN 1 END) as pending_tasks,
    COUNT(CASE WHEN t.status = 'running' THEN 1 END) as running_tasks,
    MAX(t.created_at) as last_task_created
FROM users u
LEFT JOIN tasks t ON u.id = t.user_id
GROUP BY u.id, u.username;

CREATE OR REPLACE VIEW system_metrics AS
SELECT 
    COUNT(*) as total_users,
    COUNT(CASE WHEN is_active = true THEN 1 END) as active_users,
    COUNT(CASE WHEN last_login > CURRENT_TIMESTAMP - INTERVAL '7 days' THEN 1 END) as recently_active_users,
    (SELECT COUNT(*) FROM tasks) as total_tasks,
    (SELECT COUNT(*) FROM tasks WHERE status = 'pending') as pending_tasks,
    (SELECT COUNT(*) FROM tasks WHERE status = 'running') as running_tasks,
    (SELECT COUNT(*) FROM tasks WHERE status = 'completed') as completed_tasks,
    (SELECT COUNT(*) FROM tasks WHERE status = 'failed') as failed_tasks,
    (SELECT COUNT(*) FROM github_actions) as total_github_actions
FROM users;

-- Grant privileges to application user
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO task_queue_user;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO task_queue_user;
GRANT SELECT ON user_task_summary TO task_queue_user;
GRANT SELECT ON system_metrics TO task_queue_user;

-- Insert default data (optional)
INSERT INTO users (username, email, password_hash) 
VALUES ('admin', 'admin@example.com', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj/RK.PZvO.S') 
ON CONFLICT (username) DO NOTHING;

-- Add comments for documentation
COMMENT ON TABLE users IS 'User accounts with authentication';
COMMENT ON TABLE tasks IS 'User-submitted tasks for execution';
COMMENT ON TABLE github_actions IS 'GitHub Actions triggered by users';
COMMENT ON TABLE audit_log IS 'Security and compliance audit trail';
COMMENT ON TABLE task_execution_log IS 'Detailed task execution logs';