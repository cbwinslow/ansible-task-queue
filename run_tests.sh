#!/bin/bash

# Test Runner for Ansible Task Queue System
# Runs all tests (Python, SQL, Bash) and generates coverage reports

set -e

echo "=== Ansible Task Queue Test Suite ==="
echo ""

# Configuration
TEST_DIR="/home/cbwinslow/ansible-task-queue"
PYTHON_TESTS=0
SQL_TESTS=0
BASH_TESTS=0
INTEGRATION_TESTS=0

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    local status="$1"
    local message="$2"
    
    case "$status" in
        "PASS")
            echo -e "${GREEN}✓ PASS:${NC} $message"
            ;;
        "FAIL")
            echo -e "${RED}✗ FAIL:${NC} $message"
            ;;
        "INFO")
            echo -e "${YELLOW}ℹ INFO:${NC} $message"
            ;;
        *)
            echo "$message"
            ;;
    esac
}

# Function to run Python tests
run_python_tests() {
    echo "=== Running Python Tests ==="
    
    cd "$TEST_DIR"
    
    # Check if pytest is available
    if ! command -v pytest >/dev/null 2>&1; then
        print_status "FAIL" "pytest not found. Installing..."
        pip install pytest pytest-cov >/dev/null 2>&1 || {
            print_status "FAIL" "Failed to install pytest"
            return 1
        }
    fi
    
    # Run unit tests
    echo "Running unit tests..."
    if pytest tests/unit/ -v --tb=short; then
        print_status "PASS" "Python unit tests completed"
        PYTHON_TESTS=1
    else
        print_status "FAIL" "Python unit tests failed"
        PYTHON_TESTS=0
    fi
    
    # Run integration tests
    echo "Running integration tests..."
    if pytest tests/integration/ -v --tb=short; then
        print_status "PASS" "Python integration tests completed"
        INTEGRATION_TESTS=1
    else
        print_status "FAIL" "Python integration tests failed"
        INTEGRATION_TESTS=0
    fi
    
    # Run with coverage
    echo "Running tests with coverage..."
    if pytest --cov=src --cov-report=term-missing tests/ >/dev/null 2>&1; then
        print_status "PASS" "Coverage report generated"
    else
        print_status "INFO" "Coverage report generation failed (continuing)"
    fi
    
    echo ""
}

# Function to run SQL tests
run_sql_tests() {
    echo "=== Running SQL Tests ==="
    
    cd "$TEST_DIR"
    
    # Check if PostgreSQL is available
    if ! command -v psql >/dev/null 2>&1; then
        print_status "FAIL" "PostgreSQL client (psql) not found"
        return 1
    fi
    
    # Check if test database exists, create if not
    if ! psql -h localhost -U postgres -lqt | cut -d \| -f 1 | grep -qw "test_task_queue"; then
        print_status "INFO" "Creating test database..."
        psql -h localhost -U postgres -c "CREATE DATABASE test_task_queue;" >/dev/null 2>&1 || {
            print_status "FAIL" "Failed to create test database"
            return 1
        }
    fi
    
    # Run SQL tests
    if tests/sql/test_database.sql; then
        print_status "PASS" "SQL tests completed"
        SQL_TESTS=1
    else
        print_status "FAIL" "SQL tests failed"
        SQL_TESTS=0
    fi
    
    echo ""
}

# Function to run Bash tests
run_bash_tests() {
    echo "=== Running Bash Tests ==="
    
    cd "$TEST_DIR"
    
    # Run Bash tests
    if tests/bash/test_scripts.sh; then
        print_status "PASS" "Bash tests completed"
        BASH_TESTS=1
    else
        print_status "FAIL" "Bash tests failed"
        BASH_TESTS=0
    fi
    
    echo ""
}

# Function to run setup validation
run_setup_validation() {
    echo "=== Running Setup Validation ==="
    
    cd "$TEST_DIR"
    
    local validation_passed=0
    
    # Check Python dependencies
    echo "Checking Python dependencies..."
    if pip check >/dev/null 2>&1; then
        print_status "PASS" "Python dependencies are consistent"
        validation_passed=$((validation_passed + 1))
    else
        print_status "FAIL" "Python dependency conflicts found"
    fi
    
    # Check required files
    echo "Checking required files..."
    local required_files=(
        "src/cli.py"
        "src/worker_daemon.py"
        "requirements.txt"
        "config/.env"
        "README.md"
    )
    
    local files_found=0
    for file in "${required_files[@]}"; do
        if [[ -f "$file" ]]; then
            files_found=$((files_found + 1))
        fi
    done
    
    if [[ $files_found -eq ${#required_files[@]} ]]; then
        print_status "PASS" "All required files present"
        validation_passed=$((validation_passed + 1))
    else
        print_status "FAIL" "Missing required files"
    fi
    
    # Check directory structure
    echo "Checking directory structure..."
    local required_dirs=(
        "src"
        "tests"
        "config"
        "playbooks"
        "scripts"
    )
    
    local dirs_found=0
    for dir in "${required_dirs[@]}"; do
        if [[ -d "$dir" ]]; then
            dirs_found=$((dirs_found + 1))
        fi
    done
    
    if [[ $dirs_found -eq ${#required_dirs[@]} ]]; then
        print_status "PASS" "Directory structure is correct"
        validation_passed=$((validation_passed + 1))
    else
        print_status "FAIL" "Directory structure issues"
    fi
    
    echo ""
    
    if [[ $validation_passed -eq 3 ]]; then
        return 0
    else
        return 1
    fi
}

# Function to generate test report
generate_test_report() {
    echo "=== Test Suite Summary ==="
    echo ""
    
    local total_suites=5
    local passed_suites=0
    
    if [[ $PYTHON_TESTS -eq 1 ]]; then
        print_status "PASS" "Python Unit Tests"
        passed_suites=$((passed_suites + 1))
    else
        print_status "FAIL" "Python Unit Tests"
    fi
    
    if [[ $INTEGRATION_TESTS -eq 1 ]]; then
        print_status "PASS" "Python Integration Tests"
        passed_suites=$((passed_suites + 1))
    else
        print_status "FAIL" "Python Integration Tests"
    fi
    
    if [[ $SQL_TESTS -eq 1 ]]; then
        print_status "PASS" "SQL Database Tests"
        passed_suites=$((passed_suites + 1))
    else
        print_status "FAIL" "SQL Database Tests"
    fi
    
    if [[ $BASH_TESTS -eq 1 ]]; then
        print_status "PASS" "Bash Script Tests"
        passed_suites=$((passed_suites + 1))
    else
        print_status "FAIL" "Bash Script Tests"
    fi
    
    if run_setup_validation; then
        print_status "PASS" "Setup Validation"
        passed_suites=$((passed_suites + 1))
    else
        print_status "FAIL" "Setup Validation"
    fi
    
    echo ""
    echo "Overall Results: $passed_suites/$total_suites test suites passed"
    
    if [[ $passed_suites -eq $total_suites ]]; then
        print_status "PASS" "🎉 All test suites passed!"
        echo ""
        echo "The Ansible Task Queue System is ready for production use."
        return 0
    else
        print_status "FAIL" "❌ Some test suites failed"
        echo ""
        echo "Please review the failed tests and fix the issues before deployment."
        return 1
    fi
}

# Main execution
main() {
    echo "Starting comprehensive test suite..."
    echo ""
    
    # Run all test suites
    run_python_tests
    run_sql_tests
    run_bash_tests
    
    # Generate final report
    generate_test_report
    
    # Return appropriate exit code
    if [[ $? -eq 0 ]]; then
        exit 0
    else
        exit 1
    fi
}

# Run main function
main