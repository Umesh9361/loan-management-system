# Loan Management System - Multi-Tenant

## Overview
This is a comprehensive multi-tenant loan management system for financial institutions and lending companies in the Indian market, with Marathi language support. Its purpose is to provide efficient tools for managing borrowers, loans, groups, and financial reporting with tenant-wise data isolation. The vision is to offer a complete, localized solution for efficient loan operations with high data integrity and security, ensuring complete accounting integration from account creation to ledger and cashbook synchronization.

## User Preferences
Preferred communication style: Simple, everyday language.
Local Development: User wants detailed step-by-step guide for setting up the application on local machine with database configuration.

## System Architecture

### Frontend Architecture
- **Framework**: React with TypeScript
- **Routing**: Wouter
- **State Management**: TanStack Query
- **UI Components**: Radix UI primitives with shadcn/ui
- **Styling**: Tailwind CSS with custom CSS variables
- **Forms**: React Hook Form with Zod validation
- **Build Tool**: Vite
- **Date Format**: DD/MM/YYYY consistent format.
- **UI/UX Decisions**: Mobile-first responsive design; professional currency formatting; streamlined navigation; consistent labeling; clean statement-only printing for all reports; cross-device date picker compatibility; A4 print layout with user-specified column measurements: अनुक्रमांक (30px), तारीख (60px), अंदाजे बाजार मूल्य (70px), नाव (200px), कोड नं (50px), वस्तूचा तपशील (auto), वजन (50px). Header formatting includes smaller text for "अंदाजे बाजार मूल्य" and normal 12px font for "कोड नं". Fixed data duplication issue in closing-wise reports with correct column ordering. Weight column properly positioned as the last column in all reports. Report generation date line removed from footer as per user request. Final totals display without rupees symbol for cleaner formatting.

### Backend Architecture
- **Runtime**: Node.js with Express.js
- **Language**: TypeScript
- **Session Management**: Express sessions with PostgreSQL storage
- **Authentication**: Custom session-based auth with bcrypt hashing
- **API Design**: RESTful endpoints
- **Middleware**: Request logging, error handling, authentication.

### Database Design
- **Database**: PostgreSQL with Neon serverless
- **ORM**: Drizzle ORM for type-safe operations
- **Schema Management**: Drizzle Kit for migrations
- **Multi-tenancy**: Tenant ID-based data isolation with comprehensive deletion functions ensuring data integrity.
- **Tables**: Users, companies, groups, borrowers, loans, transactions, loan closures, parties, cash transactions, with proper foreign key relationships.
- **Indexes**: Comprehensive indexing for performance.
- **Data Integrity**: Redundant borrower info in loans table for multiple loans to same-named individuals; dual-entry journal system for cash transactions; "प्रारंभिक शिल्लक" logic for opening balances.

