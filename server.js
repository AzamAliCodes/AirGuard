const express = require('express');
const mysql = require('mysql2/promise');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const axios = require('axios');
require('dotenv').config({ override: true });

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

let syncInterval;

async function initDB() {
    try {
        const connection = await mysql.createConnection({
            host: dbConfig.host,
            user: dbConfig.user,
            password: dbConfig.password,
            multipleStatements: true
        });
        await connection.query(`CREATE DATABASE IF NOT EXISTS ${dbConfig.database}`);
        await connection.end();

        pool = await mysql.createPool({ ...dbConfig, multipleStatements: true });
        console.log(`Connected to AirGuard MySQL database: ${dbConfig.database}`);
        
        const [tables] = await pool.query('SHOW TABLES');
        if (tables.length === 0) {
            const schemaPath = path.join(__dirname, 'schema.sql');
            if (fs.existsSync(schemaPath)) {
                let schema = fs.readFileSync(schemaPath, 'utf8');
                schema = schema.replace(/DELIMITER \/\/|DELIMITER ;/g, '');
                await pool.query(schema);
                console.log('Database initialized successfully from schema.sql');
            }
        }
        console.log('Database sync complete.');
        startSyncInterval();
    } catch (err) {
        console.error('Database connection failed:', err);
    }
}

function startSyncInterval() {
    if (syncInterval) clearInterval(syncInterval);
    initLiveDataSync();
    syncInterval = setInterval(initLiveDataSync, 15 * 60 * 1000);
}

