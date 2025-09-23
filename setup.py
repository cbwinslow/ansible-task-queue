#!/usr/bin/env python3
"""
Setup Script for Task Queue System
"""
import os
import sys
import subprocess
import logging
from pathlib import Path

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

def check_prerequisites():
    """Check system prerequisites"""
    logger.info("Checking system prerequisites...")
    
    # Check Python version
    if sys.version_info < (3, 8):
        logger.error("Python 3.8 or higher is required")
        return False
    
    # Check if required packages are installed
    required_packages = ['ansible', 'psql']
    missing_packages = []
    
    for package in required_packages:
        if subprocess.run(['which', package], capture_output=True).returncode != 0:
            missing_packages.append(package)
    
    if missing_packages:
        logger.warning(f"Missing packages: {', '.join(missing_packages)}")
        logger.info("Installing missing packages...")
        install_system_packages(missing_packages)
    
    return True

def install_system_packages(packages):
    """Install system packages"""
    try:
        # Try apt first (Debian/Ubuntu)
        subprocess.run(['sudo', 'apt', 'update'], check=True)
        subprocess.run(['sudo', 'apt', 'install', '-y'] + packages, check=True)
    except subprocess.CalledProcessError:
        try:
            # Try yum (RedHat/CentOS)
            subprocess.run(['sudo', 'yum', 'install', '-y'] + packages, check=True)
        except subprocess.CalledProcessError:
            logger.error("Failed to install system packages. Please install manually.")
            return False
    
    return True

def install_python_packages():
    """Install Python dependencies"""
    logger.info("Installing Python dependencies...")
    try:
        subprocess.run([sys.executable, '-m', 'pip', 'install', '-r', 'requirements.txt'], check=True)
        logger.info("Python dependencies installed successfully")
        return True
    except subprocess.CalledProcessError as e:
        logger.error(f"Failed to install Python dependencies: {e}")
        return False

def setup_database():
    """Set up PostgreSQL database"""
    logger.info("Setting up PostgreSQL database...")
    
    # This would contain the database setup logic
    # For now, we'll just create a placeholder
    db_setup_script = """
#!/bin/bash
# Database setup script

DB_NAME="task_queue"
DB_USER="task_queue_user"
DB_PASSWORD="secure_task_queue_password"

# Create database and user
sudo -u postgres psql << SQL
CREATE DATABASE IF NOT EXISTS $DB_NAME;
CREATE USER IF NOT EXISTS $DB_USER WITH PASSWORD '$DB_PASSWORD';
GRANT ALL PRIVILEGES ON DATABASE $DB_NAME TO $DB_USER;
SQL

echo "Database setup complete"
"""
    
    setup_script_path = Path("scripts/setup_database.sh")
    setup_script_path.write_text(db_setup_script)
    setup_script_path.chmod(0o755)
    
    logger.info(f"Database setup script created at {setup_script_path}")
    logger.info("Please run this script manually to set up the database")
    return True

def create_directories():
    """Create necessary directories"""
    logger.info("Creating directories...")
    
    directories = [
        "logs",
        "config",
        "playbooks",
        "scripts",
        "web"
    ]
    
    for directory in directories:
        Path(directory).mkdir(exist_ok=True)
        logger.info(f"Created directory: {directory}")
    
    return True

