# Cloudflare Integration Documentation

## Overview

The Cloudflare Mobile Task Executor leverages Cloudflare's powerful infrastructure to provide secure, reliable, and performant remote task execution capabilities. This integration enables secure tunneling, zero-trust authentication, and global content delivery while maintaining enterprise-grade security and compliance.

## Features

### Core Cloudflare Features

#### Cloudflare Tunnel Integration
- **Secure Remote Access**: Zero-trust network access to internal resources
- **Mutual TLS Authentication**: Certificate-based authentication for enhanced security
- **Automatic Certificate Management**: Seamless certificate rotation and renewal
- **Load Balancing**: Geographic and intelligent load distribution
- **High Availability**: Multi-region redundancy and failover capabilities

#### Cloudflare Access Integration
- **Identity-Based Access Control**: User and group-based access policies
- **Single Sign-On (SSO)**: Integration with identity providers (Okta, Azure AD, Google)
- **Multi-Factor Authentication**: Step-up authentication for sensitive operations
- **Device Posture Checking**: Conditional access based on device health
- **Session Management**: Real-time session control and revocation

#### Content Delivery Network (CDN)
- **Global Edge Network**: Content delivery from 275+ data centers worldwide
- **Smart Caching**: Intelligent caching strategies for optimal performance
- **DDoS Protection**: Layer 3/4 and Layer 7 DDoS attack mitigation
- **Web Application Firewall**: Real-time threat protection and mitigation
- **Bot Management**: Automated bot detection and mitigation

### Advanced Cloudflare Features

#### Zero Trust Security
- **BeyondCorp Model**: Beyond traditional perimeter-based security
- **Least Privilege Access**: Principle of minimum required access
- **Continuous Validation**: Ongoing authentication and authorization
- **Microsegmentation**: Fine-grained network segmentation
- **Threat Intelligence**: Real-time threat detection and response

#### Performance Optimization
- **Argo Smart Routing**: Optimized network paths for reduced latency
- **HTTP/3 Support**: Latest HTTP protocol for improved performance
- **Brotli Compression**: Advanced content compression algorithms
- **Early Hints**: HTTP 103 Early Hints for faster page loads
- **AMP Real URL**: Accelerated Mobile Pages optimization

#### Observability and Analytics
- **Cloudflare Analytics**: Real-time performance and security metrics
- **Logpush Integration**: Automated log streaming to SIEM tools
- **Workers Insights**: Detailed Cloudflare Workers performance data
- **RUM Monitoring**: Real User Monitoring for end-user experience
- **Custom Metrics**: Application-specific metric collection and analysis

## Technical Implementation

### Cloudflare Tunnel Setup

#### Tunnel Configuration
```yaml
# cloudflared configuration file
tunnel: your-tunnel-uuid
credentials-file: /etc/cloudflared/your-tunnel-uuid.json

ingress:
  - hostname: tasks.yourdomain.com
    service: http://localhost:3000
    originRequest:
      connectTimeout: 30s
      tlsTimeout: 30s
      tcpKeepAlive: 30s
      noHappyEyeballs: false
      
  - hostname: api.tasks.yourdomain.com
    service: http://localhost:3000
    originRequest:
      connectTimeout: 30s
      tlsTimeout: 30s
      tcpKeepAlive: 30s
      
  - service: http_status:404
```

#### Origin Certificate Management
```bash
#!/bin/bash
# Origin certificate management script

# Generate origin certificate
cloudflared tunnel origin-certs create \
  --hostname "*.yourdomain.com,tasks.yourdomain.com" \
  --validity-days 365 \
  --output /etc/ssl/cloudflare-origin.crt

# Install certificate
cp /etc/ssl/cloudflare-origin.crt /etc/ssl/certs/
update-ca-certificates

# Configure web server to use origin certificate
cat > /etc/nginx/sites-available/tasks << 'EOF'
server {
    listen 443 ssl http2;
    server_name tasks.yourdomain.com;
    
    # Origin certificate
    ssl_certificate /etc/ssl/cloudflare-origin.crt;
    ssl_certificate_key /etc/ssl/private/cloudflare-origin.key;
    
    # SSL configuration
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;
    
    # HSTS
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    
    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
EOF
```