// --- Manual Sync Endpoint ---
app.post('/api/sync-now', async (req, res) => {
    if (!req.body) {
        console.error('❌ [Sync Error] Manual sync failed: Request body is missing. Ensure Content-Type: application/json is set.');
        return res.status(400).json({ success: false, error: 'Request body is missing.' });
    }
    const { locationId } = req.body;
    console.log(`⚡ [Manual Sync] Request received for Location: ${locationId || 'All'}`);
    try {
        const result = await initLiveDataSync(locationId);
        if (result.totalInserted === 0 && result.type === 'error') {
            return res.status(500).json({ success: false, error: result.message });
        }
        res.json({ success: true, count: result.totalInserted, message: result.message || `Successfully updated readings.` });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- Real-Time Data Synchronization (OpenAQ API) ---

async function initLiveDataSync(targetLocationId = null) {
    if (!pool) return { totalInserted: 0, message: 'Database disconnected.', type: 'error' };
    
    console.log(`🔄 [${targetLocationId ? 'Manual' : 'Background'} Sync] Fetching live data...`);

    if (!process.env.OPENAQ_API_KEY || process.env.OPENAQ_API_KEY === 'your_api_key_here' || process.env.OPENAQ_API_KEY === '') {
        console.warn('❗ [Sync Error] Sync skipped: No OPENAQ_API_KEY found in .env');
        return { totalInserted: 0, message: 'API Key is missing in .env file.', type: 'error' };
    }

    let totalInserted = 0;
    let authError = false;

    try {
        let locations;
        if (targetLocationId) {
            const [rows] = await pool.query('SELECT * FROM LOCATION WHERE LocationID = ?', [targetLocationId]);
            locations = rows;
        } else {
            const [rows] = await pool.query('SELECT * FROM LOCATION');
            locations = rows;
        }

        const [pollutants] = await pool.query('SELECT * FROM POLLUTANT');
        const pollutantMap = {};
        pollutants.forEach(p => pollutantMap[p.Name.toLowerCase().replace('.', '')] = p.PollutantID);

        for (const loc of locations) {
            try {
                const searchRes = await axios.get(`https://api.openaq.org/v3/locations`, {
                    params: { 
                        coordinates: `${parseFloat(loc.Latitude).toFixed(4)},${parseFloat(loc.Longitude).toFixed(4)}`, 
                        radius: 25000, 
                        limit: 1 
                    },
                    headers: { 'User-Agent': 'AirGuard/1.0', 'X-API-Key': process.env.OPENAQ_API_KEY }
                });

                if (searchRes.data.results?.length > 0) {
                    const station = searchRes.data.results[0];
                    console.log(`📍 [Match Found] City: ${loc.Name} -> Station: "${station.name}" (ID: ${station.id})`);

                    // In OpenAQ v3, the /latest endpoint only gives sensor IDs. 
                    // We need to map sensor IDs to parameter names from the station's sensor list.
                    const sensorMap = {};
                    if (station.sensors) {
                        station.sensors.forEach(s => {
                            sensorMap[s.id] = s.parameter.name.toLowerCase().replace('.', '');
                        });
                    }

                    const latestRes = await axios.get(`https://api.openaq.org/v3/locations/${station.id}/latest`, {
                        headers: { 'User-Agent': 'AirGuard/1.0', 'X-API-Key': process.env.OPENAQ_API_KEY }
                    });

                    if (latestRes.data.results?.length > 0) {
                        for (const m of latestRes.data.results) {
                            const paramName = sensorMap[m.sensorsId];
                            const pId = paramName ? pollutantMap[paramName] : null;

                            if (pId) {
                                const time = new Date(m.datetime.utc).toISOString().slice(0, 19).replace('T', ' ');
                                await pool.query(
                                    'INSERT INTO READING (ReadingID, Value, LocationID, PollutantID, Time) VALUES (UUID(), ?, ?, ?, ?) ON DUPLICATE KEY UPDATE Value = VALUES(Value)',
                                    [m.value, loc.LocationID, pId, time]
                                );
                                totalInserted++;
                            }
                        }
                    } else {
                        console.log(`⚠️ [No Data] Station "${station.name}" found, but it has no recent readings.`);
                    }
                } else {
                    console.warn(`❓ [Not Found] City "${loc.Name}" was not found in the OpenAQ v3 database.`);
                    cityErrors.push(loc.Name);
                }
            } catch (err) {
                if (err.response?.status === 401) { 
                    console.error('❌ [Auth Error] Your OPENAQ_API_KEY is INVALID or not active. Check your .env file.');
                    authError = true; 
                    break; 
                }
                if (err.response?.status === 422) {
                    console.error(`❌ [Validation Error] OpenAQ rejected request for ${loc.Name}:`, JSON.stringify(err.response.data));
                }
                console.warn(`⚠️ [API Error] Sync failed for ${loc.Name}: ${err.message}`);
            }
        }

        if (authError) return { totalInserted: 0, message: 'Invalid API Key. Please check your .env.', type: 'error' };
        
        console.log(`✅ [Background Sync] Completed. Inserted/Updated ${totalInserted} live readings.`);

        if (totalInserted === 0) return { totalInserted: 0, message: 'API returned no new data for your cities.', type: 'warning' };
        return { totalInserted };
    } catch (err) {
        console.error('❌ [Critical Error] Sync failed:', err.message);
        return { totalInserted: 0, message: 'Sync failed: ' + err.message, type: 'error' };
    }
}

// --- Application Logic ---
const getMockLocations = () => [
    { LocationID: 'loc-001', Name: 'Chennai', State: 'Tamil Nadu' },
    { LocationID: 'loc-002', Name: 'Mumbai', State: 'Maharashtra' },
    { LocationID: 'loc-003', Name: 'Delhi', State: 'Delhi' },
    { LocationID: 'loc-004', Name: 'Kolkata', State: 'West Bengal' },
    { LocationID: 'loc-005', Name: 'Hyderabad', State: 'Telangana' },
    { LocationID: 'loc-006', Name: 'Ahmedabad', State: 'Gujarat' },
    { LocationID: 'loc-dal', Name: 'Dal Lake', State: 'Jammu and Kashmir' }
];

app.get('/api/current-aqi/:locationId', async (req, res) => {
    const locationId = req.params.locationId;
    if (!pool) {
        const mockLocs = getMockLocations();
        const loc = mockLocs.find(l => l.LocationID === locationId) || mockLocs[0];
        const baseAqi = 30 + Math.floor(Math.random() * 120);
        return res.json({
            aqi: baseAqi,
            readings: [
                { Pollutant_Name: 'PM2.5', Reading_Value: (baseAqi/2.5).toFixed(2), City_Name: loc.Name },
                { Pollutant_Name: 'PM10', Reading_Value: (baseAqi * 1.2).toFixed(2), City_Name: loc.Name },
                { Pollutant_Name: 'NO2', Reading_Value: (20 + Math.random() * 15).toFixed(2), City_Name: loc.Name },
                { Pollutant_Name: 'SO2', Reading_Value: (5 + Math.random() * 8).toFixed(2), City_Name: loc.Name },
                { Pollutant_Name: 'CO', Reading_Value: (0.4 + Math.random() * 0.6).toFixed(2), City_Name: loc.Name },
                { Pollutant_Name: 'O3', Reading_Value: (25 + Math.random() * 30).toFixed(2), City_Name: loc.Name }
            ]
        });
    }
    try {
        const [locData] = await pool.query('SELECT Name FROM LOCATION WHERE LocationID = ?', [locationId]);
        if (locData.length === 0) return res.status(404).json({ error: 'Location not found' });
        const [rows] = await pool.query('SELECT * FROM View_Live_Air_Quality_Status WHERE City_Name = ?', [locData[0].Name]);
        if (rows.length === 0) return res.json({ aqi: 0, readings: [], message: 'No readings in DB.' });
        const pm25 = rows.find(r => r.Pollutant_Name.toUpperCase() === 'PM2.5');
        res.json({ aqi: pm25 ? Math.round(parseFloat(pm25.Reading_Value) * 2.5) : 0, readings: rows });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/locations', async (req, res) => {
    if (!pool) return res.json(getMockLocations().map(l => ({ ...l, isMock: true })));
    try {
        const [rows] = await pool.query('SELECT * FROM LOCATION');
        res.json(rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/history/:locationId', async (req, res) => {
    if (!pool) return res.json([]);
    try {
        const [rows] = await pool.query('SELECT Time, Value FROM READING WHERE LocationID = ? ORDER BY Time DESC LIMIT 24', [req.params.locationId]);
        res.json(rows.reverse());
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/auth/signup', async (req, res) => {
    const { username, email, password } = req.body;
    if (!pool) return res.json({ user: { id: 999, username, email }, token: 'mock-token' });
    try {
        const hashed = await bcrypt.hash(password, 10);
        await pool.query('INSERT INTO USER (UserID, UserName, FtnName, Email, Password) VALUES (UUID(), ?, ?, ?, ?)', [username, username, email, hashed]);
        res.status(201).json({ user: { username, email }, token: 'new-token' });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/auth/login', async (req, res) => {
    const { email, password } = req.body;
    if (!pool) return res.json({ user: { id: 999, username: email.split('@')[0], email }, token: 'mock-token' });
    try {
        const [rows] = await pool.query('SELECT * FROM USER WHERE Email = ?', [email]);
        if (rows.length === 0) return res.status(401).json({ error: 'Invalid credentials' });
        const user = rows[0];
        const match = user.Password.startsWith('$2') ? await bcrypt.compare(password, user.Password) : (password === user.Password);
        if (!match) return res.status(401).json({ error: 'Invalid credentials' });
        const token = jwt.sign({ id: user.UserID }, JWT_SECRET, { expiresIn: '1h' });
        res.json({ user: { id: user.UserID, username: user.UserName, email: user.Email }, token });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/subscriptions/:userId', async (req, res) => {
    if (!pool) return res.json([]);
    try {
        const [rows] = await pool.query('SELECT LocationID FROM USER_LOCATION WHERE UserID = ?', [req.params.userId]);
        res.json(rows.map(r => r.LocationID));
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/subscribe', async (req, res) => {
    if (!pool) return res.json({ success: true });
    try {
        await pool.query('INSERT IGNORE INTO USER_LOCATION (UserID, LocationID) VALUES (?, ?)', [req.body.userId, req.body.locationId]);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/unsubscribe', async (req, res) => {
    if (!pool) return res.json({ success: true });
    try {
        await pool.query('DELETE FROM USER_LOCATION WHERE UserID = ? AND LocationID = ?', [req.body.userId, req.body.locationId]);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/alerts/:userId', async (req, res) => {
    if (!pool) return res.json([]);
    try {
        const query = `SELECT A.*, L.Name as LocationName, R.Name as RecName, R.Description as RecDesc FROM ALERT A JOIN LOCATION L ON A.LocationID = L.LocationID JOIN RECOMMENDATION R ON A.RecID = R.RecID WHERE A.UserID = ? ORDER BY A.CreatedAt DESC LIMIT 10`;
        const [rows] = await pool.query(query, [req.params.userId]);
        res.json(rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    initDB();
});
