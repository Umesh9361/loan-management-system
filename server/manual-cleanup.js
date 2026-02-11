// Emergency manual cleanup script for duplicate cash transactions
import { Pool } from '@neondatabase/serverless';
import ws from 'ws';

// Configure neon
const pool = new Pool({ 
  connectionString: process.env.DATABASE_URL,
  websocket: ws
});

async function cleanupDuplicates() {
  const client = await pool.connect();
  
  try {
    console.log('🧹 Starting manual duplicate cleanup...');
    
    // Find all duplicate loan disbursement entries
    const duplicateQuery = `
      WITH loan_duplicates AS (
        SELECT 
          id,
          narration,
          amount,
          transaction_date,
          loan_id,
          created_at,
          ROW_NUMBER() OVER (
            PARTITION BY 
              CASE 
                WHEN narration ~ 'खाते क्र\\. (\\d+)' THEN 
                  (regexp_match(narration, 'खाते क्र\\. (\\d+)'))[1]
                WHEN narration ~ '\\(([^)]+)\\)' THEN
                  (regexp_match(narration, '\\(([^)]+)\\)'))[1]
                ELSE loan_id::text
              END,
              transaction_type,
              amount::numeric
            ORDER BY created_at ASC
          ) as rn
        FROM cash_transactions
        WHERE tenant_id = 'TEST'
          AND transaction_type = 'cash_out'
          AND (narration LIKE '%कर्ज वितरण%' OR narration LIKE '%कर्ज दिले%')
      )
      SELECT id, narration FROM loan_duplicates WHERE rn > 1;
    `;
    
    const result = await client.query(duplicateQuery);
    
    if (result.rows.length > 0) {
      console.log(`Found ${result.rows.length} duplicates to remove:`);
      
      for (const row of result.rows) {
        console.log(`Removing: ${row.id} - ${row.narration}`);
        await client.query('DELETE FROM cash_transactions WHERE id = $1', [row.id]);
      }
      
      console.log(`✅ Successfully removed ${result.rows.length} duplicate entries`);
    } else {
      console.log('No duplicates found');
    }
    
  } catch (error) {
    console.error('❌ Cleanup failed:', error);
  } finally {
    client.release();
    await pool.end();
  }
}

cleanupDuplicates();