#!/bin/bash

# Bash Tests for Ansible Task Queue System
# Tests shell scripts, system integration, and command-line functionality

set -e

echo "=== Bash Tests for Ansible Task Queue ==="
echo ""

# Test configuration
TEST_DIR="/home/cbwinslow/ansible-task-queue"
TEST_SCRIPTS=0
TEST_CLI=0
TEST_INTEGRATION=0
TEST_SETUP=0

# Function to run bash test
run_bash_test() {
    local test_name="$1"
    local test_command="$2"
    
    echo "Running test: $test_name"
    
    if eval "$test_command" >/dev/null 2>&1; then
        echo "  ✓ PASS: $test_name"
        return 0
    else
        echo "  ✗ FAIL: $test_name"
        return 1
    fi
}

# Function to test file existence
test_file_exists() {
    local file_path="$1"
    local test_name="File $file_path exists"
    
    echo "Running test: $test_name"
    
    if [[ -f "$file_path" ]]; then
        echo "  ✓ PASS: $test_name"
        return 0
    else
        echo "  ✗ FAIL: $test_name"
        return 1
    fi
}

# Function to test directory existence
test_directory_exists() {
    local dir_path="$1"
    local test_name="Directory $dir_path exists"
    
    echo "Running test: $test_name"
    
    if [[ -d "$dir_path" ]]; then
        echo "  ✓ PASS: $test_name"
        return 0
    else
        echo "  ✗ FAIL: $test_name"
        return 1
    fi
}

# Function to test command availability
test_command_available() {
    local command_name="$1"
    local test_name="Command $command_name available"
    
    echo "Running test: $test_name"
    
    if command -v "$command_name" >/dev/null 2>&1; then
        echo "  ✓ PASS: $test_name"
        return 0
    else
        echo "  ✗ FAIL: $test_name"
        return 1
    fi
}

