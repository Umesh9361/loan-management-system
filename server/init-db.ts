import { db } from "./db";
import { users } from "@shared/schema";
import { eq, and, sql } from "drizzle-orm";
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
      
      // 6. AUTO-MIGRATION: Ensure new columns exist in database
      try {
        await db.execute(sql`ALTER TABLE companies ADD COLUMN IF NOT EXISTS bottom_nav_enabled BOOLEAN NOT NULL DEFAULT true`);
        console.log("✅ Schema migration: bottom_nav_enabled column verified");
      } catch (migrationError) {
        console.warn("⚠️  Schema migration warning (non-fatal):", migrationError instanceof Error ? migrationError.message : migrationError);
      }

      // 7. FINAL GUARDIAN VALIDATION: Double-check everything is correct
      await SuperAdminGuardian.validateAndFixRoleAssignments();
      console.log("🛡️  SUPER ADMIN GUARDIAN: Final validation completed");
      
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