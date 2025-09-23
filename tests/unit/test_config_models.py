"""
Unit tests for the Ansible Task Queue System
"""
import pytest
import sys
import os
from unittest.mock import Mock, patch, MagicMock
import json

# Add src to path for imports
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'src'))

from core.config import Settings, DatabaseSettings, SecuritySettings
from models.task import TaskCreate, TaskStatus, TaskPriority

class TestConfiguration:
    """Test configuration management"""
    
    def test_settings_initialization(self):
        """Test that settings initialize correctly"""
        settings = Settings()
        assert settings.app_name == "Ansible Task Queue"
        assert settings.app_version == "1.0.0"
        assert isinstance(settings.database, DatabaseSettings)
        assert isinstance(settings.security, SecuritySettings)
    
    def test_database_settings_defaults(self):
        """Test database configuration defaults"""
        db_settings = DatabaseSettings()
        assert db_settings.host == "localhost"
        assert db_settings.port == 5432
        assert db_settings.name == "task_queue"
        assert db_settings.user == "task_queue_user"
        assert db_settings.pool_size == 10
    
    def test_security_settings_defaults(self):
        """Test security configuration defaults"""
        security_settings = SecuritySettings()
        assert "admin" in security_settings.allowed_users
        assert "cbwinslow" in security_settings.allowed_users
        assert security_settings.require_authentication is True
        assert security_settings.jwt_algorithm == "HS256"

class TestTaskModels:
    """Test task data models"""
    
    def test_task_create_model(self):
        """Test TaskCreate model validation"""
        task_data = {
            "task_name": "test_task",
            "description": "Test task description",
            "priority": TaskPriority.NORMAL.value,
            "user_id": "test_user",
            "script_content": "echo 'Hello World'"
        }
        
        task = TaskCreate(**task_data)
        assert task.task_name == "test_task"
        assert task.description == "Test task description"
        assert task.priority == TaskPriority.NORMAL.value
        assert task.user_id == "test_user"
        assert task.script_content == "echo 'Hello World'"
    
    def test_task_status_enum(self):
        """Test TaskStatus enumeration"""
        assert TaskStatus.PENDING.value == "pending"
        assert TaskStatus.RUNNING.value == "running"
        assert TaskStatus.COMPLETED.value == "completed"
        assert TaskStatus.FAILED.value == "failed"
        assert TaskStatus.CANCELLED.value == "cancelled"
    
    def test_task_priority_enum(self):
        """Test TaskPriority enumeration"""
        assert TaskPriority.HIGHEST.value == 10
        assert TaskPriority.HIGH.value == 50
        assert TaskPriority.NORMAL.value == 100
        assert TaskPriority.LOW.value == 200
        assert TaskPriority.LOWEST.value == 500
    
    def test_task_create_with_playbook(self):
        """Test TaskCreate with playbook path"""
        task_data = {
            "task_name": "ansible_task",
            "playbook_path": "/path/to/playbook.yml",
            "target_host": "localhost",
            "priority": TaskPriority.HIGH.value
        }
        
        task = TaskCreate(**task_data)
        assert task.task_name == "ansible_task"
        assert task.playbook_path == "/path/to/playbook.yml"
        assert task.target_host == "localhost"
        assert task.priority == TaskPriority.HIGH.value

if __name__ == "__main__":
    pytest.main([__file__])