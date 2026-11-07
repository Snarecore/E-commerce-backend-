require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { DataSource } = require('typeorm');

async function runMigration() {
    const host = process.env.DATABASE_HOST || process.env.DB_HOST || 'localhost';
    const port = Number(process.env.DATABASE_PORT || process.env.DB_PORT) || 3306;
    const username = process.env.DATABASE_USERNAME || process.env.DB_USER || 'root';
    const password = process.env.DATABASE_PASSWORD || process.env.DB_PASSWORD || '';
    const database = process.env.DATABASE_NAME || process.env.DB_NAME || 'bazaarbound';

    console.log(`Connecting to DB ${database} at ${host}:${port}...`);

    const isSslRequired = process.env.DATABASE_SSL === 'true' || host.includes('tidbcloud.com');

    const ds = new DataSource({
        type: 'mysql',
        host,
        port,
        username,
        password,
        database,
        ssl: isSslRequired ? { rejectUnauthorized: true, minVersion: 'TLSv1.2' } : false,
        multipleStatements: true,
        logging: false
    });

    await ds.initialize();
    console.log('Database connected successfully!');

    const sqlFilePath = path.join(__dirname, '../database/migrations/create_payments_system_schema.sql');
    const sqlContent = fs.readFileSync(sqlFilePath, 'utf8');

    console.log('Executing payments system schema migration & backfill...');
    await ds.query(sqlContent);
    console.log('Migration & Backfill executed successfully!');

    // Verification
    const paymentsCount = await ds.query('SELECT COUNT(*) as cnt FROM payments');
    console.log(`Verified: Total records in 'payments' table: ${paymentsCount[0].cnt}`);

    const samplePayments = await ds.query('SELECT id, orderId, gateway, paymentMethod, tranId, amount, status FROM payments LIMIT 5');
    console.log('Sample backfilled payments:', JSON.stringify(samplePayments, null, 2));

    await ds.destroy();
}

runMigration().catch(err => {
    console.error('Migration failed ERROR MESSAGE:', err.message);
    if (err.sqlMessage) console.error('SQL MESSAGE:', err.sqlMessage);
    if (err.sql) console.error('SQL QUERY:', err.sql);
    process.exit(1);
});
