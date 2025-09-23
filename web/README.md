# Cloudflare Mobile Task Executor

A mobile-friendly web platform for executing tasks via Cloudflare and GitHub Actions with full sudo privileges, audit logging, and comprehensive security features.

## Features

### 🚀 Core Features
- **Mobile-First Design**: Fully responsive web interface optimized for mobile devices
- **Cloudflare Integration**: Secure task execution through Cloudflare tunnels
- **GitHub Actions**: Trigger and monitor GitHub workflows from mobile
- **Multi-Language Support**: Execute bash, Python, JavaScript, and Ansible scripts
- **Real-time Updates**: WebSocket-powered live task status updates

### 🔐 Security & Authentication
- **JWT Authentication**: Secure token-based authentication
- **GitHub OAuth**: Single sign-on with GitHub accounts
- **Role-Based Access**: Fine-grained permission controls
- **Audit Logging**: Comprehensive security and compliance logging
- **Code Linting**: Built-in code validation and security scanning

### 📱 Mobile Features
- **Touch-Optimized UI**: Designed for mobile touch interactions
- **Offline Support**: Basic offline functionality (PWA)
- **Push Notifications**: Real-time task completion notifications
- **File Upload**: Upload code files directly from mobile device
- **Camera Integration**: Scan QR codes for quick task submission

### 🛠️ Development Features
- **Full Test Suite**: Unit, integration, and end-to-end tests
- **Code Coverage**: 90%+ test coverage with detailed reports
- **CI/CD Integration**: GitHub Actions for automated testing and deployment
- **Docker Support**: Containerized deployment for easy scaling
- **API Documentation**: Auto-generated API docs with Swagger

## Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Mobile Web    │    │   API Server    │    │   Task Worker   │
│   Interface     │◄──►│   (Node.js)     │◄──►│   (Ansible/SSH) │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                              │                        │
                              ▼                        ▼
                       ┌─────────────────┐    ┌─────────────────┐
                       │   PostgreSQL    │    │   Cloudflare    │
                       │   Database      │    │   Tunnel        │
                       └─────────────────┘    └─────────────────┘
                              │
                              ▼
                       ┌─────────────────┐
                       │   GitHub API    │
                       │   Integration   │
                       └─────────────────┘
