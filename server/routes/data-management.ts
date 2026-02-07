import { Router } from "express";
import { dataManagementService, type LoanCleanupOptions } from "../data-management";
import { z } from "zod";

const router = Router();

// Schema for loan cleanup request
const loanCleanupSchema = z.object({
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  includeAssociatedTransactions: z.boolean().default(true),
  createBackup: z.boolean().default(true),
  borrowerIds: z.array(z.string()).optional(),
  accountNumbers: z.array(z.string()).optional()
});

// Schema for data reconciliation request
const reconciliationSchema = z.object({
  force: z.boolean().default(false),
  createBackup: z.boolean().default(true)
});

/**
 * POST /api/data-management/cleanup-closed-loans
 * बंद झालेल्या कर्जांचा comprehensive cleanup
 */
router.post("/cleanup-closed-loans", async (req: any, res) => {
  try {
    const tenantId = req.session.tenantId;
    const options = loanCleanupSchema.parse(req.body);
    
    console.log(`🧹 DATA CLEANUP: Starting closed loan cleanup for tenant ${tenantId}`);
    
    const result = await dataManagementService.cleanupClosedLoansData(tenantId, options);
    
    if (result.success) {
      console.log(`✅ DATA CLEANUP: Successfully processed ${result.affectedRecords} records`);
      res.json({
        success: true,
        message: result.message,
        summary: {
          recordsProcessed: result.affectedRecords,
          backupCreated: result.backupCreated,
          timestamp: new Date().toISOString()
        },
        details: result.details
      });
    } else {
      console.error(`❌ DATA CLEANUP: Failed - ${result.message}`);
      res.status(400).json({
        success: false,
        message: result.message,
        details: result.details
      });
    }
    
  } catch (error) {
    console.error("Data cleanup endpoint error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error during cleanup",
      error: (error as Error).message
    });
  }
});

/**
 * POST /api/data-management/reconcile-accounting
 * संपूर्ण accounting data reconciliation
 */
router.post("/reconcile-accounting", async (req: any, res) => {
  try {
    const tenantId = req.session.tenantId;
    const options = reconciliationSchema.parse(req.body);
    
    console.log(`🔄 DATA RECONCILIATION: Starting accounting reconciliation for tenant ${tenantId}`);
    
    const result = await dataManagementService.reconcileAccountingData(tenantId, options);
    
    if (result.success) {
      console.log(`✅ DATA RECONCILIATION: Successfully reconciled ${result.affectedRecords} records`);
      res.json({
        success: true,
        message: result.message,
        summary: {
          recordsReconciled: result.affectedRecords,
          backupCreated: result.backupCreated,
          timestamp: new Date().toISOString()
        },
        details: result.details
      });
    } else {
      console.error(`❌ DATA RECONCILIATION: Failed - ${result.message}`);
      res.status(400).json({
        success: false,
        message: result.message,
        details: result.details
      });
    }
    
  } catch (error) {
    console.error("Data reconciliation endpoint error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error during reconciliation",
      error: (error as Error).message
    });
  }
});

/**
 * GET /api/data-management/integrity-check
 * System integrity verification
 */
router.get("/integrity-check", async (req: any, res) => {
  try {
    const tenantId = req.session.tenantId;
    
    console.log(`🔍 INTEGRITY CHECK: Running system integrity check for tenant ${tenantId}`);
    
    const result = await dataManagementService.performIntegrityCheck(tenantId);
    
    res.json({
      success: result.success,
      message: result.message,
      summary: {
        issuesFound: result.details.length,
        timestamp: new Date().toISOString()
      },
      details: result.details
    });
    
  } catch (error) {
    console.error("Integrity check endpoint error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error during integrity check",
      error: (error as Error).message
    });
  }
});

/**
 * POST /api/data-management/rearrange-account-numbers
 * Rearrange account numbers for a group by loan disbursement date
 */
