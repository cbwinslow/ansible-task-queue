"""
Unit tests for database management
"""
import pytest
import sys
import os
from unittest.mock import Mock, patch, MagicMock

# Add src to path for imports
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..', 'src'))

from core.database import DatabaseManager

class TestDatabaseManager:
    """Test database management functionality"""
    
    @patch('src.core.database.psycopg2.connect')
    def test_database_connection_success(self, mock_connect):
        """Test successful database connection"""
        # Setup mock
        mock_connection = Mock()
        mock_connect.return_value = mock_connection
        
        # Test connection
        db_manager = DatabaseManager()
        result = db_manager.connect()
        
        # Assertions
        assert result is True
        mock_connect.assert_called_once()
        assert db_manager.connection == mock_connection
    
    @patch('src.core.database.psycopg2.connect')
    def test_database_connection_failure(self, mock_connect):
        """Test database connection failure"""
        # Setup mock to raise exception
        mock_connect.side_effect = Exception("Connection failed")
        
        # Test connection
        db_manager = DatabaseManager()
        result = db_manager.connect()
        
        # Assertions
        assert result is False
        assert db_manager.connection is None
    
    def test_database_disconnect(self):
        """Test database disconnection"""
        # Setup
        db_manager = DatabaseManager()
        mock_connection = Mock()
        db_manager.connection = mock_connection
        
        # Test disconnection
        db_manager.disconnect()
        
        # Assertions
        mock_connection.close.assert_called_once()
        assert db_manager.connection is None
    
    @patch('src.core.database.psycopg2.connect')
    def test_execute_query_success(self, mock_connect):
        """Test successful query execution"""
        # Setup mocks
        mock_connection = Mock()
        mock_cursor = Mock()
        mock_connect.return_value = mock_connection
        mock_connection.cursor.return_value = mock_cursor
        mock_cursor.fetchall.return_value = [{'id': 1, 'name': 'test'}]
        
        # Test query execution
        db_manager = DatabaseManager()
        db_manager.connect()
        result = db_manager.execute_query("SELECT * FROM test", fetch=True)
        
        # Assertions
        assert result == [{'id': 1, 'name': 'test'}]
        mock_cursor.execute.assert_called_once_with("SELECT * FROM test", None)
        mock_cursor.fetchall.assert_called_once()
    
    @patch('src.core.database.psycopg2.connect')
    def test_execute_query_with_params(self, mock_connect):
        """Test query execution with parameters"""
        # Setup mocks
        mock_connection = Mock()
        mock_cursor = Mock()
        mock_connect.return_value = mock_connection
        mock_connection.cursor.return_value = mock_cursor
        
        # Test query execution
        db_manager = DatabaseManager()
        db_manager.connect()
        db_manager.execute_query("SELECT * FROM test WHERE id = %s", (1,))
        
        # Assertions
        mock_cursor.execute.assert_called_once_with("SELECT * FROM test WHERE id = %s", (1,))
    
    def test_get_cursor_context_manager(self):
        """Test cursor context manager"""
        # Setup
        db_manager = DatabaseManager()
        mock_connection = Mock()
        mock_cursor = Mock()
        mock_connection.cursor.return_value = mock_cursor
        db_manager.connection = mock_connection
        
        # Test context manager
        with db_manager.get_cursor() as cursor:
            assert cursor == mock_cursor
        
        # Assertions
        mock_cursor.close.assert_called_once()

if __name__ == "__main__":
    pytest.main([__file__])