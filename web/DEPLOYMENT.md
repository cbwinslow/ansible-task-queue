# Deployment Documentation

## Overview

This deployment documentation provides comprehensive guidance for deploying the Cloudflare Mobile Task Executor platform in various environments. The platform supports multiple deployment strategies including Docker, Kubernetes, bare metal, and cloud provider integrations.

## Deployment Architecture

### System Components

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Load Balancer │    │   Web Servers   │    │   Database      │
│   (Cloudflare)  │◄──►│   (Node.js)     │◄──►│   (PostgreSQL)  │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                              │                        │
                              ▼                        ▼
                       ┌─────────────────┐    ┌─────────────────┐
                       │   Monitoring    │    │   Logging       │
                       │   (Prometheus)  │    │   (ELK Stack)   │
                       └─────────────────┘    └─────────────────┘
                              │
                              ▼
                       ┌─────────────────┐
                       │   CI/CD         │
                       │   (GitHub)      │
                       └─────────────────┘
```

### Microservices Architecture

#### Core Services
1. **API Gateway**: Entry point for all API requests
2. **Task Executor**: Core task execution engine
3. **Authentication Service**: User authentication and authorization
4. **GitHub Integration**: GitHub Actions and repository management
5. **Audit Service**: Security and compliance logging
6. **Notification Service**: Real-time notifications and alerts

#### Supporting Services
1. **Database**: PostgreSQL for data persistence
2. **Cache**: Redis for session and caching
3. **Message Queue**: RabbitMQ for async task processing
4. **File Storage**: S3-compatible storage for uploads
5. **Monitoring**: Prometheus and Grafana for observability
6. **Logging**: ELK stack for centralized logging

## Prerequisites

### System Requirements

#### Minimum Requirements (Single Instance)
- **CPU**: 2 cores
- **RAM**: 4 GB
- **Disk Space**: 20 GB SSD
- **Network**: 100 Mbps connectivity
- **Operating System**: Ubuntu 20.04 LTS or newer

#### Recommended Requirements (Production)
- **CPU**: 4+ cores
- **RAM**: 8+ GB
- **Disk Space**: 50+ GB SSD
- **Network**: 1 Gbps connectivity
- **Operating System**: Ubuntu 22.04 LTS or newer

### Software Dependencies

#### Runtime Dependencies
```bash
# Node.js (LTS version)
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# PostgreSQL
sudo apt-get install -y postgresql postgresql-contrib

# Redis
sudo apt-get install -y redis-server

# Docker (optional but recommended)
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin

# Certbot for SSL certificates
sudo apt-get install -y certbot

# Utilities
sudo apt-get install -y git wget curl jq
```

#### Development Dependencies
```bash
# Build tools
sudo apt-get install -y build-essential python3-dev

# Testing tools
sudo npm install -g jest mocha chai

# Code quality tools
sudo npm install -g eslint prettier

# Container tools
sudo npm install -g docker-linter
```

## Deployment Options

### Docker Deployment

#### Single Container Deployment
```bash
# Pull the latest image
docker pull cbwinslow/cloudflare-task-executor:latest

# Run the container
docker run -d \
  --name cloudflare-task-executor \
  -p 3000:3000 \
  -e DB_HOST=your-database-host \
  -e DB_PORT=5432 \
  -e DB_NAME=task_queue \
  -e DB_USER=task_queue_user \
  -e DB_PASSWORD=your-database-password \
  -e JWT_SECRET=your-super-secret-jwt-key \
  -e CLOUDFLARE_ACCOUNT_ID=your-account-id \
  -e CLOUDFLARE_API_TOKEN=your-api-token \
  -e GITHUB_CLIENT_ID=your-github-client-id \
  -e GITHUB_CLIENT_SECRET=your-github-client-secret \
  -v /var/log/cloudflare-task-executor:/app/logs \
  -v /var/lib/cloudflare-task-executor/uploads:/app/uploads \
  --restart unless-stopped \
  cbwinslow/cloudflare-task-executor:latest

# Verify the deployment
docker logs cloudflare-task-executor
```

#### Docker Compose Deployment
```yaml
# docker-compose.yml
version: '3.8'

services:
  web:
    image: cbwinslow/cloudflare-task-executor:latest
    container_name: cloudflare-task-executor-web
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - DB_HOST=database
      - DB_PORT=5432
      - DB_NAME=task_queue
      - DB_USER=task_queue_user
      - DB_PASSWORD=${DB_PASSWORD}
      - JWT_SECRET=${JWT_SECRET}
      - CLOUDFLARE_ACCOUNT_ID=${CLOUDFLARE_ACCOUNT_ID}
      - CLOUDFLARE_API_TOKEN=${CLOUDFLARE_API_TOKEN}
      - GITHUB_CLIENT_ID=${GITHUB_CLIENT_ID}
      - GITHUB_CLIENT_SECRET=${GITHUB_CLIENT_SECRET}
      - REDIS_URL=redis://redis:6379
      - LOG_LEVEL=info
    depends_on:
      - database
      - redis
    volumes:
      - ./logs:/app/logs
      - ./uploads:/app/uploads
      - ./config:/app/config
    restart: unless-stopped
    networks:
      - app-network
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/api/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 60s

  database:
    image: postgres:15-alpine
    container_name: cloudflare-task-executor-db
    environment:
      - POSTGRES_DB=task_queue
      - POSTGRES_USER=task_queue_user
      - POSTGRES_PASSWORD=${DB_PASSWORD}
      - POSTGRES_INITDB_ARGS=--auth-host=scram-sha-256 --auth-local=peer
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./init-scripts:/docker-entrypoint-initdb.d
    ports:
      - "5432:5432"
    restart: unless-stopped
    networks:
      - app-network
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U task_queue_user -d task_queue"]
      interval: 30s
      timeout: 10s
      retries: 3

  redis:
    image: redis:7-alpine
    container_name: cloudflare-task-executor-redis
    command: redis-server --appendonly yes --requirepass ${REDIS_PASSWORD}
    volumes:
      - redis_data:/data
    restart: unless-stopped
    networks:
      - app-network
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 30s
      timeout: 10s
      retries: 3

  nginx:
    image: nginx:alpine
    container_name: cloudflare-task-executor-nginx
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf
      - ./nginx/ssl:/etc/nginx/ssl
      - ./public:/var/www/public
    depends_on:
      - web
    restart: unless-stopped
    networks:
      - app-network

networks:
  app-network:
    driver: bridge

volumes:
  postgres_data:
  redis_data:
```

#### Environment Configuration File
```bash
# .env
# Database Configuration
DB_HOST=database
DB_PORT=5432
DB_NAME=task_queue
DB_USER=task_queue_user
DB_PASSWORD=your-secure-database-password

# Security Configuration
JWT_SECRET=your-super-secret-jwt-key-change-in-production
JWT_EXPIRY=24h
REDIS_PASSWORD=your-secure-redis-password

# Cloudflare Configuration
CLOUDFLARE_ACCOUNT_ID=your-cloudflare-account-id
CLOUDFLARE_API_TOKEN=your-cloudflare-api-token

# GitHub Configuration
GITHUB_CLIENT_ID=your-github-client-id
GITHUB_CLIENT_SECRET=your-github-client-secret

# Application Configuration
NODE_ENV=production
PORT=3000
LOG_LEVEL=info
SESSION_SECRET=your-session-secret-key
```

#### Deployment Commands
```bash
# Create environment file
cp .env.example .env
# Edit .env with your configuration

