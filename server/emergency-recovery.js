#!/usr/bin/env node
/**
 * Emergency Super Admin Recovery Script
 * Use only in emergency situations when normal admin access is lost
 */

import bcrypt from 'bcrypt';
import pg from 'pg';
const { Client } = pg;

// Emergency recovery functions
class EmergencyRecovery {
  constructor() {
    this.dbUrl = process.env.DATABASE_URL;
    if (!this.dbUrl) {
      console.error('❌ DATABASE_URL not found in environment variables');
      process.exit(1);
    }
  }

  async connectDB() {
    this.client = new Client({ connectionString: this.dbUrl });
    await this.client.connect();
    console.log('✅ Connected to database');
  }

  async resetAdminPassword(tenantId = 'TEST', username = 'admin', newPassword = 'EmergencyReset123') {
    try {
      console.log(`🔄 Resetting password for ${username} in tenant ${tenantId}...`);
      
      const hashedPassword = await bcrypt.hash(newPassword, 10);
      
      const result = await this.client.query(
        'UPDATE users SET password = $1, updated_at = NOW() WHERE username = $2 AND tenant_id = $3',
        [hashedPassword, username, tenantId]
      );

      if (result.rowCount > 0) {
        console.log('✅ Password reset successful!');
        console.log(`📝 Login credentials:`);
        console.log(`   Username: ${username}`);
        console.log(`   Password: ${newPassword}`);
        console.log(`   Tenant ID: ${tenantId}`);
        console.log('⚠️  CHANGE THIS PASSWORD IMMEDIATELY AFTER LOGIN!');
        return true;
      } else {
        console.log('❌ No admin user found with those credentials');
        return false;
      }
    } catch (error) {
      console.error('❌ Error resetting password:', error.message);
      return false;
    }
  }

  async createEmergencyAdmin(tenantId = 'EMERGENCY', username = 'emergency_admin') {
    try {
      console.log(`🔄 Creating emergency admin account...`);
      
      const password = 'Emergency2025!';
      const hashedPassword = await bcrypt.hash(password, 10);
      
      // First check if user exists
      const existingUser = await this.client.query(
        'SELECT id FROM users WHERE username = $1 AND tenant_id = $2',
        [username, tenantId]
      );

      if (existingUser.rows.length > 0) {
        console.log('⚠️  Emergency admin already exists, updating password...');
        const result = await this.client.query(
          'UPDATE users SET password = $1, is_active = true, updated_at = NOW() WHERE username = $2 AND tenant_id = $3',
          [hashedPassword, username, tenantId]
        );
      } else {
        const result = await this.client.query(
          `INSERT INTO users (id, username, password, tenant_id, role, is_active, created_at, updated_at) 
           VALUES (gen_random_uuid(), $1, $2, $3, 'admin', true, NOW(), NOW())`,
          [username, hashedPassword, tenantId]
        );
      }

      console.log('✅ Emergency admin created successfully!');
      console.log(`📝 Emergency login credentials:`);
      console.log(`   Username: ${username}`);
      console.log(`   Password: ${password}`);
      console.log(`   Tenant ID: ${tenantId}`);
      console.log('⚠️  DELETE THIS ACCOUNT AFTER RECOVERY!');
      return true;
    } catch (error) {
      console.error('❌ Error creating emergency admin:', error.message);
      return false;
    }
  }

  async listAllAdmins() {
    try {
      console.log('📋 Listing all admin accounts...');
      
      const result = await this.client.query(
        `SELECT username, tenant_id, role, is_active, updated_at 
         FROM users 
         WHERE role = 'admin' 
         ORDER BY tenant_id, username`
      );

      if (result.rows.length === 0) {
        console.log('❌ No admin accounts found!');
        return;
      }

      console.log('\n👥 Admin Accounts:');
      console.log('─'.repeat(80));
      console.log('USERNAME'.padEnd(20) + 'TENANT_ID'.padEnd(15) + 'ACTIVE'.padEnd(10) + 'LAST_UPDATE');
      console.log('─'.repeat(80));
      
      result.rows.forEach(row => {
        const active = row.is_active ? '✅ Yes' : '❌ No';
        const date = new Date(row.updated_at).toISOString().split('T')[0];
        console.log(
          row.username.padEnd(20) + 
          row.tenant_id.padEnd(15) + 
          active.padEnd(10) + 
          date
        );
      });
      console.log('─'.repeat(80));
    } catch (error) {
      console.error('❌ Error listing admins:', error.message);
    }
  }

  async cleanup() {
    if (this.client) {
      await this.client.end();
      console.log('✅ Database connection closed');
    }
  }
}

// Command line interface
async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  const recovery = new EmergencyRecovery();
  await recovery.connectDB();

  try {
    switch (command) {
      case 'reset-password':
        const tenantId = args[1] || 'TEST';
        const username = args[2] || 'admin';
        const password = args[3] || 'EmergencyReset123';
        await recovery.resetAdminPassword(tenantId, username, password);
        break;

      case 'create-emergency':
        await recovery.createEmergencyAdmin();
        break;

      case 'list-admins':
        await recovery.listAllAdmins();
        break;

      default:
        console.log('🔧 Emergency Super Admin Recovery Tool');
        console.log('');
        console.log('Usage:');
        console.log('  node emergency-recovery.js reset-password [tenant] [username] [password]');
        console.log('  node emergency-recovery.js create-emergency');
        console.log('  node emergency-recovery.js list-admins');
        console.log('');
        console.log('Examples:');
        console.log('  node emergency-recovery.js reset-password TEST admin NewPassword123');
        console.log('  node emergency-recovery.js create-emergency');
        console.log('  node emergency-recovery.js list-admins');
        break;
    }
  } finally {
    await recovery.cleanup();
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export default EmergencyRecovery;