# AirGuard Database — SQL Line by Line Explanation

---

## Setting Up on Local MySQL

### Step 1 — Install MySQL
- Download from: https://dev.mysql.com/downloads/installer/
- During install, choose **MySQL Server + MySQL Workbench**
- Set a root password and remember it

### Step 2 — Open MySQL Workbench or Command Line
```bash
mysql -u root -p
# then enter your password
```

### Step 3 — Run the Script
In Workbench: `File → Open SQL Script → paste → click ⚡ Execute`

---

## Part 1 — Database Setup

```sql
CREATE DATABASE IF NOT EXISTS airguard;
```
Creates a new database called `airguard`. `IF NOT EXISTS` means it won't throw an error if it already exists.

```sql
USE airguard;
```
Tells MySQL to use this database for all the following commands.

```sql
DROP TABLE IF EXISTS ALERT;
DROP TABLE IF EXISTS RECOMMENDATION;
...
```
Deletes tables if they already exist so you can re-run the script cleanly. The order matters — child tables (with foreign keys) must be dropped **before** parent tables, otherwise MySQL throws a foreign key constraint error.

---

## Part 2 — Table 1: WEATHER_API

```sql
CREATE TABLE WEATHER_API (
    API_ID VARCHAR(36) PRIMARY KEY,
    Name VARCHAR(100) NOT NULL,
    EndpointURL VARCHAR(255) NOT NULL
);
```

| Keyword | Meaning |
|---|---|
| `VARCHAR(36)` | Text up to 36 characters — UUID size |
| `PRIMARY KEY` | Uniquely identifies each row |
| `NOT NULL` | This field cannot be left empty |

```sql
INSERT INTO WEATHER_API VALUES
('api-001', 'OpenAQ Global Network', 'https://api.openaq.org/v2/latest');
```
Inserts one weather API source into the table.

---

## Part 3 — Table 2: LOCATION

```sql
CREATE TABLE LOCATION (
    LocationID VARCHAR(36) PRIMARY KEY,
    Name VARCHAR(100) NOT NULL,
    State VARCHAR(100) NOT NULL,
    Latitude DECIMAL(9,6) NOT NULL,
    Longitude DECIMAL(9,6) NOT NULL,
    API_ID VARCHAR(36),
    FOREIGN KEY (API_ID) REFERENCES WEATHER_API(API_ID)
);
```

| Keyword | Meaning |
|---|---|
| `DECIMAL(9,6)` | Number with 9 digits total, 6 after decimal — for GPS coordinates |
| `FOREIGN KEY ... REFERENCES` | Links this table to WEATHER_API — every API_ID used here must exist in WEATHER_API |

```sql
INSERT INTO LOCATION VALUES
  ('loc-001', 'Chennai', 'Tamil Nadu', 13.08, 80.27, 'api-001'),
  ...
```
Inserts 6 Indian cities with their real GPS coordinates.

---

## Part 4 — Table 3: USER

```sql
CREATE TABLE USER (
    UserID VARCHAR(36) PRIMARY KEY,
    UserName VARCHAR(100) NOT NULL UNIQUE,
    FtnName VARCHAR(100),
    Email VARCHAR(100) UNIQUE NOT NULL,
    Password VARCHAR(255) NOT NULL,
    UpdateRate INT DEFAULT 60
);
```

| Keyword | Meaning |
|---|---|
| `UNIQUE` | No two users can have the same username or email |
| `FtnName` | Full Name — optional field (no NOT NULL) |
| `DEFAULT 60` | If UpdateRate is not given, it automatically becomes 60 (seconds) |

> **Note:** Passwords should use `SHA2()` hashing in production. Plain text is used here only for demo purposes.

---

## Part 5 — Table 4: USER_LOCATION (Junction Table)

