# Local Laptop Development Setup Guide
## Multi-Tenant Loan Management System

### Overview
यह guide आपको अपने personal laptop पर complete development environment setup करने में help करेगा। आप Windows, macOS, या Linux किसी भी operating system पर यह setup कर सकते हैं।

## System Requirements

### Minimum Requirements:
- **RAM**: 8GB (16GB recommended)
- **Storage**: 5GB free space
- **OS**: Windows 10/11, macOS 10.15+, Ubuntu 20.04+
- **Internet**: Stable internet connection

### Recommended Specifications:
- **RAM**: 16GB या अधिक
- **CPU**: Intel i5/AMD Ryzen 5 या better
- **Storage**: SSD storage preferred

## Step 1: Essential Software Installation

### 1.1 Node.js Installation

#### Windows:
```bash
# Download from official website
# Visit: https://nodejs.org/
# Download LTS version (18.x या 20.x)
# Run installer and follow instructions

# Verify installation
node --version
npm --version
```

#### macOS:
```bash
# Using Homebrew (recommended)
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
brew install node

# Verify installation
node --version
npm --version
```

#### Linux (Ubuntu/Debian):
```bash
# Update package manager
sudo apt update

# Install Node.js 18.x
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Verify installation
node --version
npm --version
```

### 1.2 PostgreSQL Database Installation

#### Windows:
```bash
# Download PostgreSQL installer
# Visit: https://www.postgresql.org/download/windows/
# Download version 14+ installer
# During installation:
# - Set password for 'postgres' user (remember this!)
# - Port: 5432 (default)
# - Add to PATH when asked

# Verify installation (Command Prompt/PowerShell)
psql --version
```

#### macOS:
```bash
# Using Homebrew
brew install postgresql

# Start PostgreSQL service
brew services start postgresql

# Create database user
psql postgres
CREATE USER postgres WITH PASSWORD 'your_password';
ALTER USER postgres CREATEDB;
\q

# Verify installation
psql --version
```

#### Linux (Ubuntu/Debian):
```bash
# Install PostgreSQL
sudo apt install postgresql postgresql-contrib

# Start and enable service
sudo systemctl start postgresql
sudo systemctl enable postgresql

# Set password for postgres user
sudo -u postgres psql
\password postgres
# Enter your password twice
\q

# Verify installation
psql --version
```

### 1.3 Git Installation

#### Windows:
```bash
# Download Git for Windows
# Visit: https://git-scm.com/download/win
# Run installer with default settings

# Verify installation (Git Bash/Command Prompt)
git --version
```

#### macOS:
```bash
# Git is usually pre-installed
# If not available, install via Homebrew
brew install git

# Verify installation
git --version
```

#### Linux:
```bash
# Install Git
sudo apt install git

# Verify installation
git --version
```

### 1.4 Code Editor Installation

#### Recommended: Visual Studio Code
```bash
# Visit: https://code.visualstudio.com/
# Download and install for your OS

# Recommended Extensions:
# - TypeScript and JavaScript Language Features
# - ES7+ React/Redux/React-Native snippets
# - PostgreSQL (by Chris Kolkman)
# - Prettier - Code formatter
# - ESLint
# - GitLens
```

## Step 2: Project Setup

### 2.1 Clone Repository
```bash
# Create development folder
mkdir ~/Development
cd ~/Development

# Clone your project (replace with your repo URL)
git clone https://github.com/your-username/loan-management-system.git
cd loan-management-system

# Or download ZIP if no git repository
# Extract ZIP file to ~/Development/loan-management-system
```

### 2.2 Install Project Dependencies
```bash
# Install all required packages
npm install

# This will install all dependencies listed in package.json
# Wait for installation to complete (may take 5-10 minutes)
```

### 2.3 Database Setup

#### Create Local Database
```bash
# Connect to PostgreSQL as postgres user
psql -U postgres

# Create database for your project
CREATE DATABASE loanmanagement;

# Create application user (optional but recommended)
CREATE USER loanapp WITH PASSWORD 'your_app_password';
GRANT ALL PRIVILEGES ON DATABASE loanmanagement TO loanapp;

# Exit PostgreSQL
\q
```

#### Alternative: Using pgAdmin (GUI Tool)
```bash
# Download pgAdmin from: https://www.pgadmin.org/download/
# Install and configure
# Create database: loanmanagement
# Create user: loanapp with appropriate permissions
```

### 2.4 Environment Configuration

