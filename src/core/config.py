"""
Configuration Management using Pydantic
"""
from pydantic import BaseSettings, Field
from typing import Optional, List, Dict, Any
import os
from pathlib import Path

class DatabaseSettings(BaseSettings):
    """Database configuration settings"""
    host: str = Field(default="localhost", env="DB_HOST")
    port: int = Field(default=5432, env="DB_PORT")
    name: str = Field(default="task_queue", env="DB_NAME")
    user: str = Field(default="task_queue_user", env="DB_USER")
    password: str = Field(default="secure_task_queue_password", env="DB_PASSWORD")
    pool_size: int = Field(default=10)
    
    class Config:
        env_file = ".env"
        env_prefix = "DB_"

class SecuritySettings(BaseSettings):
    """Security configuration settings"""
    secret_key: str = Field(default="your-secret-key-here-change-in-production")
    allowed_users: List[str] = Field(default=["admin", "cbwinslow"])
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 30
    require_authentication: bool = True
    
    class Config:
        env_file = ".env"
        env_prefix = "SECURITY_"

class WorkerSettings(BaseSettings):
    """Worker configuration settings"""
    max_concurrent_tasks: int = Field(default=5)
    task_timeout_seconds: int = Field(default=3600)
    retry_attempts: int = Field(default=3)
    poll_interval_seconds: int = Field(default=5)
    log_level: str = Field(default="INFO")
    
    class Config:
        env_file = ".env"
        env_prefix = "WORKER_"

class AnsibleSettings(BaseSettings):
    """Ansible configuration settings"""
    inventory_path: str = Field(default="./config/inventory")
    config_path: str = Field(default="./config/ansible.cfg")
    playbook_directory: str = Field(default="./playbooks")
    script_directory: str = Field(default="./scripts")
    become_user: str = Field(default="root")
    become_method: str = Field(default="sudo")
    
    class Config:
        env_file = ".env"
        env_prefix = "ANSIBLE_"

class APISettings(BaseSettings):
    """API configuration settings"""
    host: str = Field(default="0.0.0.0")
    port: int = Field(default=8000)
    debug: bool = Field(default=False)
    cors_origins: List[str] = Field(default=["*"])
    
    class Config:
        env_file = ".env"
        env_prefix = "API_"

class Settings(BaseSettings):
    """Main application settings"""
    app_name: str = Field(default="Ansible Task Queue")
    app_version: str = Field(default="1.0.0")
    environment: str = Field(default="development")
    log_directory: str = Field(default="./logs")
    
    # Sub-configurations
    database: DatabaseSettings = DatabaseSettings()
    security: SecuritySettings = SecuritySettings()
    worker: WorkerSettings = WorkerSettings()
    ansible: AnsibleSettings = AnsibleSettings()
    api: APISettings = APISettings()
    
    class Config:
        env_file = ".env"

# Global settings instance
settings = Settings()