const mysql = require('mysql2/promise');
require('dotenv').config();

async function clearOrders() {
    let connection;
    try {
        const host = process.env.DATABASE_HOST || process.env.DB_HOST || 'localhost';
        const port = Number(process.env.DATABASE_PORT || process.env.DB_PORT) || 4000;
        const user = process.env.DATABASE_USERNAME || process.env.DB_USER || 'root';
        const password = process.env.DATABASE_PASSWORD || process.env.DB_PASSWORD || '';
        const database = process.env.DATABASE_NAME || process.env.DB_NAME || 'cloth';
        const sslRequired = process.env.DATABASE_SSL === 'true' || process.env.DB_SSL === 'true' || host.includes('tidbcloud.com');

        connection = await mysql.createConnection({
            host,
            port,
            user,
            password,
            database,
            ...(sslRequired ? { ssl: { rejectUnauthorized: true, minVersion: 'TLSv1.2' } } : {})
        });

        console.log('Connected to MySQL database:', process.env.DATABASE_NAME || 'cloth');

        // Disable foreign key checks temporarily to safely drop/delete order tables
        await connection.query('SET FOREIGN_KEY_CHECKS = 0;');

        console.log('Clearing order_summary table...');
        await connection.query('DELETE FROM `order-summary`;');
        
        console.log('Clearing orders table...');
        await connection.query('DELETE FROM `orders`;');

        // Re-enable foreign key checks
        await connection.query('SET FOREIGN_KEY_CHECKS = 1;');

        console.log('Successfully cleared all order data!');
    } catch (error) {
        console.error('Error clearing order data:', error);
    } finally {
        if (connection) {
            await connection.end();
        }
    }
}

clearOrders();
