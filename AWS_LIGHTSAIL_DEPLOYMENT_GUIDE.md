# AWS Lightsail Deployment Guide
## Multi-Tenant Loan Management System

### Overview
This guide will help you deploy your loan management system on AWS Lightsail with Node.js, PostgreSQL database, and proper SSL configuration.

## Prerequisites
- AWS Account with Lightsail access
- Domain name (optional but recommended)
- Basic understanding of Linux commands

## Step 1: Create Lightsail Instance

### 1.1 Instance Configuration
1. Login to AWS Lightsail Console
2. Click "Create instance"
3. Select **Linux/Unix** platform
4. Choose **Node.js** blueprint
5. Select instance plan:
   - **Recommended**: $20/month (2GB RAM, 1vCPU, 60GB SSD)
   - **Minimum**: $10/month (1GB RAM, 1vCPU, 40GB SSD)
6. Name your instance: `loan-management-app`
7. Click "Create instance"

### 1.2 Network Configuration
1. Go to instance management
2. Click "Networking" tab
3. Add these firewall rules:
   ```
   Application: Custom, Protocol: TCP, Port: 5000
   Application: HTTP, Protocol: TCP, Port: 80
   Application: HTTPS, Protocol: TCP, Port: 443
   Application: SSH, Protocol: TCP, Port: 22
   ```

## Step 2: Database Setup

### 2.1 Create PostgreSQL Database
1. In Lightsail console, go to "Databases"
2. Click "Create database"
3. Choose **PostgreSQL**
4. Select plan:
   - **Recommended**: Standard - $30/month (2GB RAM)
   - **Minimum**: Micro - $15/month (1GB RAM)
5. Database settings:
   - Database name: `loanmanagement`
   - Master username: `postgres`
   - Master password: Generate secure password
6. Name: `loan-management-db`
7. Click "Create database"

### 2.2 Database Configuration
Wait for database to be ready, then:
1. Note down the database endpoint
2. Configure database access in your application

## Step 3: Application Deployment

### 3.1 Connect to Instance
```bash
# Download SSH key from Lightsail console
# Connect via SSH
ssh -i /path/to/your/key.pem bitnami@your-instance-ip
```

### 3.2 System Preparation
```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install required packages
sudo apt install -y git postgresql-client nginx certbot python3-certbot-nginx

# Install Node.js 18+ (if not latest)
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Verify installations
node --version
npm --version
git --version
```

### 3.3 Clone and Setup Application
```bash
# Clone your repository
git clone https://github.com/your-username/your-repo.git
cd your-repo

# Install dependencies
npm install

# Create environment file
nano .env
```

### 3.4 Environment Configuration
Create `.env` file with:
```env
NODE_ENV=production
PORT=5000
DATABASE_URL=postgresql://postgres:your-password@your-db-endpoint:5432/loanmanagement
SESSION_SECRET=your-super-secret-key-here

# Optional: Email configuration
SENDGRID_API_KEY=your-sendgrid-key

# Security
ALLOWED_ORIGINS=https://yourdomain.com,https://www.yourdomain.com
```

### 3.5 Database Schema Setup
```bash
# Push database schema
npm run db:push

# If you have initial data/migrations
# Add your database initialization commands here
```

### 3.6 Build Application
```bash
# Build the application
npm run build

# Test the application
npm start

# If successful, stop with Ctrl+C
```

## Step 4: Process Management with PM2

### 4.1 Install and Configure PM2
```bash
# Install PM2 globally
sudo npm install -g pm2

# Create PM2 ecosystem file
nano ecosystem.config.js
```

### 4.2 PM2 Configuration
Create `ecosystem.config.js`:
```javascript
module.exports = {
  apps: [{
    name: 'loan-management',
    script: 'dist/index.js',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production',
      PORT: 5000
    },
    error_file: '/home/bitnami/logs/err.log',
    out_file: '/home/bitnami/logs/out.log',
    log_file: '/home/bitnami/logs/combined.log',
    time: true
  }]
};
```

### 4.3 Start Application with PM2
```bash
# Create logs directory
mkdir -p /home/bitnami/logs

# Start application
pm2 start ecosystem.config.js

# Save PM2 configuration
pm2 save

# Setup PM2 startup script
pm2 startup
# Follow the instructions shown

# Check status
pm2 status
pm2 logs
```

## Step 5: Nginx Reverse Proxy

### 5.1 Nginx Configuration
```bash
# Create Nginx configuration
sudo nano /etc/nginx/sites-available/loan-management
```

### 5.2 Nginx Config File
```nginx
server {
    listen 80;
    server_name your-domain.com www.your-domain.com;

    location / {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        
        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    # Static files (if needed)
    location /static/ {
        alias /home/bitnami/your-repo/public/;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

### 5.3 Enable Nginx Site
```bash
# Enable site
sudo ln -s /etc/nginx/sites-available/loan-management /etc/nginx/sites-enabled/

# Remove default site
sudo rm /etc/nginx/sites-enabled/default

# Test configuration
sudo nginx -t

