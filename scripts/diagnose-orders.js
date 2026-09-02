require('dotenv').config();
const { DataSource } = require('typeorm');

async function diagnose() {
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
        logging: false
    });

    await ds.initialize();
    console.log('DB Connected!');

    const dates = await ds.query(`SELECT id, orderId, status, createdAt FROM orders ORDER BY createdAt DESC`);
    console.log('\n--- ALL ORDER CREATED AT DATES ---');
    console.table(dates);

    // 2. Fetch all order summaries
    const summaries = await ds.query(`SELECT id, orderId, productId, price, quantity, unitCostPrice, totalCost, costSource FROM \`order-summary\` ORDER BY createdAt DESC LIMIT 20`);
    console.log('\n--- ORDER SUMMARIES IN DB ---');
    console.table(summaries);

    // 3. Test DELIVERED_COMPLETED status query
    const deliveredCount = await ds.query(`SELECT COUNT(*) as count FROM orders WHERE status IN ('Delivered', 'Completed') AND (isDeleted = 0 OR isDeleted IS NULL)`);
    console.log('\n--- DELIVERED / COMPLETED COUNT ---', deliveredCount[0].count);

    // 4. Test ACTIVE_ALL status query
    const activeCount = await ds.query(`SELECT COUNT(*) as count FROM orders WHERE status NOT IN ('Cancelled', 'Rejected', 'Failed') AND (isDeleted = 0 OR isDeleted IS NULL)`);
    console.log('\n--- ACTIVE ALL COUNT ---', activeCount[0].count);

    // 5. Test DISTINCT statuses in DB
    const statuses = await ds.query(`SELECT DISTINCT status, COUNT(*) as cnt FROM orders GROUP BY status`);
    console.log('\n--- DISTINCT ORDER STATUSES IN DB ---');
    console.table(statuses);

    await ds.destroy();
}

diagnose().catch(err => {
    console.error('Diagnosis Error:', err);
    process.exit(1);
});
