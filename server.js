const express = require('express');
const mysql = require('mysql2/promise');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const axios = require('axios');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret';

const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'airguard'
};

let pool;

const fs = require('fs');
const path = require('path');

async function initDB() {
    try {
        // First connection without DB selected to ensure DB exists
        const connection = await mysql.createConnection({
            host: dbConfig.host,
            user: dbConfig.user,
            password: dbConfig.password,
            multipleStatements: true
        });
        await connection.query(`CREATE DATABASE IF NOT EXISTS ${dbConfig.database}`);
        await connection.end();

        // Now create the pool with the database selected
        pool = await mysql.createPool({ ...dbConfig, multipleStatements: true });
        console.log(`Connected to AirGuard MySQL database: ${dbConfig.database}`);
        
        // Check if tables exist
        const [tables] = await pool.query('SHOW TABLES');
        if (tables.length === 0) {
            console.log('Database is empty. Initializing from schema.sql...');
            const schemaPath = path.join(__dirname, 'schema.sql');
            if (fs.existsSync(schemaPath)) {
                let schema = fs.readFileSync(schemaPath, 'utf8');
                
                // Remove DELIMITER keywords for JS execution
                schema = schema.replace(/DELIMITER \/\/|DELIMITER ;/g, '');
                
                // Split by semicolon, but careful with triggers/procs
                // A better way is to execute the whole block if multipleStatements is true
                await pool.query(schema);
                
                console.log('Database initialized successfully from schema.sql');
            }
        }

        console.log('Database sync complete.');
        // Simulation stopped to show only schema data
        // setInterval(simulateLiveReadings, 30000); 
    } catch (err) {
        console.error('Database connection/initialization failed:', err);
        console.log('\nTIP: Ensure your local MySQL server (XAMPP/WAMP/MySQL Installer) is RUNNING on port 3306.');
    }
}

// ... simulateLiveReadings function kept but not called ...

// --- Application Logic ---

// Helper for Mock Data
const getMockLocations = () => [
    { LocationID: 'loc-001', Name: 'Chennai', State: 'Tamil Nadu' },
    { LocationID: 'loc-002', Name: 'Mumbai', State: 'Maharashtra' },
    { LocationID: 'loc-003', Name: 'Delhi', State: 'Delhi' },
    { LocationID: 'loc-004', Name: 'Kolkata', State: 'West Bengal' },
    { LocationID: 'loc-005', Name: 'Hyderabad', State: 'Telangana' },
    { LocationID: 'loc-006', Name: 'Ahmedabad', State: 'Gujarat' },
    { LocationID: 'loc-dal', Name: 'Dal Lake', State: 'Jammu and Kashmir' }
];

// Fetch data from local database for a given location and return.
app.get('/api/current-aqi/:locationId', async (req, res) => {
    const locationId = req.params.locationId;
    
    if (!pool) {
        // Mock data fallback if database is missing
        const mockLocs = getMockLocations();
        const loc = mockLocs.find(l => l.LocationID === locationId) || mockLocs[0];
        const cityName = loc.Name;
        
        // Generate random but realistic data
        const baseAqi = 30 + Math.floor(Math.random() * 120);
        return res.json({
            aqi: baseAqi,
            readings: [
                { Pollutant_Name: 'PM2.5', Reading_Value: (baseAqi/2.5).toFixed(2), City_Name: cityName },
                { Pollutant_Name: 'PM10', Reading_Value: (baseAqi * 1.2).toFixed(2), City_Name: cityName },
                { Pollutant_Name: 'NO2', Reading_Value: (20 + Math.random() * 15).toFixed(2), City_Name: cityName },
                { Pollutant_Name: 'SO2', Reading_Value: (5 + Math.random() * 8).toFixed(2), City_Name: cityName },
                { Pollutant_Name: 'CO', Reading_Value: (0.4 + Math.random() * 0.6).toFixed(2), City_Name: cityName },
                { Pollutant_Name: 'O3', Reading_Value: (25 + Math.random() * 30).toFixed(2), City_Name: cityName }
            ]
        });
    }

    try {
        const [locData] = await pool.query('SELECT Name FROM LOCATION WHERE LocationID = ?', [locationId]);
        if (locData.length === 0) return res.status(404).json({ error: 'Location not found' });
        const Name = locData[0].Name;

        const [rows] = await pool.query('SELECT * FROM View_Live_Air_Quality_Status WHERE City_Name = ?', [Name]);
        
        if (rows.length === 0) {
            return res.json({ aqi: 0, readings: [], message: 'No readings found in DB for this city.' });
        }

        const pm25Reading = rows.find(r => r.Pollutant_Name.toUpperCase() === 'PM2.5');
        const aqiValue = pm25Reading ? Math.round(parseFloat(pm25Reading.Reading_Value) * 2.5) : 0;

        res.json({
            aqi: aqiValue,
            readings: rows
        });
    } catch (err) {
        console.error('Data Fetch Error:', err.message);
        res.status(500).json({ error: `Server Error: ${err.message}` });
    }
});

