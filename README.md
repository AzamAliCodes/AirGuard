# AirGuard — Environmental Intelligence System

AirGuard is a modern, full-stack Air Quality Monitoring (AQI) dashboard. It provides real-time atmospheric analysis, health advisories, and historical trend tracking.

## 🚀 Quick Start (Demo Mode)

You can run AirGuard immediately **without any database setup**. The system automatically switches to **Demo Mode** if it cannot connect to MySQL.

### 1. Run the Application
```bash
npm start
```
*Note: This starts the backend server which also serves the frontend at http://localhost:3000.*

---

## 🛠️ Full Setup (Persistent Mode)

To enable persistent data storage and real database interactions:

### 1. Start MySQL
Ensure your MySQL server is **RUNNING** (e.g., via XAMPP).

### 2. Initialize Database
Create the schema, tables, and stored procedures:
```bash
node db-init.js
```

### 3. Run the Backend
```bash
npm start
```
*The frontend will be available at http://localhost:3000.*

---

## ✨ Features & UI Updates

- **Real-time Monitoring:** Track PM2.5, PM10, NO2, SO2, CO, and Ozone levels.
- **Enhanced Status Mapping:**
  - 🟢 **Optimal** (AQI 0-50)
  - 🟡 **Moderate** (AQI 51-100)
  - 🟠 **Fair** (AQI > 100)
- **Modular Health Advisories:** Individual glassmorphic cards for Outdoor Activities, Ventilation, and General Advice.
- **Intelligence Alerts:** System-wide notifications for critical pollutant levels.
- **Glassmorphic UI:** A premium, centered layout with a responsive navigation bar and modern aesthetic.
- **Authentication System:** Secure login/signup for personalized location following (functional in both Demo and DB modes).

## 📁 Project Structure

- `server.js`: Express.js backend with MySQL integration and robust Demo Mode fallback.
- `public/`: Frontend assets (Glassmorphic HTML/CSS, Vanilla JS).
- `schema.sql`: Complete database schema (Tables, Views, Triggers, Procedures).
- `db-init.js`: Automated database setup script.

---
*Developed for DBMS Project*