#### Tunnel Management Service
```javascript
// Cloudflare Tunnel Management Service
class CloudflareTunnelManager {
  constructor() {
    this.tunnelId = process.env.CLOUDFLARE_TUNNEL_ID;
    this.accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
    this.apiToken = process.env.CLOUDFLARE_API_TOKEN;
    this.baseURL = `https://api.cloudflare.com/client/v4/accounts/${this.accountId}`;
  }

  async getTunnelStatus() {
    try {
      const response = await fetch(`${this.baseURL}/cfd_tunnel/${this.tunnelId}/connections`, {
        headers: {
          'Authorization': `Bearer ${this.apiToken}`,
          'Content-Type': 'application/json'
        }
      });

      const data = await response.json();
      return data.result;
    } catch (error) {
      throw new Error(`Failed to get tunnel status: ${error.message}`);
    }
  }

  async createTunnel(name) {
    try {
      const response = await fetch(`${this.baseURL}/cfd_tunnel`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: name,
          tunnel_secret: this.generateTunnelSecret()
        })
      });

      const data = await response.json();
      return data.result;
    } catch (error) {
      throw new Error(`Failed to create tunnel: ${error.message}`);
    }
  }

  async deleteTunnel() {
    try {
      const response = await fetch(`${this.baseURL}/cfd_tunnel/${this.tunnelId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${this.apiToken}`,
          'Content-Type': 'application/json'
        }
      });

      const data = await response.json();
      return data.success;
    } catch (error) {
      throw new Error(`Failed to delete tunnel: ${error.message}`);
    }
  }

  async configureDNS(hostname, tunnelId) {
    try {
      // Get zone ID
      const zonesResponse = await fetch(`${this.baseURL}/zones?name=${hostname.split('.').slice(-2).join('.')}`, {
        headers: {
          'Authorization': `Bearer ${this.apiToken}`,
          'Content-Type': 'application/json'
        }
      });

      const zonesData = await zonesResponse.json();
      const zoneId = zonesData.result[0].id;

      // Create DNS record
      const dnsResponse = await fetch(`${this.baseURL}/zones/${zoneId}/dns_records`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          type: 'CNAME',
          name: hostname,
          content: `${tunnelId}.cfargotunnel.com`,
          proxied: true,
          ttl: 1
        })
      });

      const dnsData = await dnsResponse.json();
      return dnsData.result;
    } catch (error) {
      throw new Error(`Failed to configure DNS: ${error.message}`);
    }
  }

  generateTunnelSecret() {
    return crypto.randomBytes(32).toString('base64');
  }

  async getTunnelConfiguration() {
    try {
      const response = await fetch(`${this.baseURL}/cfd_tunnel/${this.tunnelId}/configurations`, {
        headers: {
          'Authorization': `Bearer ${this.apiToken}`,
          'Content-Type': 'application/json'
        }
      });

      const data = await response.json();
      return data.result.config;
    } catch (error) {
      throw new Error(`Failed to get tunnel configuration: ${error.message}`);
    }
  }

  async updateTunnelConfiguration(config) {
    try {
      const response = await fetch(`${this.baseURL}/cfd_tunnel/${this.tunnelId}/configurations`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${this.apiToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          config: config
        })
      });

      const data = await response.json();
      return data.success;
    } catch (error) {
      throw new Error(`Failed to update tunnel configuration: ${error.message}`);
    }
  }
}
```

### Cloudflare Access Integration

#### Access Policy Configuration
```yaml
# Cloudflare Access Policy
{
  "name": "Task Executor Access Policy",
  "decision": "allow",
  "include": [
    {
      "email_domain": {
        "domain": "yourdomain.com"
      }
    },
    {
      "email": {
        "email": "admin@yourdomain.com"
      }
    }
  ],
  "require": [
    {
      "device_posture": {
        "integration_uid": "device-posture-integration-id"
      }
    },
    {
      "geo": {
        "country_code": "US"
      }
    }
  ],
  "purpose_justification_required": true,
  "purpose_justification_prompt": "Please explain why you need access to the task executor"
}
```

#### Access Token Management
```javascript
// Cloudflare Access Token Management
class CloudflareAccessTokenManager {
  constructor() {
    this.teamDomain = process.env.CLOUDFLARE_TEAM_DOMAIN;
    this.clientId = process.env.CLOUDFLARE_ACCESS_CLIENT_ID;
    this.clientSecret = process.env.CLOUDFLARE_ACCESS_CLIENT_SECRET;
  }

