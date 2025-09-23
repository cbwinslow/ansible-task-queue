"""
Database Management for Task Queue System
"""
import psycopg2
import psycopg2.extras
from typing import Optional, List, Dict, Any, Union
import logging
from contextlib import contextmanager
from ..core.config import settings

logger = logging.getLogger(__name__)

class DatabaseManager:
    """Manages PostgreSQL database connections and operations"""
    
    def __init__(self):
        self.settings = settings.database
        self.connection = None
    
    def connect(self) -> bool:
        """Establish database connection"""
        try:
            self.connection = psycopg2.connect(
                host=self.settings.host,
                port=self.settings.port,
                database=self.settings.name,
                user=self.settings.user,
                password=self.settings.password
            )
            logger.info("Database connection established")
            return True
        except Exception as e:
            logger.error(f"Database connection failed: {e}")
            return False
    
    def disconnect(self):
        """Close database connection"""
        if self.connection:
            self.connection.close()
            self.connection = None
            logger.info("Database connection closed")
    
    @contextmanager
    def get_cursor(self, dict_cursor: bool = False):
        """Context manager for database cursors"""
        if not self.connection:
            self.connect()
        
        cursor = None
        try:
            if dict_cursor:
                cursor = self.connection.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
            else:
                cursor = self.connection.cursor()
            yield cursor
            self.connection.commit()
        except Exception as e:
            if self.connection:
                self.connection.rollback()
            logger.error(f"Database operation failed: {e}")
            raise
        finally:
            if cursor:
                cursor.close()
    
    def execute_query(self, query: str, params: Optional[tuple] = None, fetch: bool = False) -> Union[List[Dict], int, None]:
        """Execute a database query"""
        try:
            with self.get_cursor(dict_cursor=True) as cursor:
                cursor.execute(query, params)
                if fetch:
                    return cursor.fetchall()
                else:
                    return cursor.rowcount
        except Exception as e:
            logger.error(f"Query execution failed: {e}")
            raise
    
    def initialize_schema(self) -> bool:
        """Initialize database schema"""
        schema_sql = """
        -- Create task queue table
        CREATE TABLE IF NOT EXISTS task_queue (
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

        -- Create indexes for performance
        CREATE INDEX IF NOT EXISTS idx_task_queue_status ON task_queue(status);
        CREATE INDEX IF NOT EXISTS idx_task_queue_priority ON task_queue(priority);
        CREATE INDEX IF NOT EXISTS idx_task_queue_created_at ON task_queue(created_at);
        CREATE INDEX IF NOT EXISTS idx_task_queue_target_host ON task_queue(target_host);
        CREATE INDEX IF NOT EXISTS idx_task_queue_user_id ON task_queue(user_id);

        -- Create task audit log table
        CREATE TABLE IF NOT EXISTS task_audit_log (
            id SERIAL PRIMARY KEY,
            task_id INTEGER REFERENCES task_queue(id),
            action VARCHAR(50),
            old_status VARCHAR(50),
            new_status VARCHAR(50),
            timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            user_id VARCHAR(255),
            details TEXT
        );

        -- Create indexes for audit log
        CREATE INDEX IF NOT EXISTS idx_task_audit_log_task_id ON task_audit_log(task_id);
        CREATE INDEX IF NOT EXISTS idx_task_audit_log_timestamp ON task_audit_log(timestamp);

        -- Create functions for task management
        CREATE OR REPLACE FUNCTION get_next_task()
        RETURNS TABLE(
            id INTEGER,
            task_name VARCHAR(255),
            target_host VARCHAR(255),
            target_group VARCHAR(255),
            playbook_path TEXT,
            script_content TEXT,
            script_args TEXT,
            timeout INTEGER,
            environment JSONB
        ) AS $$
        BEGIN
            RETURN QUERY
            SELECT 
                tq.id,
                tq.task_name,
                tq.target_host,
                tq.target_group,
                tq.playbook_path,
                tq.script_content,
                tq.script_args,
                tq.timeout,
                tq.environment
            FROM task_queue tq
            WHERE tq.status = 'pending'
            ORDER BY tq.priority ASC, tq.created_at ASC
            LIMIT 1
            FOR UPDATE SKIP LOCKED;
        END;
        $$ LANGUAGE plpgsql;

        -- Create function to update task status
        CREATE OR REPLACE FUNCTION update_task_status(
            task_id INTEGER,
            new_status VARCHAR(50),
            result_text TEXT DEFAULT NULL,
            error_text TEXT DEFAULT NULL
        )
        RETURNS VOID AS $$
        BEGIN
            -- Update the task
            UPDATE task_queue 
            SET 
                status = new_status,
                completed_at = CASE WHEN new_status IN ('completed', 'failed') THEN CURRENT_TIMESTAMP ELSE completed_at END,
                started_at = CASE WHEN new_status = 'running' THEN CURRENT_TIMESTAMP ELSE started_at END,
                result = CASE WHEN result_text IS NOT NULL THEN result_text ELSE result END,
                error_message = CASE WHEN error_text IS NOT NULL THEN error_text ELSE error_message END
            WHERE id = task_id;
            
            -- Log the status change
            INSERT INTO task_audit_log (task_id, action, new_status, user_id, details)
            VALUES (task_id, 'status_change', new_status, 'system', 
                    CASE WHEN error_text IS NOT NULL THEN error_text ELSE result_text END);
        END;
        $$ LANGUAGE plpgsql;

        -- Create a view for monitoring
        CREATE OR REPLACE VIEW task_summary AS
        SELECT 
            status,
            COUNT(*) as task_count,
            MIN(created_at) as oldest_task,
            MAX(created_at) as newest_task
        FROM task_queue
        GROUP BY status;
        """
        
        try:
            with self.get_cursor() as cursor:
                cursor.execute(schema_sql)
            logger.info("Database schema initialized successfully")
            return True
        except Exception as e:
            logger.error(f"Database schema initialization failed: {e}")
            return False
    
    def get_next_task(self) -> Optional[Dict]:
        """Get the next pending task from queue"""
        query = "SELECT * FROM get_next_task();"
        try:
            result = self.execute_query(query, fetch=True)
            return result[0] if result else None
        except Exception as e:
            logger.error(f"Failed to get next task: {e}")
            return None
    
    def update_task_status(self, task_id: int, status: str, result: Optional[str] = None, error: Optional[str] = None) -> bool:
        """Update task status"""
        query = "SELECT update_task_status(%s, %s, %s, %s);"
        try:
            self.execute_query(query, (task_id, status, result, error))
            return True
        except Exception as e:
            logger.error(f"Failed to update task status: {e}")
            return False
    
    def insert_task(self, task_data: Dict) -> Optional[int]:
        """Insert a new task into the queue"""
        columns = list(task_data.keys())
        values = list(task_data.values())
        placeholders = ', '.join(['%s'] * len(columns))
        column_names = ', '.join(columns)
        
        query = f"""
        INSERT INTO task_queue ({column_names})
        VALUES ({placeholders})
        RETURNING id;
        """
        
        try:
            result = self.execute_query(query, tuple(values), fetch=True)
            return result[0]['id'] if result else None
        except Exception as e:
            logger.error(f"Failed to insert task: {e}")
            return None

# Global database manager instance
db_manager = DatabaseManager()