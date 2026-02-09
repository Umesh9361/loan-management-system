/**
 * SUPER ADMIN GUARDIAN SYSTEM
 * 
 * This module provides comprehensive protection against Super Admin role confusion
 * and ensures proper multi-tenant architecture is maintained at all times.
 * 
 * CRITICAL PREVENTION RULES:
 * 1. Only SUPER_ADMIN tenant can have super_admin role users
 * 2. Business tenants (TEST, etc.) can only have 'admin' or 'user' roles
 * 3. Automatic healing of any role misconfigurations
 * 4. Validation hooks for all user creation/modification operations
 */

import { db } from "./db";
import { users, companies } from "@shared/schema";
import { eq, and, not } from "drizzle-orm";

export class SuperAdminGuardian {
  
  /**
   * CRITICAL: Validates and fixes Super Admin role assignments
   * Prevents future confusion by ensuring only SUPER_ADMIN tenant has super_admin users
   */
  static async validateAndFixRoleAssignments(): Promise<{
    superAdminCount: number;
    fixedUsers: string[];
    preventedMisconfigurations: string[];
  }> {
    console.log("🛡️  SUPER ADMIN GUARDIAN: Starting validation...");
    
    const fixedUsers: string[] = [];
    const preventedMisconfigurations: string[] = [];
    
    // 1. Find all super_admin users
    const allSuperAdmins = await db.select()
      .from(users)
      .where(eq(users.role, "super_admin"));
    
    // 2. Fix super_admin users in wrong tenants
    const wrongTenantSuperAdmins = allSuperAdmins.filter((user: typeof allSuperAdmins[number]) => user.tenantId !== "SUPER_ADMIN");
    
    for (const user of wrongTenantSuperAdmins) {
      await db.update(users)
        .set({ tenantId: "SUPER_ADMIN" })
        .where(eq(users.id, user.id));
      
      fixedUsers.push(`${user.username}@${user.tenantId} → SUPER_ADMIN`);
      console.log(`✅ GUARDIAN: Fixed ${user.username} moved from ${user.tenantId} to SUPER_ADMIN`);
    }
    
    // 3. Prevent super_admin roles in business tenants
    const businessSuperAdmins = await db.select()
      .from(users)
      .where(and(
        eq(users.role, "super_admin"),
        not(eq(users.tenantId, "SUPER_ADMIN"))
      ));
    
    for (const user of businessSuperAdmins) {
      await db.update(users)
        .set({ role: "admin" })
        .where(eq(users.id, user.id));
      
      preventedMisconfigurations.push(`${user.username}@${user.tenantId}: super_admin → admin`);
      console.log(`✅ GUARDIAN: Prevented misconfiguration - changed ${user.username} to admin role`);
    }
    
    const finalSuperAdminCount = allSuperAdmins.filter((u: typeof allSuperAdmins[number]) => u.tenantId === "SUPER_ADMIN").length + wrongTenantSuperAdmins.length;
    
    console.log(`🛡️  GUARDIAN: Validation complete - ${finalSuperAdminCount} Super Admin(s) secured`);
    
    return {
      superAdminCount: finalSuperAdminCount,
      fixedUsers,
      preventedMisconfigurations
    };
  }
  
  /**
   * PREVENTION: Hook for user creation to prevent role misconfigurations
   */
  static async validateUserCreation(userData: { 
    username: string; 
    tenantId: string; 
    role: string; 
  }): Promise<{ isValid: boolean; correctedRole?: string; reason?: string }> {
    
    // Rule 1: super_admin role only allowed in SUPER_ADMIN tenant
    if (userData.role === "super_admin" && userData.tenantId !== "SUPER_ADMIN") {
      return {
        isValid: false,
        correctedRole: "admin",
        reason: `PREVENTION: super_admin role not allowed in ${userData.tenantId} tenant. Corrected to admin.`
      };
    }
    
    // Rule 2: Ensure SUPER_ADMIN tenant only has super_admin or system roles
    if (userData.tenantId === "SUPER_ADMIN" && !["super_admin", "admin"].includes(userData.role)) {
      return {
        isValid: false,
        correctedRole: "super_admin",
        reason: `PREVENTION: Only super_admin or admin roles allowed in SUPER_ADMIN tenant. Corrected to super_admin.`
      };
    }
    
    return { isValid: true };
  }
  
  /**
   * EMERGENCY: Complete system healing - fixes all role confusions
   */
  static async emergencyHeal(): Promise<void> {
    console.log("🚨 EMERGENCY HEAL: Starting complete system validation...");
    
    // Ensure companies exist
    await this.ensureSystemCompanies();
    
    // Fix all role assignments
    const result = await this.validateAndFixRoleAssignments();
    
    console.log("🚨 EMERGENCY HEAL COMPLETE:");
    console.log(`   - Super Admins secured: ${result.superAdminCount}`);
    console.log(`   - Users fixed: ${result.fixedUsers.length}`);
    console.log(`   - Prevented misconfigurations: ${result.preventedMisconfigurations.length}`);
  }
  
  /**
   * Ensures required system companies exist
   */
  private static async ensureSystemCompanies(): Promise<void> {
    // Ensure SUPER_ADMIN company exists
    const [superAdminCompany] = await db.select()
      .from(companies)
      .where(eq(companies.tenantId, "SUPER_ADMIN"));
      
    if (!superAdminCompany) {
      await db.insert(companies).values({
        tenantId: "SUPER_ADMIN",
        name: "Super Admin Organization",
        contactNumber: "9999999999",
        email: "superadmin@system.com",
        address: "System Administrator Office",
        licenseNumber: "SUPER_ADMIN_LICENSE"
      });
      console.log("🛡️  GUARDIAN: Created SUPER_ADMIN company");
    }
  }
}

// Export for use in routes and middleware
export default SuperAdminGuardian;