app.get('/api/locations', async (req, res) => {
    if (!pool) {
        const locs = getMockLocations();
        return res.json(locs.map(l => ({ ...l, isMock: true })));
    }
    try {
        const [rows] = await pool.query('SELECT * FROM LOCATION');
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/history/:locationId', async (req, res) => {
    if (!pool) {
        const history = [];
        const now = new Date();
        let val = 50 + Math.random() * 20;
        for (let i = 24; i >= 0; i--) {
            const time = new Date(now.getTime() - i * 3600000);
            val += (Math.random() - 0.5) * 10; // Random walk
            if (val < 20) val = 20;
            if (val > 150) val = 150;
            history.push({
                Time: time.toISOString(),
                Value: Math.round(val)
            });
        }
        return res.json(history);
    }
    try {
        const [rows] = await pool.query('SELECT Time, Value FROM READING WHERE LocationID = ? ORDER BY Time DESC LIMIT 24', [req.params.locationId]);
        res.json(rows.reverse());
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- Auth Endpoints (Mocked for Demo) ---

app.post('/api/auth/signup', async (req, res) => {
    const { username, email, password } = req.body;
    if (!pool) {
        // Mock success
        const user = { id: 999, username, email };
        const token = jwt.sign({ id: user.id }, JWT_SECRET, { expiresIn: '1h' });
        return res.json({ user, token, message: 'Demo Mode: User created locally' });
    }
    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        const [result] = await pool.query('INSERT INTO USER (Username, Email, PasswordHash) VALUES (?, ?, ?)', [username, email, hashedPassword]);
        const user = { id: result.insertId, username, email };
        const token = jwt.sign({ id: user.id }, JWT_SECRET, { expiresIn: '1h' });
        res.status(201).json({ user, token });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/auth/login', async (req, res) => {
    const { email, password } = req.body;
    if (!pool) {
        // Mock success for any login in demo mode
        const user = { id: 999, username: email.split('@')[0], email };
        const token = jwt.sign({ id: user.id }, JWT_SECRET, { expiresIn: '1h' });
        return res.json({ user, token, message: 'Demo Mode: Login successful' });
    }
    try {
        const [rows] = await pool.query('SELECT * FROM USER WHERE Email = ?', [email]);
        if (rows.length === 0) return res.status(401).json({ error: 'Invalid credentials' });
        const user = rows[0];
        const isMatch = await bcrypt.compare(password, user.PasswordHash);
        if (!isMatch) return res.status(401).json({ error: 'Invalid credentials' });
        
        const token = jwt.sign({ id: user.UserID }, JWT_SECRET, { expiresIn: '1h' });
        res.json({ user: { id: user.UserID, username: user.Username, email: user.Email }, token });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- Subscription & Alerts (Mocked for Demo) ---

app.get('/api/subscriptions/:userId', async (req, res) => {
    if (!pool) return res.json(['loc-001']); // Mock subs
    try {
        const [rows] = await pool.query('SELECT LocationID FROM USER_LOCATION WHERE UserID = ?', [req.params.userId]);
        res.json(rows.map(r => r.LocationID));
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/subscribe', async (req, res) => {
    if (!pool) return res.json({ success: true, message: 'Demo Mode: Subscribed' });
    try {
        await pool.query('INSERT IGNORE INTO USER_LOCATION (UserID, LocationID) VALUES (?, ?)', [req.body.userId, req.body.locationId]);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/unsubscribe', async (req, res) => {
    if (!pool) return res.json({ success: true, message: 'Demo Mode: Unsubscribed' });
    try {
        await pool.query('DELETE FROM USER_LOCATION WHERE UserID = ? AND LocationID = ?', [req.body.userId, req.body.locationId]);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/alerts/:userId', async (req, res) => {
    if (!pool) {
        return res.json([
            {
                CreatedAt: new Date().toISOString(),
                Pollutant: 'PM2.5',
                Value: '125.50',
                LocationName: 'Delhi',
                RecName: 'Health Alert',
                RecDesc: 'Stay indoors. Avoid all physical exertion outside.'
            }
        ]);
    }
    try {
        // Query to get alerts for the user's subscribed locations
        const query = `
            SELECT A.*, L.Name as LocationName, R.Name as RecName, R.Description as RecDesc
            FROM ALERT A
            JOIN LOCATION L ON A.LocationID = L.LocationID
            JOIN RECOMMENDATION R ON A.RecID = R.RecID
            WHERE A.UserID = ?
            ORDER BY A.CreatedAt DESC LIMIT 10
        `;
        const [rows] = await pool.query(query, [req.params.userId]);
        res.json(rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/safety-report/:locationId', async (req, res) => {
    if (!pool) return res.json([{ pol_name: 'PM2.5', avg_val: '45.2' }, { pol_name: 'PM10', avg_val: '88.5' }]);
    try {
        // Call stored procedure
        const [rows] = await pool.query('CALL GetLocationSafetyReport(?)', [req.params.locationId]);
        res.json(rows[0]);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    initDB();
});
