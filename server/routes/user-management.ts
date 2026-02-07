import { Router } from "express";
import { z } from "zod";
import { 
  insertUserSchema, 
  insertUserPermissionsSchema,
} from "@shared/schema";
import { storage } from "../storage";

const router = Router();

// Authentication middleware
const requireAuth = (req: any, res: any, next: any) => {
  if (!req.session?.userId) {
    return res.status(401).json({ message: "Authentication required" });
  }
  
  // Set user object from session for compatibility
  req.user = {
    id: req.session.userId,
    tenantId: req.session.tenantId,
    role: req.session.role || 'user'
  };
  
  next();
};

// Admin-only middleware - Allow both admin and super_admin
const adminOnlyMiddleware = (req: any, res: any, next: any) => {
  if (req.user.role !== 'admin' && req.user.role !== 'super_admin') {
    return res.status(403).json({ message: "Admin access required" });
  }
  next();
};

// Get all users - Super Admin sees ALL users, Normal Admin sees only their tenant
router.get("/users", requireAuth, adminOnlyMiddleware, async (req: any, res) => {
  try {
    console.log('🔍 User Management API: Fetching users for', {
      userRole: req.user.role,
      tenantId: req.user.tenantId,
      isSuperAdmin: req.user.role === 'super_admin'
    });

    let users;
    
    // Both Super Admin and Normal Admin should only see users from their own tenant
    // Super Admin manages SUPER_ADMIN tenant, Normal Admin manages their respective tenant
    console.log('👤 Admin: Fetching users for tenant', req.user.tenantId);
    users = await storage.getUsersForTenant(req.user.tenantId);
    
    console.log('✅ Users fetched successfully:', users.length, 'users returned');
    res.json(users);
  } catch (error) {
    console.error("❌ Error fetching users:", error);
    res.status(500).json({ message: "Failed to fetch users" });
  }
});

// Create new user with permissions (admin only)
router.post("/users", requireAuth, adminOnlyMiddleware, async (req: any, res) => {
  try {
    const { userData, permissions } = req.body;

    // Validate user data
    const validatedUserData = insertUserSchema.parse({
      ...userData,
      tenantId: req.user.tenantId,
      createdBy: req.user.id,
      role: userData.role || 'user' // Default to 'user' role
    });

    // Check if username already exists in this tenant
    const existingUser = await storage.getUserByCredentials(req.user.tenantId, userData.username);
    if (existingUser) {
      return res.status(400).json({ message: "Username already exists" });
    }

    // Create user first
    const newUser = await storage.createUser(validatedUserData);
    
    // Then create permissions with the new user ID
    const validatedPermissionsWithUserId = insertUserPermissionsSchema.parse({
      ...permissions,
      userId: newUser.id,
      tenantId: req.user.tenantId
    });
    
    await storage.createUserPermissions(validatedPermissionsWithUserId);

    // Log activity
    await storage.logUserActivity({
      userId: req.user.id,
      tenantId: req.user.tenantId,
      activityType: 'create_user',
      description: `Created new user: ${userData.username}`,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      metadata: JSON.stringify({ newUserId: newUser.id })
    });

    res.status(201).json({ 
      message: "User created successfully", 
      userId: newUser.id 
    });
  } catch (error) {
    console.error("Error creating user:", error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ 
        message: "Validation error", 
        errors: error.errors 
      });
    }
    res.status(500).json({ message: "Failed to create user" });
  }
});

