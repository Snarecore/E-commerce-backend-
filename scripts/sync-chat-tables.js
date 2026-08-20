const mysql = require('mysql2/promise');
require('dotenv').config();

async function run() {
    const connection = await mysql.createConnection({
        host: process.env.DATABASE_HOST || 'localhost',
        port: Number(process.env.DATABASE_PORT) || 3306,
        user: process.env.DATABASE_USERNAME || 'root',
        password: process.env.DATABASE_PASSWORD || '12345678',
        database: process.env.DATABASE_NAME || 'cloth',
    });

    console.log('Connected to MySQL database:', process.env.DATABASE_NAME || 'cloth');

    // 1. Create or update conversations table
    await connection.query(`
        CREATE TABLE IF NOT EXISTS conversations (
            id VARCHAR(36) NOT NULL PRIMARY KEY,
            customerId VARCHAR(255) NOT NULL,
            lastMessage TEXT NULL,
            lastMessageAt TIMESTAMP NULL,
            unreadCountAdmin INT NOT NULL DEFAULT 0,
            isDeleted BOOLEAN NOT NULL DEFAULT FALSE,
            createdAt TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
            updatedAt TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // Helper to safely add column
    async function addColumnIfNotExists(table, column, definition) {
        const [rows] = await connection.query(`
            SELECT COLUMN_NAME 
            FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = ?
        `, [process.env.DATABASE_NAME || 'cloth', table, column]);

        if (rows.length === 0) {
            console.log(`Adding column ${column} to ${table}...`);
            await connection.query(`ALTER TABLE \`${table}\` ADD COLUMN \`${column}\` ${definition}`);
        } else {
            console.log(`Column ${column} already exists in ${table}.`);
        }
    }

    await addColumnIfNotExists('conversations', 'customerId', 'VARCHAR(255) NOT NULL');
    await addColumnIfNotExists('conversations', 'lastMessage', 'TEXT NULL');
    await addColumnIfNotExists('conversations', 'lastMessageAt', 'TIMESTAMP NULL');
    await addColumnIfNotExists('conversations', 'unreadCountAdmin', 'INT NOT NULL DEFAULT 0');
    await addColumnIfNotExists('conversations', 'isDeleted', 'BOOLEAN NOT NULL DEFAULT FALSE');

    // 2. Create or update messages table
    await connection.query(`
        CREATE TABLE IF NOT EXISTS messages (
            id VARCHAR(36) NOT NULL PRIMARY KEY,
            conversationId VARCHAR(255) NOT NULL,
            senderId VARCHAR(255) NOT NULL,
            senderRole ENUM('customer', 'admin') NOT NULL,
            content TEXT NOT NULL,
            isRead BOOLEAN NOT NULL DEFAULT FALSE,
            isDeleted BOOLEAN NOT NULL DEFAULT FALSE,
            createdAt TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
            updatedAt TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    await addColumnIfNotExists('messages', 'conversationId', 'VARCHAR(255) NOT NULL');
    await addColumnIfNotExists('messages', 'senderId', 'VARCHAR(255) NOT NULL');
    await addColumnIfNotExists('messages', 'senderRole', "ENUM('customer', 'admin') NOT NULL");
    await addColumnIfNotExists('messages', 'content', 'TEXT NOT NULL');
    await addColumnIfNotExists('messages', 'isRead', 'BOOLEAN NOT NULL DEFAULT FALSE');
    await addColumnIfNotExists('messages', 'isDeleted', 'BOOLEAN NOT NULL DEFAULT FALSE');

    // Safe index creation
    async function addIndexIfNotExists(table, indexName, columns) {
        const [rows] = await connection.query(`
            SHOW INDEX FROM \`${table}\` WHERE Key_name = ?
        `, [indexName]);

        if (rows.length === 0) {
            console.log(`Creating index ${indexName} on ${table}...`);
            try {
                await connection.query(`CREATE INDEX \`${indexName}\` ON \`${table}\` (${columns})`);
            } catch (err) {
                console.log(`Index warning: ${err.message}`);
            }
        } else {
            console.log(`Index ${indexName} already exists on ${table}.`);
        }
    }

    await addIndexIfNotExists('conversations', 'IDX_convo_lastMessageAt_customer', '`lastMessageAt`, `customerId`');
    await addIndexIfNotExists('messages', 'IDX_msg_convo_createdAt_id', '`conversationId`, `createdAt`, `id`');

    console.log('✅ Chat tables successfully synced in MySQL!');
    await connection.end();
}

run().catch(err => {
    console.error('Migration error:', err);
    process.exit(1);
});
