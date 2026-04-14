const mysql = require('mysql2/promise');
const fs = require('fs');
require('dotenv').config({ override: true });

const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || ''
};

async function init() {
    let connection;
    try {
        console.log('Attempting to connect to MySQL at', dbConfig.host);
        connection = await mysql.createConnection(dbConfig);
        console.log('Connected to MySQL server');

        // Create database if it doesn't exist
        const dbName = process.env.DB_NAME || 'airguard';
        await connection.query(`CREATE DATABASE IF NOT EXISTS ${dbName}`);
        await connection.query(`USE ${dbName}`);
        console.log(`Using database: ${dbName}`);

        // Function to execute SQL file
        async function executeSqlFile(filePath) {
            console.log(`Executing ${filePath}...`);
            const sql = fs.readFileSync(filePath, 'utf8');
            
            // Split by DELIMITER blocks or semicolons
            // This is a simple regex-based split that handles the DELIMITER // ... // DELIMITER ; pattern
            const regex = /DELIMITER\s+(\S+)\s+([\s\S]+?)\s+\1\s+DELIMITER\s+;/g;
            let lastIndex = 0;
            let match;

            while ((match = regex.exec(sql)) !== null) {
                // Execute anything before the DELIMITER block
                const before = sql.substring(lastIndex, match.index).split(';').map(s => s.trim()).filter(s => s.length > 0);
                for (let statement of before) {
                    await connection.query(statement).catch(err => {
                        if (!statement.includes('DROP TABLE')) {
                            console.warn('Statement warning:', statement.substring(0, 50), '...', err.message);
                        }
                    });
                }

                // Execute the block content
                const blockContent = match[2].trim();
                await connection.query(blockContent).catch(err => {
                    console.warn('Block warning:', blockContent.substring(0, 50), '...', err.message);
                });

                lastIndex = regex.lastIndex;
            }

            // Execute remaining statements
            const remaining = sql.substring(lastIndex).split(';').map(s => s.trim()).filter(s => s.length > 0);
            for (let statement of remaining) {
                await connection.query(statement).catch(err => {
                    if (!statement.includes('DROP TABLE')) {
                        console.warn('Statement warning:', statement.substring(0, 50), '...', err.message);
                    }
                });
            }
        }

        await executeSqlFile('schema.sql');
        await executeSqlFile('additions.sql');

        console.log('--- DB INIT COMPLETE ---');
        console.log('Database is ready.');
    } catch (err) {
        console.error('Initialization failed:', err);
        console.log('\nTIP: Ensure your local MySQL server (XAMPP/WAMP/MySQL Installer) is RUNNING.');
    } finally {
        if (connection) await connection.end();
    }
}

init();
