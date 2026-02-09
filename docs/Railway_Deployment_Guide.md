# 🚂 Railway Deployment Guide
## Loan Management System - संपूर्ण Deploy मार्गदर्शिका

**तयार केले**: January 2026  
**प्रोजेक्ट**: Multi-Tenant Loan Management System  
**Technology Stack**: Node.js + Express + PostgreSQL + React + TypeScript

---

## 📋 अनुक्रमणिका (Table of Contents)

1. [पूर्वतयारी (Prerequisites)](#1-पूर्वतयारी-prerequisites)
2. [Railway Account Setup](#2-railway-account-setup)
3. [GitHub वर Code Push करा](#3-github-वर-code-push-करा)
4. [Railway वर Project Create करा](#4-railway-वर-project-create-करा)
5. [PostgreSQL Database Add करा](#5-postgresql-database-add-करा)
6. [Environment Variables सेट करा](#6-environment-variables-सेट-करा)
7. [Database Migration (Schema Push)](#7-database-migration-schema-push)
8. [Data Migration (Existing Data Transfer)](#8-data-migration-existing-data-transfer)
9. [Public URL Generate करा](#9-public-url-generate-करा)
10. [Troubleshooting](#10-troubleshooting)
11. [Railway CLI Commands Reference](#11-railway-cli-commands-reference)
12. [Pricing Information](#12-pricing-information)

---

## 1. पूर्वतयारी (Prerequisites)

### आवश्यक गोष्टी:

| क्रमांक | आवश्यकता | कशासाठी |
|--------|----------|---------|
| 1 | GitHub Account | Code repository साठी |
| 2 | Railway Account | Hosting साठी |
| 3 | Git Installed | Version control साठी |
| 4 | Node.js (v18+) | Local testing साठी |

### GitHub Account नसल्यास:
1. https://github.com वर जा
2. "Sign up" click करा
3. Email, password, username टाका
4. Email verify करा

### Git Install करण्यासाठी:
**Windows:**
```bash
# Git for Windows download करा
https://git-scm.com/download/win
```

**Mac:**
```bash
brew install git
```

**Linux:**
```bash
sudo apt-get install git
```

---

## 2. Railway Account Setup

### Step 2.1: Railway वर Sign Up

1. **Browser मध्ये उघडा**: https://railway.app
2. **"Login" button click करा** (उजव्या बाजूला वरती)
3. **"Continue with GitHub" निवडा** (सर्वात सोपे)
4. **GitHub authorization द्या**
5. **Account verify करा**

### Step 2.2: Railway Dashboard

Login केल्यावर आपल्याला Dashboard दिसेल:
- **Projects**: आपले सर्व projects
- **Usage**: Resource usage
- **Settings**: Account settings

---

## 3. GitHub वर Code Push करा

### Step 3.1: नवीन Repository Create करा

1. https://github.com/new वर जा
2. **Repository name**: `loan-management-system`
3. **Visibility**: Private (recommended) किंवा Public
4. **"Create repository" click करा**

### Step 3.2: Local Code Push करा

Terminal/Command Prompt मध्ये खालील commands run करा:

```bash
# 1. Project directory मध्ये जा
cd /path/to/your/project

# 2. Git initialize करा (पहिल्यांदाच असल्यास)
git init

# 3. सर्व files staging area मध्ये add करा
git add .

# 4. Commit करा
git commit -m "Initial commit - Loan Management System for Railway deployment"

# 5. Main branch set करा
git branch -M main

# 6. Remote origin add करा (YOUR_USERNAME बदला)
git remote add origin https://github.com/YOUR_USERNAME/loan-management-system.git

# 7. Code push करा
git push -u origin main
```

### Step 3.3: Push Verify करा

GitHub repository page refresh करा. आपले सर्व files दिसायला हवेत:
- `client/` folder
- `server/` folder
- `shared/` folder
- `package.json`
- इतर files

---

## 4. Railway वर Project Create करा

### Step 4.1: नवीन Project सुरू करा

1. **Railway Dashboard उघडा**: https://railway.app/dashboard
2. **"+ New Project" button click करा**
3. **"Deploy from GitHub repo" निवडा**

### Step 4.2: Repository Connect करा

1. **"Configure GitHub App" click करा** (पहिल्यांदाच)
2. **GitHub authorization द्या**
3. **Repository select करा**: `loan-management-system`
4. **"Deploy Now" click करा**

### Step 4.3: Initial Deployment

Railway आपोआप:
- Repository clone करेल
- Node.js detect करेल
- Dependencies install करेल (`npm install`)
- Build run करेल (`npm run build`)
- Server start करेल (`npm start`)

**⚠️ Note**: पहिले deployment fail होईल कारण database connection नाही. पुढील step मध्ये fix करू.

---

## 5. PostgreSQL Database Add करा

### Step 5.1: Database Service Add करा

1. **Railway project canvas वर जा**
2. **"+ Create" button click करा** (किंवा "+ New")
3. **"Database" निवडा**
4. **"Add PostgreSQL" click करा**

### Step 5.2: Database Deploy होण्याची वाट बघा

- ~30-60 seconds लागतात
- Green status दिसेल deploy झाल्यावर
- PostgreSQL card project canvas वर दिसेल

### Step 5.3: Database Connection Variables

Database deploy झाल्यावर, Railway आपोआप हे variables create करतो:

| Variable Name | Description |
|--------------|-------------|
| `DATABASE_URL` | Full connection string |
| `PGHOST` | Database host |
| `PGPORT` | Database port |
| `PGUSER` | Database username |
| `PGPASSWORD` | Database password |
| `PGDATABASE` | Database name |

---

## 6. Environment Variables सेट करा

### Step 6.1: App Service Variables Tab उघडा

1. **App service (Node.js) वर click करा** (PostgreSQL नाही)
2. **"Variables" tab निवडा**
3. **"+ New Variable" click करा**

### Step 6.2: आवश्यक Variables Add करा

खालील variables एक एक करून add करा:

#### Variable 1: DATABASE_URL
```
Name: DATABASE_URL
Value: ${{Postgres.DATABASE_URL}}
```
**Note**: `${{Postgres.DATABASE_URL}}` हे Railway reference syntax आहे. हे automatically Postgres service चा URL घेते.

#### Variable 2: NODE_ENV
```
Name: NODE_ENV
Value: production
```

#### Variable 3: SESSION_SECRET
```
Name: SESSION_SECRET
Value: your-very-long-random-secret-key-here-make-it-at-least-32-characters
```
**Note**: हा secret key random असावा. खालील command वापरून generate करता येतो:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### Step 6.3: Optional Variables

आपल्या app मध्ये इतर secrets असल्यास ते पण add करा:

| Variable | Description | Example |
|----------|-------------|---------|
| `SENDGRID_API_KEY` | Email sending साठी | `SG.xxxx...` |
| `GOOGLE_CLIENT_ID` | Google OAuth साठी | `xxxxx.apps.googleusercontent.com` |
| `GOOGLE_CLIENT_SECRET` | Google OAuth साठी | `GOCSPX-xxxxx` |

### Step 6.4: Variables Apply करा

Variables add केल्यावर:
1. **"Deploy" button click करा** (project canvas वर)
2. Railway नवीन deployment trigger करेल
3. Deployment logs मध्ये progress बघा

---

## 7. Database Migration (Schema Push)

Database tables create करण्यासाठी Drizzle ORM वापरून schema push करावे लागेल.

### Method A: Railway CLI वापरून (Recommended)

#### Step 7.1: Railway CLI Install करा

```bash
# NPM वापरून install
npm install -g @railway/cli

# Verify installation
railway --version
```

#### Step 7.2: Railway Login करा

```bash
railway login
```
Browser उघडेल, login करा आणि authorization द्या.

#### Step 7.3: Project Link करा

```bash
# Project directory मध्ये जा
cd /path/to/your/project

# Railway project link करा
railway link
```
Project निवडा list मधून.

#### Step 7.4: Database Migration Run करा

```bash
# Schema push command
railway run npm run db:push
```

**Expected Output:**
```
[✓] Changes applied to database
```

### Method B: Manual Connection वापरून

#### Step 7.1: Connection String मिळवा

1. Railway dashboard मध्ये **PostgreSQL card** वर click करा
2. **"Connect" tab** निवडा
3. **"Public Network"** enable करा (temporary)
4. **Connection string copy करा**

#### Step 7.2: Local Machine वरून Run करा

```bash
# Connection string export करा
export DATABASE_URL="postgresql://postgres:password@host:port/railway"

# Schema push करा
npm run db:push
```

#### Step 7.3: Public Network Disable करा (Security)

Migration complete झाल्यावर:
1. PostgreSQL card → Connect tab
2. **"Public Network" disable करा**

---

## 8. Data Migration (Existing Data Transfer)

Replit वरील existing data Railway वर हलवण्यासाठी.

### Step 8.1: Replit Database Export करा

```bash
# Replit DATABASE_URL मिळवा (Replit Secrets मधून)
# Terminal मध्ये run करा:

pg_dump "$DATABASE_URL" --no-owner --no-acl > backup.sql
```

### Step 8.2: Backup File Download करा

Replit Files panel मधून `backup.sql` download करा.

### Step 8.3: Railway Database मध्ये Import करा

```bash
# Railway DATABASE_URL मिळवा (Railway Dashboard → PostgreSQL → Connect)
# Local terminal मध्ये run करा:

psql "RAILWAY_DATABASE_URL_HERE" < backup.sql
```

### Step 8.4: Data Verify करा

Railway Dashboard मध्ये:
1. PostgreSQL card वर click करा
2. **"Data" tab** निवडा
3. Tables आणि data verify करा

---

## 9. Public URL Generate करा

### Step 9.1: Domain Generate करा

1. **App service (Node.js) वर click करा**
2. **"Settings" tab निवडा**
3. **"Networking" section मध्ये जा**
4. **"Generate Domain" click करा**

### Step 9.2: Generated URL

Railway आपल्याला URL देईल:
```
https://loan-management-system-production.up.railway.app
```

### Step 9.3: Custom Domain (Optional)

आपला स्वतःचा domain वापरायचा असल्यास:
1. **"+ Custom Domain" click करा**
2. **Domain टाका**: `loans.yourdomain.com`
3. **DNS records configure करा** (Railway instructions follow करा)

---

## 10. Troubleshooting

### समस्या 1: Build Fail होते

**Logs कसे बघायचे:**
1. App service वर click करा
2. "Deployments" tab निवडा
3. Failed deployment वर click करा
4. "View Logs" निवडा

**सामान्य कारणे:**
| Error | Solution |
|-------|----------|
| `Cannot find module` | `npm install` locally run करून push करा |
| `TypeScript errors` | `npm run check` locally fix करा |
| `Build timeout` | Build script optimize करा |

### समस्या 2: Database Connection Fail

**तपासा:**
1. `DATABASE_URL` variable set आहे का?
2. Reference syntax बरोबर आहे का? `${{Postgres.DATABASE_URL}}`
3. PostgreSQL service running आहे का?

**Fix:**
```bash
# Railway CLI वापरून test करा
railway run node -e "console.log(process.env.DATABASE_URL)"
```

### समस्या 3: App Crash होते

**Logs तपासा:**
```bash
railway logs
```

**सामान्य fixes:**
1. `PORT` environment variable वापरा:
```javascript
const PORT = process.env.PORT || 5000;
```

2. `0.0.0.0` वर listen करा:
```javascript
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});
```

### समस्या 4: Static Files Serve होत नाहीत

**आपल्या server मध्ये तपासा:**
```javascript
// Production मध्ये static files serve करण्यासाठी
if (process.env.NODE_ENV === 'production') {
  app.use(express.static('dist/public'));
}
```

---

## 11. Railway CLI Commands Reference

### Installation & Auth

```bash
# Install CLI
npm install -g @railway/cli

# Login
railway login

# Logout
railway logout

# Check version
railway --version
```

### Project Management

```bash
# Initialize new project
railway init

# Link existing project
railway link

# Unlink project
railway unlink

# Open dashboard
railway open
```

### Deployment

```bash
# Deploy current directory
railway up

# Deploy with specific Dockerfile
railway up --dockerfile Dockerfile.prod

# View deployment status
railway status
```

### Environment & Variables

```bash
# View all variables
railway variables

# Set a variable
railway variables set KEY=value

# Delete a variable
railway variables delete KEY

# Run command with Railway environment
railway run <command>
```

### Logs & Monitoring

```bash
# View logs (live)
railway logs

# View logs (last 100 lines)
railway logs --tail 100

# View specific service logs
railway logs --service app
```

### Database

```bash
# Connect to database (interactive shell)
railway connect postgres

# Run SQL file
railway run psql < migration.sql
```

---

## 12. Pricing Information

### Railway Pricing Plans (2025)

| Plan | Price | Credits | Best For |
|------|-------|---------|----------|
| **Trial** | Free | $5/month | Testing & Learning |
| **Hobby** | $5/month | $5 + usage | Small projects |
| **Pro** | $20/month | $20 + usage | Production apps |
| **Enterprise** | Custom | Custom | Large organizations |

### Resource Pricing

| Resource | Price |
|----------|-------|
| **vCPU** | $0.000463/min |
| **Memory** | $0.000231/GB/min |
| **Disk** | $0.000021/GB/min |
| **Egress** | $0.10/GB (first 100GB free) |

### PostgreSQL Pricing

| Resource | Price |
|----------|-------|
| **Storage** | $0.25/GB/month |
| **Compute** | Usage-based |

### Estimated Monthly Cost

आपल्या Loan Management System साठी अंदाजित खर्च:

| Component | Estimated Cost |
|-----------|---------------|
| App Service | $3-5/month |
| PostgreSQL | $2-5/month |
| **Total** | **$5-10/month** |

---

## 📞 Support & Resources

### Official Documentation
- **Railway Docs**: https://docs.railway.com
- **Express Guide**: https://docs.railway.com/guides/express
- **PostgreSQL Guide**: https://docs.railway.com/databases/postgresql

### Community
- **Railway Discord**: https://discord.gg/railway
- **GitHub Discussions**: https://github.com/railwayapp/railway/discussions

### Contact
- **Email**: support@railway.app
- **Twitter**: @Railway

---

## ✅ Deployment Checklist

Deploy करण्यापूर्वी ही checklist वापरा:

- [ ] GitHub वर code push केला
- [ ] Railway account create केला
- [ ] GitHub repo Railway शी connect केला
- [ ] PostgreSQL database add केला
- [ ] `DATABASE_URL` variable set केला
- [ ] `NODE_ENV=production` set केला
- [ ] `SESSION_SECRET` set केला
- [ ] Database migration (`db:push`) run केला
- [ ] Existing data migrate केला (optional)
- [ ] Public URL generate केला
- [ ] App browser मध्ये test केला
- [ ] Login functionality test केला
- [ ] Data display test केला

---

## 🎉 Congratulations!

आपला Loan Management System आता Railway वर live आहे!

**Next Steps:**
1. Custom domain setup करा
2. SSL certificate verify करा (Railway automatically handles)
3. Regular backups schedule करा
4. Monitoring alerts setup करा

---

*Document Version: 1.0*  
*Last Updated: January 2026*  
*Created for: Loan Management System Railway Deployment*
