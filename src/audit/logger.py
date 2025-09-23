"""
Audit Logging for Task Queue System
"""
import logging
from typing import Optional
from datetime import datetime
from ..core.database import db_manager

logger = logging.getLogger(__name__)

class AuditLogger:
    """Handles audit logging for task executions"""
    
    def __init__(self):
        self.logger = logging.getLogger("audit")
    
    def log_task_action(self, task_id: int, action: str, new_status: str, 
                       details: Optional[str] = None, user_id: str = "system"):
        """Log a task action to both database and file"""
        try:
            # Log to database
            self._log_to_database(task_id, action, new_status, details, user_id)
            
            # Log to file
            log_message = f"Task {task_id}: {action} -> {new_status}"
            if details:
                log_message += f" | Details: {details}"
            
            self.logger.info(log_message)
            
        except Exception as e:
            logger.error(f"Audit logging failed: {e}")
    
    def _log_to_database(self, task_id: int, action: str, new_status: str,
                        details: Optional[str], user_id: str):
        """Log action to database audit table"""
        query = """
        INSERT INTO task_audit_log (task_id, action, new_status, user_id, details)
        VALUES (%s, %s, %s, %s, %s);
        """
        
        try:
            db_manager.execute_query(query, (task_id, action, new_status, user_id, details))
        except Exception as e:
            logger.error(f"Database audit logging failed: {e}")
    
    def get_task_audit_log(self, task_id: int) -> list:
        """Retrieve audit log for a specific task"""
        query = """
        SELECT * FROM task_audit_log 
        WHERE task_id = %s 
        ORDER BY timestamp ASC;
        """
        
        try:
            return db_manager.execute_query(query, (task_id,), fetch=True)
        except Exception as e:
            logger.error(f"Failed to retrieve audit log: {e}")
            return []
    
    def get_recent_audit_logs(self, limit: int = 100) -> list:
        """Retrieve recent audit logs"""
        query = """
        SELECT * FROM task_audit_log 
        ORDER BY timestamp DESC 
        LIMIT %s;
        """
        
        try:
            return db_manager.execute_query(query, (limit,), fetch=True)
        except Exception as e:
            logger.error(f"Failed to retrieve recent audit logs: {e}")
            return []