```sql
CREATE TABLE USER_LOCATION (
    UserID VARCHAR(36),
    LocationID VARCHAR(36),
    SubscribedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (UserID, LocationID),
    FOREIGN KEY (UserID) REFERENCES USER(UserID),
    FOREIGN KEY (LocationID) REFERENCES LOCATION(LocationID)
);
```

| Keyword | Meaning |
|---|---|
| `PRIMARY KEY (UserID, LocationID)` | Composite primary key — the combination of both columns must be unique |
| `CURRENT_TIMESTAMP` | Automatically saves the current date and time when a row is inserted |

This is a **M:N relationship table** — one user can subscribe to many locations, and one location can have many subscribers.

---

## Part 6 — Table 5: POLLUTANT

```sql
CREATE TABLE POLLUTANT (
    PollutantID VARCHAR(36) PRIMARY KEY,
    Name VARCHAR(100) NOT NULL,
    Unit VARCHAR(20),
    SafeThreshold DECIMAL(10,2)
);
```

- `SafeThreshold` — the maximum safe pollution level for that pollutant, used by the trigger later to decide if an alert should be raised.

```sql
INSERT INTO POLLUTANT VALUES
  ('pol-001', 'PM2.5', 'μg/m³', 35.00),
  ('pol-002', 'PM10',  'μg/m³', 75.00),
  ...
```
Inserts 6 real pollutants with WHO-based safe threshold limits.

---

## Part 7 — Table 6: READING

```sql
CREATE TABLE READING (
    ReadingID VARCHAR(36) PRIMARY KEY,
    Time DATETIME DEFAULT CURRENT_TIMESTAMP,
    Value DECIMAL(10,2) NOT NULL,
    LocationID VARCHAR(36),
    PollutantID VARCHAR(36),
    FOREIGN KEY (LocationID) REFERENCES LOCATION(LocationID),
    FOREIGN KEY (PollutantID) REFERENCES POLLUTANT(PollutantID),
    UNIQUE (LocationID, PollutantID, Time)
);
```

| Keyword | Meaning |
|---|---|
| `Value` | The actual pollutant concentration measured by the sensor |
| `UNIQUE (LocationID, PollutantID, Time)` | Prevents duplicate readings for the same pollutant at the same location at the same time |

---

## Part 8 — Table 7: RECOMMENDATION

```sql
CREATE TABLE RECOMMENDATION (
    RecID VARCHAR(36) PRIMARY KEY,
    Name VARCHAR(100) NOT NULL,
    Description TEXT,
    Category VARCHAR(50),
    PollutantID VARCHAR(36),
    FOREIGN KEY (PollutantID) REFERENCES POLLUTANT(PollutantID)
);
```

| Keyword | Meaning |
|---|---|
| `TEXT` | For long descriptions — no character limit like VARCHAR |
| `Category` | Air quality level — 'Optimal', 'Fair', 'Moderate', 'Poor' |

---

## Part 9 — Table 8: ALERT

```sql
CREATE TABLE ALERT (
    AlertID VARCHAR(36) PRIMARY KEY,
    SensorId VARCHAR(100),
    CreatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    PollutantID VARCHAR(36),
    UserID VARCHAR(36),
    RecID VARCHAR(36),
    LocationID VARCHAR(36),
    FOREIGN KEY (PollutantID) REFERENCES POLLUTANT(PollutantID),
    FOREIGN KEY (UserID) REFERENCES USER(UserID),
    FOREIGN KEY (RecID) REFERENCES RECOMMENDATION(RecID),
    FOREIGN KEY (LocationID) REFERENCES LOCATION(LocationID)
);
```

This is the most connected table — it has **4 foreign keys** linking to Pollutant, User, Recommendation, and Location.

---

## Part 10 — View 1: Live Air Quality Status

