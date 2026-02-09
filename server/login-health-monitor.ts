// Login Health Monitoring & Prevention System
// भविष्यात login problems टाळण्यासाठी comprehensive monitoring
// IMPORTANT: This system only checks if SUPER_ADMIN exists
// It NEVER auto-creates business tenants - those are managed by Super Admin only

import bcrypt from "bcrypt";
import { db } from "./db";
import { users } from "@shared/schema";
import { eq, and } from "drizzle-orm";

export class LoginHealthMonitor {
  
  static async verifyAdminHealth(): Promise<{
    superAdmin: { exists: boolean };
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
      
      return {
        superAdmin: { exists: !!superAdmin },
        issues
      };
      
    } catch (error) {
      console.error("Login health check failed:", error);
      issues.push("Database connection failed");
      return {
        superAdmin: { exists: false },
        issues
      };
    }
  }
  
  static async autoRepairCredentials(): Promise<boolean> {
    try {
      const health = await this.verifyAdminHealth();
      
      if (health.issues.length === 0) {
        console.log("✅ Super Admin account exists - no repair needed");
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
      
      return true;
      
    } catch (error) {
      console.error("❌ Auto-repair failed:", error);
      return false;
    }
  }
  
  static async getHealthReport(): Promise<string> {
    const health = await this.verifyAdminHealth();
    
    let report = "=== Login Health Report ===\n";
    report += `Super Admin: ${health.superAdmin.exists ? '✅ Active' : '❌ Missing'}\n`;
    
    if (health.issues.length > 0) {
      report += `\nIssues Found:\n`;
      health.issues.forEach(issue => {
        report += `  ⚠️  ${issue}\n`;
      });
    } else {
      report += "\n✅ All systems healthy\n";
    }
    
    return report;
  }
}

export default LoginHealthMonitor;
