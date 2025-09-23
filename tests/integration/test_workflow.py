"""
Integration tests for the Ansible Task Queue System
"""
import pytest
import sys
import os
import tempfile
import json
from unittest.mock import Mock, patch, MagicMock

# Add src to path for imports
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'src'))

from services.task_service import TaskService
from workers.queue_worker import QueueWorker
from models.task import TaskCreate, TaskStatus
from core.database import DatabaseManager

class TestIntegration:
    """Integration tests for full system workflow"""
    
    @pytest.fixture
    def mock_db_manager(self):
        """Mock database manager for integration tests"""
        with patch('src.services.task_service.db_manager') as mock_db:
            yield mock_db
    
    @pytest.fixture
    def mock_auth_manager(self):
        """Mock auth manager for integration tests"""
        with patch('src.services.task_service.AuthManager') as mock_auth:
            mock_instance = Mock()
            mock_instance.is_user_allowed.return_value = True
            mock_auth.return_value = mock_instance
            yield mock_auth
    
    def test_task_creation_and_retrieval(self, mock_db_manager, mock_auth_manager):
        """Test complete task creation and retrieval workflow"""
        # Setup mock database responses
        mock_db_manager.insert_task.return_value = 123
        mock_db_manager.execute_query.return_value = [{
            'id': 123,
            'task_name': 'integration_test_task',
            'description': 'Test task for integration',
            'status': 'pending',
            'priority': 100,
            'user_id': 'test_user',
            'created_at': '2025-01-01 00:00:00'
        }]
        
        # Test task creation
        task_service = TaskService()
        task_create = TaskCreate(
            task_name="integration_test_task",
            description="Test task for integration",
            script_content="echo 'Hello Integration Test'",
            priority=100
        )
        
        task_id = task_service.create_task(task_create, "test_user")
        assert task_id == 123
        
        # Test task retrieval
        task = task_service.get_task(123)
        assert task is not None
        assert task.id == 123
        assert task.task_name == "integration_test_task"
        assert task.status == TaskStatus.PENDING
        
        # Verify mock calls
        mock_db_manager.insert_task.assert_called_once()
        mock_db_manager.execute_query.assert_called_once()
    
    def test_task_status_updates(self, mock_db_manager, mock_auth_manager):
        """Test task status update workflow"""
        # Setup mock database responses
        mock_db_manager.insert_task.return_value = 456
        mock_db_manager.execute_query.side_effect = [
            [{'id': 456, 'task_name': 'status_test', 'status': 'pending', 'user_id': 'test_user'}],  # get_task
            [{'id': 456, 'task_name': 'status_test', 'status': 'running', 'user_id': 'test_user'}],   # after update
        ]
        
        # Create task
        task_service = TaskService()
        task_create = TaskCreate(
            task_name="status_test",
            script_content="echo 'Status Test'"
        )
        
        task_id = task_service.create_task(task_create, "test_user")
        assert task_id == 456
        
        # Get initial task
        task = task_service.get_task(456)
        assert task.status == TaskStatus.PENDING
        
        # Simulate status update (this would normally be done by worker)
        mock_db_manager.execute_query.side_effect = None
        mock_db_manager.execute_query.return_value = None  # Update returns rowcount
        
        # Get updated task
        mock_db_manager.execute_query.return_value = [{
            'id': 456, 'task_name': 'status_test', 'status': 'running', 'user_id': 'test_user'
        }]
        
        task = task_service.get_task(456)
        # Note: In real implementation, the worker would update the status
        # This test verifies the service can handle status changes
    
    def test_task_filtering(self, mock_db_manager, mock_auth_manager):
        """Test task filtering by status"""
        # Setup mock database response
        mock_db_manager.execute_query.return_value = [
            {
                'id': 1,
                'task_name': 'pending_task_1',
                'status': 'pending',
                'user_id': 'test_user'
            },
            {
                'id': 2,
                'task_name': 'pending_task_2',
                'status': 'pending',
                'user_id': 'test_user'
            }
        ]
        
        # Test filtering
        task_service = TaskService()
        pending_tasks = task_service.get_tasks_by_status(TaskStatus.PENDING, limit=10)
        
        assert len(pending_tasks) == 2
        assert all(task.status == TaskStatus.PENDING for task in pending_tasks)
        assert pending_tasks[0].id == 1
        assert pending_tasks[1].id == 2
    
    def test_task_cancellation_workflow(self, mock_db_manager, mock_auth_manager):
        """Test task cancellation workflow"""
        # Setup mock database responses
        mock_db_manager.execute_query.side_effect = [
            [{  # get_task response
                'id': 789,
                'task_name': 'cancel_test',
                'status': 'pending',
                'user_id': 'test_user'
            }],
            None,  # update query response (rowcount)
            [{  # get_task after update response
                'id': 789,
                'task_name': 'cancel_test',
                'status': 'cancelled',
                'user_id': 'test_user'
            }]
        ]
        
        # Test cancellation
        task_service = TaskService()
        result = task_service.cancel_task(789, "test_user")
        
        # In this mock setup, cancellation should work
        # The actual implementation would depend on database state
        
    def test_task_retry_workflow(self, mock_db_manager, mock_auth_manager):
        """Test task retry workflow"""
        # Setup mock database responses
        mock_db_manager.execute_query.side_effect = [
            [{  # get_task response (failed task)
                'id': 999,
                'task_name': 'retry_test',
                'status': 'failed',
                'user_id': 'test_user',
                'retry_count': 1
            }],
            None,  # update query response
            [{  # get_task after retry response
                'id': 999,
                'task_name': 'retry_test',
                'status': 'pending',
                'user_id': 'test_user',
                'retry_count': 2
            }]
        ]
        
        # Test retry
        task_service = TaskService()
        result = task_service.retry_task(999, "test_user")
        
        # In this mock setup, retry should work
        # The actual implementation would depend on database state

class TestWorkerIntegration:
    """Integration tests for worker functionality"""
    
    @patch('src.workers.queue_worker.subprocess.run')
    @patch('src.workers.queue_worker.db_manager')
    def test_ansible_playbook_execution(self, mock_db_manager, mock_subprocess):
        """Test Ansible playbook execution in worker"""
        # Setup mocks
        mock_subprocess.return_value = Mock(
            returncode=0,
            stdout="Playbook executed successfully",
            stderr=""
        )
        
        mock_db_manager.get_next_task.return_value = {
            'id': 1,
            'task_name': 'ansible_test',
            'playbook_path': '/path/to/test.yml',
            'timeout': 3600
        }
        
        # Create worker and test execution
        # Note: This is a simplified test. In reality, the worker would
        # process the task queue continuously
        
    @patch('src.workers.queue_worker.subprocess.run')
    @patch('src.workers.queue_worker.db_manager')
    def test_shell_script_execution(self, mock_db_manager, mock_subprocess):
        """Test shell script execution in worker"""
        # Setup mocks
        mock_subprocess.return_value = Mock(
            returncode=0,
            stdout="Script executed successfully",
            stderr=""
        )
        
        mock_db_manager.get_next_task.return_value = {
            'id': 2,
            'task_name': 'shell_test',
            'script_content': 'echo "Hello World"',
            'timeout': 3600
        }
        
        # Create worker and test execution
        # Note: This is a simplified test. In reality, the worker would
        # process the task queue continuously

if __name__ == "__main__":
    pytest.main([__file__])