  async exchangeCodeForToken(code, redirectUri) {
    try {
      const response = await fetch(`https://${this.teamDomain}/cdn-cgi/access/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          client_id: this.clientId,
          client_secret: this.clientSecret,
          code: code,
          redirect_uri: redirectUri
        })
      });

      const data = await response.json();
      return {
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        expiresAt: Date.now() + (data.expires_in * 1000)
      };
    } catch (error) {
      throw new Error(`Failed to exchange code for token: ${error.message}`);
    }
  }

  async validateAccessToken(token) {
    try {
      const response = await fetch(`https://${this.teamDomain}/cdn-cgi/access/token`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const data = await response.json();
      
      // Verify token claims
      const now = Math.floor(Date.now() / 1000);
      if (data.exp < now) {
        throw new Error('Token has expired');
      }

      if (!data.aud.includes(this.clientId)) {
        throw new Error('Invalid audience');
      }

      return {
        valid: true,
        claims: data,
        userId: data.sub,
        email: data.email,
        groups: data.groups || []
      };
    } catch (error) {
      return {
        valid: false,
        error: error.message
      };
    }
  }

  async refreshAccessToken(refreshToken) {
    try {
      const response = await fetch(`https://${this.teamDomain}/cdn-cgi/access/token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          client_id: this.clientId,
          client_secret: this.clientSecret,
          refresh_token: refreshToken
        })
      });

      const data = await response.json();
      return {
        accessToken: data.access_token,
        refreshToken: data.refresh_token || refreshToken,
        expiresAt: Date.now() + (data.expires_in * 1000)
      };
    } catch (error) {
      throw new Error(`Failed to refresh access token: ${error.message}`);
    }
  }

  async getUserInfo(token) {
    try {
      const response = await fetch(`https://${this.teamDomain}/cdn-cgi/access/user`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const data = await response.json();
      return data;
    } catch (error) {
      throw new Error(`Failed to get user info: ${error.message}`);
    }
  }
}
```

### Origin Server Security

#### Mutual TLS Authentication
```bash
#!/bin/bash
# Mutual TLS setup script

# Generate CA private key
openssl genrsa -out ca.key 4096

# Generate CA certificate
openssl req -x509 -new -nodes -key ca.key -sha256 -days 1095 -out ca.crt -subj "/CN=Cloudflare Task Executor CA"

# Generate server private key
openssl genrsa -out server.key 2048

# Generate server certificate signing request
openssl req -new -key server.key -out server.csr -subj "/CN=tasks.yourdomain.com"

# Generate server certificate
openssl x509 -req -in server.csr -CA ca.crt -CAkey ca.key -CAcreateserial -out server.crt -days 365 -sha256

# Configure NGINX for mutual TLS
cat > /etc/nginx/sites-available/mutual-tls << 'EOF'
server {
    listen 443 ssl http2;
    server_name tasks.yourdomain.com;
    
    # Server certificate
    ssl_certificate /etc/ssl/certs/server.crt;
    ssl_certificate_key /etc/ssl/private/server.key;
    
    # Client certificate verification
    ssl_client_certificate /etc/ssl/certs/ca.crt;
    ssl_verify_client on;
    ssl_verify_depth 1;
    
    # OCSP stapling
    ssl_stapling on;
    ssl_stapling_verify on;
    resolver 8.8.8.8 8.8.4.4 valid=300s;
    resolver_timeout 5s;
    
    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-SSL-Client-Cert $ssl_client_cert;
    }
}
EOF
```

#### Origin Server Configuration
```nginx
# Advanced NGINX configuration for Cloudflare integration
upstream task_executor_backend {
    server localhost:3000 weight=1 max_fails=3 fail_timeout=30s;
    server 127.0.0.1:3001 weight=1 max_fails=3 fail_timeout=30s backup;
}

server {
    listen 443 ssl http2;
    server_name tasks.yourdomain.com;
    
    # SSL Configuration
    ssl_certificate /etc/ssl/certs/cloudflare_origin.crt;
    ssl_certificate_key /etc/ssl/private/cloudflare_origin.key;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;
    
    # HSTS
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    
    # OCSP Stapling
    ssl_stapling on;
    ssl_stapling_verify on;
    resolver 1.1.1.1 1.0.0.1 valid=300s;
    resolver_timeout 5s;
    
    # Security Headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "no-referrer-when-downgrade" always;
    add_header Content-Security-Policy "default-src 'self' https:; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline';" always;
    
    # Rate Limiting
    limit_req_zone $binary_remote_addr zone=api:10m rate=100r/s;
    limit_req_zone $binary_remote_addr zone=login:10m rate=10r/m;
    
    # Cloudflare IP ranges (trusted proxies)
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
    
    # API endpoints
    location /api/ {
        limit_req zone=api burst=20 nodelay;
        
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
        proxy_buffering on;
        proxy_buffer_size 4k;
        proxy_buffers 8 4k;
        proxy_busy_buffers_size 8k;
    }
    
    # WebSocket connections
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
    
    # Static files
    location / {
        root /var/www/public;
        try_files $uri $uri/ /index.html;
        
        # Cache static files
        location ~* \.(jpg|jpeg|png|gif|ico|css|js)$ {
            expires 1y;
            add_header Cache-Control "public, immutable";
        }
    }
    
    # Health check
    location /health {
        access_log off;
        return 200 "healthy\n";
        add_header Content-Type text/plain;
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
```

## Security Implementation

### Zero Trust Architecture

#### Identity Verification
```javascript
// Zero Trust Identity Verification Service
class ZeroTrustIdentityService {
  constructor() {
    this.cloudflareTeamDomain = process.env.CLOUDFLARE_TEAM_DOMAIN;
    this.minimumAssuranceLevel = process.env.MINIMUM_ASSURANCE_LEVEL || 'medium';
  }

  async verifyIdentity(request) {
    try {
      // Extract Cloudflare Access JWT from request
      const cfJwt = this.extractCfJwt(request);
      
      if (!cfJwt) {
        throw new Error('No Cloudflare Access token found');
      }

      // Verify JWT signature and claims
      const verificationResult = await this.verifyCfJwt(cfJwt);
      
      if (!verificationResult.valid) {
        throw new Error('Invalid Cloudflare Access token');
      }

      // Check assurance level
      const assuranceLevel = verificationResult.claims.amr?.[0] || 'low';
      if (!this.meetsAssuranceRequirements(assuranceLevel)) {
        throw new Error(`Insufficient assurance level: ${assuranceLevel}`);
      }

      // Validate device posture
      const devicePosture = await this.validateDevicePosture(
        verificationResult.claims.device_sessions
      );
      
      if (!devicePosture.compliant) {
        throw new Error('Device does not meet security requirements');
      }

      // Validate geolocation
      const geolocationValid = await this.validateGeolocation(
        request.headers['cf-ipcountry']
      );
      
      if (!geolocationValid) {
        throw new Error('Access denied from this location');
      }

      return {
        verified: true,
        userId: verificationResult.claims.sub,
        email: verificationResult.claims.email,
        groups: verificationResult.claims.groups || [],
        assuranceLevel: assuranceLevel,
        deviceInfo: verificationResult.claims.device_sessions,
        location: request.headers['cf-ipcountry']
      };
    } catch (error) {
      console.error('Identity verification failed:', error);
      return {
        verified: false,
        error: error.message
      };
    }
  }

  extractCfJwt(request) {
    const authHeader = request.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      return authHeader.substring(7);
    }
    
    // Check for cookie-based token
    const cookies = this.parseCookies(request.headers.cookie);
    return cookies['CF_Authorization'];
  }

  async verifyCfJwt(token) {
    try {
      const response = await fetch(`https://${this.cloudflareTeamDomain}/cdn-cgi/access/certs`);
      const certsData = await response.json();
      
      // Verify against available certificates
      for (const cert of certsData.public_certs) {
        try {
          const publicKey = await this.importPublicKey(cert.cert);
          const decoded = jwt.verify(token, publicKey, { algorithms: ['RS256'] });
          
          return {
            valid: true,
            claims: decoded
          };
        } catch (verifyError) {
          // Try next certificate
          continue;
        }
      }
      
      return { valid: false, error: 'No valid certificate found' };
    } catch (error) {
      return { valid: false, error: error.message };
    }
  }

  meetsAssuranceRequirements(currentLevel) {
    const levels = {
      'low': 1,
      'medium': 2,
      'high': 3
    };
    
    return levels[currentLevel] >= levels[this.minimumAssuranceLevel];
  }

  async validateDevicePosture(deviceSessions) {
    try {
      // Check if device has valid session
      if (!deviceSessions || Object.keys(deviceSessions).length === 0) {
        return { compliant: false, reason: 'No device session found' };
      }

      // Validate device compliance status
      for (const [sessionId, session] of Object.entries(deviceSessions)) {
        if (session.status !== 'compliant') {
          return { 
            compliant: false, 
            reason: `Device session ${sessionId} is not compliant`,
            sessionId: sessionId
          };
        }
      }

      return { compliant: true };
    } catch (error) {
      return { compliant: false, error: error.message };
    }
  }

  async validateGeolocation(countryCode) {
    try {
      // Check if country is in allowed list
      const allowedCountries = process.env.ALLOWED_COUNTRIES?.split(',') || ['US'];
      
      if (allowedCountries.includes('*')) {
        return true; // Allow all countries
      }
      
      return allowedCountries.includes(countryCode);
    } catch (error) {
      return false;
    }
  }

  parseCookies(cookieHeader) {
    if (!cookieHeader) return {};
    
    const cookies = {};
    cookieHeader.split(';').forEach(cookie => {
      const [name, value] = cookie.trim().split('=');
      if (name && value) {
        cookies[name] = decodeURIComponent(value);
      }
    });
    
    return cookies;
  }

  async importPublicKey(certString) {
    // Convert PEM to DER
    const pemHeader = "-----BEGIN CERTIFICATE-----";
    const pemFooter = "-----END CERTIFICATE-----";
    const pemContents = certString.substring(
      pemHeader.length,
      certString.length - pemFooter.length
    );
    const binaryDerString = atob(pemContents);
    const der = new Uint8Array(binaryDerString.length);
    for (let i = 0; i < binaryDerString.length; i++) {
      der[i] = binaryDerString.charCodeAt(i);
    }
    
    // Import as crypto key
    return crypto.subtle.importKey(
      'spki',
      der,
      { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
      false,
      ['verify']
    );
  }
}
```

### Network Security

#### Cloudflare WAF Integration
```javascript
// Cloudflare WAF Integration Service
class CloudflareWafService {
  constructor() {
    this.accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
    this.apiToken = process.env.CLOUDFLARE_API_TOKEN;
    this.zoneId = process.env.CLOUDFLARE_ZONE_ID;
  }

  async getWafRules() {
    try {
      const response = await fetch(
        `https://api.cloudflare.com/client/v4/zones/${this.zoneId}/firewall/rules`,
        {
          headers: {
            'Authorization': `Bearer ${this.apiToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      const data = await response.json();
      return data.result;
    } catch (error) {
      throw new Error(`Failed to get WAF rules: ${error.message}`);
    }
  }

  async createCustomRule(name, expression, action, description = '') {
    try {
      const response = await fetch(
        `https://api.cloudflare.com/client/v4/zones/${this.zoneId}/firewall/rules`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.apiToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            filter: {
              expression: expression,
              paused: false
            },
            action: action,
            description: description,
            ref: name,
            enabled: true
          })
        }
      );

      const data = await response.json();
      return data.result;
    } catch (error) {
      throw new Error(`Failed to create custom rule: ${error.message}`);
    }
  }

  async updateSecurityLevel(level) {
    try {
      const response = await fetch(
        `https://api.cloudflare.com/client/v4/zones/${this.zoneId}/settings/security_level`,
        {
          method: 'PATCH',
          headers: {
            'Authorization': `Bearer ${this.apiToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            value: level // 'off', 'essentially_off', 'low', 'medium', 'high', 'under_attack'
          })
        }
      );

      const data = await response.json();
      return data.success;
    } catch (error) {
      throw new Error(`Failed to update security level: ${error.message}`);
    }
  }

  async configureRateLimiting(rules) {
    try {
      for (const rule of rules) {
        await this.createRateLimitRule(rule);
      }
      return true;
    } catch (error) {
      throw new Error(`Failed to configure rate limiting: ${error.message}`);
    }
  }

  async createRateLimitRule(ruleConfig) {
    try {
      const response = await fetch(
        `https://api.cloudflare.com/client/v4/zones/${this.zoneId}/rate_limits`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.apiToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            threshold: ruleConfig.threshold,
            period: ruleConfig.period,
            action: {
              mode: ruleConfig.action.mode,
              timeout: ruleConfig.action.timeout
            },
            match: {
              request: {
                url_pattern: ruleConfig.match.url_pattern,
                schemes: ruleConfig.match.schemes,
                methods: ruleConfig.match.methods
              },
              response: ruleConfig.match.response
            },
            description: ruleConfig.description,
            bypass_url_patterns: ruleConfig.bypass_url_patterns,
            correlated_requests_count: ruleConfig.correlated_requests_count,
            correlated_invocations_time_period: ruleConfig.correlated_invocations_time_period
          })
        }
      );

      const data = await response.json();
      return data.result;
    } catch (error) {
      throw new Error(`Failed to create rate limit rule: ${error.message}`);
    }
  }

