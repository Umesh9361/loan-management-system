// Login Health Monitoring & Prevention System
// भविष्यात login problems टाळण्यासाठी comprehensive monitoring
// IMPORTANT: This system only checks if admin users EXIST
// It NEVER resets or overwrites user-changed passwords

import bcrypt from "bcrypt";
import { db } from "./db";
import { users } from "@shared/schema";
import { eq, and } from "drizzle-orm";

export class LoginHealthMonitor {
  
  static async verifyAdminHealth(): Promise<{
    superAdmin: { exists: boolean };
    testAdmin: { exists: boolean };
    issues: string[];
  }> {
    const issues: string[] = [];
    
    try {
      const [superAdmin] = await db.select()
        .from(users)
        .where(and(
          eq(users.tenantId, "SUPER_ADMIN"),
          eq(users.username, "admin"),
          eq(users.role, "super_admin")
        ));
      
      if (!superAdmin) {
        issues.push("SUPER_ADMIN user missing");
      }
      
      const [testAdmin] = await db.select()
        .from(users)
        .where(and(
          eq(users.tenantId, "TEST"),
          eq(users.username, "admin"),
          eq(users.role, "admin")
        ));
        
      if (!testAdmin) {
        issues.push("TEST admin user missing");
      }
      
      return {
        superAdmin: { exists: !!superAdmin },
        testAdmin: { exists: !!testAdmin },
        issues
      };
      
    } catch (error) {
      console.error("Login health check failed:", error);
      issues.push("Database connection failed");
      return {
        superAdmin: { exists: false },
        testAdmin: { exists: false },
        issues
      };
    }
  }
  
  static async autoRepairCredentials(): Promise<boolean> {
    try {
      const health = await this.verifyAdminHealth();
      
      if (health.issues.length === 0) {
        console.log("✅ All admin accounts exist - no repair needed");
        return true;
      }
      
      console.log(`⚠️  Found ${health.issues.length} issues:`, health.issues);
      
      if (!health.superAdmin.exists) {
        console.log("🔧 Creating missing SUPER_ADMIN account...");
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
        console.log("✅ SUPER_ADMIN account created with default password");
      }
      
      if (!health.testAdmin.exists) {
        console.log("🔧 Creating missing TEST admin account...");
        const hashedPassword = await bcrypt.hash("admin123", 10);
        await db.insert(users).values({
          username: "admin",
          password: hashedPassword,
          tenantId: "TEST",
          role: "admin",
          isActive: true,
          fullName: "Business Administrator",
          email: "admin@test.com"
        });
        console.log("✅ TEST admin account created with default password");
      }
      
      return true;
      
    } catch (error) {
      console.error("❌ Auto-repair failed:", error);
      return false;
    }
  }
  
  static async startupHealthCheck(): Promise<void> {
    console.log("🏥 STARTUP: Running login health check...");
    
    const health = await this.verifyAdminHealth();
    
    if (health.issues.length > 0) {
      console.log("⚠️  MISSING ACCOUNTS DETECTED:", health.issues);
      
      const repairSuccess = await this.autoRepairCredentials();
      if (repairSuccess) {
        console.log("✅ HEALTH: Missing accounts created successfully");
      } else {
        console.error("❌ HEALTH: Account creation failed - manual intervention required");
      }
    } else {
      console.log("✅ HEALTH: All admin accounts verified - passwords preserved");
    }
  }
}