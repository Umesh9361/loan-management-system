// Direct database cleanup using existing connection
import { db } from './db.js';
import { cashTransactions } from '@shared/schema';
import { eq, and } from 'drizzle-orm';

async function directCleanup() {
  console.log('🧹 Starting direct duplicate cleanup...');
  
  try {
    const tenantId = 'TEST';
    let duplicatesRemoved = 0;
    
    // Get all cash_out transactions for loan disbursements
    const allTransactions = await db.select()
      .from(cashTransactions)
      .where(and(
        eq(cashTransactions.tenantId, tenantId),
        eq(cashTransactions.transactionType, 'cash_out')
      ));

    console.log(`Found ${allTransactions.length} cash_out transactions`);

    // Group by borrower name to catch all variations
    const borrowerGroups: { [key: string]: any[] } = {};
    
    allTransactions.forEach(tx => {
      if (tx.narration && (tx.narration.includes('कर्ज वितरण') || tx.narration.includes('कर्ज दिले'))) {
        // Use borrower name as the key for grouping
        let key = 'unknown';
        
        if (tx.narration.includes('राज पाटील')) {
          key = 'raj_patil';
        }
        // Add more borrower names as needed
        else {
          // Extract borrower name from standard patterns
          const nameMatch = tx.narration.match(/कर्ज [वदि]+रण - (?:खाते क्र\. \d+ )?(.+?)(?:\s+-|\s+\(|$)/);
          if (nameMatch) {
            key = nameMatch[1].trim().toLowerCase().replace(/\s+/g, '_');
          }
        }
        
        if (!borrowerGroups[key]) borrowerGroups[key] = [];
        borrowerGroups[key].push(tx);
        
        console.log(`Grouped transaction: ${key} - ${tx.narration?.substring(0, 50)}...`);
      }
    });

    console.log(`Found ${Object.keys(borrowerGroups).length} borrower groups`);

    // Remove duplicates - keep oldest entry, remove newer ones
    for (const [groupKey, group] of Object.entries(borrowerGroups)) {
      if (group.length > 1) {
        console.log(`\n📋 Processing group ${groupKey} with ${group.length} entries:`);
        
        // Sort by creation date (oldest first)
        group.sort((a, b) => new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime());
        
        // Keep first (oldest), remove others
        for (let i = 1; i < group.length; i++) {
          console.log(`❌ Removing duplicate: ${group[i].narration}`);
          console.log(`   ID: ${group[i].id}`);
          console.log(`   Date: ${group[i].createdAt}`);
          
          await db.delete(cashTransactions)
            .where(and(
              eq(cashTransactions.id, group[i].id),
              eq(cashTransactions.tenantId, tenantId)
            ));
          duplicatesRemoved++;
        }
        
        console.log(`✅ Kept original: ${group[0].narration}`);
      }
    }
    
    console.log(`\n🎉 Cleanup completed! Removed ${duplicatesRemoved} duplicate entries.`);
    
  } catch (error) {
    console.error('❌ Cleanup failed:', error);
  }
}

// Run cleanup
directCleanup().then(() => {
  console.log('Script finished');
  process.exit(0);
}).catch(error => {
  console.error('Script error:', error);
  process.exit(1);
});