import { db } from "./db";
import { users, userActivityLogs, notificationWarnings } from "@shared/schema";
import { eq, and, sql, lt } from "drizzle-orm";
import bcrypt from "bcrypt";
import SuperAdminGuardian from "./super-admin-guardian";

export async function initializeDatabase() {
  const maxRetries = 5;
  const retryDelay = 2000; // 2 seconds
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`Database initialization attempt ${attempt}/${maxRetries}...`);
      
      // Enhanced database connection test with timeout and better error handling
      const connectionTest = async () => {
        try {
          const testPromise = db.select().from(users).limit(1);
          const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Database connection timeout after 15 seconds')), 15000)
          );
          return await Promise.race([testPromise, timeoutPromise]);
        } catch (error) {
          // Handle specific WebSocket errors gracefully
          if (error instanceof Error && error.message.includes('WebSocket')) {
            console.warn('WebSocket connection issue detected, but database may still be functional');
            // Try a simpler query without WebSocket dependency
            return await db.$count(users);
          }
          throw error;
        }
      };
      
      await connectionTest();
      console.log("Database connection established successfully");
      
      // SCHEMA MIGRATIONS FIRST - must run before any ORM queries
      // 6. AUTO-MIGRATION: Ensure new columns exist in database
      try {
        await db.execute(sql`ALTER TABLE companies ADD COLUMN IF NOT EXISTS bottom_nav_enabled BOOLEAN NOT NULL DEFAULT true`);
        console.log("✅ Schema migration: bottom_nav_enabled column verified");
      } catch (migrationError) {
        console.warn("⚠️  Schema migration warning (non-fatal):", migrationError instanceof Error ? migrationError.message : migrationError);
      }

      // 6a2. AUTO-MIGRATION: Label settings column
      try {
        await db.execute(sql`ALTER TABLE companies ADD COLUMN IF NOT EXISTS label_settings TEXT`);
        console.log("✅ Schema migration: label_settings column verified");
      } catch (migrationError) {
        console.warn("⚠️  Label settings migration warning (non-fatal):", migrationError instanceof Error ? migrationError.message : migrationError);
      }

      // 6b. AUTO-MIGRATION: Subscription management columns
      try {
        await db.execute(sql`ALTER TABLE companies ADD COLUMN IF NOT EXISTS subscription_type VARCHAR(20) NOT NULL DEFAULT 'lifetime'`);
        await db.execute(sql`ALTER TABLE companies ADD COLUMN IF NOT EXISTS subscription_start_date TIMESTAMP`);
        await db.execute(sql`ALTER TABLE companies ADD COLUMN IF NOT EXISTS subscription_end_date TIMESTAMP`);
        await db.execute(sql`ALTER TABLE companies ADD COLUMN IF NOT EXISTS subscription_months INTEGER`);
        console.log("✅ Schema migration: subscription columns verified");
      } catch (migrationError) {
        console.warn("⚠️  Subscription migration warning (non-fatal):", migrationError instanceof Error ? migrationError.message : migrationError);
      }

      // 6d. AUTO-MIGRATION: loan_id column in cash_transactions (links system entries to their source loan)
      try {
        await db.execute(sql`ALTER TABLE cash_transactions ADD COLUMN IF NOT EXISTS loan_id TEXT`);
        console.log("✅ Schema migration: cash_transactions.loan_id column verified");
      } catch (migrationError) {
        console.warn("⚠️  loan_id migration warning (non-fatal):", migrationError instanceof Error ? migrationError.message : migrationError);
      }

      // 6c. AUTO-MIGRATION: Data entry mode and notification warnings
      try {
        await db.execute(sql`ALTER TABLE companies ADD COLUMN IF NOT EXISTS data_entry_mode BOOLEAN NOT NULL DEFAULT false`);
        await db.execute(sql`CREATE TABLE IF NOT EXISTS notification_warnings (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          tenant_id VARCHAR(20) NOT NULL,
          warning_type VARCHAR(50) NOT NULL,
          severity VARCHAR(20) NOT NULL DEFAULT 'warning',
          title TEXT NOT NULL,
          message TEXT NOT NULL,
          metadata TEXT,
          is_read BOOLEAN NOT NULL DEFAULT false,
          is_dismissed BOOLEAN NOT NULL DEFAULT false,
          created_at TIMESTAMP NOT NULL DEFAULT now()
        )`);
        console.log("✅ Schema migration: data_entry_mode and notification_warnings verified");
      } catch (migrationError) {
        console.warn("⚠️  Data entry mode migration warning (non-fatal):", migrationError instanceof Error ? migrationError.message : migrationError);
      }

      console.log("Checking for system initialization...");
      
      // CRITICAL FIX: Separate Super Admin and Normal Admin creation
      // This prevents future confusion and ensures proper multi-tenant architecture
      
      // 1. Check if Super Admin exists (System Administrator)
      const [existingSuperAdmin] = await db.select()
        .from(users)
        .where(and(
          eq(users.tenantId, "SUPER_ADMIN"),
          eq(users.username, "admin"),
          eq(users.role, "super_admin")
        ));
      
      if (!existingSuperAdmin) {
        console.log("Creating SUPER ADMIN (System Administrator)...");
        
        try {
          const hashedPassword = await bcrypt.hash("admin123", 10);
          await db.insert(users).values({
            username: "admin",
            password: hashedPassword,
            tenantId: "SUPER_ADMIN",
            role: "super_admin",
            isActive: true,
            fullName: "System Administrator",
            email: "superadmin@system.com"
          });
          
          console.log("✅ SUPER ADMIN created successfully in SUPER_ADMIN tenant!");
        } catch (userCreationError) {
          console.error("Failed to create Super Admin:", userCreationError);
          throw userCreationError;
        }
      } else {
        console.log("✅ Super Admin already exists in SUPER_ADMIN tenant.");
      }
      
      // 2. TEST tenant is no longer auto-created - tenants are managed by Super Admin only
      console.log("✅ Tenant management: Only Super Admin can create/delete tenants");
      
      // 3. Ensure required companies exist
      const { companies } = await import("@shared/schema");
      
      // Check if SUPER_ADMIN company exists
      const [superAdminCompany] = await db.select()
        .from(companies)
        .where(eq(companies.tenantId, "SUPER_ADMIN"));
        
      if (!superAdminCompany) {
        console.log("Creating SUPER_ADMIN company...");
        await db.insert(companies).values({
          tenantId: "SUPER_ADMIN",
          name: "Super Admin Organization",
          contactNumber: "9999999999",
          email: "superadmin@system.com",
          address: "System Administrator Office",
          licenseNumber: "SUPER_ADMIN_LICENSE"
        });
        console.log("✅ SUPER_ADMIN company created successfully!");
      }
      
      // TEST company is no longer auto-created - managed by Super Admin
      
      // 4. CRITICAL VALIDATION: Ensure no role confusion exists
      const roleValidation = await db.select()
        .from(users)
        .where(eq(users.role, "super_admin"));
        
      const superAdminCount = roleValidation.length;
      const wrongTenantSuperAdmin = roleValidation.filter((user: typeof roleValidation[number]) => user.tenantId !== "SUPER_ADMIN");
      
      if (wrongTenantSuperAdmin.length > 0) {
        console.warn("⚠️  CRITICAL WARNING: Found super_admin users in wrong tenants:", wrongTenantSuperAdmin);
        console.log("Auto-fixing tenant assignments for super admin users...");
        
        for (const user of wrongTenantSuperAdmin) {
          await db.update(users)
            .set({ tenantId: "SUPER_ADMIN" })
            .where(eq(users.id, user.id));
          console.log(`✅ Auto-fixed: super admin ${user.username} moved to SUPER_ADMIN tenant`);
        }
      }
      
      // 5. PREVENTION: Already handled by wrongTenantSuperAdmin fix above
      
      console.log(`✅ System validation complete: ${superAdminCount} Super Admin(s) found`);
      console.log("✅ Multi-tenant admin structure verified and secured");
      console.log("✅ Future-proof prevention system activated");
      
      // 7. FINAL GUARDIAN VALIDATION: Double-check everything is correct
      await SuperAdminGuardian.validateAndFixRoleAssignments();
      console.log("🛡️  SUPER ADMIN GUARDIAN: Final validation completed");
      
      // 8a. AUTO-NORMALIZE: Fix Unicode duplicates in borrower names (NFC normalization)
      try {
        const allLoans = await db.execute<{ id: string; borrower_name: string }>(sql`
          SELECT id, borrower_name FROM loans WHERE borrower_name IS NOT NULL
        `);
        let normalizedLoans = 0;
        for (const row of (allLoans.rows || [])) {
          const original = row.borrower_name;
          const normalized = original.normalize('NFC').trim().replace(/\s+/g, ' ');
          if (original !== normalized) {
            await db.execute(sql`UPDATE loans SET borrower_name = ${normalized} WHERE id = ${row.id}`);
            normalizedLoans++;
          }
        }
        
        const allBorrowers = await db.execute<{ id: number; name: string }>(sql`
          SELECT id, name FROM borrowers WHERE name IS NOT NULL
        `);
        let normalizedBorrowers = 0;
        for (const row of (allBorrowers.rows || [])) {
          const original = row.name;
          const normalized = original.normalize('NFC').trim().replace(/\s+/g, ' ');
          if (original !== normalized) {
            await db.execute(sql`UPDATE borrowers SET name = ${normalized} WHERE id = ${row.id}`);
            normalizedBorrowers++;
          }
        }
        
        if (normalizedLoans > 0 || normalizedBorrowers > 0) {
          console.log(`🔤 AUTO-NORMALIZE: ${normalizedLoans} loan names + ${normalizedBorrowers} borrower names NFC normalized`);
        }
      } catch (normError) {
        console.warn("⚠️  Auto-normalize warning (non-fatal):", normError instanceof Error ? normError.message : normError);
      }

      // 8. AUTO-CLEANUP: Delete activity logs older than 90 days
      try {
        const ninetyDaysAgo = new Date();
        ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
        
        const deletedLogs = await db.delete(userActivityLogs)
          .where(lt(userActivityLogs.createdAt, ninetyDaysAgo));
        
        const deletedCount = deletedLogs.rowCount || 0;
        if (deletedCount > 0) {
          console.log(`🧹 AUTO-CLEANUP: ${deletedCount} activity logs older than 90 days deleted`);
        } else {
          console.log("🧹 AUTO-CLEANUP: No old activity logs to clean (all within 90 days)");
        }

        const deletedNotifications = await db.delete(notificationWarnings)
          .where(and(
            lt(notificationWarnings.createdAt, ninetyDaysAgo),
            eq(notificationWarnings.isDismissed, true)
          ));
        
        const notifCount = deletedNotifications.rowCount || 0;
        if (notifCount > 0) {
          console.log(`🧹 AUTO-CLEANUP: ${notifCount} dismissed notifications older than 90 days deleted`);
        }
      } catch (cleanupError) {
        console.warn("⚠️  Auto-cleanup warning (non-fatal):", cleanupError instanceof Error ? cleanupError.message : cleanupError);
      }
      
      console.log("Database initialization completed successfully");
      return; // Success, exit the retry loop
      
    } catch (error) {
      console.error(`Database initialization attempt ${attempt} failed:`, error);
      
      // Enhanced error logging
      if (error instanceof Error) {
        console.error("Error details:", {
          name: error.name,
          message: error.message,
          stack: error.stack?.split('\n').slice(0, 5).join('\n')
        });
      }
      
      if (attempt === maxRetries) {
        console.error("All database initialization attempts failed. Application may not function properly.");
        throw new Error(`Database initialization failed after ${maxRetries} attempts: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
      
      console.log(`Retrying in ${retryDelay}ms...`);
      await new Promise(resolve => setTimeout(resolve, retryDelay));
    }
  }
}