  async getSecurityEvents(startTime, endTime) {
    try {
      const params = new URLSearchParams({
        limit: '1000',
        order: 'time',
        direction: 'desc'
      });

      if (startTime) params.append('start', startTime);
      if (endTime) params.append('end', endTime);

      const response = await fetch(
        `https://api.cloudflare.com/client/v4/zones/${this.zoneId}/security/events?${params}`,
        {
          headers: {
            'Authorization': `Bearer ${this.apiToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      const data = await response.json();
      return data.result;
    } catch (error) {
      throw new Error(`Failed to get security events: ${error.message}`);
    }
  }
}
```

## Performance Optimization

### Argo Smart Routing
```bash
#!/bin/bash
# Argo Smart Routing optimization script

# Enable Argo Smart Routing
cloudflared tunnel route lb your-tunnel-id your-domain.com

# Configure Argo Analytics
cloudflared tunnel metrics enable

# Set up custom domains for better routing
cat > argo-routing-config.yaml << 'EOF'
routing:
  smart_routing: true
  geo_routing: true
  failover_routing: true
  
analytics:
  enable: true
  sampling_rate: 0.1
  
optimization:
  tcp_keepalive: 30s
  connect_timeout: 10s
  idle_timeout: 300s
  max_concurrent_streams: 100
EOF

# Apply routing configuration
cloudflared tunnel route apply argo-routing-config.yaml
```

#### Performance Monitoring
```javascript
// Cloudflare Performance Monitoring Service
class CloudflarePerformanceMonitor {
  constructor() {
    this.accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
    this.apiToken = process.env.CLOUDFLARE_API_TOKEN;
    this.zoneId = process.env.CLOUDFLARE_ZONE_ID;
  }

  async getZoneAnalytics(start, end, dimensions = []) {
    try {
      const params = new URLSearchParams({
        since: start.toISOString(),
        until: end.toISOString(),
        continuous: 'true'
      });

      if (dimensions.length > 0) {
        params.append('dimensions', dimensions.join(','));
      }

      const response = await fetch(
        `https://api.cloudflare.com/client/v4/zones/${this.zoneId}/analytics/dashboard?${params}`,
        {
          headers: {
            'Authorization': `Bearer ${this.apiToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      const data = await response.json();
      return data.result;
    } catch (error) {
      throw new Error(`Failed to get zone analytics: ${error.message}`);
    }
  }

  async getLoadBalancingAnalytics() {
    try {
      const response = await fetch(
        `https://api.cloudflare.com/client/v4/accounts/${this.accountId}/load_balancers/pools`,
        {
          headers: {
            'Authorization': `Bearer ${this.apiToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      const data = await response.json();
      return data.result;
    } catch (error) {
      throw new Error(`Failed to get load balancing analytics: ${error.message}`);
    }
  }

  async getRumAnalytics() {
    try {
      const response = await fetch(
        `https://api.cloudflare.com/client/v4/accounts/${this.accountId}/rum/vitals/groups`,
        {
          headers: {
            'Authorization': `Bearer ${this.apiToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      const data = await response.json();
      return data.result;
    } catch (error) {
      throw new Error(`Failed to get RUM analytics: ${error.message}`);
    }
  }

  async getBandwidthUsage() {
    try {
      const today = new Date();
      const thirtyDaysAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);

      const response = await fetch(
        `https://api.cloudflare.com/client/v4/zones/${this.zoneId}/analytics/dashboard`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.apiToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            since: thirtyDaysAgo.toISOString(),
            until: today.toISOString(),
            metrics: ['sum(bytes)']
          })
        }
      );

      const data = await response.json();
      return data.result;
    } catch (error) {
      throw new Error(`Failed to get bandwidth usage: ${error.message}`);
    }
  }

  async getCachePerformance() {
    try {
      const response = await fetch(
        `https://api.cloudflare.com/client/v4/zones/${this.zoneId}/argo/smart_routing/enable`,
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${this.apiToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      const data = await response.json();
      return data.result;
    } catch (error) {
      throw new Error(`Failed to get cache performance: ${error.message}`);
    }
  }

  async generatePerformanceReport(days = 30) {
    try {
      const endDate = new Date();
      const startDate = new Date(endDate.getTime() - days * 24 * 60 * 60 * 1000);

      const [analytics, bandwidth, rum] = await Promise.all([
        this.getZoneAnalytics(startDate, endDate, ['country', 'colo']),
        this.getBandwidthUsage(),
        this.getRumAnalytics()
      ]);

      return {
        period: {
          start: startDate,
          end: endDate
        },
        traffic: {
          totalRequests: analytics.totals.requests,
          totalBandwidth: bandwidth.bytes,
          cacheHitRatio: analytics.totals['cacheRatio']
        },
        performance: {
          avgResponseTime: rum.avgLoadTime,
          firstByteTime: rum.avgFirstByte,
          domContentLoaded: rum.avgDomContentLoaded
        },
        security: {
          threatsBlocked: analytics.totals.threats,
          wafTriggers: analytics.totals['waf.matches']
        },
        geography: analytics.totals.byCountry
      };
    } catch (error) {
      throw new Error(`Failed to generate performance report: ${error.message}`);
    }
  }
}
```

## Monitoring and Analytics

### Cloudflare Logpush Integration
```javascript
// Cloudflare Logpush Integration Service
class CloudflareLogpushService {
  constructor() {
    this.accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
    this.apiToken = process.env.CLOUDFLARE_API_TOKEN;
    this.zoneId = process.env.CLOUDFLARE_ZONE_ID;
  }

  async createLogpushJob(destination, logpullOptions = {}) {
    try {
      const response = await fetch(
        `https://api.cloudflare.com/client/v4/zones/${this.zoneId}/logpush/jobs`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.apiToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            name: 'task-executor-access-logs',
            logpull_options: logpullOptions,
            destination_conf: destination,
            dataset: 'http_requests',
            enabled: true,
            frequency: 'high'
          })
        }
      );

      const data = await response.json();
      return data.result;
    } catch (error) {
      throw new Error(`Failed to create Logpush job: ${error.message}`);
    }
  }

  async createLogpushDestination(name, type, config) {
    try {
      const response = await fetch(
        `https://api.cloudflare.com/client/v4/accounts/${this.accountId}/logpush/destinations`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.apiToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            name: name,
            type: type,
            config: config
          })
        }
      );

      const data = await response.json();
      return data.result;
    } catch (error) {
      throw new Error(`Failed to create Logpush destination: ${error.message}`);
    }
  }

  async getLogpushJobs() {
    try {
      const response = await fetch(
        `https://api.cloudflare.com/client/v4/zones/${this.zoneId}/logpush/jobs`,
        {
          headers: {
            'Authorization': `Bearer ${this.apiToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      const data = await response.json();
      return data.result;
    } catch (error) {
      throw new Error(`Failed to get Logpush jobs: ${error.message}`);
    }
  }

  async getLogpullRecords(start, end, fields = [], filters = {}) {
    try {
      const params = new URLSearchParams({
        start: start.toISOString(),
        end: end.toISOString(),
        timestamps: 'iso8601'
      });

      if (fields.length > 0) {
        params.append('fields', fields.join(','));
      }

      if (Object.keys(filters).length > 0) {
        params.append('filters', JSON.stringify(filters));
      }

      const response = await fetch(
        `https://api.cloudflare.com/client/v4/zones/${this.zoneId}/logpush/retrieve?${params}`,
        {
          headers: {
            'Authorization': `Bearer ${this.apiToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      const data = await response.json();
      return data.result;
    } catch (error) {
      throw new Error(`Failed to get Logpull records: ${error.message}`);
    }
  }

  async setupS3Logging(bucket, region, accessKeyId, secretAccessKey) {
    try {
      // Create destination
      const destination = await this.createLogpushDestination(
        'task-executor-s3-logs',
        's3',
        {
          bucket: bucket,
          region: region,
          access_key_id: accessKeyId,
          secret_access_key: secretAccessKey,
          path_template: '${DATE}/${DATETIME}_${LOGPUSHID}.json.gz'
        }
      );

      // Create job
      const job = await this.createLogpushJob(
        `s3://${bucket}?region=${region}&access-key-id=${accessKeyId}`,
        {
          fields: 'ClientIP,ClientRequestHost,ClientRequestMethod,ClientRequestURI,Timestamp,EdgeResponseStatus,EdgeResponseBytes,BotScore,BotScoreSrc,WAFAction,WAFRuleID,WAFRuleMessage,SecurityLevel',
          timestamp_format: 'iso8601',
          sample: 0.1
        }
      );

      return { destination, job };
    } catch (error) {
      throw new Error(`Failed to setup S3 logging: ${error.message}`);
    }
  }

  async setupSplunkLogging(host, port, token) {
    try {
      const destination = await this.createLogpushDestination(
        'task-executor-splunk-logs',
        'splunk',
        {
          host: host,
          port: port,
          token: token,
          index: 'cloudflare_logs',
          sourcetype: 'cloudflare:http_requests'
        }
      );

      const job = await this.createLogpushJob(
        `splunk://${host}:${port}?channel=${token}`,
        {
          fields: 'ClientIP,ClientRequestHost,ClientRequestMethod,ClientRequestURI,Timestamp,EdgeResponseStatus,EdgeResponseBytes,BotScore,WAFAction,WAFRuleMessage',
          timestamp_format: 'rfc3339'
        }
      );

      return { destination, job };
    } catch (error) {
      throw new Error(`Failed to setup Splunk logging: ${error.message}`);
    }
  }

  async setupElasticsearchLogging(host, port, username, password, index) {
    try {
      const destination = await this.createLogpushDestination(
        'task-executor-elasticsearch-logs',
        'elasticsearch',
        {
          host: host,
          port: port,
          username: username,
          password: password,
          index: index,
          type: '_doc'
        }
      );

      const job = await this.createLogpushJob(
        `elasticsearch://${username}:${password}@${host}:${port}/${index}/_doc`,
        {
          fields: 'ClientIP,ClientRequestHost,ClientRequestMethod,ClientRequestURI,Timestamp,EdgeResponseStatus,BotScore,WAFAction',
          timestamp_format: 'epoch_ms'
        }
      );

      return { destination, job };
    } catch (error) {
      throw new Error(`Failed to setup Elasticsearch logging: ${error.message}`);
    }
  }
}
```

### Real-time Monitoring Dashboard
```javascript
// Cloudflare Monitoring Dashboard Service
class CloudflareMonitoringDashboard {
  constructor() {
    this.cloudflareService = new CloudflarePerformanceMonitor();
    this.logpushService = new CloudflareLogpushService();
    this.websocketClients = new Set();
  }

  async initializeDashboard() {
    try {
      // Set up real-time data streaming
      this.setupWebSocketServer();
      
      // Start periodic data collection
      this.startDataCollection();
      
      // Set up alerting system
      this.setupAlerting();
      
      return true;
    } catch (error) {
      console.error('Failed to initialize dashboard:', error);
      return false;
    }
  }

  setupWebSocketServer() {
    const WebSocket = require('ws');
    const wss = new WebSocket.Server({ port: 8080 });

    wss.on('connection', (ws) => {
      this.websocketClients.add(ws);
      
      ws.on('close', () => {
        this.websocketClients.delete(ws);
      });
      
      ws.on('error', (error) => {
        console.error('WebSocket error:', error);
        this.websocketClients.delete(ws);
      });
    });

    this.websocketServer = wss;
  }

  broadcastData(data) {
    this.websocketClients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify(data));
      }
    });
  }

  async startDataCollection() {
    // Collect data every 30 seconds
    setInterval(async () => {
      try {
        const dashboardData = await this.collectDashboardData();
        this.broadcastData({
          type: 'dashboard_update',
          data: dashboardData,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        console.error('Dashboard data collection failed:', error);
      }
    }, 30000);

    // Collect hourly reports
    setInterval(async () => {
      try {
        const hourlyReport = await this.generateHourlyReport();
        this.broadcastData({
          type: 'hourly_report',
          data: hourlyReport,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        console.error('Hourly report generation failed:', error);
      }
    }, 3600000); // 1 hour
  }

  async collectDashboardData() {
    try {
      const now = new Date();
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

      const [analytics, securityEvents, logStats] = await Promise.all([
        this.cloudflareService.getZoneAnalytics(oneHourAgo, now),
        this.cloudflareService.getSecurityEvents(oneHourAgo, now),
        this.getLogStatistics()
      ]);

      return {
        traffic: {
          requests: analytics.totals.requests,
          bandwidth: analytics.totals.bandwidth,
          cacheHitRatio: analytics.totals['cacheRatio']
        },
        performance: {
          avgResponseTime: analytics.totals['avgOriginResponseTime'],
          originErrorRate: analytics.totals['originErrorRate']
        },
        security: {
          threatsBlocked: securityEvents.length,
          wafTriggers: analytics.totals['waf.matches'],
          ddosAttacks: analytics.totals['ddos.alarms']
        },
        uptime: {
          lastCheck: new Date().toISOString(),
          status: 'operational'
        }
      };
    } catch (error) {
      console.error('Failed to collect dashboard data:', error);
      return null;
    }
  }

  async generateHourlyReport() {
    try {
      const report = await this.cloudflareService.generatePerformanceReport(1);
      
      return {
        type: 'performance_report',
        period: report.period,
        summary: {
          totalRequests: report.traffic.totalRequests,
          totalBandwidth: report.traffic.totalBandwidth,
          avgResponseTime: report.performance.avgResponseTime,
          threatsBlocked: report.security.threatsBlocked
        },
        trends: await this.calculateTrends(report),
        insights: await this.generateInsights(report)
      };
    } catch (error) {
      console.error('Failed to generate hourly report:', error);
      return null;
    }
  }

  async calculateTrends(report) {
    try {
      // Compare with previous period
      const previousPeriod = await this.cloudflareService.generatePerformanceReport(2);
      
      const previousTraffic = previousPeriod.traffic.totalRequests;
      const currentTraffic = report.traffic.totalRequests;
      
      const trendPercentage = ((currentTraffic - previousTraffic) / previousTraffic) * 100;
      
      return {
        trafficTrend: {
          percentage: trendPercentage,
          direction: trendPercentage > 0 ? 'up' : 'down'
        },
        performanceTrend: {
          avgResponseTime: report.performance.avgResponseTime,
          improvement: previousPeriod.performance.avgResponseTime > report.performance.avgResponseTime
        }
      };
    } catch (error) {
      console.error('Failed to calculate trends:', error);
      return {};
    }
  }

  async generateInsights(report) {
    try {
      const insights = [];

      // Performance insights
      if (report.performance.avgResponseTime > 500) {
        insights.push({
          type: 'performance',
          severity: 'warning',
          message: 'Average response time is above 500ms',
          recommendation: 'Consider optimizing origin server performance'
        });
      }

      // Security insights
      if (report.security.threatsBlocked > 100) {
        insights.push({
          type: 'security',
          severity: 'warning',
          message: 'High number of threats blocked in the past hour',
          recommendation: 'Review security rules and consider tightening policies'
        });
      }

      // Cache insights
      if (report.traffic.cacheHitRatio < 0.7) {
        insights.push({
          type: 'caching',
          severity: 'info',
          message: 'Cache hit ratio below 70%',
          recommendation: 'Consider implementing more aggressive caching strategies'
        });
      }

      return insights;
    } catch (error) {
      console.error('Failed to generate insights:', error);
      return [];
    }
  }

  async getLogStatistics() {
    try {
      // Get logpush job statistics
      const jobs = await this.logpushService.getLogpushJobs();
      const activeJobs = jobs.filter(job => job.enabled);
      
      return {
        totalJobs: jobs.length,
        activeJobs: activeJobs.length,
        successRate: activeJobs.length > 0 ? 
          activeJobs.filter(job => job.last_complete).length / activeJobs.length : 0
      };
    } catch (error) {
      console.error('Failed to get log statistics:', error);
      return {};
    }
  }

  setupAlerting() {
    // Set up alert thresholds
    const thresholds = {
      traffic_spike: 200, // 200% increase in traffic
      high_error_rate: 0.05, // 5% error rate
      security_incidents: 10, // 10 security incidents per hour
      performance_degradation: 1000 // 1 second response time
    };

    // Check for alerts every minute
    setInterval(async () => {
      try {
        const alerts = await this.checkAlerts(thresholds);
        if (alerts.length > 0) {
          this.broadcastAlerts(alerts);
        }
      } catch (error) {
        console.error('Alert checking failed:', error);
      }
    }, 60000); // 1 minute
  }

  async checkAlerts(thresholds) {
    try {
      const now = new Date();
      const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);
      
      const analytics = await this.cloudflareService.getZoneAnalytics(
        fiveMinutesAgo, 
        now
      );

      const alerts = [];

      // Check for traffic spikes
      const currentRequests = analytics.totals.requests;
      const baselineRequests = await this.getBaselineTraffic();
      
      if (baselineRequests > 0) {
        const spikePercentage = ((currentRequests - baselineRequests) / baselineRequests) * 100;
        if (spikePercentage > thresholds.traffic_spike) {
          alerts.push({
            type: 'traffic_spike',
            severity: 'warning',
            message: `Traffic spike detected: ${spikePercentage.toFixed(1)}% increase`,
            currentValue: currentRequests,
            baselineValue: baselineRequests,
            timestamp: now.toISOString()
          });
        }
      }

      // Check for high error rates
      const errorRate = analytics.totals['originErrorRate'] || 0;
      if (errorRate > thresholds.high_error_rate) {
        alerts.push({
          type: 'high_error_rate',
          severity: 'critical',
          message: `High error rate detected: ${(errorRate * 100).toFixed(2)}%`,
          currentValue: errorRate,
          threshold: thresholds.high_error_rate,
          timestamp: now.toISOString()
        });
      }

      // Check for security incidents
      const securityEvents = await this.cloudflareService.getSecurityEvents(
        fiveMinutesAgo, 
        now
      );
      
      if (securityEvents.length > thresholds.security_incidents) {
        alerts.push({
          type: 'security_incidents',
          severity: 'critical',
          message: `High number of security incidents: ${securityEvents.length}`,
          currentValue: securityEvents.length,
          threshold: thresholds.security_incidents,
          timestamp: now.toISOString()
        });
      }

      return alerts;
    } catch (error) {
      console.error('Alert checking failed:', error);
      return [];
    }
  }

  async getBaselineTraffic() {
    try {
      // Get average traffic from last 24 hours (excluding current hour)
      const now = new Date();
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
      
      const analytics = await this.cloudflareService.getZoneAnalytics(
        yesterday, 
        oneHourAgo
      );
      
      return analytics.totals.requests / 23; // Average per hour (excluding current)
    } catch (error) {
      console.error('Failed to get baseline traffic:', error);
      return 0;
    }
  }

  broadcastAlerts(alerts) {
    alerts.forEach(alert => {
      this.broadcastData({
        type: 'alert',
        data: alert,
        timestamp: new Date().toISOString()
      });
    });
  }

  async shutdown() {
    if (this.websocketServer) {
      this.websocketServer.close();
    }
  }
}
```

## API Integration Examples

### Node.js Integration
```javascript
// Cloudflare Integration Example
const express = require('express');
const app = express();

// Cloudflare middleware
const cloudflareMiddleware = (req, res, next) => {
  // Extract real IP from Cloudflare headers
  const realIP = req.headers['cf-connecting-ip'] || 
                 req.headers['x-forwarded-for'] || 
                 req.connection.remoteAddress;
  
  req.realIP = realIP;
  
  // Extract country information
  req.country = req.headers['cf-ipcountry'] || 'unknown';
  
  // Extract ray ID for tracing
  req.rayId = req.headers['cf-ray'] || 'unknown';
  
  next();
};

app.use(cloudflareMiddleware);

// Protected route with Cloudflare Access validation
app.get('/api/protected', async (req, res) => {
  try {
    // Validate Cloudflare Access token
    const cfJwt = req.headers.authorization?.replace('Bearer ', '');
    
    if (!cfJwt) {
      return res.status(401).json({ error: 'Cloudflare Access token required' });
    }

    const zeroTrustService = new ZeroTrustIdentityService();
    const identityVerification = await zeroTrustService.verifyIdentity(req);

    if (!identityVerification.verified) {
      return res.status(403).json({ 
        error: 'Access denied', 
        reason: identityVerification.error 
      });
    }

    // Process protected request
    res.json({
      message: 'Access granted',
      user: {
        id: identityVerification.userId,
        email: identityVerification.email,
        groups: identityVerification.groups,
        country: req.country,
        rayId: req.rayId
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Cloudflare Webhook Handler
app.post('/webhooks/cloudflare', express.raw({ type: 'application/json' }), (req, res) => {
  try {
    // Verify webhook signature (if configured)
    const signature = req.headers['x-webhook-signature'];
    const timestamp = req.headers['x-webhook-timestamp'];
    
    // Process Cloudflare webhook payload
    const payload = JSON.parse(req.body);
    
    console.log('Cloudflare webhook received:', payload);
    
    // Handle different webhook types
    switch (payload.type) {
      case 'incident.alert':
        handleIncidentAlert(payload);
        break;
      case 'access.approval':
        handleAccessApproval(payload);
        break;
      case 'tunnel.status':
        handleTunnelStatus(payload);
        break;
      default:
        console.warn('Unknown Cloudflare webhook type:', payload.type);
    }
    
    res.status(200).json({ received: true });
  } catch (error) {
    console.error('Webhook processing failed:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

app.listen(3000, () => {
  console.log('Cloudflare integrated server running on port 3000');
});
```

### Python Integration
```python
# Cloudflare Integration Example (Python)
import asyncio
import aiohttp
import jwt
from aiohttp import web
from cryptography.x509 import load_pem_x509_certificate
from cryptography.hazmat.backends import default_backend

class CloudflareIntegration:
    def __init__(self, team_domain, client_id=None, client_secret=None):
        self.team_domain = team_domain
        self.client_id = client_id
        self.client_secret = client_secret
        self.session = None
    
    async def __aenter__(self):
        self.session = aiohttp.ClientSession()
        return self
    
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        if self.session:
            await self.session.close()
    
    async def get_public_keys(self):
        """Get Cloudflare Access public keys"""
        url = f"https://{self.team_domain}/cdn-cgi/access/certs"
        async with self.session.get(url) as response:
            data = await response.json()
            return data['public_certs']
    
    async def verify_access_token(self, token):
        """Verify Cloudflare Access JWT token"""
        try:
            # Get public keys
            certs = await self.get_public_keys()
            
            # Try to verify with each certificate
            for cert_data in certs:
                try:
                    cert_pem = cert_data['cert']
                    cert = load_pem_x509_certificate(
                        cert_pem.encode(), 
                        default_backend()
                    )
                    public_key = cert.public_key()
                    
                    # Verify token
                    decoded = jwt.decode(
                        token,
                        public_key,
                        algorithms=['RS256'],
                        audience=self.client_id if self.client_id else None
                    )
                    
                    return {
                        'valid': True,
                        'claims': decoded,
                        'user_id': decoded.get('sub'),
                        'email': decoded.get('email'),
                        'groups': decoded.get('groups', [])
                    }
                except jwt.InvalidTokenError:
                    continue
            
            return {'valid': False, 'error': 'No valid certificate found'}
        except Exception as e:
            return {'valid': False, 'error': str(e)}

# Web application with Cloudflare integration
async def protected_handler(request):
    try:
        # Extract Cloudflare Access token
        auth_header = request.headers.get('Authorization', '')
        if not auth_header.startswith('Bearer '):
            return web.json_response(
                {'error': 'Cloudflare Access token required'}, 
                status=401
            )
        
        token = auth_header[7:]  # Remove 'Bearer ' prefix
        
        # Verify token using Cloudflare integration
        async with CloudflareIntegration(
            team_domain=os.getenv('CLOUDFLARE_TEAM_DOMAIN'),
            client_id=os.getenv('CLOUDFLARE_ACCESS_CLIENT_ID')
        ) as cf:
            verification = await cf.verify_access_token(token)
            
            if not verification['valid']:
                return web.json_response(
                    {'error': 'Invalid Cloudflare Access token'}, 
                    status=403
                )
            
            # Process request with verified identity
            return web.json_response({
                'message': 'Access granted',
                'user': {
                    'id': verification['user_id'],
                    'email': verification['email'],
                    'groups': verification['groups'],
                    'country': request.headers.get('CF-IPCountry', 'unknown'),
                    'ray_id': request.headers.get('CF-Ray', 'unknown')
                }
            })
    
    except Exception as e:
        return web.json_response({'error': str(e)}, status=500)

# Cloudflare webhook handler
async def webhook_handler(request):
    try:
        # Get raw body for signature verification
        body = await request.read()
        
        # Extract webhook headers
        signature = request.headers.get('X-Webhook-Signature')
        timestamp = request.headers.get('X-Webhook-Timestamp')
        
        # Parse JSON payload
        import json
        payload = json.loads(body)
        
        print(f"Cloudflare webhook received: {payload}")
        
        # Handle different webhook types
        webhook_type = payload.get('type', 'unknown')
        
        if webhook_type == 'incident.alert':
            await handle_incident_alert(payload)
        elif webhook_type == 'access.approval':
            await handle_access_approval(payload)
        elif webhook_type == 'tunnel.status':
            await handle_tunnel_status(payload)
        
        return web.json_response({'received': True})
    
    except Exception as e:
        print(f"Webhook processing failed: {e}")
        return web.json_response({'error': str(e)}, status=500)

async def handle_incident_alert(payload):
    """Handle Cloudflare incident alerts"""
    print(f"Incident alert: {payload}")
    # Implement incident handling logic

async def handle_access_approval(payload):
    """Handle Cloudflare Access approvals"""
    print(f"Access approval: {payload}")
    # Implement access approval logic

async def handle_tunnel_status(payload):
    """Handle Cloudflare Tunnel status updates"""
    print(f"Tunnel status: {payload}")
    # Implement tunnel status handling logic

# Application setup
def create_app():
    app = web.Application()
    
    # Add routes
    app.router.add_get('/api/protected', protected_handler)
    app.router.add_post('/webhooks/cloudflare', webhook_handler)
    
    return app

if __name__ == '__main__':
    app = create_app()
    web.run_app(app, host='0.0.0.0', port=3000)
```

This comprehensive Cloudflare integration documentation provides developers with all the information needed to understand, implement, and maintain the Cloudflare features within the Cloudflare Mobile Task Executor platform.