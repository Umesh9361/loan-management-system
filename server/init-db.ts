import { db } from "./db";
import { users } from "@shared/schema";
import { eq, and } from "drizzle-orm";
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
      
      // 2. Check if Normal Admin exists for TEST tenant (Business Administrator)
      const [existingNormalAdmin] = await db.select()
        .from(users)
        .where(and(
          eq(users.tenantId, "TEST"),
          eq(users.username, "admin"),
          eq(users.role, "admin")
        ));
      
      if (!existingNormalAdmin) {
        console.log("Creating Normal Admin for TEST tenant...");
        
        try {
          const hashedPassword = await bcrypt.hash("admin123", 10);
          await db.insert(users).values({
            username: "admin",
            password: hashedPassword,
            tenantId: "TEST",
            role: "admin", // Normal admin, not super_admin
            isActive: true,
            fullName: "Business Administrator",
            email: "admin@test.com"
          });
          
          console.log("✅ Normal Admin created successfully in TEST tenant!");
        } catch (userCreationError) {
          console.error("Failed to create Normal Admin:", userCreationError);
          throw userCreationError;
        }
      } else {
        console.log("✅ Normal Admin already exists in TEST tenant.");
      }
      
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
      
      // Check if TEST company exists
      const [testCompany] = await db.select()
        .from(companies)
        .where(eq(companies.tenantId, "TEST"));
        
      if (!testCompany) {
        console.log("Creating TEST company...");
        await db.insert(companies).values({
          tenantId: "TEST",
          name: "टेस्ट कंपनी",
          contactNumber: "9876543210",
          email: "test@example.com",
          address: "पुणे",
          licenseNumber: "LIC123"
        });
        console.log("✅ TEST company created successfully!");
      }
      
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
      
      // 5. PREVENTION: Ensure no regular admins have super_admin role in business tenants
      const businessAdmins = await db.select()
        .from(users)
        .where(and(
          eq(users.role, "super_admin"),
          eq(users.tenantId, "TEST")
        ));
        
      if (businessAdmins.length > 0) {
        console.warn("⚠️  PREVENTION: Found super_admin role in business tenant, fixing...");
        
        for (const admin of businessAdmins) {
          await db.update(users)
            .set({ role: "admin" })
            .where(eq(users.id, admin.id));
          console.log(`✅ Prevention: Changed ${admin.username} from super_admin to admin in ${admin.tenantId}`);
        }
      }
      
      console.log(`✅ System validation complete: ${superAdminCount} Super Admin(s) found`);
      console.log("✅ Multi-tenant admin structure verified and secured");
      console.log("✅ Future-proof prevention system activated");
      
      // 6. FINAL GUARDIAN VALIDATION: Double-check everything is correct
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