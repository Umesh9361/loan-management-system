# कर्ज व्यवस्थापन प्रणाली (Loan Management System)

## 📋 Overview
Complete multi-tenant loan management system designed for financial institutions and lending companies in India with Marathi language support.

## 🎯 Key Features
- **Multi-tenant Architecture** - Complete data isolation by tenant ID
- **Marathi Language Interface** - देशी भाषेत संपूर्ण व्यवस्था
- **Real-time Cash Management** - ऑटोमॅटिक cash transaction sync
- **Loan Management** - कर्ज नोंदणी, बंद करणे, पुनरोपन
- **Professional Reporting** - व्यावसायिक अहवाल प्रणाली
- **Responsive Design** - Mobile-first approach

## 🚀 Quick Start

### 1. Extract Files
```bash
unzip loan_management_complete.zip
cd loan_management_system
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Setup Database
- Create PostgreSQL database named "loan_management"
- Run DATABASE_SETUP.sql file
- Configure environment variables (see ENVIRONMENT_SETUP.md)

### 4. Configure Environment
Create `.env` file or add to your hosting platform:
```env
DATABASE_URL=postgresql://username:password@host:port/loan_management
SESSION_SECRET=your_random_secret_key
NODE_ENV=production
```

### 5. Start Application
```bash
npm run db:push
npm run dev
```

## 🔑 Default Login
- **Username:** admin
- **Password:** admin123
- **Tenant ID:** TEST

## 📁 File Structure
```
loan_management_system/
├── client/                 # React frontend
├── server/                 # Express backend
├── shared/                 # Shared schemas and types
├── DATABASE_SETUP.sql      # Database schema
├── ENVIRONMENT_SETUP.md    # Environment configuration
├── DEPLOYMENT_GUIDE.md     # Deployment instructions
└── package.json           # Dependencies
```

## 🗄️ Database Information

### Required Tables
- users (authentication)
- companies (tenant company info)
- groups (borrower groups)
- borrowers (customer information)
- loans (loan records)
- cash_transactions (cash book)
- loan_closures (closure records)

### Database Connection
The system uses PostgreSQL with the following environment variables:
- `DATABASE_URL` - Complete connection string
- `PGHOST` - Database host
- `PGPORT` - Database port (default: 5432)
- `PGUSER` - Database username
- `PGPASSWORD` - Database password
- `PGDATABASE` - Database name

## 🔧 Technical Stack
- **Frontend:** React + TypeScript + Tailwind CSS
- **Backend:** Node.js + Express + TypeScript
- **Database:** PostgreSQL + Drizzle ORM
- **Authentication:** Session-based with bcrypt
- **Build Tool:** Vite

## 📊 Business Features

### Loan Management
- कर्ज नोंदणी (Loan Registration)
- कर्ज बंद करणे (Loan Closure)
- कर्ज पुनरोपन (Loan Reopening)
- व्याज गणना (Interest Calculation)

### Cash Management
- रोकड वही (Cash Book)
- ऑटोमॅटिक entries for loan disbursement/closure
- Real-time balance updates
- Party-wise transactions

### Reporting
- भांडवल खाते (Capital Account)
- रोकड वही (Cash Book Report)
- खाते सारांश (Account Summary)
- कर्ज खातेवही (Loan Ledger)

## 🌐 Deployment Options

### Replit Deployment
1. Upload files to Replit workspace
2. Add environment variables in Secrets
3. Enable PostgreSQL database
4. Run `npm install && npm run db:push && npm run dev`

### Local Deployment
1. Install PostgreSQL locally
2. Create database and run DATABASE_SETUP.sql
3. Configure .env file
4. Run `npm install && npm run dev`

### Production Deployment
1. Setup PostgreSQL server
2. Configure environment variables
3. Build and deploy application
4. Run database migrations

## 🔒 Security Features
- Session-based authentication
- Password hashing with bcrypt
- Tenant-based data isolation
- Input validation with Zod
- SQL injection protection via ORM

## 📞 Support
System includes comprehensive documentation:
- DEPLOYMENT_GUIDE.md - Step-by-step deployment
- ENVIRONMENT_SETUP.md - Environment configuration
- DATABASE_SETUP.sql - Complete database schema

## 📜 License
Proprietary software for financial institutions.

---
**Version:** 1.0.0  
**Last Updated:** August 2025  
**Language:** Marathi + English