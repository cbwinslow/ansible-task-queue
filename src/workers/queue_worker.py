"""
Queue Worker for Task Queue System
"""
import asyncio
import logging
import time
import subprocess
import json
import os
from typing import Optional, Dict, Any
from ..core.config import settings
from ..core.database import db_manager
from ..models.task import TaskStatus, TaskResult
from ..audit.logger import AuditLogger
from ..security.auth import AuthManager

logger = logging.getLogger(__name__)

class QueueWorker:
    """Main queue worker that processes tasks"""
    
    def __init__(self):
        self.running = False
        self.current_task = None
        self.audit_logger = AuditLogger()
        self.auth_manager = AuthManager()
    
    def start(self):
        """Start the queue worker"""
        logger.info("Starting queue worker")
        self.running = True
        
        # Connect to database
        if not db_manager.connect():
            logger.error("Failed to connect to database")
            return False
        
        # Main worker loop
        while self.running:
            try:
                # Get next task
                task_data = db_manager.get_next_task()
                if task_data:
                    self.process_task(task_data)
                else:
                    # No tasks available, sleep
                    time.sleep(settings.worker.poll_interval_seconds)
            except KeyboardInterrupt:
                logger.info("Worker interrupted by user")
                break
            except Exception as e:
                logger.error(f"Worker error: {e}")
                time.sleep(settings.worker.poll_interval_seconds)
        
        logger.info("Queue worker stopped")
        return True
    
    def stop(self):
        """Stop the queue worker"""
        logger.info("Stopping queue worker")
        self.running = False
    
    def process_task(self, task_data: Dict[str, Any]):
        """Process a single task"""
        task_id = task_data['id']
        task_name = task_data['task_name']
        
        logger.info(f"Processing task {task_id}: {task_name}")
        
        # Update task status to running
        db_manager.update_task_status(task_id, TaskStatus.RUNNING.value)
        self.audit_logger.log_task_action(task_id, "started", "running")
        
        try:
            # Execute the task
            result = self.execute_task(task_data)
            
            # Update task status based on result
            if result.status == TaskStatus.COMPLETED:
                db_manager.update_task_status(task_id, TaskStatus.COMPLETED.value, result.result)
                self.audit_logger.log_task_action(task_id, "completed", "completed", result.result)
                logger.info(f"Task {task_id} completed successfully")
            else:
                db_manager.update_task_status(task_id, TaskStatus.FAILED.value, result.result, result.error)
                self.audit_logger.log_task_action(task_id, "failed", "failed", result.error)
                logger.error(f"Task {task_id} failed: {result.error}")
                
        except Exception as e:
            error_msg = f"Task execution error: {str(e)}"
            db_manager.update_task_status(task_id, TaskStatus.FAILED.value, None, error_msg)
            self.audit_logger.log_task_action(task_id, "error", "failed", error_msg)
            logger.error(f"Task {task_id} execution failed: {e}")
    
    def execute_task(self, task_data: Dict[str, Any]) -> TaskResult:
        """Execute a task based on its type"""
        task_id = task_data['id']
        playbook_path = task_data.get('playbook_path')
        script_content = task_data.get('script_content')
        target_host = task_data.get('target_host')
        script_args = task_data.get('script_args')
        timeout = task_data.get('timeout', 3600)
        
        start_time = time.time()
        
        try:
            if playbook_path:
                # Execute Ansible playbook
                result = self.execute_ansible_playbook(playbook_path, target_host, script_args, timeout)
            elif script_content:
                # Execute shell script
                result = self.execute_shell_script(script_content, target_host, script_args, timeout)
            else:
                raise ValueError("No playbook or script content provided")
            
            execution_time = time.time() - start_time
            
            return TaskResult(
                task_id=task_id,
                status=TaskStatus.COMPLETED,
                result=result,
                execution_time=execution_time
            )
            
        except Exception as e:
            execution_time = time.time() - start_time
            
            return TaskResult(
                task_id=task_id,
                status=TaskStatus.FAILED,
                error=str(e),
                execution_time=execution_time
            )
    
    def execute_ansible_playbook(self, playbook_path: str, target_host: Optional[str], 
                               script_args: Optional[str], timeout: int) -> str:
        """Execute an Ansible playbook"""
        logger.info(f"Executing Ansible playbook: {playbook_path}")
        
        # Build Ansible command
        cmd = ["ansible-playbook", "-i", settings.ansible.inventory_path]
        
        # Add target host if specified
        if target_host:
            cmd.extend(["-l", target_host])
        
        # Add extra variables if provided
        if script_args:
            try:
                args_dict = json.loads(script_args)
                extra_vars = " ".join([f"{k}={v}" for k, v in args_dict.items()])
                cmd.extend(["--extra-vars", extra_vars])
            except json.JSONDecodeError:
                # If not JSON, treat as raw arguments
                cmd.extend(["--extra-vars", script_args])
        
        # Add playbook path
        cmd.append(playbook_path)
        
        # Execute with timeout
        try:
            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                timeout=timeout,
                cwd=settings.ansible.playbook_directory
            )
            
            if result.returncode == 0:
                return result.stdout
            else:
                raise Exception(f"Ansible playbook failed with exit code {result.returncode}: {result.stderr}")
                
        except subprocess.TimeoutExpired:
            raise Exception(f"Ansible playbook timed out after {timeout} seconds")
        except Exception as e:
            raise Exception(f"Ansible execution failed: {str(e)}")
    
    def execute_shell_script(self, script_content: str, target_host: Optional[str],
                           script_args: Optional[str], timeout: int) -> str:
        """Execute a shell script"""
        logger.info("Executing shell script")
        
        # Create temporary script file
        script_file = f"/tmp/task_{int(time.time())}_{os.getpid()}.sh"
        
        try:
            # Write script content to file
            with open(script_file, 'w') as f:
                f.write(script_content)
            
            os.chmod(script_file, 0o755)
            
            # Build command
            cmd = ["bash", script_file]
            
            if script_args:
                cmd.extend(script_args.split())
            
            # Execute with timeout
            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                timeout=timeout
            )
            
            if result.returncode == 0:
                return result.stdout
            else:
                raise Exception(f"Shell script failed with exit code {result.returncode}: {result.stderr}")
                
        except subprocess.TimeoutExpired:
            raise Exception(f"Shell script timed out after {timeout} seconds")
        except Exception as e:
            raise Exception(f"Shell script execution failed: {str(e)}")
        finally:
            # Clean up temporary file
            if os.path.exists(script_file):
                os.remove(script_file)

# Global worker instance
worker = QueueWorker()