### Key Features
- **Multi-tenant Architecture**: Complete data isolation with robust tenant and user deletion.
- **User Management**: Role-based access control (admin/clerk) and Super Admin functions. Comprehensive user permissions control system allowing admins to grant/revoke system permissions. Dynamic permission-based routing.
- **Company Registration**: Mandatory initial setup per tenant.
- **Financial Management**: Comprehensive cash transaction system with party accounts and automated integration with loan disbursements/closures; real-time balance calculations; professional print system for statements and reports. Corrected accounting logic for balances, party statements, and account ledgers to follow proper debit/credit principles.
- **Loan Management**: Flexible loan creation, intelligent search, simple interest calculations with manual adjustments and variance tracking. **CRITICAL**: Loan-to-cash transaction synchronization ensures disbursement cash entries are automatically updated when loan amount or date is modified. **FIX**: Clean decimal formatting in loan edit forms - removes ".00" from whole numbers to prevent user confusion during editing.
- **Data Management & Cleanup**: **UPDATED September 2025** - Enhanced closed loans data cleanup with comprehensive PhotoService integration preventing storage bloat, activity logs cleanup for data consistency, and resilient error handling. The cleanup system now properly handles: loan photos (physical files + database records), user activity logs, cash transactions, journal entries, and maintains complete referential integrity while preventing orphaned data.
- **Reporting**: Cash book, capital reports, and ledger management; unified account ledger; comprehensive borrower list reports. Individual loan statements (नमुना नंबर आठ) follow proper accounting logic.
- **Photo Management**: Professional multi-provider photo storage system for collateral items. **UPDATED February 2026** - Added Cloudinary integration with tenant-wise provider selection. Architecture: PhotoStorageProvider abstraction (LocalProvider + CloudinaryProvider), PhotoProviderResolver for per-photo provider resolution during deletion (prevents mismatch when tenants switch providers). Super Admin sets default storage; each tenant can override. Schema: system_settings (default config), tenant_storage_settings (per-tenant config). Automatic cleanup during loan closure using provider-aware deletion. Key files: server/photo-storage-provider.ts, server/photo-service.ts, client/src/pages/storage-settings.tsx.
- **Localization**: Dual language support (English and Marathi) with default Marathi interface and bilingual search.
- **Audit Logging**: **UPDATED February 2026** - Comprehensive activity logging for all create/delete/update operations. Logs: group, loan, party, cash transaction create/delete/update and photo delete with Marathi descriptions, user info, timestamps. Update logs include changedFields with old → new values. Delete logs include full entity details. Create logs include basic record info. Admin-only Activity Log page (/activity-log) with filtering (all/delete/update/create/login), date/time display (DD/MM/YYYY HH:MM:SS), metadata details with changed fields display (orange ✏️ markers), and log clear functionality with confirmation dialog. Admin + Super Admin access. Key files: client/src/pages/activity-log.tsx, server/routes.ts (GET/DELETE /api/activity-logs).
- **Security**: Verified multi-tenant security and data isolation; emergency recovery system. Super Admin access is role-based, not tenant-specific, with a Super Admin Guardian system to ensure correct role configuration.
- **Performance**: Aggressive caching, instant local calculations, memoized data processing, and reduced API calls for optimized performance.
- **Search Results Ordering**: Multi-level ascending sort implemented - Loan Date → Group Name → Loan Number → Borrower Name → Loan Amount for comprehensive chronological and logical organization. Applied consistently across loan search results and borrower list reports (कर्जदाराची यादी) with date-wise matching functionality.
- **Business Logic**: Core business rule "हर next day का opening balance = previous day का closing balance" implemented across multi-period views.
- **Unified Transaction System & Duplicate Prevention**: Centralized cash synchronization ensuring all loan operations automatically create proper cash transactions. Intelligent duplicate prevention system with narration standardization and a comprehensive approach to eliminate duplicate entries at the source level, including during bulk closures and at the storage layer.
- **Calculator Interface**: Interest calculator with conditional display of calculation methods - hidden in simple interest mode, visible in advanced mode for clean user experience.
- **MASSIVE 5000+ NAME TRANSLATIONS**: Comprehensive dual-language search system with 5000+ name translations covering all regions (North India, South India, Bengali, Gujarati), traditional names, saints/gurus, nicknames, compound names, phonetic variations, and common word parts. Maximum fuzzy search with substring matching, phonetic similarity, consecutive character bonuses, and intelligent 25+ threshold scoring for finding all possible word variations and matches.

## External Dependencies

### Core Framework Dependencies
- `@neondatabase/serverless`
- `drizzle-orm`
- `@tanstack/react-query`
- `express`
- `express-session`
- `connect-pg-simple`

### UI and Styling
- `@radix-ui/*`
- `tailwindcss`
- `class-variance-authority`
- `clsx`

### Form Management
- `react-hook-form`
- `@hookform/resolvers`
- `zod`

### Authentication and Security
- `bcrypt`

### Date and Time
- `date-fns`

### Export and Reporting
- `jspdf`
- `jspdf-autotable`