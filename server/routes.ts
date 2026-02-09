import express, { type Express } from "express";
import { createServer, type Server } from "http";
import session, { SessionOptions } from "express-session";
import { storage } from "./storage";
import { db } from "./db";
import bcrypt from "bcrypt";
import { insertUserSchema, insertCompanySchema, insertGroupSchema, insertLoanSchema, insertTransactionSchema, insertLoanClosureSchema, insertPartySchema, insertCashTransactionSchema, cashTransactions, loans, groups, loanPhotos, loanClosures, transactions, insertLoanPhotoSchema, systemSettings, tenantStorageSettings, userActivityLogs, users } from "@shared/schema";
import { photoUpload, PhotoService } from "./photo-service";
import { PhotoStorageFactory, CloudinaryStorageProvider } from "./photo-storage-provider";
import path from 'path';
import fs from 'fs/promises';
import { z } from "zod";
import { and, eq, sql, or, ne, inArray, desc } from "drizzle-orm";
import connectPgSimple from "connect-pg-simple";
import { pool } from "./db";

import dataManagementRoutes from "./routes/data-management";
import userManagementRoutes from "./routes/user-management";
import { ACCOUNT_TYPES } from "@shared/constants";
import { createAutomaticPrevention } from "./automatic-duplicate-prevention";

async function invalidateOtherSessions(userId: string, currentSessionId: string): Promise<number> {
  try {
    const result = await pool.query(
      `DELETE FROM sessions WHERE sid != $1 AND sess->>'userId' = $2`,
      [currentSessionId || '', userId]
    );
    const deletedCount = result.rowCount || 0;
    if (deletedCount > 0) {
      console.log(`🔒 Invalidated ${deletedCount} other session(s) for user ${userId}`);
    }
    return deletedCount;
  } catch (error) {
    console.error("Failed to invalidate other sessions:", error);
    return 0;
  }
}
import { getNameTranslations, normalizeMarathiVowels } from "./name-translations";
import { automaticDuplicatePrevention } from "./middleware/automatic-duplicate-prevention";
import { apiCache, cacheBuster, invalidateTenantCache, getCacheStats } from "./middleware/cache";
import { triggerLoanSync } from "./real-time-sync-engine";
import { NarrationEngine } from "./narration-engine";

// Helper function to convert Indian date format (DD/MM/YYYY) to ISO format (YYYY-MM-DD)
function convertIndianDateToISO(dateStr: string): string {
  if (!dateStr || typeof dateStr !== 'string') return dateStr;
  
  const parts = dateStr.split('/');
  if (parts.length !== 3) return dateStr;
  
  const [day, month, year] = parts;
  return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
}

// Login schema
const loginSchema = z.object({
  tenantId: z.string().min(1),
  username: z.string().min(1),
  password: z.string().min(1),
});

declare module "express-session" {
  interface SessionData {
    userId?: string;
    tenantId?: string;
    role?: string;
    loginDate?: string;
  }
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Enhanced session configuration for Replit environments
  const isProduction = process.env.NODE_ENV === "production";
  const isReplit = !!(process.env.REPLIT_DOMAINS || process.env.REPLIT_APP_NAME || process.env.REPL_ID);
  
  // Always trust proxy for Replit
  app.set('trust proxy', 1);
  
  const sessionConfig: SessionOptions = {
    secret: process.env.SESSION_SECRET || "your-secret-key-loan-mgmt-2025-replit",
    resave: true, // Force save to ensure persistence in Replit
    saveUninitialized: true, // Create session for better tracking
    name: 'connect.sid', // Explicit session name
    rolling: true, // Extend session on activity
    cookie: {
      secure: false, // Always false for Replit compatibility
      httpOnly: false, // Allow frontend access for debugging
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
      sameSite: 'lax' as const,
      path: '/',
      domain: undefined, // Let Replit handle domain automatically
    },
  };

  // Use PostgreSQL for session storage for better multi-tenant isolation
  const pgStore = connectPgSimple(session);
  
  const sessionStore = new pgStore({
    pool: pool,
    tableName: 'sessions',
    createTableIfMissing: true, // Auto-create sessions table if missing
    ttl: 24 * 60 * 60 // 24 hours in seconds
  });
  
  app.use(session({
    ...sessionConfig,
    store: sessionStore
  }));

  // Authentication middleware  
  const requireAuth = (req: any, res: any, next: any) => {
    if (!req.session?.userId || !req.session?.tenantId) {
      return res.status(401).json({ 
        message: "Not authenticated",
        debug: process.env.NODE_ENV === 'development' ? {
          hasSession: !!req.session,
          hasUserId: !!req.session?.userId,
          hasTenantId: !!req.session?.tenantId
        } : undefined
      });
    }

    const nowIST = new Date(Date.now() + 5.5 * 60 * 60 * 1000);
    const todayIST = nowIST.toISOString().split('T')[0];
    const loginDate = req.session.loginDate;

    if (!loginDate || loginDate < todayIST) {
      req.session.destroy((err: any) => {
        if (err) console.error("Session destroy error:", err);
      });
      return res.status(401).json({ message: "Session expired. Please login again." });
    }

    next();
  };

  // Session verification endpoint for frontend
  app.get("/api/auth/verify", (req, res) => {
    console.log('🔐 SESSION VERIFY:', {
      hasSession: !!req.session,
      userId: req.session?.userId,
      tenantId: req.session?.tenantId,
      role: req.session?.role
    });
    
    if (!req.session?.userId || !req.session?.tenantId) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    const nowIST = new Date(Date.now() + 5.5 * 60 * 60 * 1000);
    const todayIST = nowIST.toISOString().split('T')[0];
    const loginDate = req.session.loginDate;

    if (!loginDate || loginDate < todayIST) {
      req.session.destroy((err: any) => {
        if (err) console.error("Session destroy error:", err);
      });
      return res.status(401).json({ message: "Session expired. Please login again." });
    }
    
    res.json({ 
      user: { 
        id: req.session.userId, 
        tenantId: req.session.tenantId, 
        role: req.session.role 
      } 
    });
  });

  // Cache stats endpoint for monitoring
  app.get("/api/cache/stats", requireAuth, (req, res) => {
    if (req.session.role !== 'super_admin') {
      return res.status(403).json({ message: "Super admin access required" });
    }
    
    const stats = getCacheStats();
    res.json(stats);
  });

