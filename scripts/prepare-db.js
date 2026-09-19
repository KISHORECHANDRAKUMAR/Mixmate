const fs = require('fs');
const path = require('path');

const schemaPath = path.join(__dirname, '..', 'prisma', 'schema.prisma');
const postgresBakPath = path.join(__dirname, '..', 'prisma', 'schema.prisma.postgres.bak');
const sqliteBakPath = path.join(__dirname, '..', 'prisma', 'schema.prisma.sqlite.bak');

// Backup sqlite schema if not already present
if (!fs.existsSync(sqliteBakPath) && fs.existsSync(schemaPath)) {
  const current = fs.readFileSync(schemaPath, 'utf8');
  if (current.includes('provider = "sqlite"')) {
    fs.writeFileSync(sqliteBakPath, current, 'utf8');
  }
}

const { execSync } = require('child_process');

const dbUrl = process.env.DATABASE_URL || process.env.STORAGE_URL || process.env.STORAGE_DATABASE_URL || process.env.POSTGRES_URL || process.env.POSTGRES_PRISMA_URL || '';
const isPostgres = dbUrl.startsWith('postgres://') || dbUrl.startsWith('postgresql://');

if (isPostgres) {
  process.env.DATABASE_URL = dbUrl;
}

if (isPostgres && fs.existsSync(postgresBakPath)) {
  console.log('⚡ Detected PostgreSQL database URL. Using PostgreSQL Prisma schema.');
  fs.copyFileSync(postgresBakPath, schemaPath);
  try {
    console.log('⚡ Syncing PostgreSQL database schema with prisma db push...');
    execSync('npx prisma db push --skip-generate', { stdio: 'inherit' });
  } catch (err) {
    console.warn('⚠️ Warning during prisma db push:', err.message);
  }
} else if (fs.existsSync(sqliteBakPath)) {
  console.log('⚡ Using SQLite Prisma schema.');
  fs.copyFileSync(sqliteBakPath, schemaPath);
}