# Main test execution
main() {
    echo "Starting Bash tests..."
    echo ""
    
    # Test 1: Directory structure
    echo "Test 1: Directory Structure"
    test_directory_exists "$TEST_DIR/src"
    TEST_SETUP=$((TEST_SETUP + $?))
    
    test_directory_exists "$TEST_DIR/tests"
    TEST_SETUP=$((TEST_SETUP + $?))
    
    test_directory_exists "$TEST_DIR/config"
    TEST_SETUP=$((TEST_SETUP + $?))
    
    test_directory_exists "$TEST_DIR/playbooks"
    TEST_SETUP=$((TEST_SETUP + $?))
    echo ""
    
    # Test 2: Essential files
    echo "Test 2: Essential Files"
    test_file_exists "$TEST_DIR/src/cli.py"
    TEST_SETUP=$((TEST_SETUP + $?))
    
    test_file_exists "$TEST_DIR/src/worker_daemon.py"
    TEST_SETUP=$((TEST_SETUP + $?))
    
    test_file_exists "$TEST_DIR/requirements.txt"
    TEST_SETUP=$((TEST_SETUP + $?))
    
    test_file_exists "$TEST_DIR/README.md"
    TEST_SETUP=$((TEST_SETUP + $?))
    echo ""
    
    # Test 3: Command availability
    echo "Test 3: Command Availability"
    test_command_available "python3"
    TEST_SETUP=$((TEST_SETUP + $?))
    
    test_command_available "psql"
    TEST_SETUP=$((TEST_SETUP + $?))
    
    test_command_available "ansible"
    TEST_SETUP=$((TEST_SETUP + $?))
    echo ""
    
    # Test 4: Script permissions
    echo "Test 4: Script Permissions"
    test_file_exists "$TEST_DIR/scripts/setup_database.sh"
    if [[ -f "$TEST_DIR/scripts/setup_database.sh" ]]; then
        if [[ -x "$TEST_DIR/scripts/setup_database.sh" ]]; then
            echo "  ✓ PASS: setup_database.sh is executable"
            TEST_SCRIPTS=$((TEST_SCRIPTS + 1))
        else
            echo "  ✗ FAIL: setup_database.sh is not executable"
        fi
    else
        echo "  ✗ FAIL: setup_database.sh not found"
    fi
    echo ""
    
    # Test 5: Python module imports
    echo "Test 5: Python Module Imports"
    
    echo "Running test: Core modules import"
    if cd "$TEST_DIR" && python3 -c "import src.core.config; import src.core.database" 2>/dev/null; then
        echo "  ✓ PASS: Core modules import"
        TEST_CLI=$((TEST_CLI + 1))
    else
        echo "  ✗ FAIL: Core modules import"
    fi
    
    echo "Running test: Model modules import"
    if cd "$TEST_DIR" && python3 -c "import src.models.task" 2>/dev/null; then
        echo "  ✓ PASS: Model modules import"
        TEST_CLI=$((TEST_CLI + 1))
    else
        echo "  ✗ FAIL: Model modules import"
    fi
    
    echo "Running test: Service modules import"
    if cd "$TEST_DIR" && python3 -c "import src.services.task_service" 2>/dev/null; then
        echo "  ✓ PASS: Service modules import"
        TEST_CLI=$((TEST_CLI + 1))
    else
        echo "  ✗ FAIL: Service modules import"
    fi
    echo ""
    
    # Test 6: CLI functionality
    echo "Test 6: CLI Functionality"
    
    echo "Running test: CLI help command"
    if cd "$TEST_DIR" && python3 src/cli.py --help 2>/dev/null; then
        echo "  ✓ PASS: CLI help command"
        TEST_CLI=$((TEST_CLI + 1))
    else
        echo "  ✗ FAIL: CLI help command"
    fi
    
    echo "Running test: CLI version check"
    if cd "$TEST_DIR" && python3 src/cli.py --help 2>&1 | grep -q "Ansible Task Queue CLI"; then
        echo "  ✓ PASS: CLI identification"
        TEST_CLI=$((TEST_CLI + 1))
    else
        echo "  ✗ FAIL: CLI identification"
    fi
    echo ""
    
    # Test 7: Configuration files
    echo "Test 7: Configuration Files"
    test_file_exists "$TEST_DIR/config/.env"
    TEST_SETUP=$((TEST_SETUP + $?))
    
    test_file_exists "$TEST_DIR/config/ansible.cfg"
    TEST_SETUP=$((TEST_SETUP + $?))
    
    test_file_exists "$TEST_DIR/config/inventory"
    TEST_SETUP=$((TEST_SETUP + $?))
    echo ""
    
    # Test 8: Integration tests
    echo "Test 8: Integration Tests"
    
    echo "Running test: Requirements file format"
    if cd "$TEST_DIR" && head -1 requirements.txt | grep -q "psycopg2-binary"; then
        echo "  ✓ PASS: Requirements file format"
        TEST_INTEGRATION=$((TEST_INTEGRATION + 1))
    else
        echo "  ✗ FAIL: Requirements file format"
    fi
    
    echo "Running test: Setup script syntax"
    if cd "$TEST_DIR" && bash -n scripts/setup_database.sh 2>/dev/null; then
        echo "  ✓ PASS: Setup script syntax"
        TEST_INTEGRATION=$((TEST_INTEGRATION + 1))
    else
        echo "  ✗ FAIL: Setup script syntax"
    fi
    
    echo "Running test: Playbook file existence"
    test_file_exists "$TEST_DIR/playbooks/examples.yml"
    TEST_INTEGRATION=$((TEST_INTEGRATION + $?))
    echo ""
    
    # Summary
    echo "=== Bash Test Summary ==="
    echo "Setup Tests: $TEST_SETUP/12 passed"
    echo "Script Tests: $TEST_SCRIPTS/1 passed"
    echo "CLI Tests: $TEST_CLI/5 passed"
    echo "Integration Tests: $TEST_INTEGRATION/3 passed"
    
    total_tests=21
    passed_tests=$((TEST_SETUP + TEST_SCRIPTS + TEST_CLI + TEST_INTEGRATION))
    
    echo ""
    echo "Overall: $passed_tests/$total_tests tests passed"
    
    if [[ $passed_tests -eq $total_tests ]]; then
        echo "🎉 All Bash tests passed!"
        exit 0
    else
        echo "❌ Some tests failed"
        exit 1
    fi
}

# Run tests
main