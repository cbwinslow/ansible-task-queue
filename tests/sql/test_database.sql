#!/bin/bash

# SQL Tests for Ansible Task Queue Database
# Tests database schema, functions, and constraints

set -e

echo "=== SQL Tests for Ansible Task Queue ==="
echo ""

# Database configuration
DB_NAME="test_task_queue"
DB_USER="postgres"
DB_PASSWORD="postgres"

# Test functions
TEST_FUNCTIONS=0
TEST_SCHEMA=0
TEST_CONSTRAINTS=0
TEST_QUERIES=0

# Function to run SQL test
run_sql_test() {
    local test_name="$1"
    local sql_query="$2"
    local expected_result="$3"
    
    echo "Running test: $test_name"
    
    # Run the SQL query
    result=$(psql -h localhost -U $DB_USER -d $DB_NAME -t -A -c "$sql_query" 2>/dev/null || echo "ERROR")
    
    if [[ "$result" != "ERROR" ]]; then
        echo "  ✓ PASS: $test_name"
        return 0
    else
        echo "  ✗ FAIL: $test_name"
        return 1
    fi
}

# Function to test table existence
test_table_exists() {
    local table_name="$1"
    local test_name="Table $table_name exists"
    
    echo "Running test: $test_name"
    
    result=$(psql -h localhost -U $DB_USER -d $DB_NAME -t -A -c "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = '$table_name');" 2>/dev/null)
    
    if [[ "$result" == "t" ]]; then
        echo "  ✓ PASS: $test_name"
        return 0
    else
        echo "  ✗ FAIL: $test_name"
        return 1
    fi
}

# Function to test column existence
test_column_exists() {
    local table_name="$1"
    local column_name="$2"
    local test_name="Column $table_name.$column_name exists"
    
    echo "Running test: $test_name"
    
    result=$(psql -h localhost -U $DB_USER -d $DB_NAME -t -A -c "SELECT EXISTS (SELECT FROM information_schema.columns WHERE table_name = '$table_name' AND column_name = '$column_name');" 2>/dev/null)
    
    if [[ "$result" == "t" ]]; then
        echo "  ✓ PASS: $test_name"
        return 0
    else
        echo "  ✗ FAIL: $test_name"
        return 1
    fi
}

# Function to test index existence
test_index_exists() {
    local index_name="$1"
    local test_name="Index $index_name exists"
    
    echo "Running test: $test_name"
    
    result=$(psql -h localhost -U $DB_USER -d $DB_NAME -t -A -c "SELECT EXISTS (SELECT FROM pg_indexes WHERE indexname = '$index_name');" 2>/dev/null)
    
    if [[ "$result" == "t" ]]; then
        echo "  ✓ PASS: $test_name"
        return 0
    else
        echo "  ✗ FAIL: $test_name"
        return 1
    fi
}

# Function to test function existence
test_function_exists() {
    local function_name="$1"
    local test_name="Function $function_name exists"
    
    echo "Running test: $test_name"
    
    result=$(psql -h localhost -U $DB_USER -d $DB_NAME -t -A -c "SELECT EXISTS (SELECT FROM pg_proc WHERE proname = '$function_name');" 2>/dev/null)
    
    if [[ "$result" == "t" ]]; then
        echo "  ✓ PASS: $test_name"
        return 0
    else
        echo "  ✗ FAIL: $test_name"
        return 1
    fi
}

