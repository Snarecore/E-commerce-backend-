const mysql = require('mysql2/promise');
require('dotenv').config();

async function clearOrders() {
    let connection;
    try {
        connection = await mysql.createConnection({
            host: process.env.DATABASE_HOST || 'localhost',
            port: Number(process.env.DATABASE_PORT) || 3306,
            user: process.env.DATABASE_USERNAME || 'root',
            password: process.env.DATABASE_PASSWORD || '12345678',
            database: process.env.DATABASE_NAME || 'cloth',
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
