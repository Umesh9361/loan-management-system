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
 * GET /api/data-management/missing-cash-entries
 * रोकड नोंद नसलेल्या कर्जांची यादी
 */
router.get("/missing-cash-entries", async (req: any, res) => {
  try {
    const tenantId = req.session.tenantId;
    console.log(`🔍 MISSING CASH ENTRIES: Checking for tenant ${tenantId}`);
    const result = await dataManagementService.getMissingDisbursementEntries(tenantId);
    res.json(result);
  } catch (error) {
    console.error("Missing cash entries check error:", error);
    res.status(500).json({
      success: false,
      missingCount: 0,
      totalMissingAmount: 0,
      loans: [],
      message: "तपासणी अयशस्वी: " + (error as Error).message
    });
  }
});

/**
 * POST /api/data-management/fix-missing-cash-entries
 * रोकड नोंद नसलेल्या कर्जांची रोकड एन्ट्री तयार करा
 */
router.post("/fix-missing-cash-entries", async (req: any, res) => {
  try {
    const tenantId = req.session.tenantId;
    console.log(`🔧 FIX MISSING CASH ENTRIES: Starting for tenant ${tenantId}`);
    const result = await dataManagementService.fixMissingDisbursementEntries(tenantId);
    if (result.success) {
      console.log(`✅ FIX MISSING CASH ENTRIES: Fixed ${result.fixedCount} entries, total ₹${result.totalFixedAmount}`);
    }
    res.json(result);
  } catch (error) {
    console.error("Fix missing cash entries error:", error);
    res.status(500).json({
      success: false,
      fixedCount: 0,
      totalFixedAmount: 0,
      message: "दुरुस्ती अयशस्वी: " + (error as Error).message
    });
  }
});

router.post("/rebuild-disbursement-entries", async (req: any, res) => {
  try {
    const tenantId = req.session?.tenantId;
    if (!tenantId) return res.status(401).json({ success: false, message: "Unauthorized" });
    console.log(`🔄 REBUILD DISBURSEMENT ENTRIES: Starting for tenant ${tenantId}`);
    const result = await dataManagementService.rebuildDisbursementEntries(tenantId);
    console.log(`✅ REBUILD: ${result.deleted} deleted, ${result.created} created`);
    res.json(result);
  } catch (error) {
    console.error("Rebuild disbursement entries error:", error);
    res.status(500).json({ success: false, deleted: 0, created: 0, message: "Rebuild अयशस्वी: " + (error as Error).message });
  }
});

/**
 * GET /api/data-management/balance-check
 * Simple SUM comparison: cashbook loan_disbursement total vs loans principalAmount total
 * This is the definitive source-of-truth check — no narration matching, no false positives
 */
router.get("/balance-check", async (req: any, res) => {
  try {
    const tenantId = req.session?.tenantId;
    if (!tenantId) return res.status(401).json({ message: "Unauthorized" });
    const result = await dataManagementService.getBalanceCheck(tenantId);
    res.json(result);
  } catch (error) {
    console.error("Balance check error:", error);
    res.status(500).json({ message: "Balance check अयशस्वी: " + (error as Error).message });
  }
});

const rearrangeSchema = z.object({
  groupId: z.string().min(1, "ग्रुप ID आवश्यक आहे"),
  upToDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "तारीख YYYY-MM-DD फॉर्मॅट मध्ये असावी").optional(),
  checksum: z.string().optional()
});

/**
 * POST /api/data-management/rearrange-preview
 * Preview rearrangement - returns old/new mapping without updating
 */
router.post("/rearrange-preview", async (req: any, res) => {
  try {
    const tenantId = req.session.tenantId;
    const parsed = rearrangeSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, message: parsed.error.errors[0]?.message || "Invalid input", mapping: [] });
    }
    const { groupId, upToDate } = parsed.data;

    const result = await dataManagementService.previewRearrangeAccountNumbers(tenantId, groupId, upToDate);
    res.json(result);
  } catch (error) {
    console.error("Rearrange preview error:", error);
    res.status(500).json({ success: false, message: "Preview अयशस्वी: " + (error as Error).message, mapping: [] });
  }
});

/**
 * POST /api/data-management/rearrange-confirm
 * Confirm and apply rearrangement after PDF download
 */