#### Create .env File
```bash
# Create .env file in project root
# Windows: type nul > .env
# macOS/Linux: touch .env

# Edit .env file with following content:
```

#### .env File Content:
```env
# Application Environment
NODE_ENV=development
PORT=5000

# Database Configuration
DATABASE_URL=postgresql://postgres:your_password@localhost:5432/loanmanagement

# Alternative with separate parameters
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=your_password
DB_NAME=loanmanagement

# Session Secret (generate a random string)
SESSION_SECRET=your_super_secret_session_key_change_this_in_production

# Email Configuration (Optional - for testing)
SENDGRID_API_KEY=your_sendgrid_api_key_if_needed

# Development Settings
DEBUG=true
LOG_LEVEL=debug

# CORS Settings
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:5000

# File Upload Settings (if using file uploads)
MAX_FILE_SIZE=5242880
UPLOAD_PATH=./uploads
```

## Step 3: Database Schema Setup

### 3.1 Initialize Database Schema
```bash
# Push database schema (create all tables)
npm run db:push

# This command will:
# - Connect to your PostgreSQL database
# - Create all required tables
# - Set up proper relationships and indexes
```

### 3.2 Verify Database Setup
```bash
# Connect to database and check tables
psql -U postgres -d loanmanagement

# List all tables
\dt

# You should see tables like:
# - users
# - companies  
# - groups
# - borrowers
# - loans
# - transactions
# - loan_closures
# - cash_transactions
# - parties
# - sessions

# Exit
\q
```

## Step 4: Development Tools Setup

### 4.1 Install Global Development Tools
```bash
# Install useful global packages
npm install -g typescript tsx nodemon

# Verify installations
tsc --version
tsx --version
nodemon --version
```

### 4.2 Database Management Tools

#### Option 1: pgAdmin (Recommended)
- Download from: https://www.pgadmin.org/
- GUI interface for PostgreSQL
- Easy database management

#### Option 2: Command Line Tools
```bash
# Already installed with PostgreSQL
# psql - Command line interface
# pg_dump - Backup utility
# pg_restore - Restore utility
```

### 4.3 API Testing Tools

#### Option 1: Postman
- Download from: https://www.postman.com/
- GUI for API testing
- Import API collections

#### Option 2: Thunder Client (VS Code Extension)
- Install in VS Code
- Lightweight API testing

#### Option 3: curl (Command Line)
```bash
# Test API endpoints
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"tenantId":"TEST","username":"admin","password":"admin123"}'
```

## Step 5: Running the Application

### 5.1 Development Mode
```bash
# Start development server
npm run dev

# This will:
# - Start backend server on port 5000
# - Start frontend development server
# - Enable hot reloading
# - Show detailed logs

# You should see:
# ✅ Database connection established
# ✅ Server running on port 5000
# ✅ Frontend accessible at http://localhost:3000 (if separate)
```

### 5.2 Production Build (Testing)
```bash
# Build application
npm run build

# Start production server
npm start

# Test production build locally
```

### 5.3 Access Application
```bash
# Open browser and visit:
# http://localhost:5000

# Default login credentials:
# Tenant ID: TEST
# Username: admin
# Password: admin123
```

## Step 6: Development Workflow

### 6.1 Code Structure
```
project-root/
├── client/               # Frontend React code
│   ├── src/
│   │   ├── components/   # Reusable components
│   │   ├── pages/        # Page components
│   │   ├── hooks/        # Custom hooks
│   │   └── lib/          # Utilities
├── server/               # Backend Node.js code
│   ├── routes/           # API routes
│   ├── db.ts            # Database connection
│   └── index.ts         # Server entry point
├── shared/               # Shared code
│   ├── schema.ts         # Database schema
│   └── types.ts          # TypeScript types
├── .env                  # Environment variables
├── package.json          # Dependencies
└── tsconfig.json        # TypeScript config
```

### 6.2 Common Development Commands
```bash
# Start development server
npm run dev

# Type checking
npm run check

# Database schema push
npm run db:push

# Build for production
npm run build

# Start production server
npm start
```

### 6.3 Database Operations
```bash
# Backup database
pg_dump -U postgres loanmanagement > backup.sql

# Restore database
psql -U postgres loanmanagement < backup.sql

# Reset database (careful!)
npm run db:push --force
```

## Step 7: Troubleshooting

### 7.1 Common Issues and Solutions

