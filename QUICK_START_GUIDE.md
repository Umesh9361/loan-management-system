# Quick Start Guide - 15 मिनिटात सेटअप

## झटपट सेटअप (Express Setup)

### Pre-requisites डाउनलोड (एकाच वेळी)
1. **Node.js**: https://nodejs.org/ (LTS version)
2. **Git**: https://git-scm.com/
3. **PostgreSQL**: https://www.postgresql.org/download/
4. **VS Code**: https://code.visualstudio.com/

### सगळं एकाच वेळी इंस्टॉल करा
1. सगळे installers डाउनलोड करा
2. एक एक करून install करा (default settings वापरा)
3. PostgreSQL मध्ये password: `admin123` सेट करा

### प्रोजेक्ट सेटअप (5 मिनिटे)

#### Step 1: फोल्डर तयार करा
```
D:\loan-management-system
```

#### Step 2: Replit कोड डाउनलोड करा
- Replit > Tools > Download as ZIP
- Extract करा फोल्डर मध्ये

#### Step 3: Command Prompt (Windows Key + R, cmd टाइप करा)
```cmd
cd D:\loan-management-system
npm install
```

#### Step 4: Environment File (.env तयार करा)
```env
DATABASE_URL=postgresql://postgres:admin123@localhost:5432/loan_management
SESSION_SECRET=my-super-secret-key-for-loan-management
NODE_ENV=development
PORT=5000
```

#### Step 5: डेटाबेस तयार करा
pgAdmin4 उघडा:
- Servers > PostgreSQL > Databases > Right-click > Create Database
- Name: `loan_management`

#### Step 6: Run Application
```cmd
npm run db:push
npm run dev
```

#### Step 7: Browser मध्ये उघडा
```
http://localhost:5000
```

### Login करा
- **Super Admin**: SUPER_ADMIN / admin / admin123
- **Tenant Admin**: TEST / admin / admin123
- **User**: TEST / demouser / password

## Done! 🎉

तुमचे एप्लिकेशन local machine वर चालू आहे!

### Daily Use
```cmd
cd D:\loan-management-system
npm run dev
```

### Stop Application
Command Prompt मध्ये `Ctrl + C`

## Common Issues & Quick Fixes

| समस्या | समाधान |
|--------|--------|
| Database connection error | PostgreSQL service start करा |
| Port already in use | .env मध्ये PORT=3000 करा |
| npm install fails | `npm cache clean --force` करा |
| Node not found | System restart करा |

## File Structure
```
📁 loan-management-system/
├── 📁 client/          (Frontend)
├── 📁 server/          (Backend)
├── 📁 shared/          (Common)
├── 📄 package.json     (Dependencies)
└── 📄 .env            (Settings)
```

तुमचा local development environment तयार आहे! 🚀