def create_config_files():
    """Create configuration files"""
    logger.info("Creating configuration files...")
    
    # Create default config
    config_content = """
# Task Queue System Configuration

# Database settings
DB_HOST=localhost
DB_PORT=5432
DB_NAME=task_queue
DB_USER=task_queue_user
DB_PASSWORD=secure_task_queue_password

# Security settings
SECURITY_SECRET_KEY=your-secret-key-here-change-in-production
SECURITY_ALLOWED_USERS=admin,cbwinslow
SECURITY_REQUIRE_AUTHENTICATION=true

# Worker settings
WORKER_MAX_CONCURRENT_TASKS=5
WORKER_TASK_TIMEOUT_SECONDS=3600
WORKER_RETRY_ATTEMPTS=3
WORKER_POLL_INTERVAL_SECONDS=5
WORKER_LOG_LEVEL=INFO

# Ansible settings
ANSIBLE_INVENTORY_PATH=./config/inventory
ANSIBLE_CONFIG_PATH=./config/ansible.cfg
ANSIBLE_PLAYBOOK_DIRECTORY=./playbooks
ANSIBLE_SCRIPT_DIRECTORY=./scripts
ANSIBLE_BECOME_USER=root
ANSIBLE_BECOME_METHOD=sudo

# API settings
API_HOST=0.0.0.0
API_PORT=8000
API_DEBUG=false
"""
    
    Path("config/.env").write_text(config_content.strip())
    
    # Create Ansible config
    ansible_config = """
[defaults]
inventory = ./config/inventory
host_key_checking = False
retry_files_enabled = False
stdout_callback = yaml

[privilege_escalation]
become = True
become_method = sudo
become_user = root
"""
    
    Path("config/ansible.cfg").write_text(ansible_config.strip())
    
    # Create inventory
    inventory = """
# Inventory file for task queue system

# Local server
localhost ansible_connection=local ansible_host=127.0.0.1

# ZeroTier network
[zerotier]
ztnode1 ansible_host=172.28.82.205

# All servers
[servers:children]
zerotier

# Groups for specific tasks
[web_servers]
localhost

[database_servers]
localhost
"""
    
    Path("config/inventory").write_text(inventory.strip())
    
    logger.info("Configuration files created")
    return True

def create_systemd_service():
    """Create systemd service file"""
    logger.info("Creating systemd service...")
    
    service_content = f"""
[Unit]
Description=Ansible Task Queue Worker
After=postgresql.service network.target
Wants=postgresql.service

[Service]
Type=simple
User={os.getenv('USER', 'cbwinslow')}
Group={os.getenv('USER', 'cbwinslow')}
WorkingDirectory={os.getcwd()}
ExecStart={sys.executable} src/worker_daemon.py
Restart=always
RestartSec=10
Environment=PYTHONPATH={os.getcwd()}

[Install]
WantedBy=multi-user.target
"""
    
    service_path = Path("config/task-queue-worker.service")
    service_path.write_text(service_content.strip())
    
    logger.info(f"Systemd service file created at {service_path}")
    logger.info("To install the service:")
    logger.info("  sudo cp config/task-queue-worker.service /etc/systemd/system/")
    logger.info("  sudo systemctl daemon-reload")
    logger.info("  sudo systemctl enable task-queue-worker")
    logger.info("  sudo systemctl start task-queue-worker")
    
    return True

def main():
    """Main setup function"""
    logger.info("Starting Task Queue System Setup")
    
    # Check prerequisites
    if not check_prerequisites():
        logger.error("Prerequisites check failed")
        sys.exit(1)
    
    # Create directories
    if not create_directories():
        logger.error("Failed to create directories")
        sys.exit(1)
    
    # Install Python packages
    if not install_python_packages():
        logger.error("Failed to install Python packages")
        sys.exit(1)
    
    # Create configuration files
    if not create_config_files():
        logger.error("Failed to create configuration files")
        sys.exit(1)
    
    # Set up database
    if not setup_database():
        logger.error("Failed to set up database")
        sys.exit(1)
    
    # Create systemd service
    if not create_systemd_service():
        logger.error("Failed to create systemd service")
        sys.exit(1)
    
    logger.info("Setup completed successfully!")
    logger.info("")
    logger.info("Next steps:")
    logger.info("1. Configure database settings in config/.env")
    logger.info("2. Run the database setup script: scripts/setup_database.sh")
    logger.info("3. Install the systemd service")
    logger.info("4. Start the worker: sudo systemctl start task-queue-worker")
    logger.info("5. Submit tasks using: python src/cli.py submit --help")

if __name__ == "__main__":
    main()