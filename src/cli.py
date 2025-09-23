#!/usr/bin/env python3
"""
Command Line Interface for Task Queue System
"""
import argparse
import sys
import json
from typing import Optional
from src.core.config import settings
from src.services.task_service import TaskService
from src.models.task import TaskCreate
from src.security.auth import AuthManager

def main():
    """Main CLI entry point"""
    parser = argparse.ArgumentParser(description="Ansible Task Queue CLI")
    parser.add_argument("--user", "-u", default="system", help="User ID for task submission")
    
    subparsers = parser.add_subparsers(dest="command", help="Available commands")
    
    # Submit task command
    submit_parser = subparsers.add_parser("submit", help="Submit a new task")
    submit_parser.add_argument("--name", "-n", required=True, help="Task name")
    submit_parser.add_argument("--description", "-d", help="Task description")
    submit_parser.add_argument("--target", "-t", help="Target host")
    submit_parser.add_argument("--group", "-g", help="Target group")
    submit_parser.add_argument("--playbook", "-p", help="Ansible playbook path")
    submit_parser.add_argument("--script", "-s", help="Shell script content")
    submit_parser.add_argument("--args", "-a", help="Script/playbook arguments (JSON)")
    submit_parser.add_argument("--priority", "-P", type=int, default=100, help="Task priority")
    submit_parser.add_argument("--retries", "-r", type=int, default=3, help="Max retry attempts")
    submit_parser.add_argument("--timeout", "-T", type=int, default=3600, help="Task timeout (seconds)")
    
    # List tasks command
    list_parser = subparsers.add_parser("list", help="List tasks")
    list_parser.add_argument("--status", choices=["pending", "running", "completed", "failed"], 
                           help="Filter by status")
    list_parser.add_argument("--limit", "-l", type=int, default=50, help="Number of tasks to show")
    
    # Task details command
    detail_parser = subparsers.add_parser("detail", help="Show task details")
    detail_parser.add_argument("task_id", type=int, help="Task ID")
    
    # Cancel task command
    cancel_parser = subparsers.add_parser("cancel", help="Cancel a pending task")
    cancel_parser.add_argument("task_id", type=int, help="Task ID")
    
    # Retry task command
    retry_parser = subparsers.add_parser("retry", help="Retry a failed task")
    retry_parser.add_argument("task_id", type=int, help="Task ID")
    
    # Summary command
    subparsers.add_parser("summary", help="Show task summary")
    
    args = parser.parse_args()
    
    if not args.command:
        parser.print_help()
        return
    
    # Initialize services
    task_service = TaskService()
    auth_manager = AuthManager()
    
    # Validate user
    if not auth_manager.is_user_allowed(args.user):
        print(f"Error: User {args.user} is not allowed to use this system")
        sys.exit(1)
    
    # Execute command
    if args.command == "submit":
        submit_task(task_service, args, auth_manager)
    elif args.command == "list":
        list_tasks(task_service, args)
    elif args.command == "detail":
        show_task_detail(task_service, args)
    elif args.command == "cancel":
        cancel_task(task_service, args, auth_manager)
    elif args.command == "retry":
        retry_task(task_service, args, auth_manager)
    elif args.command == "summary":
        show_summary(task_service)
    else:
        parser.print_help()

def submit_task(task_service: TaskService, args: argparse.Namespace, auth_manager: AuthManager):
    """Submit a new task"""
    # Validate required arguments
    if not args.playbook and not args.script:
        print("Error: Either --playbook or --script must be provided")
        sys.exit(1)
    
    # Parse arguments
    script_args = None
    if args.args:
        try:
            script_args = json.dumps(json.loads(args.args)) if args.args.startswith('{') else args.args
        except json.JSONDecodeError:
            script_args = args.args
    
    # Create task
    task_create = TaskCreate(
        task_name=args.name,
        description=args.description,
        target_host=args.target,
        target_group=args.group,
        playbook_path=args.playbook,
        script_content=args.script,
        script_args=script_args,
        priority=args.priority,
        max_retries=args.retries,
        timeout=args.timeout
    )
    
    # Submit task
    task_id = task_service.create_task(task_create, args.user)
    
    if task_id:
        print(f"Task submitted successfully with ID: {task_id}")
    else:
        print("Error: Failed to submit task")
        sys.exit(1)

def list_tasks(task_service: TaskService, args: argparse.Namespace):
    """List tasks"""
    if args.status:
        from src.models.task import TaskStatus
        status_map = {
            "pending": TaskStatus.PENDING,
            "running": TaskStatus.RUNNING,
            "completed": TaskStatus.COMPLETED,
            "failed": TaskStatus.FAILED
        }
        tasks = task_service.get_tasks_by_status(status_map[args.status], args.limit)
    else:
        # Show pending tasks by default
        tasks = task_service.get_pending_tasks(args.limit)
    
    if not tasks:
        print("No tasks found")
        return
    
    print(f"{'ID':<8} {'Name':<30} {'Status':<12} {'Priority':<10} {'Created'}")
    print("-" * 80)
    for task in tasks:
        print(f"{task.id:<8} {task.task_name:<30} {task.status.value:<12} {task.priority:<10} {task.created_at}")

def show_task_detail(task_service: TaskService, args: argparse.Namespace):
    """Show task details"""
    task = task_service.get_task(args.task_id)
    if not task:
        print(f"Error: Task {args.task_id} not found")
        sys.exit(1)
    
    print(f"Task ID: {task.id}")
    print(f"Name: {task.task_name}")
    print(f"Description: {task.description or 'N/A'}")
    print(f"Status: {task.status.value}")
    print(f"Priority: {task.priority}")
    print(f"Target Host: {task.target_host or 'N/A'}")
    print(f"Target Group: {task.target_group or 'N/A'}")
    print(f"Created: {task.created_at}")
    print(f"Started: {task.started_at or 'N/A'}")
    print(f"Completed: {task.completed_at or 'N/A'}")
    print(f"User: {task.user_id}")
    print(f"Retries: {task.retry_count}/{task.max_retries}")
    
    if task.error_message:
        print(f"\nError: {task.error_message}")
    
    if task.result:
        print(f"\nResult:\n{task.result}")

def cancel_task(task_service: TaskService, args: argparse.Namespace, auth_manager: AuthManager):
    """Cancel a task"""
    if task_service.cancel_task(args.task_id, args.user):
        print(f"Task {args.task_id} cancelled successfully")
    else:
        print(f"Error: Failed to cancel task {args.task_id}")
        sys.exit(1)

def retry_task(task_service: TaskService, args: argparse.Namespace, auth_manager: AuthManager):
    """Retry a task"""
    if task_service.retry_task(args.task_id, args.user):
        print(f"Task {args.task_id} queued for retry")
    else:
        print(f"Error: Failed to retry task {args.task_id}")
        sys.exit(1)

def show_summary(task_service: TaskService):
    """Show task summary"""
    summary = task_service.get_task_summary()
    if not summary:
        print("No tasks found")
        return
    
    print(f"{'Status':<15} {'Count':<10} {'Oldest':<20} {'Newest':<20}")
    print("-" * 70)
    for item in summary:
        oldest = item.oldest_task.strftime("%Y-%m-%d %H:%M") if item.oldest_task else "N/A"
        newest = item.newest_task.strftime("%Y-%m-%d %H:%M") if item.newest_task else "N/A"
        print(f"{item.status.value:<15} {item.task_count:<10} {oldest:<20} {newest:<20}")

if __name__ == "__main__":
    main()