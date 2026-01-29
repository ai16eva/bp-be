try {
  const path = require('path');
  const envName = process.env.NODE_ENV ? `.env.${process.env.NODE_ENV}` : '.env';
  require('dotenv').config({ path: path.resolve(process.cwd(), envName) });
  require('dotenv').config();
} catch (_) {}

const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

async function runMigration(migrationFile) {
  const isDev = process.env.NODE_ENV === 'dev';
  const host = isDev ? process.env.DB_HOST_DEV : process.env.DB_HOST || 'localhost';
  const user = isDev ? process.env.DB_USERNAME_DEV : process.env.DB_USERNAME || 'root';
  const password = isDev ? process.env.DB_PASSWORD_DEV : process.env.DB_PASSWORD || '';
  const database = isDev ? process.env.DB_DATABASE_DEV : process.env.DB_DATABASE || 'boomplay_db';
  
  console.log(`Connecting to database: ${database}@${host} as ${user}`);
  
  const connection = await mysql.createConnection({
    host: host,
    user: user,
    password: password,
    database: database,
    multipleStatements: true,
  });

  try {
    console.log(`Running migration: ${migrationFile}`);
    const sql = fs.readFileSync(migrationFile, 'utf8');
    
    const cleanSql = sql
      .split('\n')
      .filter(line => !line.trim().startsWith('--') && line.trim().length > 0)
      .join('\n');

    await connection.query(cleanSql);
    console.log('  Migration completed successfully');
    
    const [rows] = await connection.query(`DESCRIBE quests`);
    const daoAnswerTxColumn = rows.find(row => row.Field === 'dao_answer_tx');
    if (daoAnswerTxColumn) {
      console.log(`  Verified: dao_answer_tx column type is now: ${daoAnswerTxColumn.Type}`);
    }
  } catch (error) {
    console.error(' Migration failed:', error.message);
    throw error;
  } finally {
    await connection.end();
  }
}

async function main() {
  const migrationFile = process.argv[2];
  
  if (!migrationFile) {
    console.error('Usage: node scripts/run_migration.js <migration_file.sql>');
    console.error('Example: node scripts/run_migration.js migrations/20251103_alter_quests_dao_answer_tx.sql');
    process.exit(1);
  }

  const fullPath = path.resolve(process.cwd(), migrationFile);
  if (!fs.existsSync(fullPath)) {
    console.error(` Migration file not found: ${fullPath}`);
    process.exit(1);
  }

  try {
    await runMigration(fullPath);
    process.exit(0);
  } catch (error) {
    console.error('Migration error:', error);
    process.exit(1);
  }
}

main();

