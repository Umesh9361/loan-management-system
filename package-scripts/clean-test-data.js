#!/usr/bin/env node

// Emergency test data cleanup script
import { db } from '../server/db.js';
import { 
  loans, transactions, loanClosures, 
  cashTransactions, borrowers, groups 
} from '../shared/schema.js';
import { eq } from 'drizzle-orm';

async function cleanTestData(tenantId = 'TEST') {
  console.log(`🧹 Cleaning all data for tenant: ${tenantId}`);
  
  try {
    // Delete in correct order to avoid foreign key constraints
    await db.delete(loanClosures).where(eq(loanClosures.tenantId, tenantId));
    console.log('✅ Cleaned loan closures');
    
    await db.delete(cashTransactions).where(eq(cashTransactions.tenantId, tenantId));
    console.log('✅ Cleaned cash transactions');
    
    await db.delete(transactions).where(eq(transactions.tenantId, tenantId));
    console.log('✅ Cleaned transactions');
    
    await db.delete(loans).where(eq(loans.tenantId, tenantId));
    console.log('✅ Cleaned loans');
    
    await db.delete(borrowers).where(eq(borrowers.tenantId, tenantId));
    console.log('✅ Cleaned borrowers');
    
    await db.delete(groups).where(eq(groups.tenantId, tenantId));
    console.log('✅ Cleaned groups');
    
    console.log('🎉 Test data cleanup completed successfully!');
    console.log('🔄 Please refresh your browser to see changes');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error during cleanup:', error);
    process.exit(1);
  }
}

// Run cleanup
const tenantId = process.argv[2] || 'TEST';
cleanTestData(tenantId);