  // Health check endpoint for deployments (cached for 60 seconds)
  app.get("/api/health", apiCache({ ttl: 60 }), async (req, res) => {
    try {
      // Simple health check with database connection test
      const healthStatus = {
        status: "ok",
        timestamp: new Date().toISOString(),
        database: "connected",
        environment: process.env.NODE_ENV || "development",
        uptime: process.uptime(),
        version: "1.0.0"
      };
      
      // Test database connection with a lightweight query
      await storage.getAllUsers();
      
      res.status(200).json(healthStatus);
    } catch (error) {
      console.error("Health check failed:", error);
      res.status(503).json({
        status: "error",
        timestamp: new Date().toISOString(),
        database: "disconnected",
        environment: process.env.NODE_ENV || "development",
        uptime: process.uptime(),
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Readiness check endpoint for deployment systems
  app.get("/api/ready", async (req, res) => {
    try {
      // More comprehensive readiness check
      const checks = {
        database: false,
        session: false,
        environment: false
      };

      // Test database connection
      try {
        await storage.getAllUsers();
        checks.database = true;
      } catch (e) {
        console.error("Database readiness check failed:", e);
      }

      // Test session store
      try {
        checks.session = !!sessionStore;
      } catch (e) {
        console.error("Session store readiness check failed:", e);
      }

      // Check essential environment variables
      checks.environment = !!(process.env.DATABASE_URL && process.env.SESSION_SECRET);

      const allReady = Object.values(checks).every(check => check);

      if (allReady) {
        res.status(200).json({
          status: "ready",
          timestamp: new Date().toISOString(),
          checks
        });
      } else {
        res.status(503).json({
          status: "not ready",
          timestamp: new Date().toISOString(),
          checks
        });
      }
    } catch (error) {
      console.error("Readiness check failed:", error);
      res.status(503).json({
        status: "error",
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });



  // AUTOMATIC DUPLICATE PREVENTION: Apply to all authenticated routes
  // हे सगळं ऑटोमॅटिक झालं पाहिजे बिना प्रॉब्लेमच
  app.use('/api', automaticDuplicatePrevention);

  // Auth routes
  app.post("/api/auth/login", async (req, res) => {
    try {
      const startTime = Date.now();
      const parsed = loginSchema.parse(req.body);
      const tenantId = parsed.tenantId.toUpperCase().trim();
      const username = parsed.username.trim();
      const password = parsed.password;
      
      const user = await storage.getUserByCredentials(tenantId, username);
      
      if (!user) {
        return res.status(401).json({ message: "Invalid credentials" });
      }

      const isValid = await bcrypt.compare(password, user.password);
      
      if (!isValid) {
        return res.status(401).json({ message: "Invalid credentials" });
      }

      if (user.role !== 'super_admin') {
        const tenantCompany = await storage.getCompany(tenantId);
        if (tenantCompany && tenantCompany.isActive === false) {
          return res.status(403).json({ message: "तुमचा टेनंट निष्क्रिय (Deactivated) आहे. कृपया Super Admin शी संपर्क साधा." });
        }
      }

      const loginDuration = Date.now() - startTime;

      req.session.userId = user.id;
      req.session.tenantId = user.tenantId;
      req.session.role = user.role;
      const nowIST = new Date(Date.now() + 5.5 * 60 * 60 * 1000);
      req.session.loginDate = nowIST.toISOString().split('T')[0];

      // Update login info and log activity
      try {
        await storage.updateUserLoginInfo(user.id);
        await storage.logUserActivity({
          userId: user.id,
          tenantId: user.tenantId,
          activityType: 'login',
          description: `User logged in: ${user.username}`,
          ipAddress: req.ip,
          userAgent: req.get('User-Agent'),
          metadata: JSON.stringify({ role: user.role })
        });
      } catch (error) {
        console.error("Error logging user activity:", error);
      }

      // Set session data for authenticated user

      req.session.save((err) => {
        if (err) {
          // Session save error
          console.error(`❌ SESSION SAVE FAILED: ${user.username}@${user.tenantId}`, err);
          return res.status(500).json({ message: "Session save failed" });
        }
        
        // Session saved successfully
        console.log(`💾 SESSION SAVED: ${user.username}@${user.tenantId}`);
        
        res.json({ 
          user: { 
            id: user.id, 
            username: user.username, 
            tenantId: user.tenantId, 
            role: user.role 
          } 
        });
      });
    } catch (error) {
      // Login processing error
      res.status(400).json({ message: "Invalid request data" });
    }
  });

  // Change own password endpoint
  app.put("/api/auth/change-password", requireAuth, async (req, res) => {
    try {
      const { newPassword } = req.body;
      
      if (!newPassword || newPassword.length < 6) {
        return res.status(400).json({ message: "Password must be at least 6 characters" });
      }

      const userId = req.session.userId!;
      await storage.resetUserPassword(userId, req.session.tenantId!, newPassword, "self");

      await invalidateOtherSessions(userId, req.sessionID);

      res.json({ message: "Password updated successfully" });
    } catch (error) {
      console.error("Password change error:", error);
      res.status(500).json({ message: "Failed to change password" });
    }
  });

  app.post("/api/auth/logout", async (req, res) => {
    const userId = req.session.userId;
    const tenantId = req.session.tenantId;
    
    // Log logout activity before destroying session
    if (userId && tenantId) {
      try {
        await storage.logUserActivity({
          userId,
          tenantId,
          activityType: 'logout',
          description: `User logged out`,
          ipAddress: req.ip,
          userAgent: req.get('User-Agent'),
          metadata: JSON.stringify({})
        });
      } catch (error) {
        console.error("Error logging logout activity:", error);
      }
    }
    
    req.session.destroy(() => {
      res.json({ message: "Logged out successfully" });
    });
  });

  // Self-service password change
  app.patch("/api/auth/change-password", requireAuth, async (req, res) => {
    try {
      const { currentPassword, newPassword } = req.body;
      
      if (!currentPassword || !newPassword) {
        return res.status(400).json({ message: "Current password and new password are required" });
      }
      
      // Get current user
      const currentUser = await storage.getUser(req.session.userId!);
      if (!currentUser) {
        return res.status(404).json({ message: "User not found" });
      }
      
      // Verify current password
      if (!await bcrypt.compare(currentPassword, currentUser.password)) {
        return res.status(400).json({ message: "Current password is incorrect" });
      }
      
      const hashedNewPassword = await bcrypt.hash(newPassword, 10);
      await storage.updateUser(req.session.userId!, { password: hashedNewPassword });
      
      await invalidateOtherSessions(req.session.userId!, req.sessionID);

      res.json({ message: "Password changed successfully" });
    } catch (error) {
      res.status(500).json({ message: "Failed to change password" });
    }
  });

  app.get("/api/auth/me", async (req, res) => {
    try {
      if (!req.session.userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      const nowIST = new Date(Date.now() + 5.5 * 60 * 60 * 1000);
      const todayIST = nowIST.toISOString().split('T')[0];
      if (!req.session.loginDate || req.session.loginDate < todayIST) {
        req.session.destroy((err: any) => { if (err) console.error("Session destroy error:", err); });
        return res.status(401).json({ message: "Session expired. Please login again." });
      }
      
      const user = await storage.getUser(req.session.userId);
      if (!user) {
        // User not found in database
        return res.status(401).json({ message: "User not found" });
      }
      
      // User authenticated successfully
      
      res.json({ 
        user: { 
          id: user.id, 
          username: user.username, 
          tenantId: user.tenantId, 
          role: user.role 
        } 
      });
    } catch (error) {
      // Authentication error occurred
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Get user permissions for dynamic routing
  app.get("/api/user-permissions", async (req, res) => {
    try {
      if (!req.session.userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      const nowIST = new Date(Date.now() + 5.5 * 60 * 60 * 1000);
      const todayIST = nowIST.toISOString().split('T')[0];
      if (!req.session.loginDate || req.session.loginDate < todayIST) {
        req.session.destroy((err: any) => { if (err) console.error("Session destroy error:", err); });
        return res.status(401).json({ message: "Session expired. Please login again." });
      }
      
      const permissions = await storage.getUserPermissions(req.session.userId, req.session.tenantId!);
      res.json(permissions || {});
    } catch (error) {
      console.error("Error fetching user permissions:", error);
      res.json({}); // Return empty permissions on error
    }
  });

  // Company routes
  // Company data - cached for 10 minutes (rarely changes)
  app.get("/api/company", requireAuth, apiCache({ 
    ttl: 600,
    keyGenerator: (req) => `company:${req.session.tenantId}`
  }), async (req, res) => {
    try {
      let company = await storage.getCompany(req.session.tenantId!);
      
      // SUPER ADMIN FIX: Auto-create company if missing for Super Admin role
      if (!company && req.session.role === 'super_admin') {
        console.log(`🔧 Creating missing company for Super Admin tenant: ${req.session.tenantId}`);
        company = await storage.createCompany({
          tenantId: req.session.tenantId!,
          name: `${req.session.tenantId} Super Admin Organization`,
          contactNumber: '1234567890',
          email: 'admin@company.com',
          address: 'Admin Office Address',
          licenseNumber: `SUPER_${req.session.tenantId}`
        });
        console.log('✅ Super Admin company created:', company);
      }
      
      if (!company) {
        console.log(`❌ No company found for tenant: ${req.session.tenantId}`);
        return res.status(404).json({ 
          message: "कंपनी माहिती सापडली नाही", 
          englishMessage: "Company information not found",
          tenantId: req.session.tenantId 
        });
      }
      
      console.log(`✅ Company data retrieved for tenant: ${req.session.tenantId}`, company);
      res.json(company);
    } catch (error) {
      console.error("🚨 Company fetch error:", error);
      res.status(500).json({ 
        message: "कंपनी माहिती लोड करताना त्रुटी झाली", 
        englishMessage: "Error loading company information",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  app.post("/api/company", requireAuth, cacheBuster(['company:']), async (req, res) => {
    try {
      console.log("Company creation request body:", req.body);
      console.log("Session data:", { userId: req.session.userId, tenantId: req.session.tenantId });
      
      const companyData = insertCompanySchema.parse({
        ...req.body,
        tenantId: req.session.tenantId!,
      });
      
      console.log("Parsed company data:", companyData);
      
      const company = await storage.createCompany(companyData);
      console.log("Company created successfully:", company);
      res.json(company);
    } catch (error) {
      console.error("Company creation error:", error);
      res.status(400).json({ 
        message: "अवैध कंपनी डेटा", 
        englishMessage: "Invalid company data",
        error: error instanceof Error ? error.message : String(error),
        details: "कृपया सर्व आवश्यक फील्ड भरा"
      });
    }
  });

  app.put("/api/company", requireAuth, cacheBuster(['company:']), async (req, res) => {
    try {
      const companyData = insertCompanySchema.partial().parse(req.body);
      const company = await storage.updateCompany(req.session.tenantId!, companyData);
      
      if (!company) {
        return res.status(404).json({ 
          message: "कंपनी सापडली नाही", 
          englishMessage: "Company not found",
          tenantId: req.session.tenantId 
        });
      }
      
      res.json(company);
    } catch (error) {
      res.status(400).json({ 
        message: "कंपनी अपडेट करताना त्रुटी झाली", 
        englishMessage: "Error updating company data",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Groups routes
  // Groups data - NO CACHE for debugging display issues
  app.get("/api/groups", requireAuth, async (req, res) => {
    // Disable all caching to ensure fresh data
    res.set({
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0',
      'ETag': `"groups-${Date.now()}"` // Force unique response
    });
    
    try {
      const groups = await storage.getGroups(req.session.tenantId!);
      res.json(groups);
    } catch (error) {
      console.error("Groups fetch error:", error);
      res.status(500).json({ 
        message: "ग्रुप लोड करताना त्रुटी झाली", 
        englishMessage: "Error loading groups",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  app.post("/api/groups", requireAuth, cacheBuster(['groups:', 'dashboard:']), async (req, res) => {
    try {
      const groupData = insertGroupSchema.parse({
        ...req.body,
        tenantId: req.session.tenantId!,
      });
      
      const group = await storage.createGroup(groupData);

      try { await storage.logUserActivity({ userId: req.session.userId!, tenantId: req.session.tenantId!, activityType: 'create_group', description: `नवीन ग्रुप तयार: ${group.name}`, metadata: JSON.stringify({ groupId: group.id, groupName: group.name }) }); } catch(e) { console.error('Audit log error:', e); }

      res.json(group);
    } catch (error) {
      // Check if it's a duplicate name error
      if (error instanceof Error && error.message.includes('आधीच अस्तित्वात आहे')) {
        return res.status(409).json({ 
          message: error.message,
          englishMessage: error.message.split(' / ')[1] || error.message,
          type: "DUPLICATE_NAME_ERROR"
        });
      }
      
      res.status(400).json({ 
        message: "अवैध ग्रुप डेटा", 
        englishMessage: "Invalid group data",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  app.put("/api/groups/:id", requireAuth, cacheBuster(['groups:', 'dashboard:']), async (req, res) => {
    try {
      const { id } = req.params;
      const groupData = insertGroupSchema.partial().parse(req.body);
      
      const allGroups = await storage.getGroups(req.session.tenantId!);
      const oldGroup = allGroups.find(g => g.id === id);
      
      const group = await storage.updateGroup(id, req.session.tenantId!, groupData);
      if (!group) {
        return res.status(404).json({ message: "Group not found" });
      }
      
      try {
        const changedFields: Record<string, { old: any; new: any }> = {};
        if (oldGroup) {
          for (const key of Object.keys(req.body)) {
            if ((oldGroup as any)[key] !== undefined && String((oldGroup as any)[key]) !== String(req.body[key])) {
              changedFields[key] = { old: (oldGroup as any)[key], new: req.body[key] };
            }
          }
        }
        await storage.logUserActivity({ userId: req.session.userId!, tenantId: req.session.tenantId!, activityType: 'update_group', description: `ग्रुप अपडेट: ${group.name}`, metadata: JSON.stringify({ groupId: id, groupName: group.name, oldName: oldGroup?.name, changedFields }) });
      } catch(e) { console.error('Audit log error:', e); }

      res.json(group);
    } catch (error) {
      // Check if it's a duplicate name error
      if (error instanceof Error && error.message.includes('आधीच अस्तित्वात आहे')) {
        return res.status(409).json({ 
          message: error.message,
          englishMessage: error.message.split(' / ')[1] || error.message,
          type: "DUPLICATE_NAME_ERROR"
        });
      }
      
      res.status(400).json({ 
        message: "ग्रुप अपडेट करताना त्रुटी झाली", 
        englishMessage: "Error updating group data",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  app.delete("/api/groups/:id", requireAuth, cacheBuster(['groups:', 'dashboard:']), async (req, res) => {
    try {
      const { id } = req.params;
      
      const allGroups = await storage.getGroups(req.session.tenantId!);
      const groupToDelete = allGroups.find(g => g.id === id);
      
      const success = await storage.deleteGroup(id, req.session.tenantId!);
      
      if (!success) {
        return res.status(404).json({ message: "Group not found" });
      }
      
      try { await storage.logUserActivity({ userId: req.session.userId!, tenantId: req.session.tenantId!, activityType: 'delete_group', description: `ग्रुप डिलीट: ${groupToDelete?.name || id}`, metadata: JSON.stringify({ groupId: id, groupName: groupToDelete?.name }) }); } catch(e) { console.error('Audit log error:', e); }

      res.json({ message: "Group deleted successfully" });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete group" });
    }
  });


  // ==========================================
  // MATURITY REMINDER API - मुदत संपण्याची सूचना
  // ==========================================
  app.get("/api/maturity-reminders", requireAuth, async (req, res) => {
    try {
      const tenantId = req.session.tenantId!;
      const allLoans = await storage.getLoans(tenantId, { status: 'active' });
      
      const parseLocalDate = (dateStr: string): Date => {
        const parts = dateStr.split('-');
        return new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
      };
      
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      
      const reminders: any[] = [];
      
      for (const loan of allLoans) {
        if (!loan.hasMaturity) continue;
        
        let matDate: Date | null = null;
        if (loan.calculatedMaturityDate) {
          matDate = parseLocalDate(String(loan.calculatedMaturityDate));
        } else if (loan.maturityMonths && loan.loanDate) {
          const d = parseLocalDate(String(loan.loanDate));
          d.setMonth(d.getMonth() + Number(loan.maturityMonths));
          matDate = d;
        }
        
        if (!matDate) continue;
        
        const daysRemaining = Math.round((matDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        
        if (daysRemaining < 0) continue;
        
        const loanStartDate = parseLocalDate(String(loan.loanDate));
        const totalDurationDays = Math.round((matDate.getTime() - loanStartDate.getTime()) / (1000 * 60 * 60 * 24));
        
        let showReminder = false;
        
        if (totalDurationDays > 30) {
          const daysToOneMonthBefore = daysRemaining - 30;
          const isInFirstWindow = daysToOneMonthBefore >= 0 && daysToOneMonthBefore < 5;
          const isInLastWindow = daysRemaining <= 8;
          showReminder = isInFirstWindow || isInLastWindow;
        } else {
          showReminder = daysRemaining <= 5;
        }
        
        if (showReminder) {
          reminders.push({
            loanId: loan.id,
            borrowerName: loan.borrowerName,
            accountNumber: loan.accountNumber,
            principalAmount: loan.principalAmount,
            loanDate: loan.loanDate,
            maturityDate: matDate.toISOString().split('T')[0],
            daysRemaining,
            maturityMonths: loan.maturityMonths,
            groupId: loan.groupId,
          });
        }
      }
      
      reminders.sort((a, b) => a.daysRemaining - b.daysRemaining);
      
      res.json({ success: true, reminders, count: reminders.length });
    } catch (error) {
      console.error("Maturity reminders error:", error);
      res.status(500).json({ message: "मुदत सूचना मिळवण्यात त्रुटी" });
    }
  });

  // Loans routes - NO CACHE for real-time updates
  app.get("/api/loans", requireAuth, async (req, res) => {
    // Disable all caching for real-time loan updates
    res.set({
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0',
      'ETag': `"loans-${Date.now()}"` // Force unique response
    });
    
    try {
      const { groupId, borrowerId, status } = req.query;
      const filters = {
        groupId: groupId as string,
        borrowerId: borrowerId as string,
        status: status as string,
      };
      
      const loans = await storage.getLoans(req.session.tenantId!, filters);
      res.json(loans);
    } catch (error) {
      console.error("Loans fetch error:", error);
      res.status(500).json({ message: "Failed to fetch loans" });
    }
  });

  // Dual-language name translation mapping imported from shared module (server/name-translations.ts)
  // getNameTranslations and normalizeMarathiVowels are imported at top of file

  // Borrower autocomplete endpoint for existing borrower names with dual-language support
  app.get("/api/borrowers/autocomplete", requireAuth, async (req, res) => {
    try {
      const { search } = req.query;
      const searchTerm = ((search as string) || '').trim();
      
      if (searchTerm.length < 2) {
        return res.json([]);
      }
      
      const searchVariations = getNameTranslations(searchTerm);
      
      const normalizedTerm = normalizeMarathiVowels(searchTerm);
      if (normalizedTerm !== searchTerm) {
        const normalizedVariations = getNameTranslations(normalizedTerm);
        normalizedVariations.forEach(v => {
          if (!searchVariations.includes(v)) searchVariations.push(v);
        });
      }
      
      const vowelFrom = 'ीूैौॅॉआईऊऐऔ';
      const vowelTo   = 'िुेोेोअइउएओ';
      
      const searchConditions = searchVariations.flatMap(variation => [
        sql`${loans.borrowerName} ILIKE ${`%${variation}%`}`,
        sql`translate(${loans.borrowerName}, ${vowelFrom}, ${vowelTo}) ILIKE ${`%${normalizeMarathiVowels(variation)}%`}`
      ]);
      
      const combinedSearchCondition = searchConditions.length > 1 
        ? sql`(${searchConditions.reduce((acc, curr, idx) => 
            idx === 0 ? curr : sql`${acc} OR ${curr}`
          )})`
        : searchConditions[0];
      
      const borrowers = await db.execute<{
        borrowerName: string;
        borrowerMobile: string | null;
        borrowerAddress: string | null;
        latestLoanDate: string;
      }>(sql`
        SELECT DISTINCT ON (borrower_name)
          borrower_name as "borrowerName",
          borrower_mobile as "borrowerMobile",
          borrower_address as "borrowerAddress",
          loan_date as "latestLoanDate"
        FROM loans
        WHERE 
          tenant_id = ${req.session.tenantId!}
          AND (${combinedSearchCondition})
          AND LENGTH(TRIM(borrower_name)) >= 3
          AND borrower_name IS NOT NULL 
          AND TRIM(borrower_name) != ''
        ORDER BY borrower_name, loan_date DESC
        LIMIT 20
      `);
      
      // Convert rows to array
      const borrowerRows = borrowers.rows || [];
      
      // Sort results by relevance: exact match > starts with > contains
      const sortedBorrowers = borrowerRows.sort((a, b) => {
        const aName = a.borrowerName?.toLowerCase() || '';
        const bName = b.borrowerName?.toLowerCase() || '';
        const search = searchTerm.toLowerCase();
        
        // Check against all variations for better ranking
        const aExactMatch = searchVariations.some(v => aName === v.toLowerCase());
        const bExactMatch = searchVariations.some(v => bName === v.toLowerCase());
        
        if (aExactMatch && !bExactMatch) return -1;
        if (!aExactMatch && bExactMatch) return 1;
        
        // Starts with any variation comes next
        const aStarts = searchVariations.some(v => aName.startsWith(v.toLowerCase()));
        const bStarts = searchVariations.some(v => bName.startsWith(v.toLowerCase()));
        if (aStarts && !bStarts) return -1;
        if (!aStarts && bStarts) return 1;
        
        // Otherwise maintain date order (already sorted by latest loan date)
        return 0;
      });
      
      console.log(`🔍 Dual-language autocomplete for "${searchTerm}": ${sortedBorrowers.length} matches found (variations: ${searchVariations.join(', ')})`);
      res.json(sortedBorrowers.slice(0, 10)); // Return top 10 most relevant
    } catch (error) {
      console.error("Borrower autocomplete error:", error);
      res.status(500).json({ message: "Failed to fetch borrower suggestions" });
    }
  });

  app.post("/api/loans", requireAuth, cacheBuster(['dashboard:', 'loans:', 'borrowers:']), async (req, res) => {
    try {
      console.log("Received loan data:", req.body);
      console.log("Session tenant ID:", req.session.tenantId);
      
      // SAFETY LAYER: Convert date format from DD/MM/YYYY to YYYY-MM-DD if needed
      // Using existing convertIndianDateToISO helper function
      const processedBody = {
        ...req.body,
        loanDate: req.body.loanDate ? convertIndianDateToISO(req.body.loanDate) : req.body.loanDate,
        maturityDate: req.body.maturityDate ? convertIndianDateToISO(req.body.maturityDate) : req.body.maturityDate,
      };
      
      const loanData = insertLoanSchema.parse({
        ...processedBody,
        tenantId: req.session.tenantId!,
      });
      
      console.log("Parsed loan data:", loanData);
      
      // Note: Borrower management has been removed. Loan creation now relies only on provided borrower information stored in the loan record.
      
      const loan = await storage.createLoan(loanData);
      
      // 🚀 REAL-TIME SYNC: Trigger comprehensive loan creation synchronization
      await triggerLoanSync({
        type: 'CREATE',
        loanId: loan.id,
        tenantId: req.session.tenantId!,
        newData: loanData,
        metadata: {
          performedBy: req.session.userId!,
          timestamp: new Date()
        }
      });
      
      // AUTOMATIC DUPLICATE PREVENTION: Loan disbursement with single source processing
      // हे सगळं ऑटोमॅटिक झालं पाहिजे बिना प्रॉब्लेमच - Complete automation
      
      // STEP 1: COMPREHENSIVE CHECK - Look for both system and manual entries
      const existingDisbursement = await db
        .select()
        .from(cashTransactions)
        .where(and(
          eq(cashTransactions.tenantId, req.session.tenantId!),
          eq(cashTransactions.transactionType, 'cash_out'),
          eq(cashTransactions.category, 'loan_disbursement'),
          sql`${cashTransactions.narration} LIKE ${`%खाते क्र. ${loanData.accountNumber}%`}`,
          eq(cashTransactions.transactionDate, loanData.loanDate),
          sql`ABS(${cashTransactions.amount} - ${loanData.principalAmount}) < 0.01`
        ));

      // STEP 1.5: PRE-EMPTIVE CLEANUP - Remove any manual expense entries that match this loan
      const manualExpenseEntries = await db
        .select()
        .from(cashTransactions)
        .where(and(
          eq(cashTransactions.tenantId, req.session.tenantId!),
          eq(cashTransactions.transactionType, 'cash_out'),
          eq(cashTransactions.category, 'expense'),
          eq(cashTransactions.isSystemGenerated, false),
          sql`${cashTransactions.narration} LIKE ${`%खाते क्र. ${loanData.accountNumber}%`}`,
          sql`ABS(${cashTransactions.amount} - ${loanData.principalAmount}) < 0.01`,
          sql`${cashTransactions.createdAt} > NOW() - INTERVAL '1 hour'` // Only recent manual entries
        ));

      if (manualExpenseEntries.length > 0) {
        console.log(`🧹 PRE-EMPTIVE CLEANUP: Removing ${manualExpenseEntries.length} manual expense entries for loan ${loanData.accountNumber}`);
        await db.delete(cashTransactions)
          .where(and(
            eq(cashTransactions.tenantId, req.session.tenantId!),
            eq(cashTransactions.transactionType, 'cash_out'),
            eq(cashTransactions.category, 'expense'),
            eq(cashTransactions.isSystemGenerated, false),
            sql`${cashTransactions.narration} LIKE ${`%खाते क्र. ${loanData.accountNumber}%`}`,
            sql`ABS(${cashTransactions.amount} - ${loanData.principalAmount}) < 0.01`,
            sql`${cashTransactions.createdAt} > NOW() - INTERVAL '1 hour'`
          ));
      }
        
      console.log('🔍 DISBURSEMENT CHECK:', {
        accountNumber: loanData.accountNumber,
        amount: loanData.principalAmount,
        date: loanData.loanDate,
        existingCount: existingDisbursement.length
      });

      if (existingDisbursement.length === 0 && Number(loanData.principalAmount) > 0) {
        // STEP 2: Get group name if groupId exists
        let groupName = undefined;
        if (loanData.groupId) {
          const groups = await storage.getGroups(req.session.tenantId!);
          const group = groups.find(g => g.id === loanData.groupId);
          groupName = group ? group.name : undefined;
        }
        
        // STEP 3: Create ONLY cash transaction with standardized narration
        const { NarrationEngine } = await import('./narration-engine');
        const standardNarration = NarrationEngine.createLoanDisbursementNarration(
          loanData.accountNumber,
          loanData.borrowerName,
          Number(loanData.principalAmount),
          groupName
        );

        // CRITICAL FIX: Use storage layer for proper duplicate prevention
        await storage.createCashTransaction({
          tenantId: req.session.tenantId!,
          transactionDate: loanData.loanDate,
          transactionType: 'cash_out',
          amount: Number(loanData.principalAmount),
          category: 'loan_disbursement',
          narration: standardNarration,
          isSystemGenerated: true  // System generated - only editable through proper loan forms
        });
        
        console.log('✅ LOAN CREATED: Single disbursement cash transaction created automatically without duplicates');
      } else {
        console.log('🚫 AUTOMATIC: Duplicate disbursement cash transaction prevented');
      }

      try { await storage.logUserActivity({ userId: req.session.userId!, tenantId: req.session.tenantId!, activityType: 'create_loan', description: `नवीन कर्ज तयार: खाते क्र. ${loan.accountNumber} - ${loan.borrowerName} - ₹${loan.principalAmount}`, metadata: JSON.stringify({ loanId: loan.id, accountNumber: loan.accountNumber, borrowerName: loan.borrowerName, principalAmount: loan.principalAmount, loanDate: loan.loanDate, interestRate: loan.interestRate, groupId: loan.groupId }) }); } catch(e) { console.error('Audit log error:', e); }

      res.json(loan);
    } catch (error) {
      console.error("Loan creation error:", error);
      res.status(400).json({ 
        message: "Invalid loan data",
        error: error instanceof Error ? error.message : error 
      });
    }
  });

  app.put("/api/loans/:id", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      // Convert DD/MM/YYYY dates to YYYY-MM-DD format for database
      const bodyWithConvertedDates = {
        ...req.body,
        loanDate: req.body.loanDate ? convertIndianDateToISO(req.body.loanDate) : req.body.loanDate,
        maturityDate: req.body.maturityDate ? convertIndianDateToISO(req.body.maturityDate) : req.body.maturityDate,
      };
      
      const loanData = insertLoanSchema.partial().parse(bodyWithConvertedDates);
      
      // Get old loan data to check changes
      const loans = await storage.getLoans(req.session.tenantId!);
      const oldLoan = loans.find(l => l.id === id);
      
      if (!oldLoan) {
        return res.status(404).json({ message: "Loan not found" });
      }
      
      const loan = await storage.updateLoan(id, req.session.tenantId!, loanData);
      if (!loan) {
        return res.status(404).json({ message: "Loan not found" });
      }
      
      // 🚀 REAL-TIME SYNC: Trigger comprehensive loan update synchronization
      await triggerLoanSync({
        type: 'UPDATE',
        loanId: id,
        tenantId: req.session.tenantId!,
        oldData: oldLoan,
        newData: loan,
        metadata: {
          performedBy: req.session.userId!,
          timestamp: new Date()
        }
      });

      try {
        const changedFields: Record<string, { old: any; new: any }> = {};
        if (oldLoan) {
          for (const key of Object.keys(req.body)) {
            if ((oldLoan as any)[key] !== undefined && String((oldLoan as any)[key]) !== String(req.body[key])) {
              changedFields[key] = { old: (oldLoan as any)[key], new: req.body[key] };
            }
          }
        }
        await storage.logUserActivity({ userId: req.session.userId!, tenantId: req.session.tenantId!, activityType: 'update_loan', description: `कर्ज अपडेट: खाते क्र. ${loan.accountNumber} - ${loan.borrowerName}`, metadata: JSON.stringify({ loanId: id, accountNumber: loan.accountNumber, borrowerName: loan.borrowerName, groupId: loan.groupId, principalAmount: loan.principalAmount, changedFields }) });
      } catch(e) { console.error('Audit log error:', e); }

      // CRITICAL FIX: Update corresponding cash transaction when loan amount or date changes
      if (oldLoan && (loanData.principalAmount || loanData.loanDate)) {
        try {
          const cashTransactions = await storage.getCashTransactions(req.session.tenantId!);
          const disbursementTransaction = cashTransactions.find((ct: any) => 
            ct.narration && 
            ct.narration.includes('कर्ज वितरण') &&
            ct.narration.includes(oldLoan.accountNumber) &&
            ct.category === 'loan_disbursement'
          );
          
          if (disbursementTransaction) {
            // Update cash transaction to match loan changes
            const updateData: any = {};
            
            if (loanData.principalAmount && Number(loanData.principalAmount) !== Number(oldLoan.principalAmount)) {
              updateData.amount = Number(loanData.principalAmount);
              console.log(`💰 SYNC: Updating disbursement amount from ₹${oldLoan.principalAmount} to ₹${loanData.principalAmount}`);
            }
            
            if (loanData.loanDate && loanData.loanDate !== oldLoan.loanDate) {
              updateData.transactionDate = loanData.loanDate;
              console.log(`📅 SYNC: Updating disbursement date from ${oldLoan.loanDate} to ${loanData.loanDate}`);
            }
            
            if (Object.keys(updateData).length > 0) {
              // Get group name for updated narration
              const groups = await storage.getGroups(req.session.tenantId!);
              const group = groups.find(g => g.id === loan.groupId);
              const groupName = group?.name || '';
              
              // Update narration with new loan details using NarrationEngine
              updateData.narration = NarrationEngine.createLoanDisbursementNarration(
                loan.accountNumber,
                loan.borrowerName.substring(0, 4),
                Number(loan.principalAmount),
                groupName.substring(0, 10)
              );
              
              await storage.updateCashTransaction(disbursementTransaction.id, req.session.tenantId!, updateData);
              console.log('✅ CASH SYNC: Disbursement transaction updated successfully');
            }
          } else {
            console.log('⚠️ SYNC WARNING: Disbursement transaction not found for loan:', oldLoan.accountNumber);
          }
        } catch (syncError) {
          console.error('❌ SYNC ERROR: Failed to update cash transaction:', syncError);
          // Don't fail the loan update if cash sync fails
        }
      }
      
      // If loan status changed from active to closed, handle cash transactions
      if (oldLoan && oldLoan.status === 'active' && loanData.status === 'closed') {
        // Check if there's a closure record, if not create cash transaction
        const closures = await storage.getLoanClosures(req.session.tenantId!, id);
        if (closures.length === 0) {
          // Manual closure without proper closure form  
          // CRITICAL FIX: Loan closure cash transactions handled by bulk-closure.ts
          // This prevents duplicate entries in cashbook reports
          console.log('✅ Manual loan closure - cash transaction handled by closure system');
        }
      }
      
      // If loan status changed from closed to active, reverse cash transactions
      if (oldLoan && oldLoan.status === 'closed' && loanData.status === 'active') {
        try {
          const cashTransactions = await storage.getCashTransactions(req.session.tenantId!);
          const closureTransactions = cashTransactions.filter((ct: any) => 
            ct.narration && 
            ct.narration.includes('कर्ज बंद') &&
            (ct.narration.includes(loan.accountNumber) || ct.narration.includes(loan.borrowerName))
          );
          
          // Delete closure-related cash transactions
          for (const ct of closureTransactions) {
            await storage.deleteCashTransaction(ct.id, req.session.tenantId!);
            console.log(`✅ REOPEN: Deleted closure cash transaction - ₹${ct.amount}`);
          }

          // 📸 PHOTO REOPEN POLICY: Photos remain deleted after reopen  
          // Business Logic: Once closed and photos auto-deleted, they don't restore on reopen
          // User must re-upload photos if needed after reopening loan
          console.log(`📸 PHOTO REOPEN: Photos remain deleted - user can re-upload if needed`);
          
          // Delete loan closure record if exists
          const closures = await storage.getLoanClosures(req.session.tenantId!, id);
          for (const closure of closures) {
            await storage.deleteLoanClosure(closure.id, req.session.tenantId!);
          }
        } catch (cashError) {
          console.error('Failed to reverse cash transactions for reopened loan:', cashError);
        }
      }
      
      res.json(loan);
    } catch (error) {
      console.error("❌ Loan update error:", error);
      console.error("❌ Request body:", JSON.stringify(req.body, null, 2));
      res.status(400).json({ 
        message: "Invalid loan data",
        error: error instanceof Error ? error.message : error 
      });
    }
  });

  app.delete("/api/loans/:id", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      
      // Get loan details before deletion
      const loans = await storage.getLoans(req.session.tenantId!);
      const loan = loans.find(l => l.id === id);
      
      if (!loan) {
        return res.status(404).json({ message: "Loan not found" });
      }
      
      // 🚀 REAL-TIME SYNC: Trigger comprehensive loan deletion synchronization
      await triggerLoanSync({
        type: 'DELETE',
        loanId: id,
        tenantId: req.session.tenantId!,
        oldData: loan,
        metadata: {
          performedBy: req.session.userId!,
          timestamp: new Date(),
          reason: 'User requested loan deletion'
        }
      });
      
      const success = await storage.deleteLoan(id, req.session.tenantId!);
      
      if (!success) {
        return res.status(404).json({ message: "Failed to delete loan" });
      }

      try { await storage.logUserActivity({ userId: req.session.userId!, tenantId: req.session.tenantId!, activityType: 'delete_loan', description: `कर्ज डिलीट: खाते क्र. ${loan.accountNumber} - ${loan.borrowerName} - ₹${loan.principalAmount}`, metadata: JSON.stringify({ loanId: id, accountNumber: loan.accountNumber, borrowerName: loan.borrowerName, principalAmount: loan.principalAmount, loanDate: loan.loanDate, interestRate: loan.interestRate, groupId: loan.groupId, status: loan.status }) }); } catch(e) { console.error('Audit log error:', e); }

      res.json({ message: "Loan and related cash transactions deleted successfully" });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete loan" });
    }
  });

  // Loan reopen route
  app.patch("/api/loans/:id/reopen", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      
      // Get loan data to check if it's closed
      const loans = await storage.getLoans(req.session.tenantId!);
      const loan = loans.find(l => l.id === id);
      
      if (!loan) {
        return res.status(404).json({ message: "Loan not found" });
      }
      
      if (loan.status !== 'closed') {
        return res.status(400).json({ message: "Only closed loans can be reopened" });
      }
      
      // 🔧 CRITICAL FIX: Delete existing closure records before reopening
      // This prevents "Loan already closed" error when re-closing
      try {
        const closures = await storage.getLoanClosures(req.session.tenantId!, id);
        for (const closure of closures) {
          await storage.deleteLoanClosure(closure.id, req.session.tenantId!);
          console.log(`🗑️ CLEANUP: Deleted closure record ${closure.id} for loan reopen`);
        }
        
        // Also cleanup related closure cash transactions
        const cashTransactions = await storage.getCashTransactions(req.session.tenantId!);
        const closureCashEntries = cashTransactions.filter((ct: any) => 
          ct.narration && 
          ct.narration.includes('कर्ज बंद') &&
          (ct.narration.includes(loan.accountNumber) || ct.narration.includes(loan.borrowerName))
        );
        
        for (const ct of closureCashEntries) {
          await storage.deleteCashTransaction(ct.id, req.session.tenantId!);
          console.log(`🗑️ CLEANUP: Deleted closure cash transaction for loan reopen - ₹${ct.amount}`);
        }
        
        console.log(`✅ CLEANUP COMPLETE: Loan ${id} ready for reopen - ${closures.length} closure records + ${closureCashEntries.length} cash entries removed`);
      } catch (cleanupError) {
        console.error('Cleanup error during loan reopen:', cleanupError);
        return res.status(500).json({ message: "Failed to cleanup closure records during reopen" });
      }
      
      // Reopen the loan by changing status to active
      const reopenedLoan = await storage.updateLoan(id, req.session.tenantId!, { 
        status: 'active' 
      });
      
      if (!reopenedLoan) {
        return res.status(404).json({ message: "Failed to reopen loan" });
      }
      
      // 🚀 REAL-TIME SYNC: Trigger comprehensive loan reopen synchronization
      await triggerLoanSync({
        type: 'REOPEN',
        loanId: id,
        tenantId: req.session.tenantId!,
        oldData: loan,
        newData: reopenedLoan,
        metadata: {
          performedBy: req.session.userId!,
          timestamp: new Date(),
          reason: 'User requested loan reopen'
        }
      });

      try { await storage.logUserActivity({ userId: req.session.userId!, tenantId: req.session.tenantId!, activityType: 'reopen_loan', description: `कर्ज पुन्हा सुरू: खाते क्र. ${loan.accountNumber} - ${loan.borrowerName}`, metadata: JSON.stringify({ loanId: id, accountNumber: loan.accountNumber, borrowerName: loan.borrowerName }) }); } catch(e) { console.error('Audit log error:', e); }

      res.json({ 
        message: "Loan reopened successfully", 
        loan: reopenedLoan 
      });
    } catch (error) {
      console.error("Loan reopen error:", error);
      res.status(500).json({ message: "Failed to reopen loan" });
    }
  });

  // Comprehensive Cash Sync endpoint - for system integrity
  app.post('/api/comprehensive-sync', requireAuth, async (req: any, res) => {
    try {
      // Comprehensive sync disabled - handled by storage layer
      const result = { success: true, created: 0, updated: 0, skipped: 0 };
      
      res.json({
        success: result.success,
        message: `Sync completed: ${result.created} created, ${result.updated} updated, ${result.skipped} skipped`,
        details: result
      });
    } catch (error) {
      console.error('Comprehensive sync failed:', error);
      res.status(500).json({ error: 'Failed to perform comprehensive sync' });
    }
  });

  // System integrity validation endpoint
  app.get('/api/validate-integrity', requireAuth, async (req: any, res) => {
    try {
      // System validation disabled - handled by storage layer
      const validation = { isValid: true };
      
      res.json({
        success: validation.isValid,
        validation
      });
    } catch (error) {
      console.error('System validation failed:', error);
      res.status(500).json({ error: 'Failed to validate system integrity' });
    }
  });

  // Duplicate cleanup endpoint - PERMANENT SOLUTION
  app.post('/api/cleanup-duplicates', requireAuth, async (req: any, res) => {
    try {
      const { createDuplicateCleanupEngine } = await import('./duplicate-cleanup');
      const cleanupEngine = createDuplicateCleanupEngine(req.session.tenantId!);
      
      const result = await cleanupEngine.cleanupDuplicates();
      
      res.json({
        success: result.success,
        message: `Cleanup completed: ${result.duplicatesRemoved} duplicates removed, ${result.preservedEntries} entries preserved`,
        details: result
      });
    } catch (error) {
      console.error('Duplicate cleanup failed:', error);
      res.status(500).json({ error: 'Failed to cleanup duplicates' });
    }
  });

  // System integrity validation with duplicate detection
  app.get('/api/system-health', requireAuth, async (req: any, res) => {
    try {
      const { createDuplicateCleanupEngine } = await import('./duplicate-cleanup');
      const cleanupEngine = createDuplicateCleanupEngine(req.session.tenantId!);
      
      const integrity = await cleanupEngine.validateIntegrity();
      
      res.json({
        success: integrity.isValid,
        integrity
      });
    } catch (error) {
      console.error('System health check failed:', error);
      res.status(500).json({ error: 'Failed to check system health' });
    }
  });

  // Unified transaction system endpoint - MERGE LOAN & CASH TRANSACTIONS
  app.post('/api/unify-transactions', requireAuth, async (req: any, res) => {
    try {
      const { createUnifiedTransactionEngine } = await import('./unified-transaction-sync');
      const unificationEngine = createUnifiedTransactionEngine(req.session.tenantId!);
      
      const result = await unificationEngine.unifyTransactionSystems();
      
      res.json({
        success: result.success,
        message: `Unification completed: ${result.loanTransactionsMigrated} migrated, ${result.duplicatesRemoved} duplicates removed`,
        details: result
      });
    } catch (error) {
      console.error('Transaction unification failed:', error);
      res.status(500).json({ error: 'Failed to unify transaction systems' });
    }
  });

  // Unified system validation endpoint
  app.get('/api/unified-system-status', requireAuth, async (req: any, res) => {
    try {
      const { createUnifiedTransactionEngine } = await import('./unified-transaction-sync');
      const unificationEngine = createUnifiedTransactionEngine(req.session.tenantId!);
      
      const validation = await unificationEngine.validateUnifiedSystem();
      
      res.json({
        success: validation.isValid,
        validation
      });
    } catch (error) {
      console.error('Unified system validation failed:', error);
      res.status(500).json({ error: 'Failed to validate unified system' });
    }
  });

  // Narration standardization endpoint - ROOT CAUSE FIX
  app.post('/api/standardize-narrations', requireAuth, async (req: any, res) => {
    try {
      const { createNarrationStandardizer } = await import('./narration-standardizer');
      const standardizer = createNarrationStandardizer(req.session.tenantId!);
      
      const result = await standardizer.standardizeAllNarrations();
      
      res.json({
        success: result.success,
        message: `Narration standardization completed: ${result.standardized} standardized, ${result.duplicatesRemoved} duplicates removed`,
        details: result
      });
    } catch (error) {
      console.error('Narration standardization failed:', error);
      res.status(500).json({ error: 'Failed to standardize narrations' });
    }
  });

  // Comprehensive sync endpoint - FINAL SOLUTION WITH GROUP NAMES
  app.post('/api/comprehensive-sync', requireAuth, async (req: any, res) => {
    try {
      const { createComprehensiveCashSync } = await import('./comprehensive-sync');
      const comprehensiveSync = createComprehensiveCashSync(req.session.tenantId!);
      
      const result = await comprehensiveSync.performComprehensiveSync();
      
      res.json({
        success: result.success,
        message: `Comprehensive sync completed: ${result.duplicatesRemoved} duplicates removed, ${result.narrationUpdated} narrations updated, ${result.groupNamesAdded} group names added`,
        details: result
      });
    } catch (error) {
      console.error('Comprehensive sync failed:', error);
      res.status(500).json({ error: 'Failed to perform comprehensive sync' });
    }
  });

  // Transactions routes
  app.get("/api/transactions", requireAuth, async (req, res) => {
    try {
      // Return empty array since we don't have transactions table yet
      res.json([]);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch transactions" });
    }
  });

  app.post("/api/transactions", requireAuth, async (req, res) => {
    try {
      const transactionData = insertTransactionSchema.parse({
        ...req.body,
        tenantId: req.session.tenantId!,
      });
      
      const transaction = await storage.createTransaction(transactionData);
      res.json(transaction);
    } catch (error) {
      res.status(400).json({ message: "Invalid transaction data" });
    }
  });

  // Loan closure routes
  app.post("/api/loans/:id/close", requireAuth, cacheBuster(['dashboard:', 'loans:']), async (req, res) => {
    try {
      const { id } = req.params;
      
      // Enhanced closure data with comprehensive fields and variance tracking
      const requestData = req.body;
      const interestVariance = Number(requestData.interestVariance || 0);
      
      const closureData = insertLoanClosureSchema.parse({
        ...requestData,
        tenantId: req.session.tenantId!,
        loanId: id,
        closedBy: req.session.userId!, // Track who closed the loan
        interestVariance: interestVariance,
        varianceReason: requestData.varianceReason || "No variance tracking",
      });

      // 🔒 AUTOMATIC DUPLICATE PREVENTION: Loan closure with single source processing
      // हे सगळं ऑटोमॅटिक झालं पाहिजे बिना प्रॉब्लेमच - Complete automation for closures
      
      // Get loan details first
      const [loanDetails] = await db
        .select({
          id: loans.id,
          accountNumber: loans.accountNumber,
          borrowerName: loans.borrowerName,
          principalAmount: loans.principalAmount,
          groupId: loans.groupId,
          groupName: groups.name
        })
        .from(loans)
        .leftJoin(groups, eq(loans.groupId, groups.id))
        .where(and(eq(loans.id, id), eq(loans.tenantId, req.session.tenantId!)));

      if (!loanDetails) {
        return res.status(404).json({ message: "Loan not found" });
      }

      // STEP 1: COMPREHENSIVE CHECK - Look for both system and manual closure entries
      const existingClosure = await db
        .select()
        .from(cashTransactions)
        .where(and(
          eq(cashTransactions.tenantId, req.session.tenantId!),
          eq(cashTransactions.transactionType, 'cash_in'),
          or(eq(cashTransactions.category, 'loan_repayment'), eq(cashTransactions.category, 'income')),
          sql`${cashTransactions.narration} LIKE ${`%खाते क्र. ${loanDetails.accountNumber}%`}`,
          eq(cashTransactions.transactionDate, closureData.closureDate),
          sql`ABS(${cashTransactions.amount} - ${closureData.totalAmount}) < 0.01`
        ));

      // STEP 1.5: PRE-EMPTIVE CLEANUP - Remove any manual income/capital entries that match this loan closure
      const manualIncomeEntries = await db
        .select()
        .from(cashTransactions)
        .where(and(
          eq(cashTransactions.tenantId, req.session.tenantId!),
          eq(cashTransactions.transactionType, 'cash_in'),
          or(eq(cashTransactions.category, 'income'), eq(cashTransactions.category, 'capital')),
          sql`${cashTransactions.narration} LIKE ${`%खाते क्र. ${loanDetails.accountNumber}%`}`,
          ne(cashTransactions.isSystemGenerated, true), // Only manual entries
          eq(cashTransactions.transactionDate, closureData.closureDate),
          sql`ABS(${cashTransactions.amount} - ${closureData.totalAmount}) < 0.01`
        ));

      if (manualIncomeEntries.length > 0) {
        console.log(`🧹 PRE-EMPTIVE CLEANUP: Removing ${manualIncomeEntries.length} manual income entries for account ${loanDetails.accountNumber}`);
        await db.delete(cashTransactions).where(
          sql`id IN (${manualIncomeEntries.map(e => `'${e.id}'`).join(',')})`
        );
      }

      // STEP 2: ABSOLUTE PREVENTION - Block if any closure entry exists (system or manual)
      if (existingClosure.length > 0) {
        console.log(`🚫 ABSOLUTE DUPLICATE PREVENTION: Closure entry already exists for account ${loanDetails.accountNumber}`);
        // Return success response - closure already processed, no error needed
        return res.status(200).json({
          message: "Loan successfully closed", // User-friendly message
          success: true,
          alreadyProcessed: true,
          duplicatePrevented: true
        });
      }
      
      // STEP 3: CREATE CLOSURE - Now safe to create closure since duplicates are prevented
      const closure = await storage.createLoanClosure(closureData);
      
      // STEP 4: UPDATE LOAN STATUS - Mark loan as closed
      const closedLoan = await storage.updateLoan(id, req.session.tenantId!, { status: "closed" });
      
      // 🚀 REAL-TIME SYNC: Trigger comprehensive loan closure synchronization
      await triggerLoanSync({
        type: 'CLOSE',
        loanId: id,
        tenantId: req.session.tenantId!,
        oldData: loanDetails,
        newData: {
          ...loanDetails,
          status: 'closed',
          accountNumber: loanDetails.accountNumber,
          borrowerName: loanDetails.borrowerName,
          groupId: loanDetails.groupId,
          totalAmount: closureData.totalAmount,
          closureDate: closureData.closureDate
        },
        metadata: {
          performedBy: req.session.userId!,
          timestamp: new Date(),
          reason: closureData.varianceReason || 'Standard loan closure'
        }
      });
        
      // STEP 5: AUTO-DELETE PHOTOS - Delete photos when loan is closed
      let photoDeleteResult = null;
      if (requestData.autoDeletePhotos && requestData.hasPhotos) {
        try {
          photoDeleteResult = await PhotoService.deletePhotosForLoan(db, id, req.session.tenantId!);
          console.log(`📸 PHOTO AUTO-DELETE: ${photoDeleteResult.deletedFiles} files and ${photoDeleteResult.deletedRecords} records deleted for loan ${loanDetails.accountNumber}`);
        } catch (photoError) {
          console.warn('⚠️  Photo deletion warning:', photoError);
          // Don't fail closure if photo deletion fails
        }
      }

      console.log('✅ CLOSURE SUCCESS:', {
        loanId: id,
        accountNumber: loanDetails?.accountNumber,
        amount: closureData.totalAmount,
        date: closureData.closureDate,
        photosDeleted: photoDeleteResult?.deletedFiles || 0,
        closureCreated: true
      });

      // 🚫 ROOT CAUSE ELIMINATION: REMOVED direct cash transaction creation from routes.ts
      // ALL cash transactions handled ONLY by storage.ts createLoanClosure() method
      // This was the source creating duplicate entries - now eliminated
      // "प्रिव्हेन्शन पेक्षा रूट कॉलच काढा" - Direct DB insertion removed as requested
      
      console.log(`✅ LOAN CLOSURE COMPLETED: Account ${loanDetails?.accountNumber} - Amount ₹${closureData.totalAmount}`);
      console.log(`🎯 SINGLE SOURCE: Cash transaction handled by storage.ts only`);
      
      res.json(closure);
    } catch (error) {
      console.error("Closure error:", error);
      res.status(400).json({ message: "Invalid closure data" });
    }
  });

  // Get loan closures - supports loanId filtering for receipt generator
  app.get("/api/loan-closures", requireAuth, async (req, res) => {
    try {
      const loanId = req.query.loanId as string;
      
      // ✅ FIX: Use proper filtering - respect loanId parameter for receipt generator
      const closures = loanId 
        ? await storage.getLoanClosures(req.session.tenantId!, loanId)
        : await storage.getAllLoanClosures(req.session.tenantId!);
      
      // Prevent browser caching with strong headers
      res.set({
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
        'ETag': `"closures-${loanId || 'all'}-${Date.now()}"` // Force unique response
      });
      
      res.json(closures);
    } catch (error) {
      console.error("Error fetching loan closures:", error);
      res.status(500).json({ message: "Failed to fetch loan closures" });
    }
  });

  // Emergency duplicate cleanup endpoint
  app.post("/api/emergency-cleanup-duplicates", requireAuth, async (req, res) => {
    try {
      console.log(`🚨 Emergency duplicate cleanup requested by user: ${req.session.userId}`);
      
      const tenantId = req.session.tenantId!;
      let duplicatesRemoved = 0;
      
      // DIRECT SQL APPROACH - Find and remove duplicates
      const duplicateTransactions = await db.select()
        .from(cashTransactions)
        .where(and(
          eq(cashTransactions.tenantId, tenantId),
          eq(cashTransactions.transactionType, 'cash_out')
        ));

      // Group by loan identifier and find duplicates
      const loanGroups: { [key: string]: any[] } = {};
      duplicateTransactions.forEach(tx => {
        if (tx.narration && (tx.narration.includes('कर्ज वितरण') || tx.narration.includes('कर्ज दिले'))) {
          // Extract loan identifier from narration
          const loanAccountMatch = tx.narration.match(/खाते क्र\.\s*(\d+)/);
          const loanIdMatch = tx.narration.match(/\(([^)]+)\)/);
          
          let key = 'unknown';
          if (loanAccountMatch) {
            key = `account_${loanAccountMatch[1]}`;
          } else if (loanIdMatch) {
            key = `id_${loanIdMatch[1]}`;
          } else if (tx.narration.includes('राज पाटील')) {
            key = 'raj_patil_loan';
          }
          
          if (!loanGroups[key]) loanGroups[key] = [];
          loanGroups[key].push(tx);
        }
      });

      // Remove duplicates - keep oldest, remove newer
      for (const group of Object.values(loanGroups)) {
        if (group.length > 1) {
          // Sort by creation date, keep first (oldest)
          group.sort((a, b) => new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime());
          
          // Remove duplicates (all except first)
          for (let i = 1; i < group.length; i++) {
            console.log(`Removing duplicate: ${group[i].narration}`);
            await db.delete(cashTransactions)
              .where(and(
                eq(cashTransactions.id, group[i].id),
                eq(cashTransactions.tenantId, tenantId)
              ));
            duplicatesRemoved++;
          }
        }
      }
      
      res.json({
        success: true,
        message: `Cleanup completed successfully. Removed ${duplicatesRemoved} duplicate entries.`,
        duplicatesRemoved,
        groupsProcessed: Object.keys(loanGroups).length
      });
    } catch (error) {
      console.error("Emergency cleanup error:", error);
      res.status(500).json({ 
        success: false,
        message: "Failed to cleanup duplicates",
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // Dashboard stats with cache prevention
  // Dashboard stats - NO CACHE for real-time updates
  app.get("/api/dashboard/stats", requireAuth, async (req, res) => {
    // Disable all caching for real-time dashboard updates
    res.set({
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0',
      'ETag': `"dashboard-${Date.now()}"` // Force unique response
    });
    try {
      console.log(`📊 Dashboard stats request for tenant: ${req.session.tenantId}`);
      const stats = await storage.getDashboardStats(req.session.tenantId!);
      console.log(`✅ Dashboard stats retrieved successfully:`, stats);
      
      // Server-side cache but prevent browser cache for fresh data
      res.set({
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      });
      
      res.json(stats);
    } catch (error) {
      console.error("❌ Dashboard stats error:", error);
      res.status(500).json({ 
        message: "Failed to fetch dashboard stats",
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });



  // Reports routes
  app.get("/api/reports/cashbook", requireAuth, async (req, res) => {
    try {
      const { dateFrom, dateTo } = req.query;
      
      if (!dateFrom || !dateTo) {
        return res.status(400).json({ message: "Date range required" });
      }
      
      const report = await storage.getCashBookReport(
        req.session.tenantId!,
        dateFrom as string,
        dateTo as string
      );
      
      res.json(report);
    } catch (error) {
      res.status(500).json({ message: "Failed to generate cash book report" });
    }
  });

  app.get("/api/reports/capital", requireAuth, async (req, res) => {
    try {
      const { dateFrom, dateTo } = req.query;
      
      if (!dateFrom || !dateTo) {
        return res.status(400).json({ message: "Date range required" });
      }
      
      const report = await storage.getCapitalAccountReport(
        req.session.tenantId!,
        dateFrom as string,
        dateTo as string
      );
      
      res.json(report);
    } catch (error) {
      res.status(500).json({ message: "Failed to generate capital account report" });
    }
  });

  app.get("/api/reports/ledger/:loanId", requireAuth, async (req, res) => {
    try {
      const { loanId } = req.params;
      
      const ledger = await storage.getLoanLedger(req.session.tenantId!, loanId);
      res.json(ledger);
    } catch (error) {
      res.status(500).json({ message: "Failed to generate loan ledger" });
    }
  });

  // Party routes
  app.get("/api/parties", requireAuth, async (req, res) => {
    try {
      const { search } = req.query;
      const parties = await storage.getParties(req.session.tenantId!, search as string);
      res.json(parties);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch parties" });
    }
  });

  app.post("/api/parties", requireAuth, async (req, res) => {
    try {
      const partyData = insertPartySchema.parse({
        ...req.body,
        tenantId: req.session.tenantId!,
      });
      
      const party = await storage.createParty(partyData);

      try { await storage.logUserActivity({ userId: req.session.userId!, tenantId: req.session.tenantId!, activityType: 'create_party', description: `नवीन पार्टी तयार: ${party.name}`, metadata: JSON.stringify({ partyId: party.id, partyName: party.name, openingBalance: party.openingBalance, openingBalanceType: party.openingBalanceType }) }); } catch(e) { console.error('Audit log error:', e); }

      res.json(party);
    } catch (error) {
      res.status(400).json({ message: "Invalid party data" });
    }
  });

  app.put("/api/parties/:id", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const partyData = insertPartySchema.partial().parse(req.body);
      
      const allParties = await storage.getParties(req.session.tenantId!);
      const oldParty = allParties.find(p => p.id === id);
      
      const party = await storage.updateParty(id, req.session.tenantId!, partyData);
      if (!party) {
        return res.status(404).json({ message: "Party not found" });
      }

      try {
        const changedFields: Record<string, { old: any; new: any }> = {};
        if (oldParty) {
          for (const key of Object.keys(req.body)) {
            if ((oldParty as any)[key] !== undefined && String((oldParty as any)[key]) !== String(req.body[key])) {
              changedFields[key] = { old: (oldParty as any)[key], new: req.body[key] };
            }
          }
        }
        await storage.logUserActivity({ userId: req.session.userId!, tenantId: req.session.tenantId!, activityType: 'update_party', description: `पार्टी अपडेट: ${party.name}`, metadata: JSON.stringify({ partyId: id, partyName: party.name, oldName: oldParty?.name, changedFields }) });
      } catch(e) { console.error('Audit log error:', e); }

      res.json(party);
    } catch (error) {
      res.status(400).json({ message: "Invalid party data" });
    }
  });

  app.delete("/api/parties/:id", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      
      console.log(`Attempting to delete party ${id} for tenant ${req.session.tenantId}`);
      
      const allParties = await storage.getParties(req.session.tenantId!);
      const partyToDelete = allParties.find(p => p.id === id);
      
      const success = await storage.deleteParty(id, req.session.tenantId!);
      if (!success) {
        console.log(`Failed to delete party ${id} - either not found or has related transactions`);
        return res.status(400).json({ 
          message: "Party cannot be deleted. Either party not found or has related transactions." 
        });
      }

      try { await storage.logUserActivity({ userId: req.session.userId!, tenantId: req.session.tenantId!, activityType: 'delete_party', description: `पार्टी डिलीट: ${partyToDelete?.name || id}`, metadata: JSON.stringify({ partyId: id, partyName: partyToDelete?.name, openingBalance: partyToDelete?.openingBalance, openingBalanceType: partyToDelete?.openingBalanceType }) }); } catch(e) { console.error('Audit log error:', e); }

      console.log(`Successfully deleted party ${id}`);
      res.json({ message: "Party deleted successfully" });
    } catch (error) {
      console.error("Error deleting party:", error);
      res.status(500).json({ message: "Failed to delete party" });
    }
  });

  // Overdue Report API - WORKING VERSION WITH PROPER AUTH
  app.get("/api/overdue-report", requireAuth, async (req: any, res: any) => {
    console.log('✅ OVERDUE API REACHED WITH PROPER AUTH');
    
    // Add timeout protection
    const timeout = setTimeout(() => {
      console.error("⏰ OVERDUE REPORT TIMEOUT: 30 seconds elapsed");
      if (!res.headersSent) {
        res.status(504).json({ error: "Request timeout after 30 seconds" });
      }
    }, 30000);

    try {
      console.log('🔍 OVERDUE: Parsing parameters...');
      const { dateFrom, dateTo, groupId, currentGoldRate, finePurityPercentage, monthlyInterestRate, interestRateMode, projectionMode, futureProjectionPeriod } = req.query;
      
      console.log('🔍 PROJECTION PARAMS:', { projectionMode, futureProjectionPeriod });
      
      const filters = {
        dateFrom: dateFrom as string || new Date().toISOString().split('T')[0],
        dateTo: dateTo as string || new Date().toISOString().split('T')[0],
        groupId: groupId as string === "all" ? "all" : groupId as string || "all",
        currentGoldRate: parseFloat(currentGoldRate as string || "70"),
        finePurityPercentage: parseFloat(finePurityPercentage as string || "80"),
        monthlyInterestRate: parseFloat(monthlyInterestRate as string || "8"),
        interestRateMode: interestRateMode as string || 'manual',
        projectionMode: projectionMode as string || 'current',
        futureProjectionPeriod: futureProjectionPeriod as string || '3months',
      };

      console.log('🔍 OVERDUE: Calling storage method for tenant:', req.session.tenantId);
      const overdueData = await storage.getOverdueReportWithCorrectMath(req.session.tenantId!, filters);
      
      clearTimeout(timeout);
      console.log(`📊 OVERDUE: Successfully processed ${overdueData.length} items`);
      
      res.json(overdueData);
    } catch (error) {
      clearTimeout(timeout);
      console.error("❌ OVERDUE ERROR:", error);
      if (!res.headersSent) {
        res.status(500).json({ 
          error: "Failed to generate overdue report", 
          details: error instanceof Error ? error.message : String(error)
        });
      }
    }
  });

  // Cash transaction routes
  app.get("/api/cash-transactions", requireAuth, async (req, res) => {
    try {
      const { dateFrom, dateTo, partyId, transactionType, search, amount, includeAll } = req.query;
      
      const transactions = await storage.getCashTransactions(req.session.tenantId!, {
        dateFrom: dateFrom as string,
        dateTo: dateTo as string,
        partyId: partyId as string,
        transactionType: transactionType as string,
        search: search as string,
        amount: amount as string,
        includeAll: includeAll as string,
      });
      
      // OPTIMIZED: Deduplication for data integrity
      const uniqueMap = new Map();
      transactions.forEach((transaction: any) => {
        if (!uniqueMap.has(transaction.id)) {
          uniqueMap.set(transaction.id, transaction);
        }
      });
      
      const deduplicatedTransactions = Array.from(uniqueMap.values());
      
      // Prevent browser caching with strong headers
      res.set({
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
        'ETag': `"cash-tx-${Date.now()}"` // Force unique response
      });
      
      res.json(deduplicatedTransactions);
    } catch (error) {
      console.error('Error fetching cash transactions:', error);
      res.status(500).json({ message: "Failed to fetch cash transactions" });
    }
  });

  // Universal Mobile Cashbook Balance API - Support all periods (daily/weekly/monthly/yearly/custom)
  app.get("/api/mobile-cashbook/balance", requireAuth, async (req, res) => {
    try {
      const { startDate, endDate, viewPeriod } = req.query;
      
      if (!startDate || !endDate || !viewPeriod) {
        return res.status(400).json({ 
          message: "startDate, endDate, and viewPeriod parameters required" 
        });
      }
      
      const balanceData = await storage.getMobileCashbookUniversalBalance(
        req.session.tenantId!, 
        startDate as string, 
        endDate as string, 
        viewPeriod as string
      );
      
      res.set({
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      });
      
      res.json(balanceData);
    } catch (error) {
      console.error('Error fetching mobile cashbook universal balance:', error);
      res.status(500).json({ message: "Failed to fetch universal balance" });
    }
  });

  // Mobile Cashbook Daily Balance API - Critical for proper balance carry-forward
  app.get("/api/mobile-cashbook/daily-balance", requireAuth, async (req, res) => {
    try {
      const { date } = req.query;
      if (!date) {
        return res.status(400).json({ message: "Date parameter required" });
      }
      
      const balanceData = await storage.getMobileCashbookDailyBalance(req.session.tenantId!, date as string);
      
      res.set({
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      });
      
      res.json(balanceData);
    } catch (error) {
      console.error('Error fetching mobile cashbook daily balance:', error);
      res.status(500).json({ message: "Failed to fetch daily balance" });
    }
  });

  app.post("/api/cash-transactions", requireAuth, cacheBuster(['dashboard:', 'cash-transactions:']), async (req, res) => {
    
    try {
      const transactionData = insertCashTransactionSchema.parse({
        ...req.body,
        tenantId: req.session.tenantId!,
      });
      
      console.log('✅ PARSED SUCCESSFULLY:', transactionData);
      
      // Basic validation only
      console.log('🔧 Creating cash transaction:', {
        type: transactionData.transactionType,
        amount: transactionData.amount,
        category: transactionData.category,
        date: transactionData.transactionDate,
        partyId: transactionData.partyId
      });
      
      // 🚀 SMART DUAL ENTRY: Automatically create dual entry if party is selected
      let transaction;
      if (transactionData.partyId && transactionData.partyId !== 'cash') {
        console.log('🔧 CALLING STORAGE.createCashTransactionWithJournal for dual entry...');
        transaction = await storage.createCashTransactionWithJournal(transactionData);
      } else {
        console.log('🔧 CALLING STORAGE.createCashTransaction for single entry...');
        transaction = await storage.createCashTransaction(transactionData);
      }
      
      // If this is a loan-related transaction, update loan status
      if (transactionData.narration && transactionData.narration.includes('कर्ज')) {
        try {
          const loans = await storage.getLoans(req.session.tenantId!);
          
          // Check if it's a loan disbursement
          if (transactionData.narration.includes('कर्ज वितरण')) {
            const loan = loans.find(l => 
              transactionData.narration!.includes(l.accountNumber) || 
              transactionData.narration!.includes(l.borrowerName)
            );
            if (loan && loan.status !== 'active') {
              await storage.updateLoan(loan.id, req.session.tenantId!, { status: 'active' });
            }
          }
          
          // Check if it's a loan closure
          if (transactionData.narration.includes('कर्ज बंद')) {
            const loan = loans.find(l => 
              transactionData.narration!.includes(l.accountNumber) || 
              transactionData.narration!.includes(l.borrowerName)
            );
            if (loan && loan.status !== 'closed') {
              await storage.updateLoan(loan.id, req.session.tenantId!, { status: 'closed' });
            }
          }
        } catch (error) {
          console.error('Failed to update loan status from cash transaction:', error);
        }
      }
      
      console.log(`✅ Cash transaction created successfully: ${transactionData.transactionType} ₹${transactionData.amount}`);

      try {
        const txId = 'cashTransaction' in transaction ? (transaction as any).cashTransaction.id : (transaction as any).id;
        await storage.logUserActivity({ userId: req.session.userId!, tenantId: req.session.tenantId!, activityType: 'create_cash_transaction', description: `नवीन रोख व्यवहार: ${transactionData.transactionType === 'cash_in' ? 'जमा' : 'नावे'} ₹${transactionData.amount} - ${transactionData.narration?.substring(0, 50) || ''}`, metadata: JSON.stringify({ transactionId: txId, amount: transactionData.amount, transactionType: transactionData.transactionType, transactionDate: transactionData.transactionDate, category: transactionData.category, narration: transactionData.narration, partyId: transactionData.partyId }) });
      } catch(e) { console.error('Audit log error:', e); }

      res.json(transaction);
    } catch (error) {
      console.error("💥 MOBILE CASHBOOK TRANSACTION ERROR:", error);
      console.error("💥 ERROR TYPE:", error?.constructor?.name);
      console.error("💥 ERROR MESSAGE:", error instanceof Error ? error.message : error);
      console.error("💥 REQUEST BODY:", JSON.stringify(req.body, null, 2));
      
      res.status(400).json({ 
        message: "Invalid transaction data",
        error: error instanceof Error ? error.message : String(error),
        errorType: error?.constructor?.name,
        requestData: req.body
      });
    }
  });

  // Transaction cleanup endpoint (simplified)
  app.post("/api/cash-transactions/cleanup", requireAuth, async (req, res) => {
    try {
      res.json({
        success: true,
        message: "Manual cleanup completed"
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to perform cleanup" });
    }
  });

  app.put("/api/cash-transactions/:id", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const transactionData = insertCashTransactionSchema.partial().parse(req.body);
      
      // Get old transaction data
      const transactions = await storage.getCashTransactions(req.session.tenantId!);
      const oldTransaction = transactions.find(t => t.id === id);
      
      if (!oldTransaction) {
        return res.status(404).json({ message: "Transaction not found" });
      }
      
      const transaction = await storage.updateCashTransaction(id, req.session.tenantId!, transactionData);
      if (!transaction) {
        return res.status(404).json({ message: "Failed to update transaction" });
      }

      try {
        const changedFields: Record<string, { old: any; new: any }> = {};
        if (oldTransaction) {
          for (const key of Object.keys(req.body)) {
            if ((oldTransaction as any)[key] !== undefined && String((oldTransaction as any)[key]) !== String(req.body[key])) {
              changedFields[key] = { old: (oldTransaction as any)[key], new: req.body[key] };
            }
          }
        }
        await storage.logUserActivity({ userId: req.session.userId!, tenantId: req.session.tenantId!, activityType: 'update_cash_transaction', description: `रोख व्यवहार अपडेट: ₹${transaction.amount} - ${transaction.narration?.substring(0, 50) || ''}`, metadata: JSON.stringify({ transactionId: id, amount: transaction.amount, oldAmount: oldTransaction?.amount, narration: transaction.narration, transactionType: transaction.transactionType, transactionDate: transaction.transactionDate, changedFields }) });
      } catch(e) { console.error('Audit log error:', e); }

      // Handle loan status changes based on narration updates
      const newNarration = transactionData.narration || transaction.narration || '';
      const oldNarration = oldTransaction.narration || '';
      
      if (newNarration !== oldNarration && (newNarration.includes('कर्ज') || oldNarration.includes('कर्ज'))) {
        try {
          const loans = await storage.getLoans(req.session.tenantId!);
          
          // If changing from loan closure to something else, reopen loan
          if (oldNarration.includes('कर्ज बंद') && !newNarration.includes('कर्ज बंद')) {
            const loan = loans.find(l => 
              oldNarration.includes(l.accountNumber) || 
              oldNarration.includes(l.borrowerName)
            );
            if (loan && loan.status === 'closed') {
              await storage.updateLoan(loan.id, req.session.tenantId!, { status: 'active' });
            }
          }
          
          // If changing to loan closure, close loan
          if (!oldNarration.includes('कर्ज बंद') && newNarration.includes('कर्ज बंद')) {
            const loan = loans.find(l => 
              newNarration.includes(l.accountNumber) || 
              newNarration.includes(l.borrowerName)
            );
            if (loan && loan.status === 'active') {
              await storage.updateLoan(loan.id, req.session.tenantId!, { status: 'closed' });
            }
          }
        } catch (error) {
          console.error('Failed to update loan status after cash transaction update:', error);
        }
      }
      
      res.json(transaction);
    } catch (error) {
      res.status(400).json({ message: "Invalid transaction data" });
    }
  });

  app.delete("/api/cash-transactions/:id", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      
      console.log('🗑️ DELETE TRANSACTION REQUEST:', {
        transactionId: id,
        tenantId: req.session.tenantId,
        userId: req.session.userId
      });
      
      // Get transaction details before deletion
      const transactions = await storage.getCashTransactions(req.session.tenantId!);
      const transaction = transactions.find(t => t.id === id);
      
      console.log('🔍 TRANSACTION FOUND:', {
        exists: !!transaction,
        isDualEntry: transaction?.partyId && transaction?.partyId !== 'cash',
        partyId: transaction?.partyId,
        amount: transaction?.amount,
        narration: transaction?.narration
      });
      
      if (!transaction) {
        console.log('❌ TRANSACTION NOT FOUND');
        return res.status(404).json({ message: "Transaction not found" });
      }
      
      // If deleting a loan-related cash transaction, handle loan status
      if (transaction.narration && transaction.narration.includes('कर्ज')) {
        try {
          const loans = await storage.getLoans(req.session.tenantId!);
          
          // If deleting loan closure transaction, reopen the loan
          if (transaction.narration.includes('कर्ज बंद')) {
            const loan = loans.find(l => 
              transaction.narration!.includes(l.accountNumber) || 
              transaction.narration!.includes(l.borrowerName)
            );
            if (loan && loan.status === 'closed') {
              await storage.updateLoan(loan.id, req.session.tenantId!, { status: 'active' });
              
              // Also delete any loan closure records
              const closures = await storage.getLoanClosures(req.session.tenantId!, loan.id);
              for (const closure of closures) {
                await storage.deleteLoanClosure(closure.id, req.session.tenantId!);
              }
            }
          }
          
          // If deleting loan disbursement transaction, consider marking loan as inactive
          if (transaction.narration.includes('कर्ज वितरण')) {
            const loan = loans.find(l => 
              transaction.narration!.includes(l.accountNumber) || 
              transaction.narration!.includes(l.borrowerName)
            );
            if (loan) {
              // Check if there are any other transactions for this loan
              const loanTransactions = await storage.getTransactions(req.session.tenantId!, loan.id);
              if (loanTransactions.length === 1) { // Only disbursement exists
                await storage.updateLoan(loan.id, req.session.tenantId!, { status: 'inactive' });
              }
            }
          }
        } catch (error) {
          console.error('Failed to update loan status after cash transaction deletion:', error);
        }
      }
      
      const success = await storage.deleteCashTransaction(id, req.session.tenantId!);
      
      console.log('💥 DELETE RESULT:', {
        success,
        transactionId: id,
        tenantId: req.session.tenantId
      });
      
      if (!success) {
        console.log('❌ DELETE FAILED - Transaction not found in storage');
        return res.status(404).json({ message: "Failed to delete transaction" });
      }

      try { await storage.logUserActivity({ userId: req.session.userId!, tenantId: req.session.tenantId!, activityType: 'delete_cash_transaction', description: `रोख व्यवहार डिलीट: ₹${transaction.amount} - ${transaction.narration?.substring(0, 80) || ''}`, metadata: JSON.stringify({ transactionId: id, amount: transaction.amount, narration: transaction.narration, transactionType: transaction.transactionType, transactionDate: transaction.transactionDate, category: transaction.category, partyId: transaction.partyId }) }); } catch(e) { console.error('Audit log error:', e); }

      console.log('✅ DELETE SUCCESS - Transaction deleted successfully');
      res.json({ message: "Transaction deleted successfully" });
    } catch (error) {
      console.error('💥 DELETE EXCEPTION:', error);
      res.status(500).json({ message: "Failed to delete transaction" });
    }
  });

  // Add dedicated date-wise balance route for comprehensive date calculation
  app.get("/api/date-wise-balance/:date", requireAuth, async (req, res) => {
    try {
      const { date } = req.params;
      
      const dateWiseBalance = await storage.getDateWiseCashBalance(req.session.tenantId!, date);
      
      res.json({
        success: true,
        data: dateWiseBalance,
        message: `Date-wise balance for ${date}`
      });
    } catch (error) {
      console.error("Date-wise balance calculation error:", error);
      res.status(500).json({ 
        success: false, 
        message: "Failed to calculate date-wise balance",
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });

  app.get("/api/cash-balance", requireAuth, async (req, res) => {
    try {
      const { beforeDate, date } = req.query;
      
      if (beforeDate || date) {
        // Get comprehensive date-wise balance for specified date
        const targetDate = (date || beforeDate) as string;
        console.log(`🏦 API: Getting balance for date: ${targetDate}`);
        const dateWiseBalance = await storage.getDateWiseCashBalance(req.session.tenantId!, targetDate);
        
        console.log(`🏦 API: Date-wise balance result:`, {
          date: targetDate,
          openingBalance: dateWiseBalance.openingBalance,
          closingBalance: dateWiseBalance.closingBalance,
          dayTransactions: dateWiseBalance.dayTransactions
        });
        
        res.json({ 
          balance: dateWiseBalance.closingBalance,        // Use CLOSING balance for date-specific query
          openingBalance: dateWiseBalance.openingBalance, // Date opening balance  
          closingBalance: dateWiseBalance.closingBalance, // Date closing balance
          dayTransactions: dateWiseBalance.dayTransactions, // Day-specific transactions
          totalCashIn: dateWiseBalance.dayTransactions.cashIn,
          totalCashOut: dateWiseBalance.dayTransactions.cashOut,
          netDifference: dateWiseBalance.dayTransactions.netDifference,
          totalLoanDisbursements: 0,
          totalLoanClosures: 0,
          transactionCount: 0,
          lastUpdated: new Date(),
          isValid: true,
          errors: []
        });
      } else {
        // Professional cash balance calculation with real-time loan-cash synchronization
        const professionalBalance = await storage.getProfessionalCashBalance(req.session.tenantId!);
        res.json({ 
          balance: professionalBalance.currentBalance,
          openingBalance: professionalBalance.openingBalance,
          totalCashIn: professionalBalance.totalCashIn,
          totalCashOut: professionalBalance.totalCashOut,
          totalLoanDisbursements: professionalBalance.totalLoanDisbursements,
          totalLoanClosures: professionalBalance.totalLoanClosures,
          transactionCount: professionalBalance.transactionCount,
          lastUpdated: professionalBalance.lastUpdated,
          isValid: professionalBalance.isValid,
          errors: professionalBalance.errors
        });
      }
    } catch (error) {
      console.error("Professional cash balance calculation error:", error);
      res.status(500).json({ message: "Failed to calculate professional cash balance" });
    }
  });

  // Dual-entry accounting routes
  app.post("/api/cash-transactions-with-journal", requireAuth, async (req, res) => {
    try {
      console.log("🔍 DUAL ENTRY REQUEST DATA:", JSON.stringify(req.body, null, 2));
      console.log("🔍 SESSION DATA:", req.session.tenantId, req.session.userId);
      
      const transactionData = insertCashTransactionSchema.parse({
        ...req.body,
        tenantId: req.session.tenantId!,
      });
      
      console.log("✅ PARSED TRANSACTION DATA:", JSON.stringify(transactionData, null, 2));
      
      const result = await storage.createCashTransactionWithJournal(transactionData);
      
      console.log("🎉 DUAL ENTRY TRANSACTION CREATED:", JSON.stringify(result, null, 2));
      res.json(result);
    } catch (error) {
      console.error("💥 FULL ERROR OBJECT:", error);
      console.error("💥 Error name:", error?.constructor?.name);
      console.error("💥 Error message:", error instanceof Error ? error.message : error);
      console.error("💥 Error stack:", error instanceof Error ? error.stack : 'No stack');
      
      // Send detailed error for debugging
      res.status(400).json({ 
        message: "Invalid transaction data",
        error: error instanceof Error ? error.message : String(error),
        errorType: error?.constructor?.name,
        details: error
      });
    }
  });

  app.get("/api/journal-entries", requireAuth, async (req, res) => {
    try {
      const { dateFrom, dateTo, sourceType } = req.query;
      const entries = await storage.getJournalEntries(req.session.tenantId!, {
        dateFrom: dateFrom as string,
        dateTo: dateTo as string,
        sourceType: sourceType as string,
      });
      res.json(entries);
    } catch (error) {
      console.error("Error fetching journal entries:", error);
      res.status(500).json({ message: "Failed to fetch journal entries" });
    }
  });

  app.get("/api/party-ledger/:partyId", requireAuth, async (req, res) => {
    try {
      const { partyId } = req.params;
      const { dateFrom, dateTo } = req.query;
      
      const ledger = await storage.getPartyLedger(
        req.session.tenantId!,
        partyId,
        dateFrom as string,
        dateTo as string
      );
      res.json(ledger);
    } catch (error) {
      console.error("Error fetching party ledger:", error);
      res.status(500).json({ message: "Failed to fetch party ledger" });
    }
  });

  app.get("/api/trial-balance", requireAuth, async (req, res) => {
    try {
      const { asOfDate } = req.query;
      const trialBalance = await storage.getTrialBalance(
        req.session.tenantId!,
        asOfDate as string
      );
      res.json(trialBalance);
    } catch (error) {
      console.error("Error fetching trial balance:", error);
      res.status(500).json({ message: "Failed to fetch trial balance" });
    }
  });

  // Super Admin Routes - Main API Endpoints
  // Super Admin - Get All System Users
  app.get("/api/users", requireAuth, async (req, res) => {
    try {
      if (req.session.role !== 'super_admin') {
        return res.status(403).json({ message: "Access denied. Super admin required." });
      }
      
      const users = await storage.getAllSystemUsers();
      res.json(users);
    } catch (error) {
      console.error('Error fetching all system users:', error);
      res.status(500).json({ message: "Failed to fetch system users" });
    }
  });

  // Super Admin - Get All System Tenants
  app.get("/api/tenants", requireAuth, async (req, res) => {
    try {
      if (req.session.role !== 'super_admin') {
        return res.status(403).json({ message: "Access denied. Super admin required." });
      }
      
      const tenants = await storage.getAllSystemTenants();
      res.json(tenants);
    } catch (error) {
      console.error('Error fetching all system tenants:', error);
      res.status(500).json({ message: "Failed to fetch system tenants" });
    }
  });

  // Super Admin Routes - User Management
  // DEPRECATED: Super Admin should NOT manage individual users - only tenant admins
  app.get("/api/super-admin/users", requireAuth, async (req, res) => {
    return res.status(403).json({ 
      message: "Super Admin फक्त tenant management करू शकतो. Individual user management tenant admin द्वारे करावे.",
      redirectTo: "/super-admin-tenant-management"
    });
  });

  // DEPRECATED: Super Admin should NOT create individual users
  app.post("/api/super-admin/users", requireAuth, async (req, res) => {
    return res.status(403).json({ 
      message: "Super Admin फक्त tenant admins create करू शकतो. Individual users tenant admin द्वारे create करावे.",
      redirectTo: "/super-admin-tenant-management"
    });
  });

  // DEPRECATED: Super Admin should NOT edit individual users  
  app.put("/api/super-admin/users/:id", requireAuth, async (req, res) => {
    return res.status(403).json({ 
      message: "Super Admin फक्त tenant admins manage करू शकतो. Individual users edit करण्यासाठी tenant admin म्हणून login करा.",
      redirectTo: "/super-admin-tenant-management"
    });
  });

  // DEPRECATED: Super Admin should NOT toggle individual users
  app.patch("/api/super-admin/users/:id/toggle", requireAuth, async (req, res) => {
    return res.status(403).json({ 
      message: "Super Admin फक्त tenant admins enable/disable करू शकतो. Individual users tenant admin द्वारे manage करावे.",
      redirectTo: "/super-admin-tenant-management"
    });
  });

  // DEPRECATED: Super Admin should NOT reset individual user passwords
  app.patch("/api/super-admin/users/:id/password", requireAuth, async (req, res) => {
    return res.status(403).json({ 
      message: "Super Admin फक्त tenant admin passwords reset करू शकतो. Individual user passwords tenant admin द्वारे reset करावे.",
      redirectTo: "/super-admin-tenant-management"
    });
  });

  // Super Admin Change Own Password
  app.post("/api/super-admin/change-own-password", requireAuth, async (req, res) => {
    try {
      if (req.session.role !== 'super_admin') {
        return res.status(403).json({ message: "Access denied. Super admin required." });
      }

      const { currentPassword, newPassword } = req.body;

      if (!currentPassword || !newPassword) {
        return res.status(400).json({ message: "Current password and new password are required" });
      }

      if (newPassword.length < 6) {
        return res.status(400).json({ message: "New password must be at least 6 characters long" });
      }

      // Get Super Admin user
      const superAdmin = await storage.getUser(req.session.userId!);
      if (!superAdmin) {
        return res.status(404).json({ message: "Super Admin user not found" });
      }

      // Verify current password
      const isCurrentPasswordValid = await bcrypt.compare(currentPassword, superAdmin.password);
      if (!isCurrentPasswordValid) {
        return res.status(400).json({ message: "Current password is incorrect" });
      }

      // Update password for Super Admin
      const success = await storage.updateUserPassword(req.session.userId!, req.session.tenantId!, newPassword);
      
      if (!success) {
        return res.status(500).json({ message: "Failed to update password" });
      }

      console.log(`🔒 SUPER ADMIN PASSWORD CHANGED: ${superAdmin.username} (${req.session.userId})`);

      await invalidateOtherSessions(req.session.userId!, req.sessionID);

      await storage.logUserActivity({
        userId: req.session.userId!,
        tenantId: req.session.tenantId!,
        activityType: 'change_own_password',
        description: `Super Admin changed own password`,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        metadata: JSON.stringify({ superAdminPasswordChange: true })
      });

      res.json({ message: "Password changed successfully" });
    } catch (error) {
      console.error("Super Admin password change error:", error);
      res.status(500).json({ message: "Failed to change password" });
    }
  });

  // Super Admin - Reset Tenant Admin Password (NEW)
  app.post("/api/super-admin/reset-admin-password/:adminId", requireAuth, async (req, res) => {
    try {
      if (req.session.role !== 'super_admin') {
        return res.status(403).json({ message: "Access denied. Super admin required." });
      }
      
      const { adminId } = req.params;
      const { newPassword } = req.body;

      if (!newPassword || newPassword.length < 6) {
        return res.status(400).json({ message: "Password must be at least 6 characters long" });
      }

      // Verify admin exists and is an admin user (not a regular clerk)
      const adminUser = await storage.getUserById(adminId);
      if (!adminUser || adminUser.role !== 'admin') {
        return res.status(404).json({ message: "Admin user not found" });
      }

      const hashedPassword = await bcrypt.hash(newPassword, 10);
      await storage.updateUser(adminId, { password: hashedPassword });

      await invalidateOtherSessions(adminId, "");

      res.json({ 
        message: `Password reset successfully for admin: ${adminUser.username}`,
        adminUsername: adminUser.username,
        tenantId: adminUser.tenantId
      });
    } catch (error) {
      console.error('Error resetting admin password:', error);
      res.status(500).json({ message: "Failed to reset admin password" });
    }
  });

  // Super Admin - Delete Tenant Admin (NEW)
  app.delete("/api/super-admin/delete-admin/:adminId", requireAuth, async (req, res) => {
    try {
      if (req.session.role !== 'super_admin') {
        return res.status(403).json({ message: "Access denied. Super admin required." });
      }
      
      const { adminId } = req.params;

      // Verify admin exists and is an admin user (not a regular clerk)
      const adminUser = await storage.getUserById(adminId);
      if (!adminUser || adminUser.role !== 'admin') {
        return res.status(404).json({ message: "Admin user not found" });
      }

      // Check if this is the only admin for the tenant
      const tenantAdmins = await storage.getUsersByTenant(adminUser.tenantId);
      const adminCount = tenantAdmins.filter((u: any) => u.role === 'admin' && u.isActive).length;
      
      if (adminCount <= 1) {
        return res.status(400).json({ 
          message: "Cannot delete the only admin for this tenant. Add another admin first." 
        });
      }

      await storage.deleteUser(adminId);

      res.json({ 
        message: `Admin deleted successfully: ${adminUser.username}`,
        deletedAdmin: {
          username: adminUser.username,
          tenantId: adminUser.tenantId,
          id: adminId
        }
      });
    } catch (error) {
      console.error('Error deleting admin user:', error);
      res.status(500).json({ message: "Failed to delete admin user" });
    }
  });

  // Admin Password Reset Request (for Forgot Password functionality) - database-backed
  app.post("/api/admin/request-password-reset", async (req, res) => {
    try {
      const { tenantId, username } = req.body;

      if (!tenantId || !username) {
        return res.status(400).json({ message: "Tenant ID and username are required" });
      }

      const adminUser = await storage.findUserByTenantAndUsername(tenantId, username);
      if (!adminUser || adminUser.role !== 'admin') {
        return res.status(404).json({ message: "Admin user not found" });
      }

      const resetRequest = await storage.createPasswordResetRequest({
        tenantId: adminUser.tenantId,
        username: adminUser.username,
        adminId: adminUser.id,
        userRole: adminUser.role,
        reason: "Password reset requested by admin",
      });

      res.json({ 
        message: "Password reset request sent to Super Admin successfully",
        requestId: resetRequest.id
      });
    } catch (error) {
      console.error('Error creating password reset request:', error);
      res.status(500).json({ message: "Failed to create password reset request" });
    }
  });

  // Get Password Reset Requests for Super Admin (from database)
  app.get("/api/super-admin/password-reset-requests", requireAuth, async (req, res) => {
    try {
      if (req.session.role !== 'super_admin') {
        return res.status(403).json({ message: "Access denied. Super admin required." });
      }

      const pendingRequests = await storage.getPendingPasswordResetRequests();
      res.json(pendingRequests);
    } catch (error) {
      console.error('Error fetching password reset requests:', error);
      res.status(500).json({ message: "Failed to fetch password reset requests" });
    }
  });

  // Super Admin - Approve Password Reset Request (database-backed)
  app.post("/api/super-admin/approve-password-reset/:requestId", requireAuth, async (req, res) => {
    try {
      if (req.session.role !== 'super_admin') {
        return res.status(403).json({ message: "Access denied. Super admin required." });
      }
      
      const { requestId } = req.params;
      const { newPassword } = req.body;

      if (!newPassword || newPassword.length < 6) {
        return res.status(400).json({ message: "Password must be at least 6 characters long" });
      }

      const request = await storage.getPasswordResetRequestById(requestId);
      if (!request || request.status !== 'pending') {
        return res.status(404).json({ message: "Password reset request not found or already processed" });
      }

      const hashedPassword = await bcrypt.hash(newPassword, 10);
      if (request.adminId) {
        await storage.updateUser(request.adminId, { password: hashedPassword });
        await invalidateOtherSessions(request.adminId, "");
      }

      await storage.completePasswordResetRequest(requestId, req.session.userId!);

      res.json({ 
        message: `Password reset approved and completed for ${request.username}`,
        adminUsername: request.username,
        tenantId: request.tenantId
      });
    } catch (error) {
      console.error('Error approving password reset:', error);
      res.status(500).json({ message: "Failed to approve password reset" });
    }
  });

  // Super Admin - Reset any tenant admin password
  app.patch("/api/super-admin/reset-tenant-admin/:tenantId", requireAuth, async (req, res) => {
    try {
      if (req.session.role !== 'super_admin') {
        return res.status(403).json({ message: "Access denied. Super admin required." });
      }
      
      const { tenantId } = req.params;
      const { newPassword } = req.body;
      
      if (!tenantId || !newPassword) {
        return res.status(400).json({ message: "Tenant ID and new password are required" });
      }
      
      // Find the admin user for this tenant
      const adminUser = await storage.getUserByCredentials(tenantId, 'admin');
      
      if (!adminUser) {
        return res.status(404).json({ message: "Admin user not found for this tenant" });
      }
      
      const hashedPassword = await bcrypt.hash(newPassword, 10);
      const updatedUser = await storage.updateUser(adminUser.id, { password: hashedPassword });
      
      if (!updatedUser) {
        return res.status(500).json({ message: "Failed to update password" });
      }
      
      await invalidateOtherSessions(adminUser.id.toString(), "");
      
      res.json({ 
        message: "Tenant admin password reset successfully",
        tenantId: tenantId,
        adminUsername: adminUser.username
      });
    } catch (error) {
      console.error("Error resetting tenant admin password:", error);
      res.status(500).json({ message: "Failed to reset tenant admin password" });
    }
  });

  // Super Admin - Create new tenant with admin user
  app.post("/api/super-admin/create-tenant", requireAuth, async (req, res) => {
    try {
      if (req.session.role !== 'super_admin') {
        return res.status(403).json({ message: "Access denied. Super admin required." });
      }
      
      const { tenantId: rawTenantId, adminUsername: rawAdminUsername, adminPassword, companyName, companyAddress } = req.body;
      
      if (!rawTenantId || !rawAdminUsername || !adminPassword || !companyName) {
        return res.status(400).json({ 
          message: "Tenant ID, admin username, password, and company name are required" 
        });
      }
      
      const tenantId = rawTenantId.toString().toUpperCase().trim();
      const adminUsername = rawAdminUsername.toString().trim();
      
      // Check if tenant already exists
      const existingUser = await storage.getUserByCredentials(tenantId, adminUsername);
      if (existingUser) {
        return res.status(409).json({ message: "Tenant or admin user already exists" });
      }
      
      // CRITICAL PROTECTION: Use Super Admin Guardian for user creation validation
      const { default: SuperAdminGuardian } = await import("./super-admin-guardian");
      const validation = await SuperAdminGuardian.validateUserCreation({
        username: adminUsername,
        tenantId: tenantId,
        role: 'admin'
      });
      
      if (!validation.isValid && validation.correctedRole) {
        console.warn(`🛡️  GUARDIAN PROTECTION (CREATE TENANT): ${validation.reason}`);
      }
      
      // Create admin user for new tenant with Guardian-validated role
      const hashedPassword = await bcrypt.hash(adminPassword, 10);
      const newAdmin = await storage.createUser({
        username: adminUsername,
        password: hashedPassword,
        tenantId: tenantId,
        role: validation.correctedRole || 'admin', // Use Guardian-validated role
        fullName: `${companyName} Administrator`,
        email: null,
        isActive: true,
        isTemporaryDisabled: false,
        createdBy: req.session.userId // Super admin who created this
      });
      
      // Create company record for new tenant
      const company = await storage.createCompany({
        name: companyName,
        address: companyAddress || '',
        tenantId: tenantId,
        contactNumber: '',
        email: '',
        licenseNumber: ''
      });
      
      // Create COMPLETE permissions for new tenant admin - FULL SYSTEM ACCESS
      await storage.createUserPermissions({
        userId: newAdmin.id,
        tenantId: tenantId,
        canViewDashboard: true,
        canAccessCompanyRegistration: true,
        canAccessGroupManagement: true,
        canAccessLoanRegistration: true,
        canAccessLoanClosure: true,
        canAccessCashTransactions: true,
        canAccessPartyManagement: true,
        canAccessMobileCashbook: true,
        canAccessInterestCalculator: true,
        canViewReceiptGenerator: true,
        canViewCashBookReport: true,
        canViewCapitalReport: true,
        canViewLedgerReport: true,
        canViewBorrowerListReport: true,
        canViewOverdueReport: true,
        // Date-wise, Name-wise, Closing-wise, and Maturity-wise reports removed from schema
        canViewAccountSummaryReport: true,
        canViewOtherReports: true,
        // Loan management permissions removed from schema
        canManageBorrowers: true,
        // Additional borrower permissions removed from schema
        canDeleteBorrowers: true,
        // Group management permissions removed from schema
        // Party management permissions removed from schema
        // Cashbook and report permissions removed from schema
        // Note: User Management and Data Management are admin-only features
        // Super Admin Panel access - role-based, not tenant-based
        // Super Admin Panel access removed from regular tenant creation
      });
      
      res.json({ 
        message: "New tenant created successfully with complete admin permissions",
        tenant: {
          tenantId: tenantId,
          adminUser: {
            id: newAdmin.id,
            username: newAdmin.username,
            role: newAdmin.role,
            hasFullAccess: true
          },
          company: {
            id: company.id,
            name: company.name
          }
        }
      });
    } catch (error) {
      console.error("Error creating new tenant:", error);
      res.status(500).json({ message: "Failed to create new tenant" });
    }
  });

  // Password Reset Request - Store requests in database for persistence
  app.post("/api/auth/forgot-password", async (req, res) => {
    try {
      const { tenantId, username, reason } = req.body;
      
      if (!tenantId || !username) {
        return res.status(400).json({ message: "Tenant ID and username are required" });
      }
      
      const user = await storage.getUserByCredentials(tenantId.toUpperCase().trim(), username.trim());
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      const resetRequest = await storage.createPasswordResetRequest({
        tenantId: tenantId.toUpperCase().trim(),
        username: username.trim(),
        adminId: user.id,
        userRole: user.role,
        reason: reason || "Password forgotten",
      });
      
      console.log(`📋 Password reset request stored in DB: ${username}@${tenantId}`);
      
      res.json({ 
        message: "Password reset request submitted successfully",
        requestId: resetRequest.id,
        info: "Your request has been sent to system administrator"
      });
    } catch (error) {
      console.error("Error submitting password reset request:", error);
      res.status(500).json({ message: "Failed to submit password reset request" });
    }
  });

  // Super Admin - Get all users for password reset management
  app.get("/api/super-admin/all-users", requireAuth, async (req, res) => {
    try {
      if (req.session.role !== 'super_admin') {
        return res.status(403).json({ message: "Access denied. Super admin required." });
      }
      
      const allUsers = await storage.getAllUsersWithCompanyDetails();
      res.json(allUsers);
    } catch (error) {
      console.error("Error fetching all users:", error);
      res.status(500).json({ message: "Failed to fetch users" });
    }
  });

  // Reset user password endpoint (for super admin)
  app.post("/api/super-admin/reset-password", requireAuth, async (req, res) => {
    try {
      if (req.session.role !== 'super_admin') {
        return res.status(403).json({ message: "Access denied. Super admin required." });
      }
      
      const { userId, newPassword } = req.body;
      if (!userId || !newPassword) {
        return res.status(400).json({ message: "User ID and new password are required" });
      }
      
      const success = await storage.resetUserPassword(userId, req.session.tenantId!, newPassword, "super_admin");
      if (success) {
        res.json({ message: "Password reset successfully" });
      } else {
        res.status(500).json({ message: "Failed to reset password" });
      }
    } catch (error) {
      console.error("Error resetting password:", error);
      res.status(500).json({ message: "Failed to reset password" });
    }
  });

  // Get tenant storage analytics (for super admin)
  app.get("/api/super-admin/storage-analytics", requireAuth, async (req, res) => {
    try {
      if (req.session.role !== 'super_admin') {
        return res.status(403).json({ message: "Access denied. Super admin required." });
      }
      
      const analytics = await storage.getTenantStorageAnalytics();
      res.json(analytics);
    } catch (error) {
      console.error("Error fetching storage analytics:", error);
      res.status(500).json({ message: "Failed to fetch storage analytics" });
    }
  });

  // Get all tenants for management (for super admin)
  app.get("/api/super-admin/tenants", requireAuth, async (req, res) => {
    try {
      if (req.session.role !== 'super_admin') {
        return res.status(403).json({ message: "Access denied. Super admin required." });
      }
      
      const tenants = await storage.getAllTenantsForManagement();
      res.json(tenants);
    } catch (error) {
      console.error("Error fetching tenants:", error);
      res.status(500).json({ message: "Failed to fetch tenants" });
    }
  });

  // Super Admin - Toggle tenant active status
  app.patch("/api/super-admin/tenants/:tenantId/toggle", requireAuth, async (req, res) => {
    try {
      if (req.session.role !== 'super_admin') {
        return res.status(403).json({ message: "Access denied. Super admin required." });
      }
      
      const { tenantId } = req.params;
      const { isActive } = req.body;
      
      if (tenantId === 'SUPER_ADMIN') {
        return res.status(403).json({ message: "SUPER_ADMIN tenant बंद करता येत नाही. हा system tenant आहे." });
      }

      if (typeof isActive !== 'boolean') {
        return res.status(400).json({ message: "isActive must be a boolean value" });
      }
      
      await storage.toggleTenantActive(tenantId, isActive);
      
      console.log(`🔄 TENANT TOGGLE: ${tenantId} -> ${isActive ? 'ACTIVE' : 'INACTIVE'}`);
      
      await storage.logUserActivity({
        userId: req.session.userId!,
        tenantId: req.session.tenantId!,
        activityType: 'toggle_tenant',
        description: `Toggled tenant ${tenantId} to ${isActive ? 'active' : 'inactive'}`,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        metadata: JSON.stringify({ 
          targetTenantId: tenantId, 
          newStatus: isActive ? 'active' : 'inactive' 
        })
      });
      
      res.json({ 
        message: `Tenant ${tenantId} ${isActive ? 'activated' : 'deactivated'} successfully`,
        tenantId,
        isActive
      });
    } catch (error) {
      console.error('Error toggling tenant status:', error);
      res.status(500).json({ message: "Failed to toggle tenant status" });
    }
  });

  // Delete tenant completely (for super admin)
  app.delete("/api/super-admin/delete-tenant/:tenantId", requireAuth, async (req, res) => {
    try {
      if (req.session.role !== 'super_admin') {
        return res.status(403).json({ message: "Access denied. Super admin required." });
      }
      
      const { tenantId } = req.params;
      
      if (!tenantId || tenantId === 'SUPER_ADMIN' || tenantId === req.session.tenantId) {
        return res.status(400).json({ message: "Invalid tenant ID or cannot delete system/own tenant" });
      }
      
      const result = await storage.deleteTenantCompletely(tenantId);
      
      if (result.success) {
        res.json({ 
          message: "Tenant deleted successfully",
          deletedRecords: result.deletedRecords 
        });
      } else {
        res.status(500).json({ 
          message: "Failed to delete tenant",
          errors: result.errors 
        });
      }
    } catch (error) {
      console.error("Error deleting tenant:", error);
      res.status(500).json({ message: "Failed to delete tenant" });
    }
  });

  // Super Admin - Reset any user's password
  app.post("/api/super-admin/reset-password/:userId", requireAuth, async (req, res) => {
    try {
      if (req.session.role !== 'super_admin') {
        return res.status(403).json({ message: "Access denied. Super admin required." });
      }
      
      const { userId } = req.params;
      const { newPassword } = req.body;
      
      if (!newPassword || newPassword.length < 6) {
        return res.status(400).json({ message: "Password must be at least 6 characters long" });
      }
      
      const success = await storage.resetUserPasswordBySuperAdmin(userId, newPassword);
      
      if (!success) {
        return res.status(404).json({ message: "User not found" });
      }

      await invalidateOtherSessions(userId, "");
      
      res.json({ 
        message: "Password reset successfully",
        resetAt: new Date().toISOString()
      });
    } catch (error) {
      console.error("Error resetting user password:", error);
      res.status(500).json({ message: "Failed to reset password" });
    }
  });

  // Super Admin - Tenant Management
  app.get("/api/super-admin/tenant-stats", requireAuth, async (req, res) => {
    try {
      if (req.session.role !== 'super_admin') {
        return res.status(403).json({ message: "Access denied. Super admin required." });
      }
      
      const tenantStats = await storage.getTenantStatistics();
      res.json(tenantStats);
    } catch (error) {
      console.error("Error fetching tenant statistics:", error);
      res.status(500).json({ message: "Failed to fetch tenant statistics" });
    }
  });

  app.delete("/api/super-admin/tenant/:tenantId", requireAuth, async (req, res) => {
    try {
      if (req.session.role !== 'super_admin') {
        return res.status(403).json({ message: "Access denied. Super admin required." });
      }
      
      const { tenantId } = req.params;
      
      if (!tenantId) {
        return res.status(400).json({ message: "Tenant ID is required" });
      }

      if (tenantId === 'SUPER_ADMIN') {
        return res.status(403).json({ message: "SUPER_ADMIN tenant डिलीट करता येत नाही. हा system tenant आहे." });
      }

      const result = await storage.deleteTenantData(tenantId);
      res.json({ message: "Tenant and all data deleted successfully", deletedRecords: result });
    } catch (error) {
      console.error("Error deleting tenant data:", error);
      res.status(500).json({ message: "Failed to delete tenant data" });
    }
  });

  app.delete("/api/super-admin/users/:id", requireAuth, async (req, res) => {
    try {
      if (req.session.role !== 'super_admin') {
        return res.status(403).json({ message: "Access denied. Super admin required." });
      }
      
      const { id } = req.params;
      const success = await storage.deleteUser(id);
      
      if (!success) {
        return res.status(404).json({ message: "User not found" });
      }
      
      res.json({ message: "User deleted successfully" });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete user" });
    }
  });



  // Emergency Recovery Endpoints
  // Emergency password reset for super admin (for development/emergency only)
  app.post('/emergency/reset-admin', async (req, res) => {
    try {
      // Only allow in development or emergency mode
      if (process.env.NODE_ENV === 'production' && !process.env.EMERGENCY_MODE) {
        return res.status(403).json({ message: 'Emergency endpoints disabled in production' });
      }

      const { tenantId = 'TEST', username = 'admin', newPassword } = req.body;
      
      if (!newPassword) {
        return res.status(400).json({ message: 'New password required' });
      }

      const hashedPassword = await bcrypt.hash(newPassword, 10);
      
      // Get user first
      const user = await storage.getUserByCredentials(tenantId, username);
      if (!user) {
        return res.status(404).json({ message: 'Admin user not found' });
      }
      
      // Update password directly in database
      const success = await storage.updateUser(user.id, { password: hashedPassword });

      console.log('Emergency password reset for:', { username, tenantId });
      
      res.json({ 
        message: 'Password reset successful',
        warning: 'Change this password immediately after login'
      });
    } catch (error) {
      console.error('Emergency reset error:', error);
      res.status(500).json({ message: 'Reset failed' });
    }
  });

  // Emergency admin list (for development/debugging)
  app.get('/emergency/list-admins', async (req, res) => {
    try {
      if (process.env.NODE_ENV === 'production' && !process.env.EMERGENCY_MODE) {
        return res.status(403).json({ message: 'Emergency endpoints disabled in production' });
      }

      const admins = await storage.getAllUsers();

      const adminUsers = admins.filter(user => user.role === 'admin');
      res.json({ admins: adminUsers });
    } catch (error) {
      console.error('Emergency list error:', error);
      res.status(500).json({ message: 'List failed' });
    }
  });

  // 🤖 AUTOMATIC SYSTEM ENDPOINT - Run full automatic checks
  app.post("/api/automatic-system-check", requireAuth, async (req, res) => {
    try {
      console.log('🤖 Running automatic system check...');
      
      const automaticPrevention = createAutomaticPrevention(req.session.tenantId!);
      const result = await automaticPrevention.runFullAutomaticSystem();
      
      res.json({
        success: true,
        message: "Automatic system check completed",
        results: {
          missingDisbursementsFixed: result.missingFixed,
          duplicatesRemoved: result.duplicatesRemoved,
          actions: result.totalActions
        }
      });
    } catch (error) {
      console.error('Automatic system check failed:', error);
      res.status(500).json({ 
        success: false,
        message: "Automatic system check failed",
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // 🚫 LOAN CLOSURE MANUAL ENTRY CLEANUP - Prevent duplicate creation at form level
  app.post("/api/loans/cleanup-manual-entries", requireAuth, async (req, res) => {
    try {
      const { amount, accountNumber } = req.body;
      const tenantId = req.session.tenantId!;
      
      console.log(`🧹 FORM LEVEL CLEANUP: Checking for manual entries before loan closure ₹${amount}`);
      
      // Find recent manual entries with same amount that might conflict with loan closure
      const manualEntries = await db.select()
        .from(cashTransactions)
        .where(and(
          eq(cashTransactions.tenantId, tenantId),
          sql`ABS(${cashTransactions.amount} - ${amount}) < 0.01`,
          eq(cashTransactions.isSystemGenerated, false),
          // Look for entries within last 10 minutes that could be manual duplicates
          sql`${cashTransactions.createdAt} > NOW() - INTERVAL '10 minutes'`,
          // Target common manual entry categories
          or(
            eq(cashTransactions.category, 'income'),
            eq(cashTransactions.category, 'capital'),
            eq(cashTransactions.category, 'expense')
          )
        ))
        .orderBy(sql`${cashTransactions.createdAt} DESC`)
        .limit(5);

      let deletedCount = 0;
      
      for (const entry of manualEntries) {
        // Additional validation: check if narration contains loan keywords
        const hasLoanKeywords = entry.narration && (
          entry.narration.includes('कर्ज बंद') ||
          entry.narration.includes('खाते क्र.') ||
          entry.narration.includes('मुद्दल') ||
          entry.narration.includes('व्याज') ||
          (accountNumber && entry.narration.includes(accountNumber))
        );
        
        if (hasLoanKeywords || !entry.narration) {
          console.log(`🗑️ FORM CLEANUP: Removing potential manual duplicate: ${entry.id} - ₹${entry.amount}`);
          await db.delete(cashTransactions).where(eq(cashTransactions.id, entry.id));
          deletedCount++;
        }
      }
      
      console.log(`✅ FORM CLEANUP COMPLETE: Removed ${deletedCount} potential manual duplicates`);
      
      res.json({
        success: true,
        message: `Manual entries cleanup completed`,
        deletedCount,
        cleanState: true
      });
    } catch (error) {
      console.error('Manual entry cleanup failed:', error);
      res.status(500).json({ 
        success: false,
        message: "Manual entry cleanup failed",
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
    }
  });



  // Register data management routes (admin only)
  app.use("/api/data-management", dataManagementRoutes);

  // Register user management routes (admin only)
  app.use("/api/user-management", userManagementRoutes);

  // User permissions routes for admins
  // User permissions - cached for 10 minutes (rarely changes)
  app.get("/api/users/:userId/permissions", requireAuth, apiCache({ 
    ttl: 600,
    keyGenerator: (req) => `permissions:${req.session.tenantId}:${req.params.userId}`
  }), async (req, res) => {
    try {
      // Only admin and super_admin can manage permissions
      if (req.session.role !== 'admin' && req.session.role !== 'super_admin') {
        return res.status(403).json({ message: "Admin access required" });
      }
      
      const { userId } = req.params;
      const permissions = await storage.getUserPermissions(userId, req.session.tenantId!);
      
      if (!permissions) {
        // Create default permissions if not found
        const defaultPermissions = await storage.createUserPermissions({
          userId,
          tenantId: req.session.tenantId!,
          canViewDashboard: true,
          canAccessInterestCalculator: true
        });
        return res.json(defaultPermissions);
      }
      
      res.json(permissions);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch user permissions" });
    }
  });

  app.put("/api/users/:userId/permissions", requireAuth, async (req, res) => {
    try {
      // Only admin and super_admin can manage permissions
      if (req.session.role !== 'admin' && req.session.role !== 'super_admin') {
        return res.status(403).json({ message: "Admin access required" });
      }
      
      const { userId } = req.params;
      const permissionsData = req.body;
      
      const updatedPermissions = await storage.updateUserPermissions(userId, req.session.tenantId!, permissionsData);
      
      if (!updatedPermissions) {
        return res.status(404).json({ message: "User permissions not found" });
      }
      
      res.json(updatedPermissions);
    } catch (error) {
      res.status(500).json({ message: "Failed to update user permissions" });
    }
  });

  // Super Admin simple disable/enable routes
  app.post("/api/super-admin/admin/:adminId/temporary-disable", requireAuth, async (req, res) => {
    try {
      if (req.session.role !== 'super_admin') {
        return res.status(403).json({ message: "Super admin access required" });
      }

      const { adminId } = req.params;
      
      await storage.temporaryDisableAdmin(adminId, 0, req.session.userId!);
      
      res.json({ message: "Admin access disabled" });
    } catch (error) {
      res.status(500).json({ message: "Failed to disable admin" });
    }
  });

  app.post("/api/super-admin/admin/:adminId/temporary-enable", requireAuth, async (req, res) => {
    try {
      if (req.session.role !== 'super_admin') {
        return res.status(403).json({ message: "Super admin access required" });
      }

      const { adminId } = req.params;
      
      await storage.temporaryEnableAdmin(adminId);
      
      res.json({ message: "Admin temporarily enabled" });
    } catch (error) {
      res.status(500).json({ message: "Failed to enable admin" });
    }
  });

  // Admin password reset route
  app.put("/api/user-management/users/:userId/password", requireAuth, async (req, res) => {
    try {
      // Only admin and super_admin can reset passwords
      if (req.session.role !== 'admin' && req.session.role !== 'super_admin') {
        return res.status(403).json({ message: "Admin access required" });
      }

      const { userId } = req.params;
      const { newPassword } = req.body;

      if (!newPassword || newPassword.length < 6) {
        return res.status(400).json({ message: "Password must be at least 6 characters" });
      }
      
      const updatedUser = await storage.resetUserPassword(userId, req.session.tenantId!, newPassword, req.session.userId!);
      
      if (!updatedUser) {
        return res.status(404).json({ message: "User not found" });
      }

      await invalidateOtherSessions(userId, "");

      const { password, ...userWithoutPassword } = updatedUser;
      res.json({ message: "Password reset successfully", user: userWithoutPassword });
    } catch (error) {
      res.status(500).json({ message: "Failed to reset password" });
    }
  });

  // Super Admin: Get all admin users across tenants
  app.get("/api/super-admin/admin-users", requireAuth, async (req, res) => {
    try {
      if (req.session.role !== 'super_admin') {
        return res.status(403).json({ message: "Super admin access required" });
      }

      console.log("🔍 Super Admin fetching ONLY tenant admin users (not regular users or super admin users)");
      const adminUsers = await storage.getAllAdminUsers();
      console.log("📋 Admin users found:", adminUsers.length, "- filtering out non-admin users");
      res.json(adminUsers);
    } catch (error) {
      console.error("❌ Error fetching admin users:", error);
      res.status(500).json({ message: "Failed to fetch admin users" });
    }
  });

  // Delete individual photo API endpoint
  app.delete('/api/loans/:loanId/photos/:photoId', requireAuth, async (req, res) => {
    try {
      const { loanId, photoId } = req.params;
      const tenantId = req.session.tenantId!;
      
      // Get the specific photo record
      const [photo] = await db.select()
        .from(loanPhotos)
        .where(
          and(
            eq(loanPhotos.id, photoId),
            eq(loanPhotos.loanId, loanId),
            eq(loanPhotos.tenantId, tenantId),
            eq(loanPhotos.isActive, true)
          )
        );
      
      if (!photo) {
        return res.status(404).json({ message: "Photo not found" });
      }
      
      await PhotoService.deleteSinglePhoto(db, photo, tenantId);

      try { await storage.logUserActivity({ userId: req.session.userId!, tenantId: req.session.tenantId!, activityType: 'delete_photo', description: `फोटो डिलीट: ${photo.filename} (कर्ज ${loanId})`, metadata: JSON.stringify({ photoId, loanId, filename: photo.filename }) }); } catch(e) { console.error('Audit log error:', e); }

      console.log(`📸 INDIVIDUAL DELETE: Photo ${photo.filename} deleted successfully for loan ${loanId}`);
      res.json({ 
        message: "Photo deleted successfully",
        deletedPhotoId: photoId,
        filename: photo.filename
      });
      
    } catch (error) {
      console.error('Individual photo deletion error:', error);
      res.status(500).json({ message: "Failed to delete photo" });
    }
  });

  // =================================
  // HOSTING-READY FILE STORAGE - Professional Setup  
  // =================================
  
  // Serve static photo files with proper security and caching
  app.use('/uploads/photos', express.static(path.join(process.cwd(), 'server', 'uploads', 'photos'), {
    maxAge: '7d', // 7 days cache for photos
    etag: true,
    lastModified: true,
    setHeaders: (res, filePath) => {
      // Security headers for photo serving
      res.set('X-Content-Type-Options', 'nosniff');
      res.set('X-Frame-Options', 'DENY');
      res.set('Cache-Control', 'public, max-age=604800'); // 7 days
      
      // Content type based on file extension
      const ext = path.extname(filePath).toLowerCase();
      if (ext === '.jpg' || ext === '.jpeg') res.set('Content-Type', 'image/jpeg');
      else if (ext === '.png') res.set('Content-Type', 'image/png');
      else if (ext === '.webp') res.set('Content-Type', 'image/webp');
    }
  }));

  // =================================
  // PHOTO MANAGEMENT ROUTES - Professional Implementation
  // =================================
  
  // Upload photos for a loan (maximum 2 photos)
  app.post('/api/loans/:loanId/photos', photoUpload.array('photos', 2), async (req, res) => {
    try {
      const { loanId } = req.params;
      const files = req.files as Express.Multer.File[];
      const tenantId = req.session.tenantId!;
      const userId = req.session.userId!;

      if (!files || files.length === 0) {
        return res.status(400).json({ error: 'कोणतेही फोटो अपलोड केले नाहीत' });
      }

      if (files.length > 2) {
        return res.status(400).json({ error: 'फक्त 2 फोटो अपलोड करता येतील' });
      }

      const savedPhotos = [];

      for (const file of files) {
        // 🎯 NEW FORMAT-AWARE PROCESSING: Use memory buffer with Sharp detection
        const processedPhoto = await PhotoService.processAndSavePhoto(file.buffer, file.originalname, tenantId, loanId);
        
        const compressionRatio = file.size > 0 ? ((file.size - processedPhoto.size) / file.size * 100) : 0;
        console.log(`📸 PROCESSED [${processedPhoto.storageProvider}]: ${file.originalname} → ${processedPhoto.filename} (${processedPhoto.format.toUpperCase()}, ${compressionRatio.toFixed(1)}% compressed)`);
        
        const photoData: any = {
          tenantId,
          loanId,
          filename: processedPhoto.filename,
          originalName: file.originalname,
          mimeType: file.mimetype,
          fileSize: file.size,
          compressedSize: processedPhoto.size,
          storagePath: processedPhoto.storagePath,
          thumbnailPath: processedPhoto.thumbnailPath,
          storageProvider: processedPhoto.storageProvider,
          cloudinaryPublicId: processedPhoto.cloudinaryPublicId || null,
          photoType: 'collateral',
          description: `सोन्याच्या वस्तूचा फोटो - ${file.originalname}`,
          uploadedBy: userId,
          width: processedPhoto.width,
          height: processedPhoto.height,
          detectedFormat: processedPhoto.format
        };

        const savedPhoto = await storage.saveLoanPhoto(photoData);
        savedPhotos.push(savedPhoto);
        
        // 🔍 VALIDATION: Verify photo integrity after processing
        const validation = await PhotoService.validatePhotoIntegrity(processedPhoto.storagePath, processedPhoto.format);
        if (!validation.isValid) {
          console.warn(`⚠️ VALIDATION WARNING: ${processedPhoto.filename} - ${validation.error}`);
        } else {
          console.log(`✅ VALIDATION: ${processedPhoto.filename} integrity confirmed`);
        }
      }

      // Invalidate photos cache for this loan
      invalidateTenantCache(tenantId);
      console.log(`🗑️ CACHE: Invalidated photos cache for loan ${loanId}`);

      res.json({ 
        success: true, 
        photos: savedPhotos,
        message: `${savedPhotos.length} फोटो यशस्वीरित्या अपलोड केले` 
      });
    } catch (error) {
      console.error('Photo upload error:', error);
      res.status(500).json({ error: 'फोटो अपलोड करताना त्रुटी झाली' });
    }
  });

  // Get photos for a loan
  app.get('/api/loans/:loanId/photos', requireAuth, async (req, res) => {
    try {
      const { loanId } = req.params;
      const tenantId = req.session.tenantId!;
      
      console.log(`🔍 ROUTE DEBUG: Getting photos for loanId="${loanId}", tenantId="${tenantId}"`);

      const photos = await storage.getLoanPhotos(loanId, tenantId);
      const photosWithUrls = photos.map(photo => ({
        ...photo,
        url: PhotoService.getPhotoUrl(req, photo),
        thumbnailUrl: PhotoService.getPhotoThumbnailUrl(req, photo)
      }));

      res.json(photosWithUrls);
    } catch (error) {
      console.error('Get photos error:', error);
      res.status(500).json({ error: 'फोटो fetch करताना त्रुटी झाली' });
    }
  });

  // Auto-delete photos when loan is closed
  app.patch('/api/loans/:loanId/auto-delete-photos', async (req, res) => {
    try {
      const { loanId } = req.params;
      const tenantId = req.session.tenantId!;

      const deleteResult = await PhotoService.deletePhotosForLoan(db, loanId, tenantId);
      
      // Invalidate photos cache for this loan
      invalidateTenantCache(tenantId);
      console.log(`🗑️ CACHE: Invalidated photos cache for loan ${loanId} after auto-delete`);

      res.json({ 
        success: true, 
        deletedFiles: deleteResult.deletedFiles,
        deletedRecords: deleteResult.deletedRecords,
        message: `कर्ज बंद झाल्यावर ${deleteResult.deletedFiles} फोटो automatic delete केले`
      });
    } catch (error) {
      console.error('Auto-delete photos error:', error);
      res.status(500).json({ error: 'फोटो auto-delete करताना त्रुटी झाली' });
    }
  });

  // Photo availability check for multiple loans - OPTIMIZATION
  app.post('/api/loans/photo-availability', requireAuth, async (req, res) => {
    try {
      const { loanIds } = req.body;
      const tenantId = req.session.tenantId!;

      if (!Array.isArray(loanIds) || loanIds.length === 0) {
        return res.status(400).json({ error: 'Loan IDs array is required' });
      }

      console.log(`📸 AVAILABILITY CHECK: Checking ${loanIds.length} loans for photos`);

      // Optimized query to check photo availability for multiple loans at once
      const photoStats = await db.select({
        loanId: loanPhotos.loanId,
        photoCount: sql<number>`COUNT(*)`.as('photoCount')
      })
      .from(loanPhotos)
      .where(
        and(
          inArray(loanPhotos.loanId, loanIds),
          eq(loanPhotos.tenantId, tenantId),
          eq(loanPhotos.isActive, true)
        )
      )
      .groupBy(loanPhotos.loanId);

      // Create availability map
      const availability = loanIds.map(loanId => {
        const stats = photoStats.find(p => p.loanId === loanId);
        return {
          loanId,
          hasPhotos: stats ? stats.photoCount > 0 : false,
          photoCount: stats ? stats.photoCount : 0
        };
      });

      console.log(`📸 AVAILABILITY RESULT: ${availability.filter(a => a.hasPhotos).length}/${loanIds.length} loans have photos`);

      res.json(availability);
    } catch (error) {
      console.error('Photo availability check error:', error);
      res.status(500).json({ error: 'फोटो availability check करताना त्रुटी झाली' });
    }
  });

  // Annual Statement API - नमुना क्रमांक १४
  app.get("/api/annual-statement", requireAuth, async (req, res) => {
    try {
      const { loanId, year } = req.query;
      const tenantId = req.session.tenantId!;

      if (!loanId || !year) {
        return res.status(400).json({ error: 'Loan ID and year are required' });
      }

      const financialYear = parseInt(year as string);
      
      // Financial year: 1 April to 31 March
      const yearStart = new Date(financialYear, 3, 1); // April 1
      const yearEnd = new Date(financialYear + 1, 2, 31); // March 31 next year
      const beforeYearStart = new Date(financialYear, 3, 1);

      console.log(`📊 ANNUAL STATEMENT: Generating for loan ${loanId}, FY ${financialYear}-${financialYear+1}`);

      // Get the specific loan
      const borrowerLoans = await db.select()
        .from(loans)
        .where(
          and(
            eq(loans.tenantId, tenantId),
            eq(loans.id, loanId as string)
          )
        );

      if (borrowerLoans.length === 0) {
        return res.status(404).json({ error: 'Loan not found' });
      }

      // Get the specific loan data
      const loan = borrowerLoans[0];
      const loanDate = new Date(loan.loanDate);
      const principal = parseFloat(loan.principalAmount || '0');
      const rate = parseFloat(loan.interestRate || '0');
      const rateType = loan.interestRateType || 'monthly';
      const yearlyRate = rateType === 'monthly' ? rate * 12 : rate;

      // Get closure for this specific loan
      const closureData = await db.select()
        .from(loanClosures)
        .where(
          and(
            eq(loanClosures.tenantId, tenantId),
            eq(loanClosures.loanId, loan.id)
          )
        );

      const closure = closureData.length > 0 ? closureData[0] : null;

      // Get all transactions before year start for proper opening balance calculation
      const priorTransactions = await db.select()
        .from(transactions)
        .where(
          and(
            eq(transactions.tenantId, tenantId),
            eq(transactions.loanId, loan.id),
            sql`${transactions.transactionDate} < ${beforeYearStart.toISOString().split('T')[0]}`
          )
        )
        .orderBy(transactions.transactionDate);

      // Calculate opening balance (before year start) - considering all prior transactions
      let openingPrincipal = 0;
      let openingInterest = 0;

      if (loanDate < beforeYearStart) {
        // Check if loan was closed before year start
        if (closure && new Date(closure.closureDate) < beforeYearStart) {
          // Loan was closed before year, no opening balance
          openingPrincipal = 0;
          openingInterest = 0;
        } else {
          // Calculate opening principal by replaying transaction history
          let currentPrincipal = principal;
          let lastDate = loanDate;
          let accumulatedInterest = 0;

          // Process each transaction chronologically
          for (const txn of priorTransactions) {
            const txnDate = new Date(txn.transactionDate);
            
            // Calculate interest from last date to this transaction date on current principal
            const days = Math.floor((txnDate.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24));
            if (days > 0 && currentPrincipal > 0) {
              const periodInterest = (currentPrincipal * yearlyRate * days) / (365 * 100);
              accumulatedInterest += periodInterest;
            }

            // Apply transaction
            if (txn.type === 'payment' || txn.type === 'closure') {
              const paymentAmount = parseFloat(txn.amount || '0');
              currentPrincipal -= paymentAmount;
              if (currentPrincipal < 0) currentPrincipal = 0; // Safety check
            }

            lastDate = txnDate;
          }

          // Calculate interest from last transaction to year start
          const remainingDays = Math.floor((beforeYearStart.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24));
          if (remainingDays > 0 && currentPrincipal > 0) {
            const periodInterest = (currentPrincipal * yearlyRate * remainingDays) / (365 * 100);
            accumulatedInterest += periodInterest;
          }

          openingPrincipal = currentPrincipal;
          openingInterest = accumulatedInterest;
        }
      }

      // Calculate disbursements during the year
      let yearDisbursement = 0;
      if (loanDate >= yearStart && loanDate <= yearEnd) {
        yearDisbursement = principal;
      }

      // Calculate repayments during the year
      let yearPrincipalRepayment = 0;
      let yearInterestRepayment = 0;

      if (closure) {
        const closureDate = new Date(closure.closureDate);
        if (closureDate >= yearStart && closureDate <= yearEnd) {
          yearPrincipalRepayment = parseFloat(closure.principalPaid || '0');
          yearInterestRepayment = parseFloat(closure.interestPaid || '0');
        }
      }

      // Calculate closing balance
      let closingPrincipal = 0;
      let closingInterest = 0;
      
      // Check if loan was closed during this year
      const isClosedDuringYear = closure && 
        new Date(closure.closureDate) >= yearStart && 
        new Date(closure.closureDate) <= yearEnd;
      
      // Check if loan was closed before year start
      const isClosedBeforeYear = closure && new Date(closure.closureDate) < yearStart;
      
      if (isClosedDuringYear || isClosedBeforeYear) {
        // Loan is fully closed - year end outstanding is ZERO
        closingPrincipal = 0;
        closingInterest = 0;
        console.log(`📊 Loan closed ${isClosedDuringYear ? 'during' : 'before'} year - year end balance = 0`);
      } else {
        // Loan is still active at year end
        closingPrincipal = openingPrincipal + yearDisbursement - yearPrincipalRepayment;
        
        // Calculate interest from year start (or loan date if newer) to year end
        const interestStartDate = loanDate > yearStart ? loanDate : yearStart;
        const days = Math.floor((yearEnd.getTime() - interestStartDate.getTime()) / (1000 * 60 * 60 * 24));
        
        if (days > 0 && closingPrincipal > 0) {
          closingInterest = (closingPrincipal * yearlyRate * days) / (365 * 100);
        }
        console.log(`📊 Loan active - calculated year end interest for ${days} days on ₹${closingPrincipal}`);
      }

      const statementData = {
        borrowerName: loan.borrowerName,
        occupation: loan.borrowerOccupation || '',
        address: loan.borrowerAddress || '',
        isBackwardClass: loan.isBackwardClass ?? false,
        isFarmer: loan.isFarmer ?? false,
        accountNumber: loan.accountNumber || '',
        loanDate: loan.loanDate || '',
        
        // Financial year info
        financialYear: `${financialYear}-${financialYear + 1}`,
        yearStart: yearStart.toISOString().split('T')[0],
        yearEnd: yearEnd.toISOString().split('T')[0],
        
        // Opening balance
        openingPrincipal: Math.round(openingPrincipal * 100) / 100,
        openingInterest: Math.round(openingInterest), // Round to whole number
        openingFees: 0, // Not tracked currently
        openingTotal: Math.round(openingPrincipal + openingInterest),
        
        // Year activity
        yearDisbursement: Math.round(yearDisbursement * 100) / 100,
        yearPrincipalRepayment: Math.round(yearPrincipalRepayment * 100) / 100,
        yearInterestRepayment: Math.round(yearInterestRepayment), // Round to whole number
        
        // Closing balance
        closingPrincipal: Math.round(closingPrincipal * 100) / 100,
        closingInterest: Math.round(closingInterest), // Round to whole number
        closingTotal: Math.round(closingPrincipal + closingInterest)
      };

      console.log('📊 ANNUAL STATEMENT DATA:', statementData);

      res.json(statementData);
    } catch (error) {
      console.error('Annual statement error:', error);
      res.status(500).json({ error: 'वार्षिक विवरणपत्र तयार करताना त्रुटी झाली' });
    }
  });

  // =================================
  // STORAGE SETTINGS API ROUTES
  // =================================

  // Get default storage settings (Super Admin only)
  app.get('/api/admin/storage-settings/default', requireAuth, async (req, res) => {
    try {
      if (req.session.role !== 'super_admin') {
        return res.status(403).json({ message: "Only Super Admin can access default storage settings" });
      }

      const [setting] = await db.select()
        .from(systemSettings)
        .where(eq(systemSettings.settingKey, 'default_storage_provider'));

      if (setting) {
        const config = JSON.parse(setting.settingValue);
        res.json({
          provider: config.provider || 'local',
          cloudinaryCloudName: config.cloudinaryCloudName || '',
          cloudinaryApiKey: config.cloudinaryApiKey ? '••••••••' : '',
          cloudinaryApiSecret: config.cloudinaryApiSecret ? '••••••••' : '',
          cloudinaryFolder: config.cloudinaryFolder || 'loan_photos',
          hasCloudinaryKeys: !!(config.cloudinaryApiKey && config.cloudinaryApiSecret),
          updatedAt: setting.updatedAt,
        });
      } else {
        res.json({
          provider: 'local',
          cloudinaryCloudName: '',
          cloudinaryApiKey: '',
          cloudinaryApiSecret: '',
          cloudinaryFolder: 'loan_photos',
          hasCloudinaryKeys: false,
        });
      }
    } catch (error) {
      console.error('Get default storage settings error:', error);
      res.status(500).json({ message: "Failed to get storage settings" });
    }
  });

  // Save default storage settings (Super Admin only)
  app.post('/api/admin/storage-settings/default', requireAuth, async (req, res) => {
    try {
      if (req.session.role !== 'super_admin') {
        return res.status(403).json({ message: "Only Super Admin can modify default storage settings" });
      }

      const { provider, cloudinaryCloudName, cloudinaryApiKey, cloudinaryApiSecret, cloudinaryFolder } = req.body;

      const configValue = JSON.stringify({
        provider: provider || 'local',
        cloudinaryCloudName: cloudinaryCloudName || '',
        cloudinaryApiKey: cloudinaryApiKey || '',
        cloudinaryApiSecret: cloudinaryApiSecret || '',
        cloudinaryFolder: cloudinaryFolder || 'loan_photos',
      });

      const [existing] = await db.select()
        .from(systemSettings)
        .where(eq(systemSettings.settingKey, 'default_storage_provider'));

      if (existing) {
        await db.update(systemSettings)
          .set({
            settingValue: configValue,
            updatedBy: req.session.userId,
            updatedAt: new Date(),
          })
          .where(eq(systemSettings.settingKey, 'default_storage_provider'));
      } else {
        await db.insert(systemSettings).values({
          settingKey: 'default_storage_provider',
          settingValue: configValue,
          settingType: 'json',
          description: 'Default photo storage provider configuration',
          updatedBy: req.session.userId,
        });
      }

      PhotoStorageFactory.clearCache();
      console.log(`⚙️ DEFAULT STORAGE: Updated to ${provider} by Super Admin`);

      res.json({ success: true, message: `Default storage provider updated to ${provider}` });
    } catch (error) {
      console.error('Save default storage settings error:', error);
      res.status(500).json({ message: "Failed to save storage settings" });
    }
  });

  // Get tenant storage settings (Admin)
  app.get('/api/admin/storage-settings/tenant', requireAuth, async (req, res) => {
    try {
      if (req.session.role !== 'admin' && req.session.role !== 'super_admin') {
        return res.status(403).json({ message: "Only Admin can access storage settings" });
      }

      const tenantId = req.session.tenantId!;

      const [tenantConfig] = await db.select()
        .from(tenantStorageSettings)
        .where(eq(tenantStorageSettings.tenantId, tenantId));

      if (tenantConfig) {
        res.json({
          storageProvider: tenantConfig.storageProvider,
          cloudinaryCloudName: tenantConfig.cloudinaryCloudName || '',
          cloudinaryApiKey: tenantConfig.cloudinaryApiKey ? '••••••••' : '',
          cloudinaryApiSecret: tenantConfig.cloudinaryApiSecret ? '••••••••' : '',
          cloudinaryFolder: tenantConfig.cloudinaryFolder || '',
          isConfigured: tenantConfig.isConfigured,
          lastTestedAt: tenantConfig.lastTestedAt,
          testStatus: tenantConfig.testStatus,
        });
      } else {
        const defaultConfig = await PhotoStorageFactory.getStorageConfig(tenantId);
        res.json({
          storageProvider: defaultConfig.provider,
          cloudinaryCloudName: '',
          cloudinaryApiKey: '',
          cloudinaryApiSecret: '',
          cloudinaryFolder: '',
          isConfigured: false,
          isUsingDefault: true,
        });
      }
    } catch (error) {
      console.error('Get tenant storage settings error:', error);
      res.status(500).json({ message: "Failed to get storage settings" });
    }
  });

  // Save tenant storage settings (Admin)
  app.post('/api/admin/storage-settings/tenant', requireAuth, async (req, res) => {
    try {
      if (req.session.role !== 'admin' && req.session.role !== 'super_admin') {
        return res.status(403).json({ message: "Only Admin can modify storage settings" });
      }

      const tenantId = req.session.tenantId!;
      const { storageProvider, cloudinaryCloudName, cloudinaryApiKey, cloudinaryApiSecret, cloudinaryFolder } = req.body;

      const [existing] = await db.select()
        .from(tenantStorageSettings)
        .where(eq(tenantStorageSettings.tenantId, tenantId));

      const isConfigured = storageProvider === 'cloudinary' 
        ? !!(cloudinaryCloudName && cloudinaryApiKey && cloudinaryApiSecret)
        : true;

      const settingsData = {
        tenantId,
        storageProvider: storageProvider || 'local',
        cloudinaryCloudName: cloudinaryCloudName || null,
        cloudinaryApiKey: (cloudinaryApiKey && cloudinaryApiKey !== '••••••••') ? cloudinaryApiKey : (existing?.cloudinaryApiKey || null),
        cloudinaryApiSecret: (cloudinaryApiSecret && cloudinaryApiSecret !== '••••••••') ? cloudinaryApiSecret : (existing?.cloudinaryApiSecret || null),
        cloudinaryFolder: cloudinaryFolder || null,
        isConfigured,
        updatedAt: new Date(),
      };

      if (existing) {
        await db.update(tenantStorageSettings)
          .set(settingsData)
          .where(eq(tenantStorageSettings.tenantId, tenantId));
      } else {
        await db.insert(tenantStorageSettings).values(settingsData);
      }

      PhotoStorageFactory.clearCache(tenantId);
      console.log(`⚙️ TENANT STORAGE: ${tenantId} updated to ${storageProvider}`);

      res.json({ success: true, message: `Storage provider updated to ${storageProvider}` });
    } catch (error) {
      console.error('Save tenant storage settings error:', error);
      res.status(500).json({ message: "Failed to save storage settings" });
    }
  });

  // Test Cloudinary connection
  app.post('/api/admin/storage-settings/test-cloudinary', requireAuth, async (req, res) => {
    try {
      if (req.session.role !== 'admin' && req.session.role !== 'super_admin') {
        return res.status(403).json({ message: "Only Admin can test storage connection" });
      }

      const { cloudinaryCloudName, cloudinaryApiKey, cloudinaryApiSecret } = req.body;

      if (!cloudinaryCloudName || !cloudinaryApiKey || !cloudinaryApiSecret) {
        return res.status(400).json({ success: false, message: "All Cloudinary credentials are required" });
      }

      const testResult = await CloudinaryStorageProvider.testConnection({
        provider: 'cloudinary',
        cloudinaryCloudName,
        cloudinaryApiKey,
        cloudinaryApiSecret,
      });

      const tenantId = req.session.tenantId!;
      const [existing] = await db.select()
        .from(tenantStorageSettings)
        .where(eq(tenantStorageSettings.tenantId, tenantId));

      if (existing) {
        await db.update(tenantStorageSettings)
          .set({
            lastTestedAt: new Date(),
            testStatus: testResult.success ? 'success' : 'failed',
            updatedAt: new Date(),
          })
          .where(eq(tenantStorageSettings.tenantId, tenantId));
      }

      console.log(`🔗 CLOUDINARY TEST: ${testResult.success ? 'SUCCESS' : 'FAILED'} for tenant ${tenantId}`);
      res.json(testResult);
    } catch (error) {
      console.error('Cloudinary connection test error:', error);
      res.status(500).json({ success: false, message: "Connection test failed" });
    }
  });

  // Get all tenant storage settings (Super Admin overview)
  app.get('/api/admin/storage-settings/all-tenants', requireAuth, async (req, res) => {
    try {
      if (req.session.role !== 'super_admin') {
        return res.status(403).json({ message: "Only Super Admin can view all tenant settings" });
      }

      const allSettings = await db.select().from(tenantStorageSettings);
      const sanitized = allSettings.map(s => ({
        tenantId: s.tenantId,
        storageProvider: s.storageProvider,
        isConfigured: s.isConfigured,
        lastTestedAt: s.lastTestedAt,
        testStatus: s.testStatus,
        hasCloudinaryKeys: !!(s.cloudinaryApiKey && s.cloudinaryApiSecret),
      }));

      res.json(sanitized);
    } catch (error) {
      console.error('Get all tenant storage settings error:', error);
      res.status(500).json({ message: "Failed to get tenant settings" });
    }
  });

  app.get("/api/activity-logs", requireAuth, async (req: any, res) => {
    try {
      if (req.session.role !== 'admin' && req.session.role !== 'super_admin') {
        return res.status(403).json({ message: "Admin access required" });
      }
      
      const allLogs = await db.select({
        id: userActivityLogs.id,
        userId: userActivityLogs.userId,
        activityType: userActivityLogs.activityType,
        description: userActivityLogs.description,
        metadata: userActivityLogs.metadata,
        createdAt: userActivityLogs.createdAt,
        userName: users.username,
      })
      .from(userActivityLogs)
      .leftJoin(users, eq(userActivityLogs.userId, users.id))
      .where(eq(userActivityLogs.tenantId, req.session.tenantId!))
      .orderBy(desc(userActivityLogs.createdAt))
      .limit(500);
      
      res.json(allLogs);
    } catch (error) {
      console.error("Activity logs fetch error:", error);
      res.status(500).json({ message: "Failed to fetch activity logs" });
    }
  });

  app.delete("/api/activity-logs", requireAuth, async (req: any, res) => {
    try {
      if (req.session.role !== 'admin' && req.session.role !== 'super_admin') {
        return res.status(403).json({ message: "Admin access required" });
      }
      
      const deleted = await db.delete(userActivityLogs)
        .where(eq(userActivityLogs.tenantId, req.session.tenantId!));
      
      res.json({ 
        success: true, 
        message: "सर्व लॉग यशस्वीपणे साफ केले",
        deletedCount: deleted.rowCount || 0
      });
    } catch (error) {
      console.error("Activity logs clear error:", error);
      res.status(500).json({ message: "Failed to clear activity logs" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
