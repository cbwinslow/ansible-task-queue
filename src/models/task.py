"""
Task Model for Task Queue System
"""
from enum import Enum
from typing import Optional, List, Dict, Any
from datetime import datetime
from pydantic import BaseModel, Field
import json

class TaskStatus(str, Enum):
    """Task status enumeration"""
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"

class TaskPriority(int, Enum):
    """Task priority levels"""
    HIGHEST = 10
    HIGH = 50
    NORMAL = 100
    LOW = 200
    LOWEST = 500

class TaskBase(BaseModel):
    """Base task model"""
    task_name: str = Field(..., max_length=255)
    description: Optional[str] = None
    target_host: Optional[str] = None
    target_group: Optional[str] = None
    playbook_path: Optional[str] = None
    script_content: Optional[str] = None
    script_args: Optional[str] = None
    priority: int = Field(default=TaskPriority.NORMAL.value)
    user_id: str = Field(default="system")
    max_retries: int = Field(default=3)
    timeout: int = Field(default=3600)
    tags: Optional[List[str]] = None
    environment: Optional[Dict[str, Any]] = None

class TaskCreate(TaskBase):
    """Task creation model"""
    pass

class TaskInDB(TaskBase):
    """Task model with database fields"""
    id: int
    status: TaskStatus = TaskStatus.PENDING
    created_at: datetime = Field(default_factory=datetime.utcnow)
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    result: Optional[str] = None
    error_message: Optional[str] = None
    retry_count: int = 0

class Task(TaskInDB):
    """Complete task model"""
    class Config:
        orm_mode = True

class TaskResult(BaseModel):
    """Task execution result"""
    task_id: int
    status: TaskStatus
    result: Optional[str] = None
    error: Optional[str] = None
    execution_time: Optional[float] = None

class TaskSummary(BaseModel):
    """Task summary statistics"""
    status: TaskStatus
    task_count: int
    oldest_task: Optional[datetime] = None
    newest_task: Optional[datetime] = None