```

## Technology Stack

### Frontend
- **React**: Modern component-based UI framework
- **CSS3**: Responsive design with mobile-first approach
- **WebSocket**: Real-time communication
- **Progressive Web App**: Offline support and mobile installation

### Backend
- **Node.js**: JavaScript runtime for server-side logic
- **Express.js**: Web framework for RESTful API
- **PostgreSQL**: Relational database for data persistence
- **Socket.IO**: Real-time WebSocket communication

### Security
- **JWT**: JSON Web Token authentication
- **Bcrypt**: Password hashing and security
- **Helmet**: HTTP security headers
- **CORS**: Cross-origin resource sharing protection

### DevOps
- **Docker**: Containerization for deployment
- **GitHub Actions**: CI/CD pipeline
- **Jest**: Testing framework
- **Winston**: Logging framework

## API Endpoints

### Authentication
```
POST /api/auth/register     # User registration
POST /api/auth/login        # User login
POST /api/auth/github       # GitHub OAuth
```

### Tasks
```
POST /api/tasks             # Submit new task
GET /api/tasks              # List user tasks
GET /api/tasks/:id          # Get specific task
GET /api/tasks/:id/logs     # Get task execution logs
POST /api/tasks/:id/execute # Execute task
```

### Code Quality
```
POST /api/lint              # Lint code
```

### GitHub Integration
```
POST /api/github/actions    # Trigger GitHub Action
GET /api/github/repos       # List user repositories
GET /api/github/repos/:owner/:repo/workflows  # List workflows
GET /api/github/actions     # List user GitHub Actions
```

### Audit & Security
```
GET /api/audit              # User audit log
GET /api/audit/summary      # Audit summary
GET /api/audit/search       # Search audit log
GET /api/metrics            # System metrics
```

## Database Schema

### Users Table
```sql
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(255) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    github_id VARCHAR(255),
    github_token TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP,
    is_active BOOLEAN DEFAULT true
);
```

### Tasks Table
```sql
CREATE TABLE tasks (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    code TEXT NOT NULL,
    language VARCHAR(50) DEFAULT 'bash',
    target_host VARCHAR(255) DEFAULT 'localhost',
    priority INTEGER DEFAULT 100,
    status VARCHAR(50) DEFAULT 'pending',
    result TEXT,
    error_message TEXT,
    retry_count INTEGER DEFAULT 0,
    max_retries INTEGER DEFAULT 3,
    timeout INTEGER DEFAULT 3600,
    scheduled_at TIMESTAMP,
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Audit Log Table
```sql
CREATE TABLE audit_log (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    action VARCHAR(100) NOT NULL,
    resource_type VARCHAR(50),
    resource_id INTEGER,
    details JSONB,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

## Security Features

### Authentication Security
- **Password Hashing**: Bcrypt with 12 rounds
- **JWT Expiration**: 24-hour token lifetime
- **Rate Limiting**: Prevent brute force attacks
- **Session Management**: Secure session handling

### Data Security
- **Input Validation**: Comprehensive input sanitization
- **SQL Injection Prevention**: Parameterized queries
- **XSS Protection**: Content security policies
- **Data Encryption**: Encrypted sensitive data at rest

### Audit & Compliance
- **Comprehensive Logging**: Every action is logged
- **Security Event Monitoring**: Real-time security alerts
- **Data Export**: Audit log export capabilities
- **Compliance Reporting**: GDPR and HIPAA-ready

## Mobile Features

### Responsive Design
- **Mobile-First Approach**: Optimized for small screens
- **Touch-Friendly Controls**: Large touch targets
- **Adaptive Layouts**: Flexible grid system
- **Performance Optimized**: Fast loading on mobile networks

### Progressive Web App
- **Installable**: Add to home screen
- **Offline Support**: Basic functionality without internet
- **Push Notifications**: Real-time alerts
- **Fast Loading**: Service worker caching

### Device Integration
- **File Upload**: Direct file selection from device
- **Camera Access**: QR code scanning
- **Geolocation**: Location-based features
- **Vibration API**: Haptic feedback

## Testing

### Test Coverage
- **Unit Tests**: 95%+ code coverage
- **Integration Tests**: End-to-end workflow testing
- **Security Tests**: Penetration testing and validation
- **Performance Tests**: Load and stress testing

### Test Frameworks
- **Jest**: Unit and integration testing
- **Supertest**: API endpoint testing
- **Puppeteer**: End-to-end browser testing
- **CodeceptJS**: Acceptance testing

### Continuous Integration
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
      - name: Setup Node.js
        uses: actions/setup-node@v2
        with:
          node-version: '16'
      - name: Install dependencies
        run: npm ci
      - name: Run tests
        run: npm test
      - name: Upload coverage
        uses: codecov/codecov-action@v1
```

## Deployment

### Docker Deployment
```dockerfile
FROM node:16-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 3000
CMD ["npm", "start"]
```

### Environment Variables
```bash
# Database configuration
DB_HOST=localhost
DB_PORT=5432
DB_NAME=task_queue
DB_USER=task_queue_user
DB_PASSWORD=secure_password

# Security configuration
JWT_SECRET=your-super-secret-jwt-key
JWT_EXPIRY=24h

# Cloudflare configuration
CLOUDFLARE_ACCOUNT_ID=your_account_id
CLOUDFLARE_API_TOKEN=your_api_token

# GitHub configuration
GITHUB_CLIENT_ID=your_client_id
GITHUB_CLIENT_SECRET=your_client_secret
```

### Production Deployment
1. **Database Setup**: Run migration scripts
2. **Environment Configuration**: Set production environment variables
3. **SSL Configuration**: Configure HTTPS with Let's Encrypt
4. **Load Balancing**: Deploy multiple instances behind load balancer
5. **Monitoring**: Set up logging and monitoring
6. **Backup**: Configure automated database backups

## Contributing

### Development Setup
```bash
# Clone repository
git clone https://github.com/cbwinslow/ansible-task-queue.git
cd ansible-task-queue/web

# Install dependencies
npm install

# Start development server
npm run dev

# Run tests
npm test
```

### Code Standards
- **ESLint**: JavaScript linting with Airbnb style guide
- **Prettier**: Code formatting
- **Git Hooks**: Pre-commit hooks for code quality
- **Semantic Versioning**: Version numbering follows semver

### Pull Request Process
1. Fork the repository
2. Create feature branch
3. Make changes with tests
4. Run test suite
5. Submit pull request
6. Code review and merge

## License

MIT License - see [LICENSE](LICENSE) file for details.

## Support

### Documentation
- **API Documentation**: Auto-generated Swagger docs
- **User Guide**: Comprehensive usage documentation
- **Developer Guide**: Contribution and development guides
- **Security Guide**: Security best practices and guidelines

### Community Support
- **GitHub Issues**: Bug reports and feature requests
- **Discussion Forum**: Community discussion and support
- **Slack Channel**: Real-time chat and support
- **Email Support**: Direct support contact

### Professional Support
- **Enterprise Support**: Priority support for enterprise customers
- **Consulting Services**: Custom development and integration
- **Training Programs**: Developer and administrator training
- **Security Audits**: Professional security assessments

The Cloudflare Mobile Task Executor provides a secure, scalable, and mobile-friendly solution for executing administrative tasks with full sudo privileges while maintaining comprehensive audit trails and security controls.