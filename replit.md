# Loan Management System - Multi-Tenant

## Overview
This is a comprehensive multi-tenant loan management system designed for financial institutions and lending companies in the Indian market, offering full Marathi language support. Its primary purpose is to streamline the management of borrowers, loans, groups, and financial reporting with robust tenant-wise data isolation. The system aims to provide a complete, localized solution for efficient loan operations, emphasizing high data integrity, security, and full accounting integration from account creation to ledger and cashbook synchronization.

## User Preferences
Preferred communication style: Simple, everyday language.
Local Development: User wants detailed step-by-step guide for setting up the application on local machine with database configuration.
GitHub Push Policy: NEVER push the full project. Only push changed/modified files. Repository: Umesh9361/loan-management-system, Token: GITHUB_PAT secret. Use GitHub API with file-based blob upload for large files.

## System Architecture

### Frontend Architecture
- **Framework & Libraries**: React with TypeScript, Wouter for routing, TanStack Query for state management.
- **UI/Styling**: Radix UI primitives integrated with shadcn/ui, styled using Tailwind CSS and custom CSS variables. Implements a mobile-first responsive design, professional currency formatting, and consistent labeling. Features an Indigo theme across all components and pages.
- **Forms**: Managed with React Hook Form and Zod for validation.
- **Build Tool**: Vite.
- **Date Format**: Consistent DD/MM/YYYY.
- **Reporting UI**: Clean statement-only printing for reports, cross-device date picker compatibility, A4 print layout with user-specified column measurements and specific header/footer formatting.
- **Label Printing**: Customizable barcode/sticker label printing system with 5 presets + custom size, field visibility toggle, arrow-button reordering, per-field font size, bold/oval toggles, custom text, margin controls, and dynamic preview. Settings panel starts collapsed showing preview first. Settings persisted in database (labelSettings column in companies table) with localStorage fallback, isDirty flag to prevent overwrites on load, debounced 800ms save.

### Backend Architecture
- **Runtime & Language**: Node.js with Express.js and TypeScript.
- **Authentication & Session**: Custom session-based authentication using bcrypt for hashing, with Express sessions storing data in PostgreSQL.
- **API Design**: RESTful endpoints with comprehensive middleware for request logging, error handling, and authentication.

### Database Design
- **Database**: PostgreSQL leveraging Neon serverless, managed with Drizzle ORM for type-safe operations and Drizzle Kit for migrations.
- **Multi-tenancy**: Achieved via tenant ID-based data isolation with robust deletion functions ensuring referential integrity.
- **Schema**: Includes tables for users, companies, groups, borrowers, loans, transactions, loan closures, parties, and cash transactions, all with proper foreign key relationships and comprehensive indexing.
- **Data Integrity**: Implements redundant borrower information for multiple loans, a dual-entry journal system for cash transactions, and "प्रारंभिक शिल्लक" logic for opening balances. Each loan has a `purity` column (default 82%) for per-loan gold purity — DB value takes priority, keyword detection is fallback.

### Key Features
- **Multi-tenant Architecture**: Ensures complete data isolation and provides robust tenant/user deletion capabilities.
- **User Management**: Role-based access control (admin/clerk) and Super Admin functions with dynamic permission-based routing. Granular permissions include dedicated canViewBalanceSheet, canViewProfitLoss, canViewInformationRegister, canViewNoticeGenerator permissions.
- **Company Registration**: Mandatory initial setup per tenant.
- **Financial Management**: Comprehensive cash transaction system with party accounts, automated integration with loan disbursements/closures, real-time balance calculations, and professional print systems for statements and reports following a "Lender Perspective" accounting convention (Format 8).
- **Loan Management**: Flexible loan creation, intelligent search, simple interest calculations with manual adjustments, variance tracking, and critical loan-to-cash transaction synchronization. Includes a maturity reminder system with smart notification logic.
- **Data Management & Cleanup**: Enhanced cleanup for closed loans, activity logs, and cashbook entries. Features comprehensive PhotoService integration for loan photos, and date-range based cleanup of general cash transactions with a 3-layer loan protection system and preview mode.
- **Reporting**: Provides cash book, capital reports, ledger management, unified account ledger, comprehensive borrower list reports, individual loan statements (नमुना नंबर आठ), and Loading Report (LTV overloading analysis with dual-logic: 80% standard + data-driven average).
- **Photo Management**: Professional multi-provider photo storage system with Cloudinary integration and a PhotoStorageProvider abstraction for tenant-wise provider selection and deletion.
- **Localization**: Dual language support (English and Marathi) with default Marathi interface and bilingual search.
- **Audit Logging**: Comprehensive activity logging for all CRUD operations on key entities with Marathi descriptions, user info, timestamps, and detailed change tracking. Accessible via an admin-only Activity Log page with filtering and clear functionality.
- **Subscription Management**: Tenant subscription system supporting lifetime and time-limited types. Features automatic write-protection for expired subscriptions, dashboard reminders, full-screen expiry notices, and bidirectional conversion between subscription types managed by Super Admin.
- **Security**: Verified multi-tenant security, data isolation, and an emergency recovery system. Super Admin access is role-based, enforced by a Guardian system. Granular permissions include dedicated canViewLoadingReport permission separate from canViewOverdueReport.
- **Performance**: Achieved through aggressive caching, instant local calculations, memoized data processing, and reduced API calls.
- **Search Results Ordering**: Multi-level ascending sort across Loan Date, Group Name, Loan Number, Borrower Name, and Loan Amount for consistent chronological and logical organization.
- **Business Logic**: Centralized opening balance calculation ensuring "हर next day का opening balance = previous day का closing balance" across multi-period views.
- **Account-to-Account Transfer**: Dedicated transfer feature in mobile cashbook — creates linked cash_in + cash_out entries with journal, net-zero cashbook impact, separate party ledger entries for both source and destination.
- **Unified Transaction System & Duplicate Prevention**: Centralized cash synchronization and intelligent duplicate prevention for all loan operations.
- **Calculator Interface**: Interest calculator with conditional display based on calculation method.
- **Name Translations**: Extensive dual-language search system with 5000+ name translations covering various regions, traditional names, and phonetic variations using fuzzy search logic.

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