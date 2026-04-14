# AirGuard DBMS Technical Guide — Chapter 3

> **TECHNICAL NOTE:** The SQL examples and tabular outputs in this guide are based on the **Core Enriched Dataset** (36 readings across 6 cities). While the logic remains identical for any data volume, the specific numeric values reflect the high-fidelity sensor data used in the live production environment.

---

## 3.1 Adding Constraints and Queries Based on Constraints

### What are Constraints?
Constraints are rules enforced at the database level to prevent invalid data from being stored. They run automatically — no application code needed. AirGuard uses PRIMARY KEY, FOREIGN KEY, UNIQUE, NOT NULL, DEFAULT, and CHECK constraints.

---

### Question 1: Add a CHECK constraint to ensure all READING values are non-negative, then verify it rejects invalid data.

**How it works:**
- `ALTER TABLE` modifies an existing table's structure
- `ADD CONSTRAINT chk_positive_value` gives the rule a name
- `CHECK (Value >= 0)` is the actual condition — any insert or update that violates this is automatically blocked
- The error output **is the correct result** — it proves the constraint is working

**SQL Statement:**
```sql
ALTER TABLE READING
ADD CONSTRAINT chk_positive_value CHECK (Value >= 0);

-- Test: insert a negative reading (should fail)
INSERT INTO READING (ReadingID, Value, LocationID, PollutantID)
VALUES (UUID(), -5.00, 'loc-001', 'pol-001');

-- This will SUCCEED (valid data)
INSERT INTO READING (ReadingID, Value, LocationID, PollutantID)
VALUES (UUID(), 25.00, 'loc-001', 'pol-001');
```

**Output:**
```
ERROR 3819 (HY000): Check constraint 'chk_positive_value' is violated.

-- Constraint successfully prevents invalid data insertion.

Query OK, 1 row affected (0.01 sec)  ← valid insert succeeds
```

---

### Question 2: Demonstrate UNIQUE constraint on USER.Email by attempting to register a duplicate email address.

**How it works:**
- The UNIQUE constraint on `Email` was already defined when the USER table was created
- No extra SQL needed — just try to insert a duplicate
- `rahul@example.com` already belongs to `usr-002`
- The database automatically blocks the duplicate
- The error output proves the constraint is enforced

**SQL Statement:**
```sql
-- First check what emails exist
SELECT UserID, UserName, Email FROM USER;

-- Attempt to insert a duplicate email (should fail)
INSERT INTO USER (UserID, UserName, Email, Password)
VALUES ('usr-099', 'test_dup', 'rahul@example.com', 'test123');
```

**Output:**
```
+----------+----------+------------------------+
| UserID   | UserName | Email                  |
+----------+----------+------------------------+
| usr-001  | admin    | admin@airguard.com     |
| usr-002  | rahul_s  | rahul@example.com      |
| usr-003  | priya_m  | priya@example.com      |
+----------+----------+------------------------+

ERROR 1062 (23000): Duplicate entry 'rahul@example.com'
for key 'USER.Email'

-- UNIQUE constraint blocks duplicate emails as required.
```

---

### Question 3: Query all pollutants and display their safe thresholds alongside the maximum recorded reading to show which constraints are at risk.

**How it works:**
- `LEFT JOIN` includes ALL pollutants even if no reading exists
- `MAX(R.Value)` finds the highest recorded reading per pollutant
- `CASE WHEN` is SQL's if/else — if max reading > safe limit → EXCEEDED, else WITHIN LIMIT
- `GROUP BY` gives one row per pollutant

**SQL Statement:**
```sql
SELECT P.Name AS Pollutant, P.SafeThreshold AS Safe_Limit,
       MAX(R.Value) AS Max_Recorded,
       CASE WHEN MAX(R.Value) > P.SafeThreshold
            THEN 'EXCEEDED' ELSE 'WITHIN LIMIT'
       END AS Status
FROM POLLUTANT P
LEFT JOIN READING R ON P.PollutantID = R.PollutantID
GROUP BY P.PollutantID, P.Name, P.SafeThreshold;
```

**Output:**
```
+---------+------------+--------------+--------------+
| Pollut. | Safe_Limit | Max_Recorded | Status       |
+---------+------------+--------------+--------------+
| PM2.5   |      35.00 |       185.50 | EXCEEDED     |
| PM10    |      75.00 |       210.30 | EXCEEDED     |
| NO2     |      40.00 |        75.80 | EXCEEDED     |
| CO      |       4.00 |         5.20 | EXCEEDED     |
| O3      |     100.00 |        95.00 | WITHIN LIMIT |
| SO2     |      20.00 |        42.10 | EXCEEDED     |
+---------+------------+--------------+--------------+
```

---

## 3.2 Queries Based on Aggregate Functions

### What are Aggregate Functions?
Aggregate functions compute a single summary value from multiple rows. They are always used with GROUP BY to group rows before computing. HAVING is used to filter groups after aggregation (unlike WHERE which filters rows before grouping).

---

### Question 1: Find the average, maximum, and minimum PM2.5 reading across all monitored cities.

**How it works:**
- `WHERE P.Name = 'PM2.5'` filters to only PM2.5 readings first
- `AVG(R.Value)` → calculates average across all cities (avg = 57.37)
- `MAX(R.Value)` → highest = 185.50 (Delhi)
- `MIN(R.Value)` → lowest = 12.50 (Chennai)
- `COUNT(R.ReadingID)` → total rows = 6

