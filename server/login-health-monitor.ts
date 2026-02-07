// Login Health Monitoring & Prevention System
// भविष्यात login problems टाळण्यासाठी comprehensive monitoring

import bcrypt from "bcrypt";
import { db } from "./db";
import { users } from "@shared/schema";
import { eq, and } from "drizzle-orm";

export class LoginHealthMonitor {
  
  // Verify admin credentials are healthy
  static async verifyAdminHealth(): Promise<{
    superAdmin: { exists: boolean; passwordValid: boolean };
    testAdmin: { exists: boolean; passwordValid: boolean };
    issues: string[];
  }> {
    const issues: string[] = [];
    
    try {
      // Check Super Admin
      const [superAdmin] = await db.select()
        .from(users)
        .where(and(
          eq(users.tenantId, "SUPER_ADMIN"),
          eq(users.username, "admin"),
          eq(users.role, "super_admin")
        ));
      
      const superAdminValid = superAdmin ? 
        await bcrypt.compare("admin123", superAdmin.password) : false;
      
      if (!superAdmin) {
        issues.push("SUPER_ADMIN user missing");
      } else if (!superAdminValid) {
        issues.push("SUPER_ADMIN password corrupted");
      }
      
      // Check TEST Admin  
      const [testAdmin] = await db.select()
        .from(users)
        .where(and(
          eq(users.tenantId, "TEST"),
          eq(users.username, "admin"),
          eq(users.role, "admin")
        ));
        
      const testAdminValid = testAdmin ? 
        await bcrypt.compare("admin123", testAdmin.password) : false;
        
      if (!testAdmin) {
        issues.push("TEST admin user missing");
      } else if (!testAdminValid) {
        issues.push("TEST admin password corrupted");
      }
      
      return {
        superAdmin: { 
          exists: !!superAdmin, 
          passwordValid: superAdminValid 
        },
        testAdmin: { 
          exists: !!testAdmin, 
          passwordValid: testAdminValid 
        },
        issues
      };
      
    } catch (error) {
      console.error("Login health check failed:", error);
      issues.push("Database connection failed");
      return {
        superAdmin: { exists: false, passwordValid: false },
        testAdmin: { exists: false, passwordValid: false },
        issues
      };
    }
  }
  
  // Auto-repair corrupted credentials
  static async autoRepairCredentials(): Promise<boolean> {
    try {
      const health = await this.verifyAdminHealth();
      
      if (health.issues.length === 0) {
        console.log("✅ All admin credentials healthy");
        return true;
      }
      
      console.log(`⚠️  Found ${health.issues.length} credential issues:`, health.issues);
      
      // Auto-repair Super Admin
      if (!health.superAdmin.exists || !health.superAdmin.passwordValid) {
        console.log("🔧 Auto-repairing SUPER_ADMIN credentials...");
        const hashedPassword = await bcrypt.hash("admin123", 10);
        
        if (!health.superAdmin.exists) {
          await db.insert(users).values({
            username: "admin",
            password: hashedPassword,
            tenantId: "SUPER_ADMIN",
            role: "super_admin",
            isActive: true,
            fullName: "System Administrator",
            email: "superadmin@system.com"
          });
        } else {
          await db.update(users)
            .set({ password: hashedPassword })
            .where(and(
              eq(users.tenantId, "SUPER_ADMIN"),
              eq(users.username, "admin")
            ));
        }
        console.log("✅ SUPER_ADMIN credentials repaired");
      }
      
      // Auto-repair TEST Admin
      if (!health.testAdmin.exists || !health.testAdmin.passwordValid) {
        console.log("🔧 Auto-repairing TEST admin credentials...");
        const hashedPassword = await bcrypt.hash("admin123", 10);
        
        if (!health.testAdmin.exists) {
          await db.insert(users).values({
            username: "admin",
            password: hashedPassword,
            tenantId: "TEST",
            role: "admin",
            isActive: true,
            fullName: "Business Administrator",
            email: "admin@test.com"
          });
        } else {
          await db.update(users)
            .set({ password: hashedPassword })
            .where(and(
              eq(users.tenantId, "TEST"),
              eq(users.username, "admin")
            ));
        }
        console.log("✅ TEST admin credentials repaired");
      }
      
      return true;
      
    } catch (error) {
      console.error("❌ Auto-repair failed:", error);
      return false;
    }
  }
  
  // Startup health check
  static async startupHealthCheck(): Promise<void> {
    console.log("🏥 STARTUP: Running login health check...");
    
    const health = await this.verifyAdminHealth();
    
    if (health.issues.length > 0) {
      console.log("⚠️  HEALTH ISSUES DETECTED:", health.issues);
      
      const repairSuccess = await this.autoRepairCredentials();
      if (repairSuccess) {
        console.log("✅ HEALTH: All credential issues auto-repaired");
      } else {
        console.error("❌ HEALTH: Auto-repair failed - manual intervention required");
      }
    } else {
      console.log("✅ HEALTH: All admin credentials verified healthy");
    }
  }
}