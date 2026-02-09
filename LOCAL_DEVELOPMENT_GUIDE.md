# लोन मॅनेजमेंट सिस्टम - लोकल डेव्हलपमेंट गाइड

## आवश्यक सॉफ्टवेअर डाउनलोड करा

### 1. Node.js डाउनलोड आणि इंस्टॉल करा
- वेबसाइट: https://nodejs.org/
- **LTS Version** (Long Term Support) डाउनलोड करा
- Windows साठी: `.msi` फाइल डाउनलोड करा
- इंस्टॉलेशन दरम्यान सगळे default options निवडा

### 2. Git डाउनलोड आणि इंस्टॉल करा
- वेबसाइट: https://git-scm.com/
- Windows साठी Git for Windows डाउनलोड करा
- इंस्टॉलेशन दरम्यान default settings वापरा

### 3. VS Code (Code Editor) डाउनलोड करा
- वेबसाइट: https://code.visualstudio.com/
- Windows साठी डाउनलोड करा आणि इंस्टॉल करा

### 4. PostgreSQL डेटाबेस डाउनलोड करा
- वेबसाइट: https://www.postgresql.org/download/
- Windows साठी डाउनलोड करा
- **महत्वाचे**: इंस्टॉलेशन दरम्यान password सेट करताना याद ठेवा
- **सुचवलेला password**: `admin123` (सोपा आणि याद ठेवण्यासाठी)
- Port: `5432` (default) ठेवा

## प्रोजेक्ट सेटअप

### Step 1: प्रोजेक्ट फोल्डर तयार करा
```
D: (किंवा C:) ड्राइव्ह मध्ये नवीन फोल्डर तयार करा
नाव: loan-management-system
```

### Step 2: Replit मधून कोड डाउनलोड करा
1. Replit मध्ये तुमच्या प्रोजेक्ट मध्ये जा
2. बाजूला Tools > Export/Download > Download as ZIP
3. ZIP फाइल extract करा loan-management-system फोल्डर मध्ये

### Step 3: Command Prompt उघडा
- Windows Key + R दाबा
- `cmd` टाइप करा आणि Enter दाबा
- किंवा Start Menu मध्ये "Command Prompt" शोधा

### Step 4: प्रोजेक्ट फोल्डर मध्ये जा
```cmd
cd D:\loan-management-system
```
(तुमचा फोल्डर path वापरा)

### Step 5: Dependencies इंस्टॉल करा
```cmd
npm install
```
हे command सगळे आवश्यक packages डाउनलोड करेल (2-3 मिनिटे लागू शकतात)

## डेटाबेस सेटअप

### Step 1: PostgreSQL Start करा
- Windows मध्ये Services उघडा (services.msc)
- PostgreSQL service शोधा आणि Start करा
- किंवा pgAdmin4 उघडा

### Step 2: डेटाबेस तयार करा
pgAdmin4 उघडा:
1. Servers > PostgreSQL > Databases वर right-click
2. Create > Database
3. Database Name: `loan_management`
4. Save करा

### Step 3: Environment Variables सेट करा
प्रोजेक्ट folder मध्ये `.env` फाइल तयार करा:

```env
# डेटाबेस कनेक्शन
DATABASE_URL=postgresql://postgres:admin123@localhost:5432/loan_management

# Session सिक्रेट
SESSION_SECRET=your-secret-key-here-make-it-long-and-random

# एप्लिकेशन सेटिंग्ज
NODE_ENV=development
PORT=5000

# हे असणार variables Replit मध्ये automatically set होतात
REPL_ID=local-development
REPL_SLUG=loan-management-local
```

**महत्वाचे**: 
- `admin123` हा तुमचा PostgreSQL password आहे
- जर वेगळा password सेट केला असेल तर तो वापरा

## एप्लिकेशन चालवा

### Step 1: डेटाबेस Schema तयार करा
```cmd
npm run db:push
```
हे command डेटाबेस tables तयार करेल

### Step 2: एप्लिकेशन Start करा
```cmd
npm run dev
```

### Step 3: Browser मध्ये उघडा
```
http://localhost:5000
```

## Login Credentials

### Super Admin:
- Tenant ID: `SUPER_ADMIN`
- Username: `admin`
- Password: `admin123`

### Demo Tenant Admin:
- Tenant ID: `TEST`
- Username: `admin`
- Password: `admin123`

### Demo User:
- Tenant ID: `TEST`
- Username: `demouser`
- Password: `password`

## Troubleshooting (समस्या निवारण)

### समस्या 1: Node.js चालत नाही
**समाधान**:
```cmd
node --version
npm --version
```
Version numbers दिसले पाहिजेत

### समस्या 2: Database Connection Error
**तपासा**:
1. PostgreSQL service चालू आहे का?
2. `.env` फाइल मध्ये योग्य password आहे का?
3. Database `loan_management` तयार केला आहे का?

**समाधान**:
```cmd
# PostgreSQL service start करा
net start postgresql-x64-14
```

### समस्या 3: Port 5000 Already in Use
**समाधान**:
`.env` फाइल मध्ये port बदला:
```env
PORT=3000
```
आणि browser मध्ये `http://localhost:3000` वापरा

### समस्या 4: npm install Error
**समाधान**:
```cmd
# npm cache साफ करा
npm cache clean --force

# पुन्हा try करा
npm install
```

## फोल्डर Structure

```
loan-management-system/
├── client/                 # Frontend React code
├── server/                 # Backend Express code
├── shared/                 # Common code
├── package.json           # Dependencies list
├── .env                   # Environment variables
└── README.md             # Project info
```

## VS Code Extensions (सुचवलेले)

VS Code मध्ये Extensions install करा:
1. `Auto Rename Tag`
2. `Bracket Pair Colorizer`
3. `ES7+ React/Redux/React-Native snippets`
4. `Prettier - Code formatter`
5. `TypeScript Importer`

## Development Workflow

### दररोज काम सुरू करताना:
1. Command Prompt उघडा
2. प्रोजेक्ट फोल्डर मध्ये जा
3. `npm run dev` चालवा
4. Browser मध्ये `http://localhost:5000` उघडा

### काम संपल्यावर:
1. Command Prompt मध्ये `Ctrl + C` दाबा
2. Browser बंद करा

## Backup आणि Version Control

### Git Repository तयार करा:
```cmd
git init
git add .
git commit -m "Initial commit"
```

### Daily backup:
```cmd
git add .
git commit -m "Daily work backup"
```

## Performance Tips

1. **RAM**: कमीत कमी 4GB RAM हवी
2. **Storage**: कमीत कमी 2GB free space हवी
3. **Antivirus**: Node modules folder ला antivirus exclusion मध्ये add करा

## Support

जर कोणती समस्या आली तर:
1. Error message copy करा
2. Screenshot घ्या
3. Command Prompt मधला output copy करा

हा setup complete केल्यावर तुमचे एप्लिकेशन तुमच्या local machine वर चालू होईल!