# Start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Scale web service
docker-compose up -d --scale web=3

# Update to latest version
docker-compose pull
docker-compose up -d

# Backup database
docker-compose exec database pg_dump -U task_queue_user task_queue > backup_$(date +%Y%m%d_%H%M%S).sql

# Restore database
docker-compose exec -T database psql -U task_queue_user task_queue < backup_file.sql
```

### Kubernetes Deployment

#### Helm Chart Deployment
```yaml
# values.yaml
# Cloudflare Task Executor Helm Chart Values

# Global configuration
global:
  imageRegistry: ""
  imagePullSecrets: []
  storageClass: ""

# Application configuration
app:
  name: cloudflare-task-executor
  replicaCount: 3
  image:
    repository: cbwinslow/cloudflare-task-executor
    tag: latest
    pullPolicy: IfNotPresent
  service:
    type: ClusterIP
    port: 3000
  resources:
    limits:
      cpu: 1000m
      memory: 2Gi
    requests:
      cpu: 500m
      memory: 1Gi
  autoscaling:
    enabled: true
    minReplicas: 3
    maxReplicas: 10
    targetCPUUtilizationPercentage: 80
    targetMemoryUtilizationPercentage: 80

# Database configuration
database:
  enabled: true
  postgresql:
    image:
      registry: docker.io
      repository: bitnami/postgresql
      tag: 15-debian-11
    auth:
      postgresPassword: "your-postgres-password"
      username: "task_queue_user"
      password: "your-database-password"
      database: "task_queue"
    primary:
      persistence:
        enabled: true
        size: 20Gi
        storageClass: ""

# Redis configuration
redis:
  enabled: true
  auth:
    enabled: true
    password: "your-redis-password"
  master:
    persistence:
      enabled: true
      size: 10Gi

# Ingress configuration
ingress:
  enabled: true
  className: "nginx"
  annotations:
    kubernetes.io/ingress.class: nginx
    kubernetes.io/tls-acme: "true"
    cert-manager.io/cluster-issuer: "letsencrypt-prod"
  hosts:
    - host: tasks.yourdomain.com
      paths:
        - path: /
          pathType: Prefix
  tls:
    - secretName: cloudflare-task-executor-tls
      hosts:
        - tasks.yourdomain.com

# Secrets configuration
secrets:
  jwtSecret: "your-super-secret-jwt-key"
  cloudflareAccountId: "your-cloudflare-account-id"
  cloudflareApiToken: "your-cloudflare-api-token"
  githubClientId: "your-github-client-id"
  githubClientSecret: "your-github-client-secret"

# Monitoring configuration
monitoring:
  enabled: true
  prometheus:
    enabled: true
  grafana:
    enabled: true
    adminPassword: "your-grafana-admin-password"

# External services
externalDatabase:
  enabled: false
  host: ""
  port: 5432
  user: ""
  password: ""
  database: ""

externalRedis:
  enabled: false
  host: ""
  port: 6379
  password: ""
```

#### Kubernetes Manifests
```yaml
# deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: cloudflare-task-executor
  labels:
    app: cloudflare-task-executor
spec:
  replicas: 3
  selector:
    matchLabels:
      app: cloudflare-task-executor
  template:
    metadata:
      labels:
        app: cloudflare-task-executor
    spec:
      containers:
      - name: web
        image: cbwinslow/cloudflare-task-executor:latest
        ports:
        - containerPort: 3000
        env:
        - name: DB_HOST
          valueFrom:
            secretKeyRef:
              name: database-secret
              key: host
        - name: DB_PORT
          value: "5432"
        - name: DB_NAME
          valueFrom:
            secretKeyRef:
              name: database-secret
              key: database
        - name: DB_USER
          valueFrom:
            secretKeyRef:
              name: database-secret
              key: username
        - name: DB_PASSWORD
          valueFrom:
            secretKeyRef:
              name: database-secret
              key: password
        - name: JWT_SECRET
          valueFrom:
            secretKeyRef:
              name: app-secret
              key: jwt-secret
        - name: CLOUDFLARE_ACCOUNT_ID
          valueFrom:
            secretKeyRef:
              name: cloudflare-secret
              key: account-id
        - name: CLOUDFLARE_API_TOKEN
          valueFrom:
            secretKeyRef:
              name: cloudflare-secret
              key: api-token
        - name: GITHUB_CLIENT_ID
          valueFrom:
            secretKeyRef:
              name: github-secret
              key: client-id
        - name: GITHUB_CLIENT_SECRET
          valueFrom:
            secretKeyRef:
              name: github-secret
              key: client-secret
        - name: NODE_ENV
          value: "production"
        - name: LOG_LEVEL
          value: "info"
        resources:
          requests:
            memory: "1Gi"
            cpu: "500m"
          limits:
            memory: "2Gi"
            cpu: "1000m"
        livenessProbe:
          httpGet:
            path: /api/health
            port: 3000
          initialDelaySeconds: 60
          periodSeconds: 30
        readinessProbe:
          httpGet:
            path: /api/health
            port: 3000
          initialDelaySeconds: 30
          periodSeconds: 10
        volumeMounts:
        - name: logs
          mountPath: /app/logs
        - name: uploads
          mountPath: /app/uploads
      volumes:
      - name: logs
        emptyDir: {}
      - name: uploads
        emptyDir: {}
---
apiVersion: v1
kind: Service
metadata:
  name: cloudflare-task-executor
  labels:
    app: cloudflare-task-executor
spec:
  selector:
    app: cloudflare-task-executor
  ports:
  - port: 3000
    targetPort: 3000
  type: ClusterIP
---
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: cloudflare-task-executor
  annotations:
    kubernetes.io/ingress.class: nginx
    nginx.ingress.kubernetes.io/rewrite-target: /
    cert-manager.io/cluster-issuer: "letsencrypt-prod"
spec:
  tls:
  - hosts:
    - tasks.yourdomain.com
    secretName: cloudflare-task-executor-tls
  rules:
  - host: tasks.yourdomain.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: cloudflare-task-executor
            port:
              number: 3000
---
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: cloudflare-task-executor
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: cloudflare-task-executor
  minReplicas: 3
  maxReplicas: 10
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 80
  - type: Resource
    resource:
      name: memory
      target:
        type: Utilization
        averageUtilization: 80
```

### Bare Metal Deployment

#### System Preparation
```bash
#!/bin/bash
# Bare metal deployment script

# Update system
sudo apt-get update && sudo apt-get upgrade -y

# Install dependencies
sudo apt-get install -y \
  nodejs npm \
  postgresql postgresql-contrib \
  redis-server \
  nginx \
  certbot \
  git \
  curl \
  wget \
  jq \
  build-essential \
  python3-dev

# Create application user
sudo useradd -m -s /bin/bash taskexecutor
sudo usermod -aG docker taskexecutor

# Create directories
sudo mkdir -p /opt/cloudflare-task-executor
sudo mkdir -p /var/log/cloudflare-task-executor
sudo mkdir -p /var/lib/cloudflare-task-executor/uploads
sudo mkdir -p /etc/cloudflare-task-executor

# Set permissions
sudo chown -R taskexecutor:taskexecutor /opt/cloudflare-task-executor
sudo chown -R taskexecutor:taskexecutor /var/log/cloudflare-task-executor
sudo chown -R taskexecutor:taskexecutor /var/lib/cloudflare-task-executor
sudo chown -R taskexecutor:taskexecutor /etc/cloudflare-task-executor

