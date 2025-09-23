"""
Task Service for Task Queue System
"""
import logging
from typing import Optional, List, Dict, Any
from ..core.database import db_manager
from ..models.task import TaskCreate, Task, TaskStatus, TaskSummary
from ..security.auth import AuthManager

logger = logging.getLogger(__name__)

class TaskService:
    """Service layer for task management"""
    
    def __init__(self):
        self.auth_manager = AuthManager()
    
    def create_task(self, task_create: TaskCreate, user_id: str) -> Optional[int]:
        """Create a new task in the queue"""
        try:
            # Validate user permissions
            if not self.auth_manager.is_user_allowed(user_id):
                logger.warning(f"User {user_id} not allowed to create tasks")
                return None
            
            # Convert task data to dictionary
            task_data = task_create.dict()
            task_data['user_id'] = user_id
            
            # Insert into database
            task_id = db_manager.insert_task(task_data)
            
            if task_id:
                logger.info(f"Task {task_id} created by user {user_id}")
                return task_id
            else:
                logger.error("Failed to create task")
                return None
                
        except Exception as e:
            logger.error(f"Task creation failed: {e}")
            return None
    
    def get_task(self, task_id: int) -> Optional[Task]:
        """Retrieve a specific task"""
        query = "SELECT * FROM task_queue WHERE id = %s;"
        
        try:
            result = db_manager.execute_query(query, (task_id,), fetch=True)
            if result:
                return Task(**result[0])
            return None
        except Exception as e:
            logger.error(f"Failed to retrieve task {task_id}: {e}")
            return None
    
    def get_tasks_by_status(self, status: TaskStatus, limit: int = 100) -> List[Task]:
        """Retrieve tasks by status"""
        query = "SELECT * FROM task_queue WHERE status = %s ORDER BY created_at DESC LIMIT %s;"
        
        try:
            result = db_manager.execute_query(query, (status.value, limit), fetch=True)
            return [Task(**row) for row in result]
        except Exception as e:
            logger.error(f"Failed to retrieve tasks by status {status}: {e}")
            return []
    
    def get_pending_tasks(self, limit: int = 100) -> List[Task]:
        """Retrieve pending tasks"""
        return self.get_tasks_by_status(TaskStatus.PENDING, limit)
    
    def get_running_tasks(self, limit: int = 100) -> List[Task]:
        """Retrieve running tasks"""
        return self.get_tasks_by_status(TaskStatus.RUNNING, limit)
    
    def get_completed_tasks(self, limit: int = 100) -> List[Task]:
        """Retrieve completed tasks"""
        return self.get_tasks_by_status(TaskStatus.COMPLETED, limit)
    
    def get_failed_tasks(self, limit: int = 100) -> List[Task]:
        """Retrieve failed tasks"""
        return self.get_tasks_by_status(TaskStatus.FAILED, limit)
    
    def get_task_summary(self) -> List[TaskSummary]:
        """Get task summary statistics"""
        query = "SELECT * FROM task_summary;"
        
        try:
            result = db_manager.execute_query(query, fetch=True)
            return [TaskSummary(**row) for row in result]
        except Exception as e:
            logger.error(f"Failed to retrieve task summary: {e}")
            return []
    
    def cancel_task(self, task_id: int, user_id: str) -> bool:
        """Cancel a pending task"""
        # Check if user can cancel this task
        task = self.get_task(task_id)
        if not task:
            return False
        
        if task.user_id != user_id and user_id not in ['admin', 'system']:
            logger.warning(f"User {user_id} not authorized to cancel task {task_id}")
            return False
        
        # Only cancel pending tasks
        if task.status != TaskStatus.PENDING:
            logger.warning(f"Cannot cancel task {task_id} with status {task.status}")
            return False
        
        # Update task status
        query = "UPDATE task_queue SET status = %s WHERE id = %s;"
        try:
            db_manager.execute_query(query, (TaskStatus.CANCELLED.value, task_id))
            logger.info(f"Task {task_id} cancelled by user {user_id}")
            return True
        except Exception as e:
            logger.error(f"Failed to cancel task {task_id}: {e}")
            return False
    
    def retry_task(self, task_id: int, user_id: str) -> bool:
        """Retry a failed task"""
        # Check if user can retry this task
        task = self.get_task(task_id)
        if not task:
            return False
        
        if task.user_id != user_id and user_id not in ['admin', 'system']:
            logger.warning(f"User {user_id} not authorized to retry task {task_id}")
            return False
        
        # Only retry failed tasks
        if task.status != TaskStatus.FAILED:
            logger.warning(f"Cannot retry task {task_id} with status {task.status}")
            return False
        
        # Reset task for retry
        query = """
        UPDATE task_queue 
        SET status = %s, retry_count = retry_count + 1, error_message = NULL
        WHERE id = %s;
        """
        try:
            db_manager.execute_query(query, (TaskStatus.PENDING.value, task_id))
            logger.info(f"Task {task_id} retried by user {user_id}")
            return True
        except Exception as e:
            logger.error(f"Failed to retry task {task_id}: {e}")
            return False