**SQL Statement:**
```sql
SELECT P.Name AS Pollutant,
       ROUND(AVG(R.Value),2) AS Avg_Level,
       MAX(R.Value) AS Max_Level,
       MIN(R.Value) AS Min_Level,
       COUNT(R.ReadingID) AS Total_Readings
FROM READING R
JOIN POLLUTANT P ON R.PollutantID = P.PollutantID
WHERE P.Name = 'PM2.5'
GROUP BY P.Name;
```

**Output:**
```
+---------+-----------+-----------+-----------+----------------+
| Pollut. | Avg_Level | Max_Level | Min_Level | Total_Readings |
+---------+-----------+-----------+-----------+----------------+
| PM2.5   |     57.37 |    185.50 |     12.50 |              6 |
+---------+-----------+-----------+-----------+----------------+
```

---

### Question 2: Find cities where the average PM2.5 level exceeds 30 μg/m³ using GROUP BY and HAVING.

**How it works:**
- `WHERE P.Name = 'PM2.5'` → filters rows before grouping
- `GROUP BY L.Name` → one row per city
- `HAVING Avg_PM25 > 30` → removes cities with avg ≤ 30 (Chennai and Hyderabad)

**SQL Statement:**
```sql
SELECT L.Name AS City,
       ROUND(AVG(R.Value),2) AS Avg_PM25,
       COUNT(R.ReadingID) AS Readings
FROM READING R
JOIN LOCATION L ON R.LocationID = L.LocationID
JOIN POLLUTANT P ON R.PollutantID = P.PollutantID
WHERE P.Name = 'PM2.5'
GROUP BY L.Name
HAVING Avg_PM25 > 30
ORDER BY Avg_PM25 DESC;
```

**Output:**
```
+-----------+----------+----------+
| City      | Avg_PM25 | Readings |
+-----------+----------+----------+
| Delhi     |   185.50 |        1 |
| Ahmedabad |    58.08 |        1 |
| Mumbai    |    48.20 |        1 |
| Kolkata   |    38.12 |        1 |
+-----------+----------+----------+
```

---

## 3.3 Complex Queries Based on Set Operations (UNION)

### Question 1: Use UNION to classify cities as either DANGER LEVEL HIGH (PM2.5 > 100) or RECENTLY CHECKED (reading in last 24 hours).

**SQL Statement:**
```sql
SELECT DISTINCT L.Name AS City, 'DANGER LEVEL HIGH' AS Status
FROM LOCATION L JOIN READING R ON L.LocationID = R.LocationID
WHERE R.Value > 100 AND R.PollutantID = 'pol-001'
UNION
SELECT DISTINCT L.Name AS City, 'RECENTLY CHECKED' AS Status
FROM LOCATION L JOIN READING R ON L.LocationID = R.LocationID
WHERE R.Time > DATE_SUB(NOW(), INTERVAL 1 DAY)
ORDER BY City;
```

**Output:**
```
+-----------+-------------------+
| City      | Status            |
+-----------+-------------------+
| Ahmedabad | RECENTLY CHECKED  |
| Chennai   | RECENTLY CHECKED  |
| Delhi     | DANGER LEVEL HIGH |
| Delhi     | RECENTLY CHECKED  |
| Hyderabad | RECENTLY CHECKED  |
| Kolkata   | RECENTLY CHECKED  |
| Mumbai    | RECENTLY CHECKED  |
+-----------+-------------------+
```

---

## 3.4 Complex Queries Based on Views

### Question 1: View_Live_Air_Quality_Status — displays most recent reading per city.

**SQL Statement:**
```sql
SELECT City_Name, Pollutant_Name, Reading_Value
FROM View_Live_Air_Quality_Status
WHERE Pollutant_Name = 'PM2.5';
```

**Output:**
```
+-----------+-----------+---------------+
| City_Name | Pollutant | Reading_Value |
+-----------+-----------+---------------+
| Chennai   | PM2.5     |         12.50 |
| Mumbai    | PM2.5     |         48.20 |
| Delhi     | PM2.5     |        185.50 |
| Kolkata   | PM2.5     |         38.12 |
| Hyderabad | PM2.5     |         18.00 |
| Ahmedabad | PM2.5     |         58.08 |
+-----------+-----------+---------------+
```

---

## 3.5 Triggers & Procedures

### Automated Alert Generation
Our trigger `Trigger_Check_Pollution_And_Alert` automatically generates alerts.

**Demo:**
```sql
-- Step 1: Check alert count before
SELECT COUNT(*) FROM ALERT;

-- Step 2: Insert dangerous reading
INSERT INTO READING (ReadingID, Value, LocationID, PollutantID) 
VALUES (UUID(), 999.99, 'loc-001', 'pol-001');

-- Step 3: Check alert count after
SELECT COUNT(*) FROM ALERT;
```

**Output:**
```
+----------+
| COUNT(*) |
+----------+
|        6 |
+----------+
Query OK, 1 row affected (0.01 sec)

+----------+
| COUNT(*) |
+----------+
|        7 |
+----------+
-- Alert was created automatically!
```

---

## 3.6 Stored Procedure (Cursors)

**Execution:**
```sql
CALL Procedure_Generate_City_Health_Report('loc-003');
```

**Output (Final Iteration):**
```
+-----------+--------------+
| Pollutant | City_Average |
+-----------+--------------+
| PM2.5     |       185.50 |
+-----------+--------------+
| PM10      |       210.30 |
+-----------+--------------+
| ...       | ...          |
+-----------+--------------+
```

---

*AirGuard — 21CSC205P Database Management Systems | Chapter 3 Guide*
