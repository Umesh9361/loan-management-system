# Loan Management System - Deployment Guide

## System Overview
Complete multi-tenant loan management system with Marathi language support.

## Database Environment Variables (Required)
```
DATABASE_URL=postgresql://username:password@host:port/database
PGHOST=your_postgres_host
PGPORT=5432
PGUSER=your_username
PGPASSWORD=your_password
PGDATABASE=your_database_name
```

## Installation Instructions

### 1. Install Dependencies
```bash
npm install
```

### 2. Setup Database
```bash
npm run db:push
```

### 3. Start Application
```bash
npm run dev
```

## Default Login Credentials
- **Username:** admin
- **Password:** admin123
- **Tenant ID:** TEST

## Key Features
- Multi-tenant loan management
- Real-time cash transaction sync
- Marathi language interface
- Professional reporting system
- Cash balance tracking
- Loan closure and reopening

## Database Schema
The system automatically creates all required tables via Drizzle ORM:
- users
- companies  
- groups
- borrowers
- loans
- cash_transactions
- loan_closures
- transactions

## Deployment Notes
- Application runs on port 5000
- Frontend served by Vite
- Backend uses Express.js
- PostgreSQL database required
- Session-based authentication