#### Port Already in Use
```bash
# Find process using port 5000
# Windows:
netstat -ano | findstr :5000
taskkill /PID <process_id> /F

# macOS/Linux:
lsof -i :5000
kill -9 <process_id>
```

#### Database Connection Issues
```bash
# Check PostgreSQL service status
# Windows: Check Services app
# macOS: brew services list
# Linux: sudo systemctl status postgresql

# Test database connection
psql -U postgres -h localhost -p 5432 -d loanmanagement
```

#### Node.js Version Issues
```bash
# Check Node.js version
node --version

# Should be 16.x or higher
# If older version, reinstall Node.js
```

#### npm Install Issues
```bash
# Clear npm cache
npm cache clean --force

# Delete node_modules and reinstall
rm -rf node_modules
npm install
```

### 7.2 Performance Issues

#### Slow Database Queries
```bash
# Enable query logging in PostgreSQL
# Edit postgresql.conf:
# log_statement = 'all'
# log_duration = on

# Restart PostgreSQL service
```

#### Memory Issues
```bash
# Monitor memory usage
# Windows: Task Manager
# macOS: Activity Monitor  
# Linux: htop or top

# Increase Node.js memory limit if needed
node --max-old-space-size=4096 server/index.js
```

## Step 8: Development Best Practices

### 8.1 Version Control
```bash
# Create feature branch
git checkout -b feature/new-feature

# Make changes and commit
git add .
git commit -m "Add new feature"

# Push to remote
git push origin feature/new-feature
```

### 8.2 Code Quality
```bash
# Format code (if Prettier configured)
npx prettier --write .

# Lint code (if ESLint configured)
npx eslint . --fix

# Type check
npx tsc --noEmit
```

### 8.3 Testing
```bash
# Run tests (if configured)
npm test

# Watch mode for continuous testing
npm run test:watch
```

## Step 9: Deployment Preparation

### 9.1 Environment Variables
```bash
# Create .env.production for production settings
# Never commit .env files to version control
# Use different database for production
```

### 9.2 Build Optimization
```bash
# Optimize build for production
NODE_ENV=production npm run build

# Test production build locally
NODE_ENV=production npm start
```

## Step 10: Additional Tools (Optional)

### 10.1 Database GUI Alternatives
- **DBeaver**: Universal database tool
- **TablePlus**: Modern database client
- **DataGrip**: JetBrains database IDE

### 10.2 Development Environment Enhancements
```bash
# Install Oh My Zsh (macOS/Linux)
sh -c "$(curl -fsSL https://raw.github.com/ohmyzsh/ohmyzsh/master/tools/install.sh)"

# Install Windows Terminal (Windows)
# Download from Microsoft Store
```

### 10.3 Docker Setup (Advanced)
```dockerfile
# Dockerfile for containerized development
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
EXPOSE 5000
CMD ["npm", "run", "dev"]
```

```yaml
# docker-compose.yml
version: '3.8'
services:
  app:
    build: .
    ports:
      - "5000:5000"
    environment:
      - DATABASE_URL=postgresql://postgres:password@db:5432/loanmanagement
    depends_on:
      - db
  
  db:
    image: postgres:14
    environment:
      POSTGRES_DB: loanmanagement
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: password
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data

volumes:
  postgres_data:
```

## Quick Start Checklist

- [ ] Node.js 18+ installed
- [ ] PostgreSQL 14+ installed and running
- [ ] Git installed
- [ ] Code editor (VS Code) installed
- [ ] Project cloned/downloaded
- [ ] Dependencies installed (`npm install`)
- [ ] Database created and configured
- [ ] Environment variables set (.env file)
- [ ] Database schema pushed (`npm run db:push`)
- [ ] Development server started (`npm run dev`)
- [ ] Application accessible at http://localhost:5000
- [ ] Default admin login working

## Support and Resources

### Documentation
- **Node.js**: https://nodejs.org/docs/
- **PostgreSQL**: https://www.postgresql.org/docs/
- **React**: https://reactjs.org/docs/
- **TypeScript**: https://www.typescriptlang.org/docs/

### Community Help
- Stack Overflow
- GitHub Issues
- Discord/Slack communities

### Local Development Tips
1. Keep database backups regularly
2. Use version control for all changes
3. Test on different browsers
4. Monitor console logs for errors
5. Use debugging tools in browser/editor

This comprehensive guide will help you set up a complete local development environment for your multi-tenant loan management system. Follow each step carefully and refer to troubleshooting section if you encounter any issues.