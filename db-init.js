const mysql = require('mysql2/promise');
const fs = require('fs');
require('dotenv').config();

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

        const schema = fs.readFileSync('schema.sql', 'utf8');
        // Filter out DELIMITER lines and split by semicolon
        const statements = schema
            .replace(/DELIMITER \/\//g, '')
            .replace(/\/\/ DELIMITER ;/g, '')
            .split(';')
            .map(s => s.trim())
            .filter(s => s.length > 0);

        for (let statement of statements) {
            try {
                await connection.query(statement);
            } catch (err) {
                // Ignore errors for DROP/CREATE if they are expected during re-init
                if (!statement.includes('DROP TABLE')) {
                    console.warn('Statement warning:', statement.substring(0, 50), '...', err.message);
                }
            }
        }

        // Add Dal Lake as the signature location
        await connection.query(`
            INSERT INTO LOCATION (LocationID, Name, State, Latitude, Longitude) 
            VALUES ('loc-dal', 'Dal Lake', 'Jammu and Kashmir', 34.1130, 74.8710)
            ON DUPLICATE KEY UPDATE Name = 'Dal Lake';
        `);

        console.log('--- DB INIT COMPLETE ---');
        console.log('Database and "Dal Lake" location are ready.');
    } catch (err) {
        console.error('Initialization failed:', err);
        console.log('\nTIP: Ensure your local MySQL server (XAMPP/WAMP/MySQL Installer) is RUNNING.');
    } finally {
        if (connection) await connection.end();
    }
}

init();