router.post("/rearrange-account-numbers", async (req: any, res) => {
  try {
    const tenantId = req.session.tenantId;
    const { groupId } = req.body;

    if (!groupId) {
      return res.status(400).json({ 
        success: false, 
        message: "ग्रुप ID आवश्यक आहे",
        affectedRecords: 0,
        details: []
      });
    }

    console.log(`🔢 ACCOUNT REARRANGE: Starting for group ${groupId} in tenant ${tenantId}`);
    
    const result = await dataManagementService.rearrangeAccountNumbers(tenantId, groupId);
    
    if (result.success) {
      console.log(`✅ ACCOUNT REARRANGE: Successfully rearranged ${result.affectedRecords} account numbers`);
      res.json({
        success: true,
        message: result.message,
        summary: {
          accountsRearranged: result.affectedRecords,
          timestamp: new Date().toISOString()
        },
        details: result.details
      });
    } else {
      console.error(`❌ ACCOUNT REARRANGE: Failed - ${result.message}`);
      res.status(400).json({
        success: false,
        message: result.message,
        details: result.details
      });
    }
    
  } catch (error) {
    console.error("Account rearrangement endpoint error:", error);
    res.status(500).json({
      success: false,
      message: "Account rearrangement failed: " + (error as Error).message,
      error: (error as Error).message
    });
  }
});

/**
 * POST /api/data-management/create-backup
 * Create comprehensive system backup
 */
router.post("/create-backup", async (req: any, res) => {
  try {
    const tenantId = req.session.tenantId;
    
    console.log(`💾 BACKUP: Creating comprehensive backup for tenant ${tenantId}`);
    
    const result = await dataManagementService.createComprehensiveBackup(tenantId);
    
    if (result.success) {
      console.log(`✅ BACKUP: Successfully created backup with ID ${result.backupId}`);
      res.json({
        success: true,
        message: result.message,
        backupId: result.backupId,
        summary: {
          recordsBackedUp: result.affectedRecords,
          timestamp: new Date().toISOString()
        },
        details: result.details,
        backupData: result.backupData
      });
    } else {
      console.error(`❌ BACKUP: Failed - ${result.message}`);
      res.status(400).json({
        success: false,
        message: result.message,
        details: result.details
      });
    }
    
  } catch (error) {
    console.error("Backup endpoint error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error during backup",
      error: (error as Error).message
    });
  }
});

/**
 * POST /api/data-management/restore-system-data
 * Restore all system data to clean state (complete data wipe)
 */
router.post("/restore-system-data", async (req: any, res) => {
  try {
    const tenantId = req.session.tenantId;
    const { createBackup = true } = req.body;
    
    console.log(`🔄 RESTORE: Starting system data restore for tenant ${tenantId}`);
    
    const result = await dataManagementService.restoreAllSystemData(tenantId, { createBackup });
    
    if (result.success) {
      console.log(`✅ RESTORE: Successfully restored system data, affected ${result.affectedRecords} records`);
      res.json({
        success: true,
        message: result.message,
        summary: {
          recordsRestored: result.affectedRecords,
          timestamp: new Date().toISOString()
        },
        details: result.details
      });
    } else {
      console.error(`❌ RESTORE: Failed - ${result.message}`);
      res.status(400).json({
        success: false,
        message: result.message,
        details: result.details
      });
    }
    
  } catch (error) {
    console.error("System restore endpoint error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error during system restore",
      error: (error as Error).message
    });
  }
});

/**
 * POST /api/data-management/restore-from-backup
 * Comprehensive data restore from backup file - Updated August 2025
 */
router.post("/restore-from-backup", async (req: any, res) => {
  try {
    const tenantId = req.session.tenantId;
    const { backupData } = req.body;
    
    if (!backupData) {
      return res.status(400).json({
        success: false,
        message: "Backup data is required for restore operation"
      });
    }
    
    console.log(`🔄 COMPREHENSIVE RESTORE: Starting backup restore for tenant ${tenantId}`);
    
    const result = await dataManagementService.restoreFromBackup(tenantId, backupData);
    
    if (result.success) {
      console.log(`✅ COMPREHENSIVE RESTORE: Successfully restored ${result.affectedRecords} records`);
      res.json({
        success: true,
        message: result.message,
        summary: {
          recordsRestored: result.affectedRecords,
          timestamp: new Date().toISOString()
        },
        details: result.details
      });
    } else {
      console.error(`❌ COMPREHENSIVE RESTORE: Failed - ${result.message}`);
      res.status(400).json({
        success: false,
        message: result.message,
        details: result.details
      });
    }
    
  } catch (error) {
    console.error("Comprehensive restore endpoint error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error during comprehensive restore",
      error: (error as Error).message
    });
  }
});

export default router;