# Switch to application user
sudo -u taskexecutor -H bash
```

#### Application Installation
```bash
#!/bin/bash
# Application installation script

# Clone repository
cd /opt/cloudflare-task-executor
git clone https://github.com/cbwinslow/ansible-task-queue.git .
cd web

# Install Node.js dependencies
npm ci --only=production

# Create environment file
cat > .env << 'EOF'
# Database Configuration
DB_HOST=localhost
DB_PORT=5432
DB_NAME=task_queue
DB_USER=task_queue_user
DB_PASSWORD=your-secure-database-password

# Security Configuration
JWT_SECRET=your-super-secret-jwt-key-change-in-production
JWT_EXPIRY=24h

# Application Configuration
NODE_ENV=production
PORT=3000
LOG_LEVEL=info
SESSION_SECRET=your-session-secret-key

# Cloudflare Configuration
CLOUDFLARE_ACCOUNT_ID=your-cloudflare-account-id
CLOUDFLARE_API_TOKEN=your-cloudflare-api-token

# GitHub Configuration
GITHUB_CLIENT_ID=your-github-client-id
GITHUB_CLIENT_SECRET=your-github-client-secret
EOF

# Set proper permissions
chmod 600 .env
```

#### Database Setup
```bash
#!/bin/bash
# Database setup script

# Switch to postgres user
sudo -u postgres bash

# Create database and user
psql << 'EOF'
CREATE DATABASE task_queue;
CREATE USER task_queue_user WITH PASSWORD 'your-secure-database-password';
GRANT ALL PRIVILEGES ON DATABASE task_queue TO task_queue_user;
ALTER USER task_queue_user CREATEDB;
EOF

# Exit postgres user session
exit

# Run database migrations
cd /opt/cloudflare-task-executor/web
npm run migrate

# Verify database setup
psql -h localhost -U task_queue_user -d task_queue -c "SELECT COUNT(*) FROM users;"
```

#### Service Configuration
```bash
#!/bin/bash
# Service configuration script

# Create systemd service file
sudo tee /etc/systemd/system/cloudflare-task-executor.service << 'EOF'
[Unit]
Description=Cloudflare Mobile Task Executor
After=network.target postgresql.service redis.service
Wants=postgresql.service redis.service

[Service]
Type=simple
User=taskexecutor
Group=taskexecutor
WorkingDirectory=/opt/cloudflare-task-executor/web
Environment=NODE_ENV=production
EnvironmentFile=/opt/cloudflare-task-executor/web/.env
ExecStart=/usr/bin/node server.js
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal
SyslogIdentifier=cloudflare-task-executor

[Install]
WantedBy=multi-user.target
EOF