# Main test execution
main() {
    echo "Starting SQL tests..."
    echo ""
    
    # Test 1: Database connection and basic setup
    echo "Test 1: Database Connection"
    if psql -h localhost -U $DB_USER -d $DB_NAME -c "SELECT 1;" >/dev/null 2>&1; then
        echo "  ✓ PASS: Database connection successful"
        TEST_SCHEMA=$((TEST_SCHEMA + 1))
    else
        echo "  ✗ FAIL: Database connection failed"
        exit 1
    fi
    echo ""
    
    # Test 2: Task queue table structure
    echo "Test 2: Task Queue Table Structure"
    test_table_exists "task_queue"
    TEST_SCHEMA=$((TEST_SCHEMA + $?))
    
    test_column_exists "task_queue" "id"
    TEST_SCHEMA=$((TEST_SCHEMA + $?))
    
    test_column_exists "task_queue" "task_name"
    TEST_SCHEMA=$((TEST_SCHEMA + $?))
    
    test_column_exists "task_queue" "status"
    TEST_SCHEMA=$((TEST_SCHEMA + $?))
    
    test_column_exists "task_queue" "created_at"
    TEST_SCHEMA=$((TEST_SCHEMA + $?))
    echo ""
    
    # Test 3: Audit log table structure
    echo "Test 3: Audit Log Table Structure"
    test_table_exists "task_audit_log"
    TEST_SCHEMA=$((TEST_SCHEMA + $?))
    
    test_column_exists "task_audit_log" "task_id"
    TEST_SCHEMA=$((TEST_SCHEMA + $?))
    
    test_column_exists "task_audit_log" "action"
    TEST_SCHEMA=$((TEST_SCHEMA + $?))
    
    test_column_exists "task_audit_log" "timestamp"
    TEST_SCHEMA=$((TEST_SCHEMA + $?))
    echo ""
    
    # Test 4: Indexes
    echo "Test 4: Database Indexes"
    test_index_exists "idx_task_queue_status"
    TEST_SCHEMA=$((TEST_SCHEMA + $?))
    
    test_index_exists "idx_task_queue_priority"
    TEST_SCHEMA=$((TEST_SCHEMA + $?))
    
    test_index_exists "idx_task_audit_log_task_id"
    TEST_SCHEMA=$((TEST_SCHEMA + $?))
    echo ""
    
    # Test 5: Functions
    echo "Test 5: Database Functions"
    test_function_exists "get_next_task"
    TEST_FUNCTIONS=$((TEST_FUNCTIONS + $?))
    
    test_function_exists "update_task_status"
    TEST_FUNCTIONS=$((TEST_FUNCTIONS + $?))
    
    # Test 6: Views
    echo "Test 6: Database Views"
    test_table_exists "task_summary"
    TEST_SCHEMA=$((TEST_SCHEMA + $?))
    echo ""
    
    # Test 7: Data integrity tests
    echo "Test 7: Data Integrity"
    
    # Test inserting a task
    echo "Running test: Insert task"
    result=$(psql -h localhost -U $DB_USER -d $DB_NAME -t -A -c "INSERT INTO task_queue (task_name, status) VALUES ('test_task', 'pending') RETURNING id;" 2>/dev/null)
    if [[ "$result" != "" && "$result" != "ERROR" ]]; then
        echo "  ✓ PASS: Insert task"
        task_id=$result
        
        # Test updating task status
        echo "Running test: Update task status"
        result=$(psql -h localhost -U $DB_USER -d $DB_NAME -t -A -c "SELECT update_task_status($task_id, 'running', 'Test result');" 2>/dev/null)
        if [[ "$result" != "ERROR" ]]; then
            echo "  ✓ PASS: Update task status"
            TEST_QUERIES=$((TEST_QUERIES + 1))
        else
            echo "  ✗ FAIL: Update task status"
        fi
        
        # Test getting next task
        echo "Running test: Get next task"
        result=$(psql -h localhost -U $DB_USER -d $DB_NAME -t -A -c "SELECT * FROM get_next_task();" 2>/dev/null)
        if [[ "$result" != "ERROR" ]]; then
            echo "  ✓ PASS: Get next task"
            TEST_QUERIES=$((TEST_QUERIES + 1))
        else
            echo "  ✗ FAIL: Get next task"
        fi
        
    else
        echo "  ✗ FAIL: Insert task"
    fi
    echo ""
    
    # Test 8: Constraints and validations
    echo "Test 8: Constraints and Validations"
    
    # Test that task_name is required
    echo "Running test: Task name required"
    result=$(psql -h localhost -U $DB_USER -d $DB_NAME -t -A -c "INSERT INTO task_queue (status) VALUES ('pending');" 2>&1)
    if [[ "$result" == *"null value in column \"task_name\" violates not-null constraint"* ]]; then
        echo "  ✓ PASS: Task name required constraint"
        TEST_CONSTRAINTS=$((TEST_CONSTRAINTS + 1))
    else
        echo "  ✗ FAIL: Task name required constraint"
    fi
    
    # Test default values
    echo "Running test: Default values"
    result=$(psql -h localhost -U $DB_USER -d $DB_NAME -t -A -c "INSERT INTO task_queue (task_name) VALUES ('default_test') RETURNING status, priority;" 2>/dev/null)
    if [[ "$result" == "pending|100" ]]; then
        echo "  ✓ PASS: Default values"
        TEST_CONSTRAINTS=$((TEST_CONSTRAINTS + 1))
    else
        echo "  ✗ FAIL: Default values"
    fi
    echo ""
    
    # Summary
    echo "=== SQL Test Summary ==="
    echo "Schema Tests: $TEST_SCHEMA/8 passed"
    echo "Function Tests: $TEST_FUNCTIONS/2 passed"
    echo "Constraint Tests: $TEST_CONSTRAINTS/2 passed"
    echo "Query Tests: $TEST_QUERIES/2 passed"
    
    total_tests=14
    passed_tests=$((TEST_SCHEMA + TEST_FUNCTIONS + TEST_CONSTRAINTS + TEST_QUERIES))
    
    echo ""
    echo "Overall: $passed_tests/$total_tests tests passed"
    
    if [[ $passed_tests -eq $total_tests ]]; then
        echo "🎉 All SQL tests passed!"
        exit 0
    else
        echo "❌ Some tests failed"
        exit 1
    fi
}

# Run tests
main