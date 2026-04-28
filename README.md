# AirGuard - Environmental Intelligence Dashboard

AirGuard is a professional-grade full-stack DBMS project. It features a futuristic **Node.js** web interface and a robust **MySQL** relational backend designed to showcase advanced database concepts.

---

## 🚦 Essential Setup

### 1. Start your MySQL Database Server
Your database **must** be running before the application can connect.

#### Option A: Using GUI (XAMPP / WAMP)
- **XAMPP:** Open **XAMPP Control Panel** and click **Start** on **MySQL**.
- **WAMP:** Click the WAMP icon -> **MySQL** -> **Service Administration** -> **Start Service**.

#### Option B: Using Terminal (Administrator)
```powershell
net start MySQL80
```

> **TIP:** Ensure MySQL is **RUNNING** on port **3306** before starting the app.

---

### 2. Configure Environment (.env)
Create a `.env` file in the root directory:
```env
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_mysql_password
DB_NAME=airguard
PORT=3000
JWT_SECRET=supersecretkey123

# OpenWeatherMap API Key (Get free key at https://openweathermap.org/api)
OWM_API_KEY=your_openweather_api_key_here
```

---

## 🛠 Local Setup & Execution

Open your terminal in the project folder and run:

1. **Install Requirements:** `npm install`
2. **Setup Database:** `node db-init.js` (Automates table creation & data population)
3. **Start Server:** `npm start`

> **View the App:** [http://localhost:3000](http://localhost:3000)

---

## 💻 Tech Stack

- **Frontend:** Vanilla JavaScript (ES6+), CSS3 (Glassmorphism), HTML5
- **Backend:** Node.js, Express.js
- **Database:** MySQL 8.0+
- **API Integration:** OpenWeatherMap Air Pollution API (Real-time data)
- **Security:** JSON Web Tokens (JWT), Bcrypt.js
- **Data Visualization:** Chart.js 4.4

---

## 🛰️ Real-Time Intelligence

AirGuard doesn't just store data; it actively breathes with the world:
- **Automatic Sync:** Every 15 minutes, the backend queries OpenWeatherMap for the latest pollutant concentrations.
- **Precision Tracking:** Monitors PM2.5, PM10, NO2, SO2, CO, and O3.
- **Relational Integrity:** API responses are parsed and mapped to the normalized `READING` table with atomic precision.
- **Manual Override:** Users can trigger a real-time "Sync Now" for their selected city directly from the dashboard.

---

## 💎 Advanced DBMS Features

This project is built to demonstrate intelligence-grade database management:

- **Database Normalization (3NF):** Found in `additions.sql`, featuring a full decomposition demo of `RAW_AIR_DATA`.
- **Transaction Integrity:** Implementation of `COMMIT`, `ROLLBACK`, and `SAVEPOINT` for secure operations.
- **Concurrency Control:** Demonstrations of **Row-level locking** and **Shared locks** to prevent data anomalies.
- **Automated Logic:** Real-time **Triggers**, **Stored Procedures** (with Cursors), and **Complex Views**.

---

## 📂 Project Organization
- `schema.sql`: Core relational structure & diverse sample data.
- `additions.sql`: Normalization, Transactions, and Locking demos.
- `review-guide/`: Detailed technical documentation for DBMS concepts.
- `public/`: Sleek glassmorphism frontend with real-time DB status tracking.

---

## 📊 Smart Dashboard Indicators
The UI automatically tracks your database connection:
- **🟢 DATABASE Badge:** Successfully fetching real atmospheric data from MySQL.
- **🔴 SIMULATED Badge:** Database disconnected; showing randomized sensor data for demo safety.
- **⚠️ Sidebar Status:** Displays troubleshooting steps if the connection fails.
