# Test Suite Documentation

## Overview

The Ansible Task Queue System includes a comprehensive test suite covering all aspects of the system:

- **Unit Tests**: Individual component testing
- **Integration Tests**: End-to-end workflow testing
- **SQL Tests**: Database schema and function validation
- **Bash Tests**: Shell script and system integration testing
- **Setup Validation**: Environment and dependency verification

## Test Directory Structure

```
tests/
├── unit/              # Python unit tests
│   ├── test_config_models.py
│   ├── test_database.py
│   ├── test_security.py
│   ├── test_task_service.py
│   └── ...
├── integration/       # Python integration tests
│   └── test_workflow.py
├── sql/              # SQL database tests
│   └── test_database.sql
├── bash/             # Bash script tests
│   └── test_scripts.sh
├── requirements.txt   # Test dependencies
└── run_tests.sh      # Test runner script
```

## Running Tests

### Quick Test Run
```bash
# Run all tests
./run_tests.sh
```

### Individual Test Suites

#### Python Tests
```bash
# Run unit tests
pytest tests/unit/

# Run integration tests
pytest tests/integration/

# Run with coverage
pytest --cov=src tests/
```

#### SQL Tests
```bash
# Run database tests
./tests/sql/test_database.sql
```

#### Bash Tests
```bash
# Run script tests
./tests/bash/test_scripts.sh
```

## Test Coverage

### Python Tests
- **Configuration Management**: Settings validation and defaults
- **Database Operations**: Connection, queries, and transactions
- **Security Functions**: Authentication, authorization, and encryption
- **Task Service**: Task creation, retrieval, and management
- **Worker Functionality**: Task processing and execution

### SQL Tests
- **Schema Validation**: Table structures and constraints
- **Function Testing**: Custom PostgreSQL functions
- **Index Verification**: Performance optimization indexes
- **Data Integrity**: Insert, update, and constraint validation
- **View Testing**: Summary and reporting views

### Bash Tests
- **File System**: Directory and file existence
- **Command Availability**: Required system commands
- **Script Permissions**: Executable file validation
- **Integration Points**: System integration verification
- **Setup Validation**: Environment configuration

## Test Categories

### Unit Tests
Focus on individual components and functions:
- Model validation
- Configuration parsing
- Database connection management
- Security function implementation
- Service layer operations

### Integration Tests
Test component interaction and workflows:
- Task creation to execution flow
- Database to service layer integration
- Worker processing workflows
- Authentication and authorization flows
- Error handling and recovery

### System Tests
End-to-end system validation:
- Complete task lifecycle
- Database schema integrity
- Script execution environments
- Security boundary testing
- Performance benchmarks

## Continuous Integration

The test suite is designed for CI/CD integration:

### GitHub Actions
```yaml
name: Tests
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:13
        env:
          POSTGRES_PASSWORD: postgres
    steps:
      - uses: actions/checkout@v2
      - name: Set up Python
        uses: actions/setup-python@v2
      - name: Install dependencies
        run: |
          pip install -r requirements.txt
          pip install -r tests/requirements.txt
      - name: Run tests
        run: ./run_tests.sh
```

## Test Data Management

### Fixtures
Test data is managed through:
- **Mock Objects**: Unit test isolation
- **Temporary Databases**: SQL test isolation
- **Sample Playbooks**: Ansible integration testing
- **Test Configuration**: Environment isolation

### Database Testing
- **Test Database**: Separate database for testing
- **Schema Setup**: Automated test database creation
- **Data Cleanup**: Automatic test data cleanup
- **Performance Testing**: Load and stress testing

## Test Reporting

### Output Formats
- **Console**: Human-readable test results
- **JUnit**: CI/CD integration format
- **HTML**: Detailed test reports
- **Coverage**: Code coverage reports

### Metrics Tracked
- **Test Execution Time**: Performance monitoring
- **Code Coverage**: Test completeness
- **Failure Rates**: Quality metrics
- **Performance Benchmarks**: System optimization

## Development Workflow

### Adding New Tests
1. **Identify Test Category**: Unit, integration, or system
2. **Create Test File**: Following naming conventions
3. **Write Test Cases**: Covering all scenarios
4. **Run Tests**: Verify new tests pass
5. **Update Documentation**: Keep docs current

### Test Maintenance
- **Regular Updates**: Keep tests current with code changes
- **Performance Monitoring**: Track test execution times
- **Coverage Analysis**: Maintain high coverage levels
- **Flakey Test Management**: Identify and fix unreliable tests

## Best Practices

### Test Design
- **Isolation**: Tests should not depend on each other
- **Repeatability**: Tests should produce consistent results
- **Speed**: Tests should execute quickly
- **Clarity**: Test names and assertions should be clear

### Code Coverage
- **Target**: 90%+ code coverage
- **Critical Paths**: 100% coverage for security and core functions
- **Edge Cases**: Comprehensive edge case testing
- **Error Conditions**: Thorough error handling validation

This comprehensive test suite ensures the reliability, security, and performance of the Ansible Task Queue System.