// Update user permissions (admin only)
router.put("/users/:userId/permissions", requireAuth, adminOnlyMiddleware, async (req: any, res) => {
  try {
    const { userId } = req.params;
    const permissions = req.body;

    // Validate permissions data
    const validatedPermissions = insertUserPermissionsSchema.partial().parse(permissions);

    // Update permissions
    const updatedPermissions = await storage.updateUserPermissions(userId, req.user.tenantId, validatedPermissions);
    
    if (!updatedPermissions) {
      return res.status(404).json({ message: "User permissions not found" });
    }

    // Log activity
    await storage.logUserActivity({
      userId: req.user.id,
      tenantId: req.user.tenantId,
      activityType: 'update_permissions',
      description: `Updated permissions for user: ${userId}`,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      metadata: JSON.stringify({ targetUserId: userId, permissions: validatedPermissions })
    });

    res.json({ 
      message: "Permissions updated successfully", 
      permissions: updatedPermissions 
    });
  } catch (error) {
    console.error("Error updating permissions:", error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ 
        message: "Validation error", 
        errors: error.errors 
      });
    }
    res.status(500).json({ message: "Failed to update permissions" });
  }
});

// Update user status (admin only)
router.put("/users/:userId/status", requireAuth, adminOnlyMiddleware, async (req: any, res) => {
  try {
    const { userId } = req.params;
    const { isActive, isTemporaryDisabled } = req.body;

    // Update user status
    const updatedUser = await storage.updateUserStatus(userId, req.user.tenantId, isActive, isTemporaryDisabled);
    
    if (!updatedUser) {
      return res.status(404).json({ message: "User not found" });
    }

    // Log activity
    await storage.logUserActivity({
      userId: req.user.id,
      tenantId: req.user.tenantId,
      activityType: 'update_status',
      description: `Updated status for user: ${userId} - Active: ${isActive}, Disabled: ${isTemporaryDisabled}`,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      metadata: JSON.stringify({ targetUserId: userId, isActive, isTemporaryDisabled })
    });

    res.json({ 
      message: "User status updated successfully", 
      user: updatedUser 
    });
  } catch (error) {
    console.error("Error updating user status:", error);
    res.status(500).json({ message: "Failed to update user status" });
  }
});

// Update user password (admin only)
router.put("/users/:userId/password", requireAuth, adminOnlyMiddleware, async (req: any, res) => {
  try {
    const { userId } = req.params;
    const { newPassword } = req.body;

    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ message: "Password must be at least 6 characters long" });
    }

    // Update password
    const success = await storage.updateUserPassword(userId, req.user.tenantId, newPassword);
    
    if (!success) {
      return res.status(404).json({ message: "User not found" });
    }

    // Log activity
    await storage.logUserActivity({
      userId: req.user.id,
      tenantId: req.user.tenantId,
      activityType: 'update_password',
      description: `Updated password for user: ${userId}`,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      metadata: JSON.stringify({ targetUserId: userId })
    });

    res.json({ message: "Password updated successfully" });
  } catch (error) {
    console.error("Error updating password:", error);
    res.status(500).json({ message: "Failed to update password" });
  }
});

// Delete user (admin only)
router.delete("/users/:userId", requireAuth, adminOnlyMiddleware, async (req: any, res) => {
  try {
    const { userId } = req.params;

    // Prevent admin from deleting themselves
    if (userId === req.user.id) {
      return res.status(400).json({ message: "Cannot delete your own account" });
    }

    // Delete user
    const success = await storage.deleteUser(userId);
    
    if (!success) {
      return res.status(404).json({ message: "User not found" });
    }

    // Log activity
    await storage.logUserActivity({
      userId: req.user.id,
      tenantId: req.user.tenantId,
      activityType: 'delete_user',
      description: `Deleted user: ${userId}`,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      metadata: JSON.stringify({ deletedUserId: userId })
    });

    res.json({ message: "User deleted successfully" });
  } catch (error) {
    console.error("Error deleting user:", error);
    res.status(500).json({ message: "Failed to delete user" });
  }
});

// Get user activity logs (admin only)
router.get("/users/:userId/activity", requireAuth, adminOnlyMiddleware, async (req: any, res) => {
  try {
    const { userId } = req.params;
    const limit = parseInt(req.query.limit as string) || 100;

    const activityLogs = await storage.getUserActivityLogs(userId, req.user.tenantId, limit);
    res.json(activityLogs);
  } catch (error) {
    console.error("Error fetching activity logs:", error);
    res.status(500).json({ message: "Failed to fetch activity logs" });
  }
});

export default router;