```sql
CREATE OR REPLACE VIEW View_Live_Air_Quality_Status AS
SELECT
    LOCATION.Name AS City_Name,
    POLLUTANT.Name AS Pollutant_Name,
    READING.Value AS Reading_Value,
    READING.Time AS Last_Updated
FROM READING
JOIN LOCATION ON READING.LocationID = LOCATION.LocationID
JOIN POLLUTANT ON READING.PollutantID = POLLUTANT.PollutantID
WHERE READING.Time = (
    SELECT MAX(Time)
    FROM READING AS Internal_Table
    WHERE Internal_Table.LocationID = READING.LocationID
    AND Internal_Table.PollutantID = READING.PollutantID
);
```

| Part | Meaning |
|---|---|
| `CREATE OR REPLACE VIEW` | Creates a virtual table you can query like a real table |
| `JOIN LOCATION` | Connects READING with LOCATION using LocationID |
| `JOIN POLLUTANT` | Connects READING with POLLUTANT using PollutantID |
| `WHERE READING.Time = (SELECT MAX...)` | Correlated subquery — for each row, checks if this is the most recent reading for that location + pollutant combo |
| `Internal_Table` | Alias for the inner READING table to avoid confusion with the outer one |

---

## Part 11 — View 2: City Pollution Averages

```sql
CREATE OR REPLACE VIEW View_City_Pollution_Averages AS
SELECT
    LOCATION.Name AS City_Name,
    POLLUTANT.Name AS Pollutant_Name,
    AVG(READING.Value) AS Average_Pollution_Level,
    COUNT(READING.ReadingID) AS Total_Readings_Collected
FROM READING
JOIN LOCATION ON READING.LocationID = LOCATION.LocationID
JOIN POLLUTANT ON READING.PollutantID = POLLUTANT.PollutantID
GROUP BY LOCATION.Name, POLLUTANT.Name
HAVING Average_Pollution_Level > 0;
```

| Part | Meaning |
|---|---|
| `AVG()` | Calculates average pollution value |
| `COUNT()` | Counts how many readings were taken |
| `GROUP BY` | Groups results by city + pollutant combination |
| `HAVING` | Filters groups after grouping (like WHERE but for aggregated results) — keeps only non-zero averages |

---

## Part 12 — View 3: Emergency Monitoring Zone

```sql
CREATE OR REPLACE VIEW View_Emergency_Monitoring_Zone AS
SELECT DISTINCT LOCATION.Name AS City_Name, 'DANGER_LEVEL_HIGH' as Monitoring_Priority
FROM LOCATION
JOIN READING ON LOCATION.LocationID = READING.LocationID
WHERE READING.Value > 100
UNION
SELECT DISTINCT LOCATION.Name AS City_Name, 'RECENTLY_CHECKED' as Monitoring_Priority
FROM LOCATION
JOIN READING ON LOCATION.LocationID = READING.LocationID
WHERE READING.Time > DATE_SUB(NOW(), INTERVAL 1 DAY);
```

| Part | Meaning |
|---|---|
| First `SELECT` | Finds cities where any reading exceeded 100 (danger zone) |
| `UNION` | Combines results of two SELECT statements and removes duplicates |
| Second `SELECT` | Finds cities that had readings in the last 24 hours |
| `DATE_SUB(NOW(), INTERVAL 1 DAY)` | Subtracts 1 day from the current timestamp |

---

## Part 13 — Stored Procedure with Cursor & Exception Handling

```sql
CREATE PROCEDURE Procedure_Generate_City_Health_Report(IN Target_City_ID VARCHAR(36))
```
- `IN` — input parameter, you pass a city ID when calling the procedure

```sql
DECLARE Is_Finished INT DEFAULT FALSE;
DECLARE Current_Pollutant_Name VARCHAR(100);
DECLARE Calculated_Average DECIMAL(10,2);
```
- `DECLARE` — creates local variables that exist only inside the procedure

```sql
DECLARE Data_Cursor CURSOR FOR
    SELECT POLLUTANT.Name, AVG(READING.Value)
    FROM READING
    JOIN POLLUTANT ON READING.PollutantID = POLLUTANT.PollutantID
    WHERE READING.LocationID = Target_City_ID
    GROUP BY POLLUTANT.Name;
```
- `CURSOR` — a pointer that goes through query results one row at a time
- This cursor fetches average pollution per pollutant for the given city

