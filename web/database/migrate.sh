#!/bin/bash

# Database Migration Script for Cloudflare Mobile Task Executor
# This script handles database schema migrations and setup

set -e

echo "=== Cloudflare Mobile Task Executor Database Migration ==="
echo ""

# Configuration
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_NAME="${DB_NAME:-task_queue}"
DB_USER="${DB_USER:-task_queue_user}"
DB_PASSWORD="${DB_PASSWORD:-secure_task_queue_password}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${BLUE}ℹ${NC} $1"
}

log_success() {
    echo -e "${GREEN}✓${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

log_error() {
    echo -e "${RED}✗${NC} $1"
}

# Check if PostgreSQL is available
check_postgresql() {
    log_info "Checking PostgreSQL connection..."
    if command -v psql >/dev/null 2>&1; then
        if PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "SELECT 1;" >/dev/null 2>&1; then
            log_success "PostgreSQL connection successful"
            return 0
        else
            log_error "Cannot connect to PostgreSQL"
            return 1
        fi
    else
        log_error "PostgreSQL client (psql) not found"
        return 1
    fi
}

# Create database if it doesn't exist
create_database() {
    log_info "Creating database $DB_NAME if it doesn't exist..."
    
    # Connect to postgres database to create our database
    if PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U postgres -d postgres -c "CREATE DATABASE $DB_NAME;" 2>/dev/null; then
        log_success "Database $DB_NAME created"
    else
        log_info "Database $DB_NAME already exists or creation failed"
    fi
}

# Create user if it doesn't exist
create_user() {
    log_info "Creating user $DB_USER if it doesn't exist..."
    
    # Connect to postgres database to create our user
    if PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U postgres -d postgres -c "CREATE USER $DB_USER WITH PASSWORD '$DB_PASSWORD';" 2>/dev/null; then
        log_success "User $DB_USER created"
    else
        log_info "User $DB_USER already exists or creation failed"
    fi
    
    # Grant privileges
    PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U postgres -d postgres -c "GRANT ALL PRIVILEGES ON DATABASE $DB_NAME TO $DB_USER;" 2>/dev/null || true
}

# Apply schema migrations
apply_migrations() {
    log_info "Applying database schema migrations..."
    
    if [[ -f "/home/cbwinslow/ansible-task-queue/web/database/schema.sql" ]]; then
        if PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -f "/home/cbwinslow/ansible-task-queue/web/database/schema.sql"; then
            log_success "Schema migrations applied successfully"
            return 0
        else
            log_error "Failed to apply schema migrations"
            return 1
        fi
    else
        log_error "Schema file not found: /home/cbwinslow/ansible-task-queue/web/database/schema.sql"
        return 1
    fi
}

# Create audit triggers
create_audit_triggers() {
    log_info "Creating audit triggers..."
    
    audit_trigger_sql="
-- Audit trigger function
CREATE OR REPLACE FUNCTION audit_trigger()
RETURNS TRIGGER AS \$\$
BEGIN
    IF (TG_OP = 'DELETE') THEN
        INSERT INTO audit_log (user_id, action, resource_type, resource_id, details)
        VALUES (COALESCE(NEW.user_id, OLD.user_id), TG_OP, TG_TABLE_NAME, OLD.id, row_to_json(OLD));
        RETURN OLD;
    ELSIF (TG_OP = 'UPDATE') THEN
        INSERT INTO audit_log (user_id, action, resource_type, resource_id, details)
        VALUES (NEW.user_id, TG_OP, TG_TABLE_NAME, NEW.id, row_to_json(NEW));
        RETURN NEW;
    ELSIF (TG_OP = 'INSERT') THEN
        INSERT INTO audit_log (user_id, action, resource_type, resource_id, details)
        VALUES (NEW.user_id, TG_OP, TG_TABLE_NAME, NEW.id, row_to_json(NEW));
        RETURN NEW;
    END IF;
    RETURN NULL;
END;
\$\$ LANGUAGE plpgsql;

-- Create audit triggers for sensitive tables
-- Note: In a real implementation, you would add these to specific tables
-- CREATE TRIGGER audit_users_trigger AFTER INSERT OR UPDATE OR DELETE ON users FOR EACH ROW EXECUTE FUNCTION audit_trigger();
"

    if PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "$audit_trigger_sql"; then
        log_success "Audit triggers created"
    else
        log_warning "Failed to create audit triggers"
    fi
}

# Verify migration
verify_migration() {
    log_info "Verifying migration..."
    
    # Check if tables exist
    tables=("users" "tasks" "github_actions" "audit_log" "task_execution_log")
    
    for table in "${tables[@]}"; do
        if PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "SELECT COUNT(*) FROM $table;" >/dev/null 2>&1; then
            log_success "Table $table exists and is accessible"
        else
            log_error "Table $table verification failed"
            return 1
        fi
    done
    
    log_success "All tables verified successfully"
    return 0
}

# Main migration function
run_migration() {
    log_info "Starting database migration process..."
    
    # Create database and user
    create_database
    create_user
    
    # Apply schema
    if apply_migrations; then
        # Create audit triggers
        create_audit_triggers
        
        # Verify migration
        if verify_migration; then
            log_success "Database migration completed successfully!"
            echo ""
            echo "Database: $DB_NAME"
            echo "User: $DB_USER"
            echo "Host: $DB_HOST:$DB_PORT"
            return 0
        else
            log_error "Migration verification failed"
            return 1
        fi
    else
        log_error "Schema migration failed"
        return 1
    fi
}

# Rollback function
rollback_migration() {
    log_warning "Rollback functionality not implemented in this version"
    log_info "To rollback, you would need to:"
    echo "  1. Drop the database: DROP DATABASE $DB_NAME;"
    echo "  2. Drop the user: DROP USER $DB_USER;"
    echo "  3. Recreate from backup"
}

# Help function
show_help() {
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "Options:"
    echo "  --migrate     Run database migration (default)"
    echo "  --verify      Verify current database state"
    echo "  --rollback    Rollback migration (not implemented)"
    echo "  --help        Show this help message"
    echo ""
    echo "Environment Variables:"
    echo "  DB_HOST       Database host (default: localhost)"
    echo "  DB_PORT       Database port (default: 5432)"
    echo "  DB_NAME       Database name (default: task_queue)"
    echo "  DB_USER       Database user (default: task_queue_user)"
    echo "  DB_PASSWORD   Database password (default: secure_task_queue_password)"
}

# Main execution
main() {
    case "${1:---migrate}" in
        --migrate)
            if check_postgresql; then
                run_migration
            else
                log_error "Cannot proceed with migration due to PostgreSQL connection issues"
                exit 1
            fi
            ;;
        --verify)
            if check_postgresql; then
                verify_migration
            else
                log_error "Cannot verify due to PostgreSQL connection issues"
                exit 1
            fi
            ;;
        --rollback)
            rollback_migration
            ;;
        --help)
            show_help
            ;;
        *)
            log_error "Unknown option: $1"
            show_help
            exit 1
            ;;
    esac
}

# Run main function
main "$@"