# Ansible Task Queue System

A production-ready task queue system for executing Ansible playbooks and shell scripts with full sudo privileges, audit logging, and access control.

## Features

- **Queue-Based Execution**: Submit tasks that execute asynchronously
- **Full Sudo Support**: Execute tasks with root privileges when needed
- **Ansible Integration**: Leverage Ansible for complex multi-host operations
- **Audit Logging**: Complete audit trail of all task executions
- **Access Control**: User authentication and authorization
- **Retry Logic**: Automatic retry of failed tasks
- **Priority System**: High-priority tasks execute first
- **Web Interface**: Monitor and manage tasks via web UI
- **API Access**: RESTful API for programmatic access
- **Database Storage**: PostgreSQL backend for reliability

## Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   CLI/API/Web   │    │   Task Queue    │    │   Task Worker   │
│  (Submission)   │───▶│   (PostgreSQL)  │───▶│ (Ansible/Shell) │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                              │
                              ▼
                       ┌─────────────────┐
                       │   Audit Log     │
                       └─────────────────┘
```

## Installation

### Prerequisites

- Python 3.8+
- PostgreSQL 12+
- Ansible 2.9+
- System with sudo privileges

### Quick Start

```bash
# Clone the repository
git clone <repository-url>
cd ansible-task-queue

# Install dependencies
pip install -r requirements.txt

# Run setup
python setup.py

# Configure settings
# Edit config/.env with your database credentials

# Set up database
./scripts/setup_database.sh

# Start worker
sudo systemctl start task-queue-worker
```

## Usage

### Submitting Tasks

```bash
# Submit Ansible playbook
python src/cli.py submit \
  --name \"update-system\" \
  --playbook \"./playbooks/system-update.yml\" \
  --target \"localhost\" \
  --priority 50 \
  --user \"admin\"

# Submit shell script
python src/cli.py submit \
  --name \"backup-database\" \
  --script \"pg_dump mydb > /backups/backup-$(date +%Y%m%d).sql\" \
  --timeout 1800 \
  --user \"cbwinslow\"
```

### Monitoring Tasks

```bash
# List pending tasks
python src/cli.py list --status pending

# Show task details
python src/cli.py detail 123

# Get system summary
python src/cli.py summary
```

## Security

- User authentication and authorization
- Audit logging of all actions
- Secure configuration management
- Role-based access control
- Encrypted communications

## Configuration

All configuration is managed through environment variables in `config/.env`:

```bash
# Database settings
DB_HOST=localhost
DB_PORT=5432
DB_NAME=task_queue
DB_USER=task_queue_user
DB_PASSWORD=secure_password

# Security settings
SECURITY_SECRET_KEY=your-secret-key
SECURITY_ALLOWED_USERS=admin,cbwinslow
```

## Development

### Running Tests

```bash
# Run unit tests
python -m pytest tests/unit/

# Run integration tests
python -m pytest tests/integration/

# Run all tests
python -m pytest tests/
```

### API Documentation

The system includes a FastAPI-based REST API with automatic OpenAPI documentation available at `/docs`.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## License

MIT License - see LICENSE file for details.