# Create log rotation configuration
sudo tee /etc/logrotate.d/cloudflare-task-executor << 'EOF'
/var/log/cloudflare-task-executor/*.log {
    daily
    missingok
    rotate 52
    compress
    delaycompress
    notifempty
    create 644 taskexecutor taskexecutor
    postrotate
        systemctl reload cloudflare-task-executor
    endscript
}
EOF

# Reload systemd and enable service
sudo systemctl daemon-reload
sudo systemctl enable cloudflare-task-executor
sudo systemctl start cloudflare-task-executor

# Check service status
sudo systemctl status cloudflare-task-executor
```

#### Nginx Configuration
```bash
#!/bin/bash
# Nginx configuration script

# Create Nginx configuration
sudo tee /etc/nginx/sites-available/cloudflare-task-executor << 'EOF'
upstream task_executor_backend {
    server 127.0.0.1:3000;
    keepalive 32;
}

server {
    listen 80;
    server_name tasks.yourdomain.com;
    
    # Redirect all HTTP to HTTPS
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name tasks.yourdomain.com;
    
    # SSL Configuration
    ssl_certificate /etc/letsencrypt/live/tasks.yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/tasks.yourdomain.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;
    
    # Security Headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "no-referrer-when-downgrade" always;
    
    # Rate Limiting
    limit_req_zone $binary_remote_addr zone=api:10m rate=100r/s;
    limit_req_zone $binary_remote_addr zone=login:10m rate=10r/m;
    
    # Client IP Resolution (Cloudflare)
    set_real_ip_from 173.245.48.0/20;
    set_real_ip_from 103.21.244.0/22;
    set_real_ip_from 103.22.200.0/22;
    set_real_ip_from 103.31.4.0/22;
    set_real_ip_from 141.101.64.0/18;
    set_real_ip_from 108.162.192.0/18;
    set_real_ip_from 190.93.240.0/20;
    set_real_ip_from 188.114.96.0/20;
    set_real_ip_from 197.234.240.0/22;
    set_real_ip_from 198.41.128.0/17;
    set_real_ip_from 162.158.0.0/15;
    set_real_ip_from 104.16.0.0/13;
    set_real_ip_from 104.24.0.0/14;
    set_real_ip_from 172.64.0.0/13;
    set_real_ip_from 131.0.72.0/22;
    real_ip_header CF-Connecting-IP;
    real_ip_recursive on;
    
    location / {
        proxy_pass http://task_executor_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header CF-Connecting-IP $http_cf_connecting_ip;
        proxy_set_header CF-IPCountry $http_cf_ipcountry;
        proxy_set_header CF-Ray $http_cf_ray;
        proxy_set_header CF-Visitor $http_cf_visitor;
        proxy_cache_bypass $http_upgrade;
        
        # Timeouts
        proxy_connect_timeout 30s;
        proxy_send_timeout 30s;
        proxy_read_timeout 30s;
        
        # Rate limiting
        limit_req zone=api burst=20 nodelay;
    }
    
    location /api/ {
        proxy_pass http://task_executor_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header CF-Connecting-IP $http_cf_connecting_ip;
        proxy_cache_bypass $http_upgrade;
        
        # API rate limiting
        limit_req zone=api burst=50 nodelay;
    }
    
    location /socket.io/ {
        proxy_pass http://task_executor_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header CF-Connecting-IP $http_cf_connecting_ip;
        proxy_cache_bypass $http_upgrade;
    }
    
    location /health {
        access_log off;
        return 200 "healthy\n";
        add_header Content-Type text/plain;
    }
    
    # Static files
    location /static/ {
        alias /opt/cloudflare-task-executor/web/public/;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
    
    # Error pages
    error_page 404 /404.html;
    location = /404.html {
        internal;
    }
    
    error_page 500 502 503 504 /50x.html;
    location = /50x.html {
        internal;
    }
}
EOF

# Enable site
sudo ln -sf /etc/nginx/sites-available/cloudflare-task-executor /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

#### SSL Certificate Setup
```bash
#!/bin/bash
# SSL certificate setup script

# Obtain SSL certificate
sudo certbot --nginx -d tasks.yourdomain.com

# Set up auto-renewal
sudo crontab -l | { cat; echo "0 12 * * * /usr/bin/certbot renew --quiet"; } | sudo crontab -

# Test renewal
sudo certbot renew --dry-run
```

## Cloud Provider Deployments

### AWS Deployment

#### EC2 Instance Launch Template
```json
{
  "LaunchTemplateName": "cloudflare-task-executor",
  "LaunchTemplateData": {
    "ImageId": "ami-0abcdef1234567890",
    "InstanceType": "t3.medium",
    "KeyName": "your-key-pair",
    "SecurityGroupIds": ["sg-12345678"],
    "UserData": {
      "Fn::Base64": {
        "Fn::Join": [
          "",
          [
            "#!/bin/bash\n",
            "yum update -y\n",
            "yum install -y docker git nodejs npm postgresql postgresql-contrib\n",
            "systemctl start docker\n",
            "systemctl enable docker\n",
            "usermod -aG docker ec2-user\n",
            "git clone https://github.com/cbwinslow/ansible-task-queue.git /opt/cloudflare-task-executor\n",
            "cd /opt/cloudflare-task-executor/web\n",
            "npm ci --only=production\n",
            "# Add additional setup commands here\n"
          ]
        ]
      }
    },
    "BlockDeviceMappings": [
      {
        "DeviceName": "/dev/xvda",
        "Ebs": {
          "VolumeSize": 20,
          "VolumeType": "gp3",
          "DeleteOnTermination": true
        }
      }
    ]
  }
}
```

#### RDS Database Setup
```bash
#!/bin/bash
# AWS RDS setup script

# Create RDS instance
aws rds create-db-instance \
  --db-instance-identifier cloudflare-task-executor-db \
  --db-instance-class db.t3.micro \
  --engine postgres \
  --master-username task_queue_user \
  --master-user-password your-secure-database-password \
  --allocated-storage 20 \
  --storage-type gp2 \
  --vpc-security-group-ids sg-12345678 \
  --db-subnet-group-name my-db-subnet-group \
  --backup-retention-period 7 \
  --multi-az \
  --publicly-accessible \
  --storage-encrypted \
  --enable-performance-insights

# Wait for RDS instance to be available
aws rds wait db-instance-available --db-instance-identifier cloudflare-task-executor-db

# Get RDS endpoint
RDS_ENDPOINT=$(aws rds describe-db-instances --db-instance-identifier cloudflare-task-executor-db --query 'DBInstances[0].Endpoint.Address' --output text)

echo "RDS Endpoint: $RDS_ENDPOINT"
```

#### ECS Service Definition
```json
{
  "family": "cloudflare-task-executor",
  "taskRoleArn": "arn:aws:iam::123456789012:role/ECS-Task-Role",
  "executionRoleArn": "arn:aws:iam::123456789012:role/ecsTaskExecutionRole",
  "networkMode": "awsvpc",
  "containerDefinitions": [
    {
      "name": "web",
      "image": "cbwinslow/cloudflare-task-executor:latest",
      "portMappings": [
        {
          "containerPort": 3000,
          "protocol": "tcp"
        }
      ],
      "environment": [
        {
          "name": "DB_HOST",
          "value": "your-rds-endpoint.amazonaws.com"
        },
        {
          "name": "DB_PORT",
          "value": "5432"
        },
        {
          "name": "DB_NAME",
          "value": "task_queue"
        },
        {
          "name": "DB_USER",
          "value": "task_queue_user"
        },
        {
          "name": "DB_PASSWORD",
          "value": "your-secure-database-password"
        },
        {
          "name": "JWT_SECRET",
          "value": "your-super-secret-jwt-key"
        }
      ],
      "logConfiguration": {
        "logDriver": "awslogs",
        "options": {
          "awslogs-group": "/ecs/cloudflare-task-executor",
          "awslogs-region": "us-west-2",
          "awslogs-stream-prefix": "ecs"
        }
      },
      "healthCheck": {
        "command": ["CMD-SHELL", "curl -f http://localhost:3000/api/health || exit 1"],
        "interval": 30,
        "timeout": 5,
        "retries": 3,
        "startPeriod": 60
      }
    }
  ],
  "requiresCompatibilities": ["FARGATE"],
  "cpu": "512",
  "memory": "1024"
}
```

### Google Cloud Platform Deployment

#### GKE Cluster Setup
```bash
#!/bin/bash
# GKE cluster setup script

# Create GKE cluster
gcloud container clusters create cloudflare-task-executor-cluster \
  --zone=us-central1-a \
  --num-nodes=3 \
  --machine-type=e2-medium \
  --disk-size=20GB \
  --disk-type=pd-standard \
  --enable-autoscaling \
  --min-nodes=1 \
  --max-nodes=10 \
  --enable-autorepair \
  --enable-autoupgrade \
  --enable-ip-alias \
  --enable-master-authorized-networks \
  --enable-private-nodes \
  --master-authorized-networks=0.0.0.0/0

# Get cluster credentials
gcloud container clusters get-credentials cloudflare-task-executor-cluster --zone=us-central1-a

# Create namespace
kubectl create namespace cloudflare-task-executor
```

#### Cloud SQL Setup
```bash
#!/bin/bash
# Cloud SQL setup script

# Create Cloud SQL instance
gcloud sql instances create cloudflare-task-executor-db \
  --database-version=POSTGRES_15 \
  --tier=db-f1-micro \
  --region=us-central1 \
  --storage-size=10GB \
  --storage-type=SSD \
  --backup \
  --backup-start-time=03:00 \
  --enable-point-in-time-recovery \
  --maintenance-window-day=SUNDAY \
  --maintenance-window-hour=3 \
  --assign-ip \
  --authorized-networks=0.0.0.0/0

# Create database
gcloud sql databases create task_queue \
  --instance=cloudflare-task-executor-db

# Create user
gcloud sql users create task_queue_user \
  --instance=cloudflare-task-executor-db \
  --password=your-secure-database-password

# Get connection name
CONNECTION_NAME=$(gcloud sql instances describe cloudflare-task-executor-db --format="value(connectionName)")

echo "Cloud SQL Connection Name: $CONNECTION_NAME"
```

#### Cloud Run Deployment
```bash
#!/bin/bash
# Cloud Run deployment script

# Build and push container
gcloud builds submit \
  --tag gcr.io/your-project-id/cloudflare-task-executor \
  --timeout=1200s

# Deploy to Cloud Run
gcloud run deploy cloudflare-task-executor \
  --image gcr.io/your-project-id/cloudflare-task-executor \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --set-env-vars \
    DB_HOST=your-cloud-sql-connection-name,\
    DB_PORT=5432,\
    DB_NAME=task_queue,\
    DB_USER=task_queue_user,\
    DB_PASSWORD=your-secure-database-password,\
    JWT_SECRET=your-super-secret-jwt-key,\
    CLOUDFLARE_ACCOUNT_ID=your-cloudflare-account-id,\
    CLOUDFLARE_API_TOKEN=your-cloudflare-api-token,\
    GITHUB_CLIENT_ID=your-github-client-id,\
    GITHUB_CLIENT_SECRET=your-github-client-secret

# Get service URL
SERVICE_URL=$(gcloud run services describe cloudflare-task-executor --region us-central1 --format="value(status.url)")

echo "Service URL: $SERVICE_URL"
```

## Monitoring and Observability

### Prometheus Configuration
```yaml
# prometheus.yml
global:
  scrape_interval: 15s
  evaluation_interval: 15s

rule_files:
  - "alert.rules"

scrape_configs:
  - job_name: 'cloudflare-task-executor'
    static_configs:
      - targets: ['localhost:3000']
    metrics_path: '/metrics'
    scrape_interval: 10s

  - job_name: 'postgresql'
    static_configs:
      - targets: ['localhost:9187']
    metrics_path: '/metrics'

  - job_name: 'redis'
    static_configs:
      - targets: ['localhost:9121']
    metrics_path: '/metrics'

  - job_name: 'nginx'
    static_configs:
      - targets: ['localhost:9113']
    metrics_path: '/metrics'

  - job_name: 'node-exporter'
    static_configs:
      - targets: ['localhost:9100']
    metrics_path: '/metrics'

alerting:
  alertmanagers:
    - static_configs:
        - targets: ['localhost:9093']

remote_write:
  - url: 'https://prometheus-us-central1.grafana.net/api/prom/push'
    basic_auth:
      username: 'your-prometheus-username'
      password: 'your-prometheus-password'
```

### Grafana Dashboard Configuration
```json
{
  "dashboard": {
    "id": null,
    "title": "Cloudflare Task Executor - System Overview",
    "timezone": "browser",
    "schemaVersion": 16,
    "version": 0,
    "refresh": "30s",
    "panels": [
      {
        "type": "graph",
        "title": "API Requests",
        "gridPos": {
          "x": 0,
          "y": 0,
          "w": 12,
          "h": 6
        },
        "targets": [
          {
            "expr": "rate(http_requests_total[5m])",
            "legendFormat": "{{method}} {{handler}}"
          }
        ],
        "datasource": "Prometheus"
      },
      {
        "type": "graph",
        "title": "Database Connections",
        "gridPos": {
          "x": 12,
          "y": 0,
          "w": 12,
          "h": 6
        },
        "targets": [
          {
            "expr": "pg_stat_database_numbackends",
            "legendFormat": "{{datname}}"
          }
        ],
        "datasource": "Prometheus"
      },
      {
        "type": "singlestat",
        "title": "Active Tasks",
        "gridPos": {
          "x": 0,
          "y": 6,
          "w": 6,
          "h": 3
        },
        "targets": [
          {
            "expr": "count(task_status{status=\"running\"})"
          }
        ],
        "datasource": "Prometheus"
      },
      {
        "type": "singlestat",
        "title": "Pending Tasks",
        "gridPos": {
          "x": 6,
          "y": 6,
          "w": 6,
          "h": 3
        },
        "targets": [
          {
            "expr": "count(task_status{status=\"pending\"})"
          }
        ],
        "datasource": "Prometheus"
      },
      {
        "type": "singlestat",
        "title": "Completed Tasks",
        "gridPos": {
          "x": 12,
          "y": 6,
          "w": 6,
          "h": 3
        },
        "targets": [
          {
            "expr": "count(task_status{status=\"completed\"})"
          }
        ],
        "datasource": "Prometheus"
      },
      {
        "type": "singlestat",
        "title": "Failed Tasks",
        "gridPos": {
          "x": 18,
          "y": 6,
          "w": 6,
          "h": 3
        },
        "targets": [
          {
            "expr": "count(task_status{status=\"failed\"})"
          }
        ],
        "datasource": "Prometheus"
      },
      {
        "type": "graph",
        "title": "Response Time",
        "gridPos": {
          "x": 0,
          "y": 9,
          "w": 12,
          "h": 6
        },
        "targets": [
          {
            "expr": "histogram_quantile(0.95, sum(rate(http_request_duration_seconds_bucket[5m])) by (le))",
            "legendFormat": "95th percentile"
          },
          {
            "expr": "histogram_quantile(0.50, sum(rate(http_request_duration_seconds_bucket[5m])) by (le))",
            "legendFormat": "50th percentile"
          }
        ],
        "datasource": "Prometheus"
      },
      {
        "type": "graph",
        "title": "System Resources",
        "gridPos": {
          "x": 12,
          "y": 9,
          "w": 12,
          "h": 6
        },
        "targets": [
          {
            "expr": "node_cpu_seconds_total{mode=\"idle\"}",
            "legendFormat": "CPU Idle"
          },
          {
            "expr": "node_memory_MemAvailable_bytes",
            "legendFormat": "Memory Available"
          },
          {
            "expr": "node_filesystem_avail_bytes{mountpoint=\"/\"}",
            "legendFormat": "Disk Available"
          }
        ],
        "datasource": "Prometheus"
      }
    ]
  }
}
```

### Logging Configuration

#### Fluentd Configuration
```xml
<!-- fluentd.conf -->
<source>
  @type tail
  @id in_tail_application_logs
  path /var/log/cloudflare-task-executor/*.log
  pos_file /var/log/fluentd/application_logs.pos
  tag application.*
  format json
  time_key timestamp
  time_format %Y-%m-%dT%H:%M:%S.%NZ
</source>

<source>
  @type tail
  @id in_tail_access_logs
  path /var/log/nginx/access.log
  pos_file /var/log/fluentd/access_logs.pos
  tag nginx.access
  format nginx
</source>

<source>
  @type tail
  @id in_tail_error_logs
  path /var/log/nginx/error.log
  pos_file /var/log/fluentd/error_logs.pos
  tag nginx.error
  format /^(?<time>[^\s]+) \[(?<log_level>[^\]]+)\] (?<pid>\d+)#(?<tid>\d+): (\*(?<connection>\d+) )?(?<message>.*)$/
</source>

<filter application.**>
  @type record_transformer
  <record>
    hostname "#{Socket.gethostname}"
    service_name cloudflare-task-executor
  </record>
</filter>

<match application.**>
  @type elasticsearch
  @id out_es_application
  host elasticsearch-host
  port 9200
  logstash_format true
  logstash_prefix application-logs
  <buffer>
    @type file
    path /var/log/fluentd/buffer/application
    flush_mode interval
    flush_interval 10s
    chunk_limit_size 2M
    queue_limit_length 32
    retry_max_interval 30
    retry_forever true
  </buffer>
</match>

<match nginx.**>
  @type elasticsearch
  @id out_es_nginx
  host elasticsearch-host
  port 9200
  logstash_format true
  logstash_prefix nginx-logs
  <buffer>
    @type file
    path /var/log/fluentd/buffer/nginx
    flush_mode interval
    flush_interval 10s
    chunk_limit_size 2M
    queue_limit_length 32
    retry_max_interval 30
    retry_forever true
  </buffer>
</match>

<match **>
  @type stdout
</match>
```

## Backup and Recovery

### Database Backup Strategy

#### Automated Backup Script
```bash
#!/bin/bash
# Automated database backup script

# Configuration
BACKUP_DIR="/var/backups/cloudflare-task-executor"
RETENTION_DAYS=30
DATABASE_NAME="task_queue"
DATABASE_USER="task_queue_user"
DATABASE_HOST="localhost"
DATABASE_PORT="5432"

# Create backup directory
mkdir -p "$BACKUP_DIR"

# Generate backup filename
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="$BACKUP_DIR/${DATABASE_NAME}_${TIMESTAMP}.sql.gz"

# Create backup
pg_dump \
  -h "$DATABASE_HOST" \
  -p "$DATABASE_PORT" \
  -U "$DATABASE_USER" \
  -d "$DATABASE_NAME" \
  --clean \
  --create \
  --verbose | gzip > "$BACKUP_FILE"

# Check backup creation
if [ $? -eq 0 ]; then
  echo "Backup created successfully: $BACKUP_FILE"
  
  # Set proper permissions
  chmod 600 "$BACKUP_FILE"
  
  # Remove old backups
  find "$BACKUP_DIR" -name "${DATABASE_NAME}_*.sql.gz" -mtime +$RETENTION_DAYS -delete
  
  # Log successful backup
  logger -t "cloudflare-task-executor-backup" "Backup created successfully: $BACKUP_FILE"
else
  echo "Backup creation failed"
  logger -t "cloudflare-task-executor-backup" "Backup creation failed"
  exit 1
fi

# Upload to cloud storage (optional)
if [ -n "$AWS_ACCESS_KEY_ID" ]; then
  aws s3 cp "$BACKUP_FILE" s3://your-backup-bucket/cloudflare-task-executor/
fi
```

#### Scheduled Backup Configuration
```bash
# Crontab entry for automated backups
# Daily backup at 2:00 AM
0 2 * * * /opt/cloudflare-task-executor/scripts/backup.sh >> /var/log/cloudflare-task-executor/backup.log 2>&1

# Weekly full backup on Sunday at 1:00 AM
0 1 * * 0 /opt/cloudflare-task-executor/scripts/full-backup.sh >> /var/log/cloudflare-task-executor/backup.log 2>&1

# Monthly cleanup on first day of month at 3:00 AM
0 3 1 * * /opt/cloudflare-task-executor/scripts/cleanup.sh >> /var/log/cloudflare-task-executor/backup.log 2>&1
```

#### Point-in-Time Recovery
```bash
#!/bin/bash
# Point-in-time recovery script

# Configuration
RECOVERY_POINT="2023-01-01 12:00:00"
BASE_BACKUP="/var/backups/cloudflare-task-executor/base_backup.tar.gz"
WAL_ARCHIVE="/var/backups/cloudflare-task-executor/wal"

# Stop PostgreSQL
sudo systemctl stop postgresql

# Remove current data directory
sudo rm -rf /var/lib/postgresql/15/main

# Extract base backup
sudo tar -xzf "$BASE_BACKUP" -C /var/lib/postgresql/15/main

# Recover to specific point in time
sudo -u postgres pg_rewind \
  --target-pgdata=/var/lib/postgresql/15/main \
  --source-pgdata=/var/lib/postgresql/15/main \
  --restore-target-time="$RECOVERY_POINT"

# Start PostgreSQL
sudo systemctl start postgresql

# Verify recovery
psql -U task_queue_user -d task_queue -c "SELECT COUNT(*) FROM tasks;"
```

## Disaster Recovery Plan

### Recovery Time Objective (RTO)
- **Critical Services**: 2 hours
- **Non-Critical Services**: 24 hours
- **Data Recovery**: 4 hours

### Recovery Point Objective (RPO)
- **Database**: 1 hour
- **Configuration**: 1 day
- **Static Assets**: 1 week

### Recovery Procedures

#### Complete System Recovery
```bash
#!/bin/bash
# Complete system recovery procedure

# 1. Provision new infrastructure
echo "Provisioning new infrastructure..."
# Implementation depends on deployment method

# 2. Restore database from latest backup
echo "Restoring database..."
LATEST_BACKUP=$(ls -t /var/backups/cloudflare-task-executor/*.sql.gz | head -1)
gunzip -c "$LATEST_BACKUP" | psql -U task_queue_user -d task_queue

# 3. Deploy application
echo "Deploying application..."
cd /opt/cloudflare-task-executor/web
npm ci --only=production

# 4. Restore configuration files
echo "Restoring configuration..."
cp /var/backups/cloudflare-task-executor/config/* /opt/cloudflare-task-executor/web/config/

# 5. Start services
echo "Starting services..."
systemctl start cloudflare-task-executor
systemctl start postgresql
systemctl start redis

# 6. Verify deployment
echo "Verifying deployment..."
curl -f http://localhost:3000/api/health
```

#### Partial Recovery (Single Service)
```bash
#!/bin/bash
# Partial service recovery procedure

SERVICE_NAME=$1

case $SERVICE_NAME in
  "web")
    echo "Recovering web service..."
    systemctl restart cloudflare-task-executor
    ;;
  "database")
    echo "Recovering database service..."
    systemctl restart postgresql
    # Restore from latest backup if needed
    ;;
  "redis")
    echo "Recovering redis service..."
    systemctl restart redis
    ;;
  *)
    echo "Unknown service: $SERVICE_NAME"
    exit 1
    ;;
esac

# Verify service recovery
sleep 10
systemctl status $SERVICE_NAME
```

## Security Hardening

### System Security Configuration

#### Firewall Configuration
```bash
#!/bin/bash
# Firewall hardening script

# Install UFW (Uncomplicated Firewall)
sudo apt-get install -y ufw

# Default policies
sudo ufw default deny incoming
sudo ufw default allow outgoing

# Allow essential services
sudo ufw allow ssh
sudo ufw allow 'Nginx Full'
sudo ufw allow 3000/tcp comment 'Cloudflare Task Executor'

# Rate limiting for SSH
sudo ufw limit ssh

# Enable firewall
sudo ufw --force enable

# Log firewall activity
sudo ufw logging on
```

#### SSH Security Hardening
```bash
#!/bin/bash
# SSH security hardening script

# Backup SSH configuration
sudo cp /etc/ssh/sshd_config /etc/ssh/sshd_config.backup

# SSH configuration
sudo tee /etc/ssh/sshd_config << 'EOF'
# SSH Configuration for security hardening

# Protocol and version
Protocol 2
HostKey /etc/ssh/ssh_host_rsa_key
HostKey /etc/ssh/ssh_host_ecdsa_key
HostKey /etc/ssh/ssh_host_ed25519_key

# Logging
SyslogFacility AUTH
LogLevel VERBOSE

# Authentication
LoginGraceTime 60
PermitRootLogin no
StrictModes yes
MaxAuthTries 3
MaxSessions 10

# Public Key Authentication
PubkeyAuthentication yes
AuthorizedKeysFile	%h/.ssh/authorized_keys

# Password Authentication
PasswordAuthentication no
PermitEmptyPasswords no

# Challenge Response Authentication
ChallengeResponseAuthentication no

# Kerberos options
KerberosAuthentication no
KerberosOrLocalPasswd yes
KerberosTicketCleanup yes

# GSSAPI options
GSSAPIAuthentication no
GSSAPICleanupCredentials yes

# X11 Forwarding
X11Forwarding no

# PAM
UsePAM yes

# Security options
AllowAgentForwarding no
AllowTcpForwarding no
PermitTunnel no
GatewayPorts no

# Client alive settings
ClientAliveInterval 300
ClientAliveCountMax 2

# Banner
Banner /etc/ssh/banner

# Ciphers and MACs
Ciphers chacha20-poly1305@openssh.com,aes256-gcm@openssh.com,aes128-gcm@openssh.com,aes256-ctr,aes192-ctr,aes128-ctr
MACs hmac-sha2-512-etm@openssh.com,hmac-sha2-256-etm@openssh.com,umac-128-etm@openssh.com,hmac-sha2-512,hmac-sha2-256,umac-128@openssh.com

# Key Exchange Algorithms
KexAlgorithms curve25519-sha256@libssh.org,diffie-hellman-group-exchange-sha256

# Disable weak algorithms
HostbasedAuthentication no
IgnoreRhosts yes
EOF

# Create SSH banner
sudo tee /etc/ssh/banner << 'EOF'
*******************************************************************************
*                                                                             *
*                          UNAUTHORIZED ACCESS                                *
*                                                                             *
*        This system is for authorized users only.                            *
*        Unauthorized access is prohibited and will be prosecuted.           *
*                                                                             *
*******************************************************************************
EOF

# Restart SSH service
sudo systemctl restart ssh

# Verify configuration
sudo sshd -t
```

#### Application Security Hardening
```bash
#!/bin/bash
# Application security hardening script

# Set proper file permissions
sudo chown -R taskexecutor:taskexecutor /opt/cloudflare-task-executor
sudo chmod 750 /opt/cloudflare-task-executor
sudo chmod 600 /opt/cloudflare-task-executor/web/.env

# Secure log files
sudo chown -R taskexecutor:taskexecutor /var/log/cloudflare-task-executor
sudo chmod 750 /var/log/cloudflare-task-executor

# Secure upload directory
sudo chown -R taskexecutor:taskexecutor /var/lib/cloudflare-task-executor
sudo chmod 750 /var/lib/cloudflare-task-executor

# Set ulimits for security
sudo tee /etc/security/limits.d/cloudflare-task-executor.conf << 'EOF'
taskexecutor soft nofile 65536
taskexecutor hard nofile 65536
taskexecutor soft nproc 8192
taskexecutor hard nproc 8192
EOF

# Apply kernel security parameters
sudo tee /etc/sysctl.d/99-cloudflare-task-executor.conf << 'EOF'
# Kernel hardening
kernel.dmesg_restrict = 1
kernel.kptr_restrict = 2
kernel.perf_event_paranoid = 3

# Network security
net.ipv4.tcp_syncookies = 1
net.ipv4.tcp_max_syn_backlog = 4096
net.ipv4.tcp_fin_timeout = 30
net.ipv4.tcp_keepalive_time = 1200
net.ipv4.ip_forward = 0
net.ipv6.conf.all.forwarding = 0
net.ipv4.conf.all.accept_redirects = 0
net.ipv6.conf.all.accept_redirects = 0
net.ipv4.conf.all.send_redirects = 0
net.ipv4.conf.all.accept_source_route = 0
net.ipv6.conf.all.accept_source_route = 0

# Memory security
vm.mmap_min_addr = 65536
vm.swappiness = 1
EOF

# Apply sysctl settings
sudo sysctl -p /etc/sysctl.d/99-cloudflare-task-executor.conf
```

## Performance Optimization

### Database Performance Tuning

#### PostgreSQL Configuration
```bash
#!/bin/bash
# PostgreSQL performance tuning script

# Backup current configuration
sudo cp /etc/postgresql/15/main/postgresql.conf /etc/postgresql/15/main/postgresql.conf.backup

# PostgreSQL performance configuration
sudo tee /etc/postgresql/15/main/conf.d/performance.conf << 'EOF'
# Performance tuning for Cloudflare Task Executor

# Memory settings
shared_buffers = 256MB
effective_cache_size = 1GB
work_mem = 4MB
maintenance_work_mem = 64MB

# Checkpoint settings
checkpoint_completion_target = 0.9
wal_buffers = 16MB
min_wal_size = 1GB
max_wal_size = 2GB

# Query planner
random_page_cost = 1.1
effective_io_concurrency = 200
parallel_tuple_cost = 0.1
parallel_setup_cost = 1000.0

# Connection settings
max_connections = 100
superuser_reserved_connections = 3

# Logging
log_min_duration_statement = 1000
log_line_prefix = '%t [%p]: [%l-1] user=%u,db=%d,app=%a,client=%h '
log_checkpoints = on
log_connections = on
log_disconnections = on
log_lock_waits = on
log_temp_files = 0

# Statistics
track_activities = on
track_counts = on
track_io_timing = on
track_functions = all

# Autovacuum
autovacuum = on
autovacuum_max_workers = 3
autovacuum_naptime = 10s
autovacuum_vacuum_threshold = 50
autovacuum_analyze_threshold = 50
EOF

# Restart PostgreSQL to apply changes
sudo systemctl restart postgresql
```

#### Connection Pooling
```bash
#!/bin/bash
# PgBouncer setup script

# Install PgBouncer
sudo apt-get install -y pgbouncer

# PgBouncer configuration
sudo tee /etc/pgbouncer/pgbouncer.ini << 'EOF'
[databases]
task_queue = host=localhost port=5432 dbname=task_queue

[pgbouncer]
pool_mode = transaction
listen_port = 6432
listen_addr = localhost
auth_type = md5
auth_file = /etc/pgbouncer/userlist.txt
logfile = /var/log/postgresql/pgbouncer.log
pidfile = /var/run/postgresql/pgbouncer.pid
admin_users = postgres
stats_users = stats, postgres

# Connection limits
max_client_conn = 100
default_pool_size = 20
reserve_pool_size = 5
reserve_pool_timeout = 3

# Timeouts
server_reset_query = DISCARD ALL
ignore_startup_parameters = extra_float_digits

# Logging
log_connections = 1
log_disconnections = 1
log_pooler_errors = 1
EOF

# Create user list
sudo tee /etc/pgbouncer/userlist.txt << 'EOF'
"task_queue_user" "your-secure-database-password"
"postgres" "your-postgres-password"
EOF

# Set proper permissions
sudo chmod 600 /etc/pgbouncer/userlist.txt
sudo chown pgbouncer:pgbouncer /etc/pgbouncer/userlist.txt

# Enable and start PgBouncer
sudo systemctl enable pgbouncer
sudo systemctl start pgbouncer
```

### Application Performance Tuning

#### Node.js Performance Configuration
```bash
#!/bin/bash
# Node.js performance tuning script

# Create systemd service with performance optimizations
sudo tee /etc/systemd/system/cloudflare-task-executor.service << 'EOF'
[Unit]
Description=Cloudflare Mobile Task Executor
After=network.target postgresql.service redis.service
Wants=postgresql.service redis.service

[Service]
Type=simple
User=taskexecutor
Group=taskexecutor
WorkingDirectory=/opt/cloudflare-task-executor/web
Environment=NODE_ENV=production
Environment=NODE_OPTIONS=--max-old-space-size=2048
Environment=UV_THREADPOOL_SIZE=16
EnvironmentFile=/opt/cloudflare-task-executor/web/.env
ExecStart=/usr/bin/node --trace_gc --trace_gc_verbose server.js
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal
SyslogIdentifier=cloudflare-task-executor
LimitNOFILE=65536
LimitNPROC=8192

[Install]
WantedBy=multi-user.target
EOF

# Node.js application optimizations
cd /opt/cloudflare-task-executor/web

# Install performance monitoring tools
npm install --save-dev clinic
npm install --save-dev 0x

# Create performance test script
tee performance-test.js << 'EOF'
const autocannon = require('autocannon')

const instance = autocannon({
  url: 'http://localhost:3000/api/health',
  connections: 100,
  pipelining: 10,
  duration: 30
}, console.log)

// Run the test
instance.on('done', (result) => {
  console.log('Performance test completed:')
  console.log(`Requests per second: ${result.requests.average}`)
  console.log(`Latency: ${result.latency.average}ms`)
})

// Start the test
autocannon.track(instance)
EOF

# Install test dependencies
npm install --save-dev autocannon
```

## Maintenance Procedures

### Regular Maintenance Tasks

#### Daily Maintenance
```bash
#!/bin/bash
# Daily maintenance script

echo "Starting daily maintenance..."

# Check system health
echo "Checking system health..."
systemctl is-active cloudflare-task-executor || echo "Service is not active"
systemctl is-active postgresql || echo "Database is not active"
systemctl is-active redis || echo "Redis is not active"

# Check disk space
echo "Checking disk space..."
df -h | grep -E "(Filesystem|/)$"

# Check log file sizes
echo "Checking log file sizes..."
du -sh /var/log/cloudflare-task-executor/

# Check database size
echo "Checking database size..."
psql -U task_queue_user -d task_queue -c "SELECT pg_size_pretty(pg_database_size('task_queue'));"

# Rotate logs
echo "Rotating logs..."
sudo logrotate -f /etc/logrotate.d/cloudflare-task-executor

# Check for security updates
echo "Checking for security updates..."
sudo apt-get update
sudo unattended-upgrade --dry-run

echo "Daily maintenance completed."
```

#### Weekly Maintenance
```bash
#!/bin/bash
# Weekly maintenance script

echo "Starting weekly maintenance..."

# Database maintenance
echo "Performing database maintenance..."
psql -U task_queue_user -d task_queue -c "VACUUM ANALYZE;"
psql -U task_queue_user -d task_queue -c "REINDEX DATABASE task_queue;"

# Check database performance
echo "Checking database performance..."
psql -U task_queue_user -d task_queue -c "SELECT schemaname, tablename, seq_scan, seq_tup_read, idx_scan, idx_tup_fetch FROM pg_stat_user_tables;"

# Application maintenance
echo "Restarting services for memory cleanup..."
sudo systemctl restart cloudflare-task-executor

# Check for application updates
echo "Checking for application updates..."
cd /opt/cloudflare-task-executor/web
git fetch origin
LOCAL=$(git rev-parse HEAD)
REMOTE=$(git rev-parse origin/main)

if [ $LOCAL != $REMOTE ]; then
  echo "Updates available. Consider upgrading."
fi

# Clean temporary files
echo "Cleaning temporary files..."
sudo find /tmp -name "cloudflare-*" -mtime +7 -delete

# Check SSL certificate expiry
echo "Checking SSL certificate expiry..."
sudo certbot certificates

echo "Weekly maintenance completed."
```

#### Monthly Maintenance
```bash
#!/bin/bash
# Monthly maintenance script

echo "Starting monthly maintenance..."

# Full system backup
echo "Creating full system backup..."
sudo tar -czf "/var/backups/cloudflare-task-executor/full-backup-$(date +%Y%m%d).tar.gz" \
  /opt/cloudflare-task-executor \
  /var/log/cloudflare-task-executor \
  /var/lib/cloudflare-task-executor \
  /etc/cloudflare-task-executor

# Database backup verification
echo "Verifying database backups..."
LATEST_BACKUP=$(ls -t /var/backups/cloudflare-task-executor/*.sql.gz | head -1)
if [ -f "$LATEST_BACKUP" ]; then
  gunzip -c "$LATEST_BACKUP" | head -100 | grep -q "PostgreSQL database dump"
  if [ $? -eq 0 ]; then
    echo "Database backup verified successfully."
  else
    echo "WARNING: Database backup verification failed."
  fi
else
  echo "WARNING: No database backup found."
fi

# Security audit
echo "Performing security audit..."
sudo lynis audit system --quick

# Check system performance
echo "Checking system performance..."
uptime
free -h
iostat -x 1 5

# Update documentation
echo "Updating system documentation..."
cd /opt/cloudflare-task-executor
git add .
git commit -m "Monthly documentation update"

echo "Monthly maintenance completed."
```

## Troubleshooting Guide

### Common Issues and Solutions

#### Service Won't Start
```bash
# Check service status
systemctl status cloudflare-task-executor

# Check service logs
journalctl -u cloudflare-task-executor -f

# Check application logs
tail -f /var/log/cloudflare-task-executor/*.log

# Common fixes:
# 1. Check environment variables
echo $DB_HOST $DB_PORT $DB_NAME

# 2. Check database connectivity
psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -c "SELECT 1;"

# 3. Check file permissions
ls -la /opt/cloudflare-task-executor/web/.env
```

#### Database Connection Issues
```bash
# Check database service
systemctl status postgresql

# Check database connectivity
psql -h localhost -p 5432 -U task_queue_user -d task_queue -c "SELECT version();"

# Check database logs
tail -f /var/log/postgresql/postgresql-15-main.log

# Check connection pool
psql -h localhost -p 5432 -U postgres -d postgres -c "SELECT * FROM pg_stat_activity;"

# Common fixes:
# 1. Restart database service
sudo systemctl restart postgresql

# 2. Check database user permissions
psql -h localhost -p 5432 -U postgres -d postgres -c "GRANT ALL PRIVILEGES ON DATABASE task_queue TO task_queue_user;"

# 3. Check firewall rules
sudo ufw status
```

#### Performance Issues
```bash
# Monitor system resources
top -p $(pgrep node)
iostat -x 1 5
free -h

# Monitor database performance
psql -h localhost -p 5432 -U task_queue_user -d task_queue -c "SELECT * FROM pg_stat_activity WHERE state = 'active';"

# Monitor slow queries
psql -h localhost -p 5432 -U task_queue_user -d task_queue -c "SELECT query, calls, total_time, mean_time FROM pg_stat_statements ORDER BY total_time DESC LIMIT 10;"

# Common performance fixes:
# 1. Add database indexes
psql -h localhost -p 5432 -U task_queue_user -d task_queue -c "CREATE INDEX CONCURRENTLY idx_tasks_user_id ON tasks(user_id);"

# 2. Optimize queries
psql -h localhost -p 5432 -U task_queue_user -d task_queue -c "EXPLAIN ANALYZE SELECT * FROM tasks WHERE user_id = 1 ORDER BY created_at DESC LIMIT 10;"

# 3. Increase connection pool
sudo nano /etc/pgbouncer/pgbouncer.ini
```

#### Security Issues
```bash
# Check for failed login attempts
journalctl -u cloudflare-task-executor | grep -i "failed\|error\|denied"

# Check firewall logs
sudo ufw status numbered

# Check SSH security
sudo grep "Failed\|Invalid" /var/log/auth.log

# Check for suspicious processes
ps aux | grep -E "(nc|netcat|ncat|socat|nc.traditional)"

# Security hardening checklist:
# 1. Update system packages
sudo apt-get update && sudo apt-get upgrade -y

# 2. Check for security updates
sudo unattended-upgrade --dry-run

# 3. Verify SSL certificates
sudo certbot certificates

# 4. Check file permissions
find /opt/cloudflare-task-executor -type f -name "*.env" -exec ls -la {} \;
```

## Monitoring Commands

### Real-time Monitoring
```bash
# Monitor application logs
tail -f /var/log/cloudflare-task-executor/*.log

# Monitor system resources
htop
iotop
iftop

# Monitor database
watch -n 1 "psql -h localhost -p 5432 -U task_queue_user -d task_queue -c 'SELECT COUNT(*), status FROM tasks GROUP BY status;'"

# Monitor network connections
ss -tuln | grep 3000
netstat -an | grep 3000

# Monitor Docker containers (if using Docker)
docker ps
docker stats
docker logs -f cloudflare-task-executor-web
```

### Health Checks
```bash
# Application health check
curl -f http://localhost:3000/api/health

# Database health check
psql -h localhost -p 5432 -U task_queue_user -d task_queue -c "SELECT 1;"

# Redis health check
redis-cli ping

# Nginx health check
curl -f http://localhost/health

# System health check
uptime
df -h
free -h
```

This comprehensive deployment documentation provides all the information needed to successfully deploy, configure, and maintain the Cloudflare Mobile Task Executor platform in various environments.