router.post("/rearrange-confirm", async (req: any, res) => {
  try {
    const tenantId = req.session.tenantId;
    const parsed = rearrangeSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, message: parsed.error.errors[0]?.message || "Invalid input", affectedRecords: 0, details: [] });
    }
    const { groupId, upToDate, checksum } = parsed.data;

    const result = await dataManagementService.confirmRearrangeAccountNumbers(tenantId, groupId, upToDate, checksum);
    
    if (result.success) {
      res.json({ success: true, message: result.message, summary: { accountsRearranged: result.affectedRecords, timestamp: new Date().toISOString() }, details: result.details });
    } else {
      res.status(400).json({ success: false, message: result.message, details: result.details });
    }
  } catch (error) {
    console.error("Rearrange confirm error:", error);
    res.status(500).json({ success: false, message: "रिअरेंज अयशस्वी: " + (error as Error).message, error: (error as Error).message });
  }
});

/**
 * POST /api/data-management/rearrange-account-numbers
 * Legacy endpoint - kept for backward compatibility
 */
router.post("/rearrange-account-numbers", async (req: any, res) => {
  try {
    const tenantId = req.session.tenantId;
    const { groupId } = req.body;

    if (!groupId) {
      return res.status(400).json({ success: false, message: "ग्रुप ID आवश्यक आहे", affectedRecords: 0, details: [] });
    }

    const result = await dataManagementService.rearrangeAccountNumbers(tenantId, groupId);
    
    if (result.success) {
      res.json({ success: true, message: result.message, summary: { accountsRearranged: result.affectedRecords, timestamp: new Date().toISOString() }, details: result.details });
    } else {
      res.status(400).json({ success: false, message: result.message, details: result.details });
    }
  } catch (error) {
    console.error("Account rearrangement endpoint error:", error);
    res.status(500).json({ success: false, message: "Account rearrangement failed: " + (error as Error).message, error: (error as Error).message });
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

/**
 * POST /api/data-management/preview-cashbook-cleanup
 * कॅशबुक एन्ट्री क्लीनअप preview - किती entries delete होतील आणि किती safe राहतील
 */
router.post("/preview-cashbook-cleanup", async (req: any, res) => {
  try {
    const tenantId = req.session.tenantId;
    const { dateFrom, dateTo } = req.body;

    if (!dateFrom || !dateTo) {
      return res.status(400).json({
        success: false,
        message: "तारीख रेंज (from आणि to) आवश्यक आहे"
      });
    }

    const result = await dataManagementService.previewCashBookCleanup(tenantId, { dateFrom, dateTo });
    res.json(result);
  } catch (error) {
    console.error("Preview cashbook cleanup error:", error);
    res.status(500).json({
      success: false,
      message: "Preview अयशस्वी: " + (error as Error).message
    });
  }
});

/**
 * POST /api/data-management/cleanup-cashbook-entries
 * कॅशबुक एन्ट्री क्लीनअप - कर्जाच्या एन्ट्री सोडून सामान्य एन्ट्री हटवा
 */
router.post("/cleanup-cashbook-entries", async (req: any, res) => {
  try {
    const tenantId = req.session.tenantId;
    const { dateFrom, dateTo, cleanCashTransactions = true, cleanJournalEntries = true, createBackup = true } = req.body;

    if (!dateFrom || !dateTo) {
      return res.status(400).json({
        success: false,
        message: "तारीख रेंज (from आणि to) आवश्यक आहे"
      });
    }

    console.log(`🧹 CASHBOOK CLEANUP: Starting for tenant ${tenantId} from ${dateFrom} to ${dateTo}`);

    const result = await dataManagementService.cleanupCashBookEntries(tenantId, {
      dateFrom,
      dateTo,
      cleanCashTransactions,
      cleanJournalEntries,
      createBackup
    });

    if (result.success) {
      console.log(`✅ CASHBOOK CLEANUP: ${result.affectedRecords} entries cleaned`);
      res.json({
        success: true,
        message: result.message,
        summary: {
          recordsDeleted: result.affectedRecords,
          timestamp: new Date().toISOString()
        },
        details: result.details
      });
    } else {
      res.status(400).json({
        success: false,
        message: result.message,
        details: result.details
      });
    }
  } catch (error) {
    console.error("Cashbook cleanup error:", error);
    res.status(500).json({
      success: false,
      message: "कॅशबुक क्लीनअप अयशस्वी: " + (error as Error).message
    });
  }
});

export default router;