```sql
DECLARE CONTINUE HANDLER FOR NOT FOUND SET Is_Finished = TRUE;
```
- **Exception handler** — when the cursor runs out of rows, it sets `Is_Finished = TRUE` instead of crashing the procedure

```sql
OPEN Data_Cursor;
Report_Loop: LOOP
    FETCH Data_Cursor INTO Current_Pollutant_Name, Calculated_Average;
    IF Is_Finished THEN
        LEAVE Report_Loop;
    END IF;
    SELECT Current_Pollutant_Name AS Pollutant, Calculated_Average AS City_Average;
END LOOP;
CLOSE Data_Cursor;
```

| Part | Meaning |
|---|---|
| `OPEN` | Starts the cursor |
| `FETCH ... INTO` | Gets the next row and stores values into the declared variables |
| `IF Is_Finished` | Exits the loop when there are no more rows |
| `SELECT` inside loop | Prints each pollutant's average as output |
| `CLOSE` | Releases the cursor from memory |

**To call the procedure:**
```sql
CALL Procedure_Generate_City_Health_Report('loc-001');
```

---

## Part 14 — Trigger: Automatic Emergency Alert

```sql
CREATE TRIGGER Trigger_Check_Pollution_And_Alert
AFTER INSERT ON READING
FOR EACH ROW
```

| Part | Meaning |
|---|---|
| `AFTER INSERT` | Fires automatically after every new row is added to READING |
| `FOR EACH ROW` | Runs once per inserted row |

```sql
SELECT SafeThreshold INTO Pollutant_Safe_Limit
FROM POLLUTANT WHERE PollutantID = NEW.PollutantID;
```
- `NEW.PollutantID` — refers to the newly inserted row's PollutantID
- `INTO` — stores the query result directly into the local variable

```sql
IF NEW.Value > Pollutant_Safe_Limit THEN
    SELECT RecID INTO Suggested_Health_Rec_ID
    FROM RECOMMENDATION WHERE PollutantID = NEW.PollutantID LIMIT 1;

    INSERT INTO ALERT (AlertID, PollutantID, UserID, RecID, LocationID, CreatedAt)
    SELECT UUID(), NEW.PollutantID, UserID, Suggested_Health_Rec_ID, NEW.LocationID, NOW()
    FROM USER_LOCATION
    WHERE LocationID = NEW.LocationID;
END IF;
```

| Part | Meaning |
|---|---|
| `IF NEW.Value > Pollutant_Safe_Limit` | Checks if the new reading exceeds the safe threshold |
| `LIMIT 1` | Picks the first matching recommendation |
| `SELECT ... FROM USER_LOCATION WHERE LocationID = NEW.LocationID` | Finds ALL users subscribed to the affected location |
| Final `INSERT` | Automatically creates one alert per subscribed user — no manual action needed |

---

## Testing on Local System

```sql
-- Check all tables were created:
SHOW TABLES;

-- See data in any table:
SELECT * FROM USER;
SELECT * FROM LOCATION;
SELECT * FROM READING;

-- Test the views:
SELECT * FROM View_Live_Air_Quality_Status;
SELECT * FROM View_City_Pollution_Averages;
SELECT * FROM View_Emergency_Monitoring_Zone;

-- Test the stored procedure:
CALL Procedure_Generate_City_Health_Report('loc-001');

-- Test the trigger (insert a dangerously high reading):
INSERT INTO READING (ReadingID, Value, LocationID, PollutantID)
VALUES (UUID(), 999.99, 'loc-001', 'pol-001');

-- Check if trigger auto-created alerts:
SELECT * FROM ALERT ORDER BY CreatedAt DESC;
```

---

*AirGuard — 21CSC205P Database Management Systems | Review 2*
