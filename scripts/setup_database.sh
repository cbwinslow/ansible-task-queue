#!/bin/bash

# Utility Scripts for Task Queue System

# Script: setup_database.sh
# Purpose: Initialize PostgreSQL database for task queue

DB_NAME="task_queue"
DB_USER="task_queue_user"
DB_PASSWORD="secure_task_queue_password"

echo "Setting up PostgreSQL database for Task Queue System..."

# Check if PostgreSQL is running
if ! systemctl is-active --quiet postgresql; then
    echo "Error: PostgreSQL is not running"
    echo "Please start PostgreSQL: sudo systemctl start postgresql"
    exit 1
fi

# Create database and user
sudo -u postgres psql << EOF
-- Create database
CREATE DATABASE $DB_NAME;

-- Create user
CREATE USER $DB_USER WITH PASSWORD '$DB_PASSWORD';

-- Grant privileges
GRANT ALL PRIVILEGES ON DATABASE $DB_NAME TO $DB_USER;

-- Connect to database and create schema
\c $DB_NAME;

-- Create task queue table
CREATE TABLE task_queue (
    id SERIAL PRIMARY KEY,
    task_name VARCHAR(255) NOT NULL,
    description TEXT,
    target_host VARCHAR(255),
    target_group VARCHAR(255),
    playbook_path TEXT,
    script_content TEXT,
    script_args TEXT,
    priority INTEGER DEFAULT 100,
    status VARCHAR(50) DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    result TEXT,
    error_message TEXT,
    user_id VARCHAR(255),
    retry_count INTEGER DEFAULT 0,
    max_retries INTEGER DEFAULT 3,
    timeout INTEGER DEFAULT 3600,
    tags VARCHAR(255)[],
    environment JSONB
);

-- Create indexes
CREATE INDEX idx_task_queue_status ON task_queue(status);
CREATE INDEX idx_task_queue_priority ON task_queue(priority);
CREATE INDEX idx_task_queue_created_at ON task_queue(created_at);

-- Create audit log table
CREATE TABLE task_audit_log (
    id SERIAL PRIMARY KEY,
    task_id INTEGER REFERENCES task_queue(id),
    action VARCHAR(50),
    old_status VARCHAR(50),
    new_status VARCHAR(50),
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    user_id VARCHAR(255),
    details TEXT
);

-- Create audit log indexes
CREATE INDEX idx_task_audit_log_task_id ON task_audit_log(task_id);
CREATE INDEX idx_task_audit_log_timestamp ON task_audit_log(timestamp);

-- Create summary view
CREATE OR REPLACE VIEW task_summary AS
SELECT 
    status,
    COUNT(*) as task_count,
    MIN(created_at) as oldest_task,
    MAX(created_at) as newest_task
FROM task_queue
GROUP BY status;

GRANT ALL PRIVILEGES ON TABLE task_queue TO $DB_USER;
GRANT ALL PRIVILEGES ON TABLE task_audit_log TO $DB_USER;
GRANT ALL PRIVILEGES ON SEQUENCE task_queue_id_seq TO $DB_USER;
GRANT ALL PRIVILEGES ON SEQUENCE task_audit_log_id_seq TO $DB_USER;
GRANT SELECT ON task_summary TO $DB_USER;

\q
EOF

echo "Database setup completed successfully!"
echo "Database: $DB_NAME"
echo "User: $DB_USER"
echo "Password: $DB_PASSWORD"