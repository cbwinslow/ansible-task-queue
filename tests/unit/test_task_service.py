"""
Unit tests for task service
"""
import pytest
import sys
import os
from unittest.mock import Mock, patch, MagicMock

# Add src to path for imports
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..', 'src'))

from services.task_service import TaskService
from models.task import TaskCreate, TaskStatus

class TestTaskService:
    """Test task service functionality"""
    
    @patch('src.services.task_service.db_manager')
    @patch('src.services.task_service.AuthManager')
    def test_task_creation_success(self, mock_auth_manager, mock_db_manager):
        """Test successful task creation"""
        # Setup mocks
        mock_auth_instance = Mock()
        mock_auth_instance.is_user_allowed.return_value = True
        mock_auth_manager.return_value = mock_auth_instance
        
        mock_db_manager.insert_task.return_value = 123
        
        # Test task creation
        task_service = TaskService()
        task_create = TaskCreate(
            task_name="test_task",
            script_content="echo 'Hello World'"
        )
        
        task_id = task_service.create_task(task_create, "test_user")
        
        # Assertions
        assert task_id == 123
        mock_auth_instance.is_user_allowed.assert_called_once_with("test_user")
        mock_db_manager.insert_task.assert_called_once()
    
    @patch('src.services.task_service.db_manager')
    @patch('src.services.task_service.AuthManager')
    def test_task_creation_unauthorized_user(self, mock_auth_manager, mock_db_manager):
        """Test task creation with unauthorized user"""
        # Setup mocks
        mock_auth_instance = Mock()
        mock_auth_instance.is_user_allowed.return_value = False
        mock_auth_manager.return_value = mock_auth_instance
        
        # Test task creation
        task_service = TaskService()
        task_create = TaskCreate(
            task_name="test_task",
            script_content="echo 'Hello World'"
        )
        
        task_id = task_service.create_task(task_create, "unauthorized_user")
        
        # Assertions
        assert task_id is None
        mock_auth_instance.is_user_allowed.assert_called_once_with("unauthorized_user")
        mock_db_manager.insert_task.assert_not_called()
    
    @patch('src.services.task_service.db_manager')
    def test_get_task_success(self, mock_db_manager):
        """Test successful task retrieval"""
        # Setup mock
        mock_db_manager.execute_query.return_value = [{
            'id': 123,
            'task_name': 'test_task',
            'status': 'pending',
            'user_id': 'test_user'
        }]
        
        # Test task retrieval
        task_service = TaskService()
        task = task_service.get_task(123)
        
        # Assertions
        assert task is not None
        assert task.id == 123
        assert task.task_name == 'test_task'
        assert task.status == TaskStatus.PENDING
        mock_db_manager.execute_query.assert_called_once()
    
    @patch('src.services.task_service.db_manager')
    def test_get_task_not_found(self, mock_db_manager):
        """Test task retrieval when task not found"""
        # Setup mock
        mock_db_manager.execute_query.return_value = []
        
        # Test task retrieval
        task_service = TaskService()
        task = task_service.get_task(999)
        
        # Assertions
        assert task is None
        mock_db_manager.execute_query.assert_called_once()
    
    @patch('src.services.task_service.db_manager')
    def test_get_tasks_by_status(self, mock_db_manager):
        """Test retrieving tasks by status"""
        # Setup mock
        mock_db_manager.execute_query.return_value = [
            {
                'id': 123,
                'task_name': 'test_task_1',
                'status': 'pending',
                'user_id': 'test_user'
            },
            {
                'id': 124,
                'task_name': 'test_task_2',
                'status': 'pending',
                'user_id': 'test_user'
            }
        ]
        
        # Test task retrieval
        task_service = TaskService()
        tasks = task_service.get_tasks_by_status(TaskStatus.PENDING, limit=10)
        
        # Assertions
        assert len(tasks) == 2
        assert all(task.status == TaskStatus.PENDING for task in tasks)
        mock_db_manager.execute_query.assert_called_once()

if __name__ == "__main__":
    pytest.main([__file__])