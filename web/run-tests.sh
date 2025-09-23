#!/bin/bash

# Test Runner Script for Cloudflare Mobile Task Executor
# Runs all tests (unit, integration, and end-to-end)

set -e

echo "=== Cloudflare Mobile Task Executor Test Suite ==="
echo ""

# Configuration
TEST_DIR="/home/cbwinslow/ansible-task-queue/web"
UNIT_TESTS=0
INTEGRATION_TESTS=0
COVERAGE_TESTS=0
E2E_TESTS=0

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

# Function to run unit tests
run_unit_tests() {
    echo "=== Running Unit Tests ==="
    
    cd "$TEST_DIR"
    
    if npm test -- --testPathPattern=tests/unit --passWithNoTests; then
        log_success "Unit tests completed successfully"
        UNIT_TESTS=1
    else
        log_error "Unit tests failed"
        UNIT_TESTS=0
    fi
    
    echo ""
}

# Function to run integration tests
run_integration_tests() {
    echo "=== Running Integration Tests ==="
    
    cd "$TEST_DIR"
    
    if npm test -- --testPathPattern=tests/integration --passWithNoTests; then
        log_success "Integration tests completed successfully"
        INTEGRATION_TESTS=1
    else
        log_error "Integration tests failed"
        INTEGRATION_TESTS=0
    fi
    
    echo ""
}

# Function to run coverage tests
run_coverage_tests() {
    echo "=== Running Coverage Tests ==="
    
    cd "$TEST_DIR"
    
    if npm test -- --coverage --passWithNoTests; then
        log_success "Coverage tests completed successfully"
        COVERAGE_TESTS=1
        
        # Display coverage summary
        if [[ -f "coverage/lcov-report/index.html" ]]; then
            log_info "Coverage report available at: coverage/lcov-report/index.html"
        fi
    else
        log_error "Coverage tests failed"
        COVERAGE_TESTS=0
    fi
    
    echo ""
}

# Function to run end-to-end tests
run_e2e_tests() {
    echo "=== Running End-to-End Tests ==="
    
    cd "$TEST_DIR"
    
    # Check if we have end-to-end tests
    if [[ -d "tests/e2e" ]] && [[ -n "$(ls -A tests/e2e)" ]]; then
        if npm run test:e2e -- --passWithNoTests 2>/dev/null; then
            log_success "End-to-end tests completed successfully"
            E2E_TESTS=1
        else
            log_warning "End-to-end tests not configured or failed"
            E2E_TESTS=0
        fi
    else
        log_info "No end-to-end tests found, skipping..."
        E2E_TESTS=1
    fi
    
    echo ""
}

# Function to check test dependencies
check_dependencies() {
    echo "=== Checking Test Dependencies ==="
    
    # Check if npm is available
    if ! command -v npm >/dev/null 2>&1; then
        log_error "npm not found. Please install Node.js and npm."
        return 1
    fi
    
    # Check if jest is available
    if ! command -v jest >/dev/null 2>&1; then
        log_info "Installing test dependencies..."
        cd "$TEST_DIR"
        if npm install; then
            log_success "Test dependencies installed"
        else
            log_error "Failed to install test dependencies"
            return 1
        fi
    fi
    
    log_success "All dependencies are available"
    echo ""
    return 0
}

# Function to generate test report
generate_test_report() {
    echo "=== Test Suite Summary ==="
    echo ""
    
    local total_suites=4
    local passed_suites=0
    
    if [[ $UNIT_TESTS -eq 1 ]]; then
        log_success "Unit Tests"
        passed_suites=$((passed_suites + 1))
    else
        log_error "Unit Tests"
    fi
    
    if [[ $INTEGRATION_TESTS -eq 1 ]]; then
        log_success "Integration Tests"
        passed_suites=$((passed_suites + 1))
    else
        log_error "Integration Tests"
    fi
    
    if [[ $COVERAGE_TESTS -eq 1 ]]; then
        log_success "Coverage Tests"
        passed_suites=$((passed_suites + 1))
    else
        log_error "Coverage Tests"
    fi
    
    if [[ $E2E_TESTS -eq 1 ]]; then
        log_success "End-to-End Tests"
        passed_suites=$((passed_suites + 1))
    else
        log_error "End-to-End Tests"
    fi
    
    echo ""
    echo "Overall Results: $passed_suites/$total_suites test suites passed"
    
    if [[ $passed_suites -eq $total_suites ]]; then
        log_success "🎉 All test suites passed!"
        echo ""
        echo "The Cloudflare Mobile Task Executor is ready for deployment."
        return 0
    else
        log_error "❌ Some test suites failed"
        echo ""
        echo "Please review the failed tests and fix the issues before deployment."
        return 1
    fi
}

# Function to run specific test suite
run_specific_suite() {
    local suite="$1"
    
    case "$suite" in
        "unit")
            run_unit_tests
            ;;
        "integration")
            run_integration_tests
            ;;
        "coverage")
            run_coverage_tests
            ;;
        "e2e")
            run_e2e_tests
            ;;
        *)
            log_error "Unknown test suite: $suite"
            echo "Available suites: unit, integration, coverage, e2e"
            return 1
            ;;
    esac
}

# Function to show help
show_help() {
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "Options:"
    echo "  --all          Run all test suites (default)"
    echo "  --unit         Run unit tests only"
    echo "  --integration  Run integration tests only"
    echo "  --coverage     Run coverage tests only"
    echo "  --e2e          Run end-to-end tests only"
    echo "  --help         Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0 --all       # Run all tests"
    echo "  $0 --unit      # Run unit tests only"
    echo "  $0 --coverage  # Run coverage analysis"
}

# Main execution
main() {
    local run_all=true
    local specific_suite=""
    
    # Parse command line arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            --all)
                run_all=true
                shift
                ;;
            --unit|--integration|--coverage|--e2e)
                run_all=false
                specific_suite="${1#--}"
                shift
                ;;
            --help)
                show_help
                exit 0
                ;;
            *)
                log_error "Unknown option: $1"
                show_help
                exit 1
                ;;
        esac
    done
    
    echo "Starting test suite execution..."
    echo ""
    
    # Check dependencies
    if ! check_dependencies; then
        exit 1
    fi
    
    # Run tests
    if [[ "$run_all" == true ]]; then
        run_unit_tests
        run_integration_tests
        run_coverage_tests
        run_e2e_tests
        generate_test_report
    else
        run_specific_suite "$specific_suite"
    fi
}

# Run main function
main "$@"