# Restart Nginx
sudo systemctl restart nginx
sudo systemctl enable nginx
```

## Step 6: SSL Certificate (Let's Encrypt)

### 6.1 Domain Setup
1. Point your domain to Lightsail instance IP
2. Wait for DNS propagation (can take up to 24 hours)

### 6.2 SSL Certificate Installation
```bash
# Install SSL certificate
sudo certbot --nginx -d your-domain.com -d www.your-domain.com

# Follow the prompts
# Choose option 2 (redirect HTTP to HTTPS)

# Test auto-renewal
sudo certbot renew --dry-run
```

## Step 7: Firewall and Security

### 7.1 UFW Firewall Setup
```bash
# Install and configure UFW
sudo ufw enable

# Allow necessary ports
sudo ufw allow 22    # SSH
sudo ufw allow 80    # HTTP
sudo ufw allow 443   # HTTPS

# Check status
sudo ufw status
```

### 7.2 Security Hardening
```bash
# Secure SSH (optional)
sudo nano /etc/ssh/sshd_config

# Disable password authentication (use keys only)
# PasswordAuthentication no
# PubkeyAuthentication yes

# Restart SSH service
sudo systemctl restart ssh
```

## Step 8: Monitoring and Maintenance

### 8.1 Log Monitoring
```bash
# Check application logs
pm2 logs

# Check Nginx logs
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log

# Check system logs
sudo journalctl -u nginx -f
```

### 8.2 Backup Strategy
```bash
# Create backup script
nano ~/backup.sh
```

Backup script content:
```bash
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/home/bitnami/backups"

# Create backup directory
mkdir -p $BACKUP_DIR

# Database backup
pg_dump $DATABASE_URL > $BACKUP_DIR/db_backup_$DATE.sql

# Application backup
tar -czf $BACKUP_DIR/app_backup_$DATE.tar.gz /home/bitnami/your-repo

# Keep only last 7 days of backups
find $BACKUP_DIR -name "*.sql" -mtime +7 -delete
find $BACKUP_DIR -name "*.tar.gz" -mtime +7 -delete

echo "Backup completed: $DATE"
```

```bash
# Make executable
chmod +x ~/backup.sh

# Add to crontab for daily backup
crontab -e
# Add line: 0 2 * * * /home/bitnami/backup.sh
```

## Step 9: Domain Configuration (Optional)

### 9.1 Custom Domain Setup
If you have a domain:
1. Update DNS A record to point to Lightsail IP
2. Update Nginx configuration with your domain
3. Re-run Certbot for SSL certificate

### 9.2 Static IP (Recommended)
1. Go to Lightsail console
2. Click "Networking" → "Create static IP"
3. Attach to your instance
4. Update DNS records with static IP

## Step 10: Final Testing

### 10.1 Application Testing
```bash
# Check all services are running
sudo systemctl status nginx
pm2 status

# Test application endpoints
curl -I http://your-domain.com
curl -I https://your-domain.com

# Test database connection
psql $DATABASE_URL -c "SELECT version();"
```

### 10.2 Performance Optimization
```bash
# Enable Nginx gzip compression
sudo nano /etc/nginx/nginx.conf

# Add in http block:
# gzip on;
# gzip_types text/plain application/json application/javascript text/css;

# Restart Nginx
sudo systemctl restart nginx
```

## Troubleshooting

### Common Issues

1. **Application not starting**:
   ```bash
   pm2 logs
   # Check for port conflicts, database connection issues
   ```

2. **Database connection errors**:
   ```bash
   # Verify DATABASE_URL format
   # Check database security group allows connection
   ```

3. **SSL certificate issues**:
   ```bash
   sudo certbot certificates
   sudo nginx -t
   ```

4. **High memory usage**:
   ```bash
   # Monitor with htop
   sudo apt install htop
   htop
   
   # Adjust PM2 memory limits in ecosystem.config.js
   ```

## Deployment Checklist

- [ ] Lightsail instance created and running
- [ ] PostgreSQL database created and accessible
- [ ] Application code deployed and built
- [ ] Environment variables configured
- [ ] Database schema pushed
- [ ] PM2 process manager setup
- [ ] Nginx reverse proxy configured
- [ ] SSL certificate installed
- [ ] Firewall configured
- [ ] Backup strategy implemented
- [ ] Domain pointed to instance (if applicable)
- [ ] Application tested and working

## Cost Estimation

**Monthly Costs:**
- Lightsail Instance (2GB): $20/month
- PostgreSQL Database (2GB): $30/month
- Data Transfer: $0.09/GB (usually minimal)
- **Total**: ~$50/month

**Optional:**
- Domain name: $10-15/year
- Static IP: $5/month (if instance stopped frequently)

## Maintenance

### Regular Tasks
- Monitor application logs weekly
- Update dependencies monthly
- Review and rotate SSL certificates (automatic with Let's Encrypt)
- Perform database backups (automated)
- Monitor disk usage and clean logs

### Security Updates
```bash
# Monthly system updates
sudo apt update && sudo apt upgrade -y

# Restart services if needed
sudo systemctl restart nginx
pm2 restart all
```

This guide provides a complete production-ready deployment of your loan management system on AWS Lightsail with proper security, monitoring, and maintenance procedures.