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

// --- Logging Setup ---
const logDir = path.join(__dirname, 'logs');
if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir);
}
const logFile = path.join(logDir, 'sync.txt');

function logActivity(message) {
    const timestamp = new Date().toLocaleString();
    const separator = "--------------------------------------------------------------------------------";
    const logLine = `\n${separator}\n[${timestamp}]\n${message}\n${separator}\n`;
    fs.appendFileSync(logFile, logLine, 'utf8');
}

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
        
        // Ensure AQI exists as a distinct "pollutant" so we can store it as a separate reading row
        await pool.query("INSERT IGNORE INTO POLLUTANT (PollutantID, Name, Unit, SafeThreshold) VALUES ('pol-aqi', 'AQI', 'Index', 100)");

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

// --- Real-Time Data Synchronization (OpenWeatherMap API) ---

async function initLiveDataSync(targetLocationId = null) {
    if (!pool) return { totalInserted: 0, message: 'Database disconnected.', type: 'error' };

    const syncType = targetLocationId ? 'Manual' : 'Background';
    console.log(`🔄 [${syncType} Sync] Fetching live data from OpenWeatherMap...`);

    if (!process.env.OWM_API_KEY || process.env.OWM_API_KEY === 'your_openweather_api_key_here' || process.env.OWM_API_KEY === '') {
        console.warn('❗ [Sync Error] Sync skipped: No OWM_API_KEY found in .env');
        return { totalInserted: 0, message: 'API Key is missing in .env file.', type: 'error' };
    }

    let totalInserted = 0;
    let authError = false;

    try {
        let locations;
        if (targetLocationId) {
            const [rows] = await pool.query('SELECT * FROM LOCATION WHERE LocationID = ?', [targetLocationId]);
            locations = rows;
            if (locations.length > 0) {
                const sel = locations[0];
                logActivity(`[Dropdown Selected]: ${sel.Name}${sel.State ? ', ' + sel.State : ''}`);
            }
        } else {
            const [rows] = await pool.query('SELECT * FROM LOCATION');
            locations = rows;
            logActivity(`[Scheduled Action] Starting Background Sync for all ${locations.length} locations.`);
        }

        const [pollutants] = await pool.query('SELECT * FROM POLLUTANT');
        const pollutantMap = {};
        // Map common keys to DB IDs (e.g., pm2_5 -> pm25)
        pollutants.forEach(p => pollutantMap[p.Name.toLowerCase().replace('.', '')] = p.PollutantID);

        for (const loc of locations) {
            try {
                const locationName = `${loc.Name}${loc.State ? ', ' + loc.State : ''}`;
                logActivity(`[Syncing Location] ${locationName}\n[API Request] GET /data/2.5/air_pollution | Params: { lat: ${loc.Latitude}, lon: ${loc.Longitude} }`);

                const res = await axios.get(`http://api.openweathermap.org/data/2.5/air_pollution`, {
                    params: {
                        lat: loc.Latitude,
                        lon: loc.Longitude,
                        appid: process.env.OWM_API_KEY
                    }
                });

                if (res.data.list?.length > 0) {
                    const components = res.data.list[0].components;
                    const owmAqi = res.data.list[0].main?.aqi || 'N/A';
                    const computedAqi = components.pm2_5 ? Math.round(parseFloat(components.pm2_5) * 2.5) : 0;
                    const timestamp = new Date(res.data.list[0].dt * 1000).toISOString().slice(0, 19).replace('T', ' ');
                    
                    // Consolidated JSON log for the API response
                    const consolidatedData = {
                        index: owmAqi,
                        aqi: computedAqi,
                        ...components
                    };
                    logActivity(`[API Response] Data received for ${loc.Name}: ${JSON.stringify(consolidatedData)}`);

                    // 1. Explicitly insert/update the Computed AQI FIRST as requested
                    const aqiSql = 'INSERT INTO READING (ReadingID, Value, LocationID, PollutantID, Time) VALUES (UUID(), ?, ?, ?, ?) ON DUPLICATE KEY UPDATE Value = VALUES(Value)';
                    const aqiVals = [computedAqi, loc.LocationID, 'pol-aqi', timestamp];
                    logActivity(`[DB Action] Updating AQI Index for ${loc.Name}\n[Query] ${aqiSql} | Values: [${aqiVals.join(', ')}]`);
                    await pool.query(aqiSql, aqiVals);
                    totalInserted++;

                    // 2. Then insert individual pollutants
                    for (const [key, value] of Object.entries(components)) {
                        // Normalize key (e.g., pm2_5 -> pm25)
                        const normalizedKey = key.replace('_', '');
                        const pId = pollutantMap[normalizedKey];

                        if (pId) {
                            const pollutantName = key.toUpperCase().replace('PM2_5', 'PM2.5').replace('PM10', 'PM10');
                            const sql = 'INSERT INTO READING (ReadingID, Value, LocationID, PollutantID, Time) VALUES (UUID(), ?, ?, ?, ?) ON DUPLICATE KEY UPDATE Value = VALUES(Value)';
                            const vals = [value, loc.LocationID, pId, timestamp];

                            logActivity(`[DB Action] Inserting ${pollutantName} level for ${loc.Name}\n[Query] ${sql} | Values: [${vals.join(', ')}]`);
                            await pool.query(sql, vals);
                            totalInserted++;
                        }
                    }
                } else {
                    logActivity(`[Sync Warning] No data returned for ${loc.Name}`);
                }
            } catch (err) {
                if (err.response?.status === 401) {
                    logActivity(`[API Error] 401 Unauthorized - Check OWM_API_KEY.`);
                    console.error('❌ [Auth Error] Your OWM_API_KEY is INVALID. Check your .env file.');
                    authError = true;
                    break;
                }
                logActivity(`[Sync Error] Failed for ${loc.Name}: ${err.message}`);
                console.warn(`⚠️ [API Error] Sync failed for ${loc.Name}: ${err.message}`);
            }
        }

        if (authError) return { totalInserted: 0, message: 'Invalid API Key. Please check your .env.', type: 'error' };

        console.log(`✅ [Background Sync] Completed. Inserted/Updated ${totalInserted} readings from OpenWeatherMap.`);
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
        const userId = crypto.randomUUID();
        await pool.query('INSERT INTO USER (UserID, UserName, FtnName, Email, Password) VALUES (?, ?, ?, ?, ?)', [userId, username, username, email, hashed]);
        res.status(201).json({ user: { id: userId, username, email, FtnName: username }, token: 'new-token' });
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
        res.json({ user: { id: user.UserID, username: user.UserName, email: user.Email, FtnName: user.FtnName }, token });
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
