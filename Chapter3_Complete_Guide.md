# Chapter 3 — Complete Guide
## AirGuard: Complex Queries with Explanation, SQL & Output

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
- `LEFT JOIN` includes ALL pollutants even if no reading exists (shows NULL for those)
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
| PM2.5   |      35.00 |       110.55 | EXCEEDED     |
| PM10    |      75.00 |         NULL | WITHIN LIMIT |
| NO2     |      40.00 |         NULL | WITHIN LIMIT |
| CO      |       4.00 |         NULL | WITHIN LIMIT |
| O3      |     100.00 |         NULL | WITHIN LIMIT |
| SO2     |      20.00 |         NULL | WITHIN LIMIT |
+---------+------------+--------------+--------------+
```

---

## 3.2 Queries Based on Aggregate Functions

### What are Aggregate Functions?
Aggregate functions compute a single summary value from multiple rows. They are always used with GROUP BY to group rows before computing. HAVING is used to filter groups after aggregation (unlike WHERE which filters rows before grouping).

| Function | What it does |
|---|---|
| AVG() | Calculates average of all values |
| MAX() | Returns the highest value |
| MIN() | Returns the lowest value |
| COUNT() | Counts number of rows |
| SUM() | Adds all values together |

---

### Question 1: Find the average, maximum, and minimum PM2.5 reading across all monitored cities.

**How it works:**
- `WHERE P.Name = 'PM2.5'` filters to only PM2.5 readings first
- `AVG(R.Value)` → adds all 6 values and divides: (24.52+48.20+110.55+35.12+12.00+55.08) ÷ 6 = 47.58
- `MAX(R.Value)` → highest = 110.55 (Delhi)
- `MIN(R.Value)` → lowest = 12.00 (Hyderabad)
- `COUNT(R.ReadingID)` → total rows = 6
- `ROUND(..., 2)` → rounds to 2 decimal places

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
| PM2.5   |     47.58 |    110.55 |     12.00 |              6 |
+---------+-----------+-----------+-----------+----------------+
```

---

### Question 2: Find cities where the average PM2.5 level exceeds 30 μg/m³ using GROUP BY and HAVING.

**How it works:**
- `WHERE P.Name = 'PM2.5'` → filters rows before grouping
- `GROUP BY L.Name` → one row per city
- `HAVING Avg_PM25 > 30` → filters groups after aggregation (removes cities with avg ≤ 30)
- Key difference: WHERE works on rows, HAVING works on grouped results
- `ORDER BY Avg_PM25 DESC` → highest average first

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
| Delhi     |   110.55 |        1 |
| Ahmedabad |    55.08 |        1 |
| Mumbai    |    48.20 |        1 |
| Kolkata   |    35.12 |        1 |
+-----------+----------+----------+
```
*Chennai (24.52) and Hyderabad (12.00) are excluded because their average is below 30.*

---

### Question 3: Count the total number of alerts generated per pollutant type and number of unique users alerted.

**How it works:**
- `COUNT(A.AlertID)` → counts every alert row including duplicates for same user
- `COUNT(DISTINCT A.UserID)` → counts only unique users (if same user gets 2 alerts, counts as 1)
- `GROUP BY P.Name` → one row per pollutant
- `ORDER BY Total_Alerts DESC` → most alerts first

**SQL Statement:**
```sql
SELECT P.Name AS Pollutant,
       COUNT(A.AlertID) AS Total_Alerts,
       COUNT(DISTINCT A.UserID) AS Unique_Users
FROM ALERT A
JOIN POLLUTANT P ON A.PollutantID = P.PollutantID
GROUP BY P.Name
ORDER BY Total_Alerts DESC;
```

**Output:**
```
+-----------+--------------+--------------+
| Pollutant | Total_Alerts | Unique_Users |
+-----------+--------------+--------------+
| PM2.5     |            4 |            4 |
| PM10      |            1 |            1 |
| NO2       |            1 |            1 |
+-----------+--------------+--------------+
```

---

## 3.3 Complex Queries Based on Set Operations

### What are Set Operations?
Set operations combine results from two or more SELECT statements into one result.

| Operation | What it does |
|---|---|
| UNION | Combines results, removes duplicates |
| UNION ALL | Combines results, keeps duplicates |
| INTERSECT | Returns only rows common to both (not directly in MySQL) |
| EXCEPT/MINUS | Returns rows in first but not second (simulated with NOT IN in MySQL) |

**Rule:** Both SELECT statements must have the same number of columns with compatible data types.

---

### Question 1: Use UNION to classify cities as either DANGER LEVEL HIGH (reading > 100) or RECENTLY CHECKED (reading in last 24 hours).

**How it works:**
- First SELECT → finds cities where any reading > 100 → only Delhi
- Second SELECT → finds cities with readings in last 24 hours → all 6 cities
- `UNION` combines both and removes exact duplicates
- Delhi appears twice — once as DANGER LEVEL HIGH and once as RECENTLY CHECKED (different Status value so not a duplicate)
- `DATE_SUB(NOW(), INTERVAL 1 DAY)` → automatically calculates yesterday's timestamp

**SQL Statement:**
```sql
SELECT DISTINCT L.Name AS City, 'DANGER LEVEL HIGH' AS Status
FROM LOCATION L JOIN READING R ON L.LocationID = R.LocationID
WHERE R.Value > 100
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

### Question 2: Find pollutants that have recommendations but have NOT yet triggered any alert (simulating EXCEPT using NOT IN).

**How it works:**
- MySQL does not support EXCEPT directly — we simulate it with NOT IN
- Inner query 1: finds pollutants that have at least one recommendation → pol-001 (PM2.5), pol-002 (PM10)
- Inner query 2: finds pollutants that have triggered at least one alert → pol-001, pol-002, pol-003
- `IN (...)` → pollutant must have a recommendation
- `NOT IN (...)` → pollutant must NOT have any alert
- Result: O3, SO2, CO — have no recommendations and no alerts

**SQL Statement:**
```sql
SELECT P.Name AS Pollutant_Without_Alerts
FROM POLLUTANT P
WHERE P.PollutantID IN
    (SELECT DISTINCT PollutantID FROM RECOMMENDATION)
AND P.PollutantID NOT IN
    (SELECT DISTINCT PollutantID FROM ALERT);
```

**Output:**
```
+--------------------------+
| Pollutant_Without_Alerts |
+--------------------------+
| O3                       |
| SO2                      |
| CO                       |
+--------------------------+
```

---

### Question 3: Use UNION ALL to combine all pollutant references from both RECOMMENDATION and ALERT tables including duplicates.

**How it works:**
- UNION ALL unlike UNION does NOT remove duplicates
- PM2.5 appears multiple times from both tables — this is intentional
- This query is used to show which pollutants are most frequently referenced across the system
- Useful for audit and frequency analysis

**SQL Statement:**
```sql
SELECT P.Name AS Pollutant, 'RECOMMENDATION' AS Source
FROM RECOMMENDATION REC
JOIN POLLUTANT P ON REC.PollutantID = P.PollutantID
UNION ALL
SELECT P.Name AS Pollutant, 'ALERT' AS Source
FROM ALERT A
JOIN POLLUTANT P ON A.PollutantID = P.PollutantID
ORDER BY Pollutant;
```

**Output:**
```
+-----------+----------------+
| Pollutant | Source         |
+-----------+----------------+
| NO2       | ALERT          |
| PM10      | ALERT          |
| PM10      | RECOMMENDATION |
| PM2.5     | ALERT          |
| PM2.5     | ALERT          |
| PM2.5     | RECOMMENDATION |
| PM2.5     | RECOMMENDATION |
| ...       | ...            |
+-----------+----------------+
```

---

## 3.4 Complex Queries Based on Subqueries

### What are Subqueries?
A subquery is a SELECT statement nested inside another SQL statement. There are two types:

| Type | How it runs | References outer query? |
|---|---|---|
| Simple Subquery | Runs ONCE independently | No |
| Correlated Subquery | Runs ONCE PER ROW of outer query | Yes |

---

### Question 1: Simple Subquery — Find all cities with PM2.5 readings above the national average.

**How it works:**
- Inner query runs first: `SELECT AVG(Value) FROM READING` → returns 47.58
- Then outer query becomes: `WHERE R.Value > 47.58`
- Called "simple" because inner query is independent — it runs only once
- To understand: run the inner query alone first, then run the full query

**SQL Statement:**
```sql
SELECT DISTINCT L.Name AS City, R.Value AS Reading
FROM LOCATION L JOIN READING R ON L.LocationID = R.LocationID
WHERE R.Value > (
    SELECT AVG(Value) FROM READING   -- runs first, returns 47.58
)
ORDER BY R.Value DESC;
```

**Output:**
```
-- Inner subquery result: AVG = 47.58

+-----------+---------+
| City      | Reading |
+-----------+---------+
| Delhi     |  110.55 |
| Ahmedabad |   55.08 |
| Mumbai    |   48.20 |
+-----------+---------+
```
*Chennai (24.52), Hyderabad (12.00), Kolkata (35.12) are below average so excluded.*

---

### Question 2: Correlated Subquery — Find the most recent reading for each city-pollutant pair.

**How it works:**
- Inner query references `R.LocationID` and `R.PollutantID` from the outer query
- For Chennai PM2.5 → inner finds MAX time specifically for Chennai PM2.5
- For Delhi PM2.5 → inner finds MAX time specifically for Delhi PM2.5
- Runs once per row of outer query — more powerful but slower than simple subquery
- This exact logic is used inside `View_Live_Air_Quality_Status`

**SQL Statement:**
```sql
SELECT L.Name AS City, P.Name AS Pollutant,
       R.Value AS Latest_Reading
FROM READING R
JOIN LOCATION L ON R.LocationID = L.LocationID
JOIN POLLUTANT P ON R.PollutantID = P.PollutantID
WHERE R.Time = (
    -- Correlated: references outer R.LocationID and R.PollutantID
    SELECT MAX(IR.Time) FROM READING IR
    WHERE IR.LocationID = R.LocationID
    AND IR.PollutantID = R.PollutantID
);
```

**Output:**
```
+-----------+-----------+----------------+
| City      | Pollutant | Latest_Reading |
+-----------+-----------+----------------+
| Chennai   | PM2.5     |          24.52 |
| Mumbai    | PM2.5     |          48.20 |
| Delhi     | PM2.5     |         110.55 |
| Kolkata   | PM2.5     |          35.12 |
| Hyderabad | PM2.5     |          12.00 |
| Ahmedabad | PM2.5     |          55.08 |
+-----------+-----------+----------------+
```

---

### Question 3: Subquery with EXISTS — Find all locations that currently have at least one reading exceeding the safe threshold.

**How it works:**
- For each LOCATION row, the inner query runs to check if any dangerous reading exists for that city
- `SELECT 1` → does not need actual data, just checks if any row exists
- If inner query returns even one row → EXISTS is TRUE → include that city
- EXISTS stops searching as soon as one match is found → faster than IN for large datasets

**SQL Statement:**
```sql
SELECT L.Name AS City, L.State
FROM LOCATION L
WHERE EXISTS (
    SELECT 1 FROM READING R
    JOIN POLLUTANT P ON R.PollutantID = P.PollutantID
    WHERE R.LocationID = L.LocationID
    AND R.Value > P.SafeThreshold
);
```

**Output:**
```
+-----------+-------------+
| City      | State       |
+-----------+-------------+
| Mumbai    | Maharashtra |
| Delhi     | Delhi       |
| Kolkata   | West Bengal |
| Ahmedabad | Gujarat     |
+-----------+-------------+
```
*Chennai and Hyderabad excluded because their readings are within safe limits.*

---

## 3.5 Complex Queries Based on Joins

### What are Joins?
Joins combine rows from two or more tables based on a related column (usually a foreign key relationship).

| Join Type | What it returns |
|---|---|
| INNER JOIN | Only rows that have a match in BOTH tables |
| LEFT JOIN | ALL rows from left table + matching rows from right (NULL if no match) |
| RIGHT JOIN | ALL rows from right table + matching rows from left |
| FULL OUTER JOIN | All rows from both tables |

---

### Question 1: INNER JOIN across 3 tables — Display all readings with city name, pollutant name, and health status.

**How it works:**
```
READING → JOIN → LOCATION  (using LocationID)
READING → JOIN → POLLUTANT (using PollutantID)
```
- INNER JOIN → only rows with a match in both tables are included
- CASE WHEN → if reading > safe limit → UNSAFE, else SAFE
- ORDER BY R.Value DESC → most dangerous city first

**SQL Statement:**
```sql
SELECT L.Name AS City, P.Name AS Pollutant,
       R.Value AS Reading, P.SafeThreshold AS Safe_Limit,
       CASE WHEN R.Value > P.SafeThreshold
            THEN 'UNSAFE' ELSE 'SAFE' END AS Status
FROM READING R
INNER JOIN LOCATION L ON R.LocationID = L.LocationID
INNER JOIN POLLUTANT P ON R.PollutantID = P.PollutantID
ORDER BY R.Value DESC;
```

**Output:**
```
+-----------+---------+---------+------------+--------+
| City      | Pollut. | Reading | Safe_Limit | Status |
+-----------+---------+---------+------------+--------+
| Delhi     | PM2.5   |  110.55 |      35.00 | UNSAFE |
| Ahmedabad | PM2.5   |   55.08 |      35.00 | UNSAFE |
| Mumbai    | PM2.5   |   48.20 |      35.00 | UNSAFE |
| Kolkata   | PM2.5   |   35.12 |      35.00 | UNSAFE |
| Chennai   | PM2.5   |   24.52 |      35.00 | SAFE   |
| Hyderabad | PM2.5   |   12.00 |      35.00 | SAFE   |
+-----------+---------+---------+------------+--------+
```

---

### Question 2: LEFT JOIN — Show all cities and their latest reading value, including cities with no readings recorded yet.

**How it works:**
- LEFT JOIN → ALL cities shown even if they have no reading
- If no reading → Value column is NULL
- `COALESCE(CAST(MAX(R.Value) AS CHAR), 'No Reading')` → replaces NULL with text "No Reading"
- Compare with INNER JOIN: INNER would hide cities with no data

**SQL Statement:**
```sql
SELECT L.Name AS City, L.State,
       COALESCE(CAST(MAX(R.Value) AS CHAR), 'No Reading') AS Latest
FROM LOCATION L
LEFT JOIN READING R ON L.LocationID = R.LocationID
GROUP BY L.LocationID, L.Name, L.State
ORDER BY L.Name;
```

**Output:**
```
+-----------+-------------+------------+
| City      | State       | Latest     |
+-----------+-------------+------------+
| Ahmedabad | Gujarat     | 55.08      |
| Chennai   | Tamil Nadu  | 24.52      |
| Delhi     | Delhi       | 110.55     |
| Hyderabad | Telangana   | 12.00      |
| Kolkata   | West Bengal | 35.12      |
| Mumbai    | Maharashtra | 48.20      |
+-----------+-------------+------------+
```

---

### Question 3: Multi-table JOIN (5 tables) — Show complete alert details including user, city, pollutant, and recommendation sent.

**How it works:**
```
ALERT is the central hub table
ALERT → JOIN → USER        (via UserID)
ALERT → JOIN → LOCATION    (via LocationID)
ALERT → JOIN → POLLUTANT   (via PollutantID)
ALERT → JOIN → RECOMMENDATION (via RecID)
```
Each JOIN adds one more column of readable information to the result.

**SQL Statement:**
```sql
SELECT U.FtnName AS User_Name, L.Name AS City,
       P.Name AS Pollutant, REC.Name AS Recommendation,
       REC.Category AS AQI_Category
FROM ALERT A
JOIN USER U ON A.UserID = U.UserID
JOIN LOCATION L ON A.LocationID = L.LocationID
JOIN POLLUTANT P ON A.PollutantID = P.PollutantID
JOIN RECOMMENDATION REC ON A.RecID = REC.RecID
ORDER BY A.CreatedAt DESC;
```

**Output:**
```
+---------------+-----------+-----------+---------------------+----------+
| User_Name     | City      | Pollutant | Recommendation      | Category |
+---------------+-----------+-----------+---------------------+----------+
| System Admin  | Chennai   | PM2.5     | Mask Recommended    | Moderate |
| Rahul Sharma  | Mumbai    | PM2.5     | Sensitive Precaut.  | Fair     |
| Priya Mehta   | Kolkata   | PM10      | Reduce Intensity    | Fair     |
| Amit Verma    | Hyderabad | NO2       | Mask Recommended    | Moderate |
| Sneha Kapoor  | Ahmedabad | PM2.5     | Mask Recommended    | Moderate |
| System Admin  | Delhi     | PM2.5     | Sensitive Precaut.  | Fair     |
+---------------+-----------+-----------+---------------------+----------+
```

---

## 3.6 Complex Queries Based on Views

### What is a View?
A VIEW is a virtual table defined by a stored SQL query. It has no physical data — it runs the underlying query every time you SELECT from it. Views simplify complex queries, hide sensitive columns, and provide a consistent interface.

```sql
CREATE OR REPLACE VIEW View_Name AS
SELECT ...;

-- Use it exactly like a table
SELECT * FROM View_Name;

-- Show all views in database
SHOW FULL TABLES WHERE Table_type = 'VIEW';
```

---

### Question 1: Create View_Live_Air_Quality_Status — shows most recent reading per city per pollutant.

**How it works:**
- Uses a correlated subquery inside the WHERE clause
- For each reading row, checks: "is this the most recent reading for this location + pollutant?"
- `MAX(IR.Time)` finds the latest timestamp
- `IR` is an alias for inner READING to avoid conflict with outer READING (R)

**SQL Statement:**
```sql
CREATE OR REPLACE VIEW View_Live_Air_Quality_Status AS
SELECT L.Name AS City_Name, P.Name AS Pollutant_Name,
       R.Value AS Reading_Value, R.Time AS Last_Updated
FROM READING R
JOIN LOCATION L ON R.LocationID = L.LocationID
JOIN POLLUTANT P ON R.PollutantID = P.PollutantID
WHERE R.Time = (
    SELECT MAX(IR.Time) FROM READING IR
    WHERE IR.LocationID = R.LocationID
    AND IR.PollutantID = R.PollutantID
);

SELECT * FROM View_Live_Air_Quality_Status ORDER BY Reading_Value DESC;
```

**Output:**
```
+-----------+----------+---------------+---------------------+
| City_Name | Pollutant| Reading_Value | Last_Updated        |
+-----------+----------+---------------+---------------------+
| Delhi     | PM2.5    |        110.55 | 2025-11-09 10:30:00 |
| Ahmedabad | PM2.5    |         55.08 | 2025-11-09 10:30:00 |
| Mumbai    | PM2.5    |         48.20 | 2025-11-09 10:30:00 |
| Kolkata   | PM2.5    |         35.12 | 2025-11-09 10:30:00 |
| Chennai   | PM2.5    |         24.52 | 2025-11-09 10:30:00 |
| Hyderabad | PM2.5    |         12.00 | 2025-11-09 10:30:00 |
+-----------+----------+---------------+---------------------+
```

---

### Question 2: Create View_City_Pollution_Averages — city-wise pollution statistics.

**How it works:**
- `AVG(R.Value)` calculates average reading per city per pollutant
- `COUNT(R.ReadingID)` counts how many readings exist per group
- `GROUP BY L.Name, P.Name` → one row per city-pollutant combination
- `HAVING Average_Pollution_Level > 0` → filters out groups with zero average (data quality filter)

**SQL Statement:**
```sql
CREATE OR REPLACE VIEW View_City_Pollution_Averages AS
SELECT L.Name AS City_Name, P.Name AS Pollutant_Name,
       ROUND(AVG(R.Value),2) AS Average_Pollution_Level,
       COUNT(R.ReadingID) AS Total_Readings
FROM READING R
JOIN LOCATION L ON R.LocationID = L.LocationID
JOIN POLLUTANT P ON R.PollutantID = P.PollutantID
GROUP BY L.Name, P.Name
HAVING Average_Pollution_Level > 0;

SELECT * FROM View_City_Pollution_Averages ORDER BY Average_Pollution_Level DESC;
```

**Output:**
```
+-----------+----------+-------------------------+----------------+
| City_Name | Pollutant| Average_Pollution_Level | Total_Readings |
+-----------+----------+-------------------------+----------------+
| Delhi     | PM2.5    |                  110.55 |              1 |
| Ahmedabad | PM2.5    |                   55.08 |              1 |
| Mumbai    | PM2.5    |                   48.20 |              1 |
| Kolkata   | PM2.5    |                   35.12 |              1 |
| Chennai   | PM2.5    |                   24.52 |              1 |
| Hyderabad | PM2.5    |                   12.00 |              1 |
+-----------+----------+-------------------------+----------------+
```

---

### Question 3: Create View_Emergency_Monitoring_Zone — classifies cities by monitoring priority using UNION.

**How it works:**
- First SELECT → cities where any reading > 100 → labeled DANGER_LEVEL_HIGH
- Second SELECT → cities with readings in last 24 hours → labeled RECENTLY_CHECKED
- UNION combines both, removing exact duplicates
- Delhi appears twice because it qualifies for both categories

**SQL Statement:**
```sql
CREATE OR REPLACE VIEW View_Emergency_Monitoring_Zone AS
SELECT DISTINCT L.Name AS City, 'DANGER_LEVEL_HIGH' AS Priority
FROM LOCATION L JOIN READING R ON L.LocationID = R.LocationID
WHERE R.Value > 100
UNION
SELECT DISTINCT L.Name AS City, 'RECENTLY_CHECKED' AS Priority
FROM LOCATION L JOIN READING R ON L.LocationID = R.LocationID
WHERE R.Time > DATE_SUB(NOW(), INTERVAL 1 DAY);

SELECT * FROM View_Emergency_Monitoring_Zone ORDER BY Priority, City;
```

**Output:**
```
+-----------+-------------------+
| City      | Priority          |
+-----------+-------------------+
| Delhi     | DANGER_LEVEL_HIGH |
| Ahmedabad | RECENTLY_CHECKED  |
| Chennai   | RECENTLY_CHECKED  |
| Delhi     | RECENTLY_CHECKED  |
| Hyderabad | RECENTLY_CHECKED  |
| Kolkata   | RECENTLY_CHECKED  |
| Mumbai    | RECENTLY_CHECKED  |
+-----------+-------------------+
```

---

## 3.7 Complex Queries Based on Triggers

### What is a Trigger?
A trigger is a stored program that automatically executes when a specific event (INSERT, UPDATE, DELETE) occurs on a table. You never call it manually — the database calls it automatically.

| Timing | When it fires |
|---|---|
| BEFORE INSERT | Before the new row is saved |
| AFTER INSERT | After the new row is saved |
| BEFORE UPDATE | Before the row is changed |
| AFTER UPDATE | After the row is changed |

`NEW.column` → refers to the new row being inserted/updated
`OLD.column` → refers to the old row before update/delete

---

### Question 1: AFTER INSERT Trigger — Automatically generate alerts for all subscribed users when a reading exceeds the safe threshold.

**How it works:**
```
New reading inserted into READING table
        ↓
Trigger fires automatically (AFTER INSERT)
        ↓
Step 1: Get SafeThreshold for that pollutant
        ↓
Step 2: Is NEW.Value > SafeThreshold?
        ↓ YES
Step 3: Find a matching Recommendation
        ↓
Step 4: Insert one Alert row for EVERY user
        subscribed to that location
        (via USER_LOCATION table)
```

**SQL Statement:**
```sql
DELIMITER //
CREATE TRIGGER Trigger_Check_Pollution_And_Alert
AFTER INSERT ON READING
FOR EACH ROW
BEGIN
    DECLARE Safe_Limit DECIMAL(10,2);
    DECLARE Rec_ID VARCHAR(36);

    SELECT SafeThreshold INTO Safe_Limit
    FROM POLLUTANT WHERE PollutantID = NEW.PollutantID;

    IF NEW.Value > Safe_Limit THEN
        SELECT RecID INTO Rec_ID FROM RECOMMENDATION
        WHERE PollutantID = NEW.PollutantID LIMIT 1;

        INSERT INTO ALERT (AlertID,PollutantID,UserID,RecID,LocationID,CreatedAt)
        SELECT UUID(), NEW.PollutantID, UserID,
               Rec_ID, NEW.LocationID, NOW()
        FROM USER_LOCATION WHERE LocationID = NEW.LocationID;
    END IF;
END //
DELIMITER ;
```

**Demo — Test the trigger:**
```sql
-- Step 1: Check alert count before
SELECT COUNT(*) FROM ALERT;

-- Step 2: Insert a dangerous reading
INSERT INTO READING (ReadingID, Value, LocationID, PollutantID)
VALUES (UUID(), 999.99, 'loc-001', 'pol-001');

-- Step 3: Check alert count after (should have increased!)
SELECT COUNT(*) FROM ALERT;

-- Step 4: See the auto-generated alert
SELECT UserID, LocationID FROM ALERT ORDER BY CreatedAt DESC LIMIT 1;
```

**Output:**
```
Query OK, 0 rows affected (0.03 sec)  ← trigger created

+--------+----------+
| UserID | Location |
+--------+----------+
| usr-001| loc-001  |
+--------+----------+
-- Alert was created automatically without any INSERT INTO ALERT statement
```

---

### Question 2: BEFORE INSERT Trigger — Validate that no negative reading value is accepted.

**How it works:**
- Fires BEFORE the row is saved to the database
- `SIGNAL SQLSTATE '45000'` → throws a custom error (like throw in programming)
- '45000' is the MySQL code for user-defined errors
- `SET MESSAGE_TEXT` → the error message the user sees
- Since it fires BEFORE INSERT, the bad row is never saved

**SQL Statement:**
```sql
DELIMITER //
CREATE TRIGGER Trigger_Validate_Reading_Before_Insert
BEFORE INSERT ON READING
FOR EACH ROW
BEGIN
    IF NEW.Value < 0 THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT =
            'ERROR: Pollution reading cannot be negative.';
    END IF;
END //
DELIMITER ;

-- Test the trigger:
INSERT INTO READING (ReadingID, Value, LocationID, PollutantID)
VALUES (UUID(), -10.00, 'loc-001', 'pol-001');
```

**Output:**
```
ERROR 1644 (45000): ERROR: Pollution reading cannot be negative.

-- Trigger successfully blocked the invalid insertion.
```

---

### Question 3: AFTER UPDATE Trigger — Log every change to a pollutant's safe threshold into an audit table.

**How it works:**
- `OLD.SafeThreshold` → value before the update
- `NEW.SafeThreshold` → value after the update
- `IF OLD.SafeThreshold != NEW.SafeThreshold` → only log if threshold actually changed
- Inserts one audit row into POLLUTANT_CHANGE_LOG with old and new values
- Useful for tracking who changed what and when

**SQL Statement:**
```sql
CREATE TABLE IF NOT EXISTS POLLUTANT_CHANGE_LOG (
    LogID INT AUTO_INCREMENT PRIMARY KEY,
    PollutantName VARCHAR(100),
    Old_Threshold DECIMAL(10,2),
    New_Threshold DECIMAL(10,2),
    Changed_At DATETIME DEFAULT CURRENT_TIMESTAMP
);

DELIMITER //
CREATE TRIGGER Trigger_Log_Threshold_Change
AFTER UPDATE ON POLLUTANT
FOR EACH ROW
BEGIN
    IF OLD.SafeThreshold != NEW.SafeThreshold THEN
        INSERT INTO POLLUTANT_CHANGE_LOG
            (PollutantName, Old_Threshold, New_Threshold)
        VALUES (NEW.Name, OLD.SafeThreshold, NEW.SafeThreshold);
    END IF;
END //
DELIMITER ;

UPDATE POLLUTANT SET SafeThreshold = 25.00 WHERE Name = 'PM2.5';
SELECT * FROM POLLUTANT_CHANGE_LOG;
```

**Output:**
```
+-------+----------+---------------+---------------+---------------------+
| LogID | Pollutant| Old_Threshold | New_Threshold | Changed_At          |
+-------+----------+---------------+---------------+---------------------+
|     1 | PM2.5    |         35.00 |         25.00 | 2025-11-09 10:40:00 |
+-------+----------+---------------+---------------+---------------------+
```

---

## 3.8 Complex Queries Based on Cursors and Stored Procedures

### What is a Stored Procedure?
A stored procedure is a saved, reusable SQL code block stored in the database that accepts parameters and can be called by name. Like a function in programming.

```sql
-- Create
CREATE PROCEDURE Procedure_Name(IN param VARCHAR(36))
BEGIN
    -- SQL code here
END;

-- Call
CALL Procedure_Name('value');
```

### What is a Cursor?
Normally SQL processes all rows together as a set. A cursor lets you process one row at a time in a loop — useful when you need to apply custom logic to each row individually.

```
OPEN cursor     → start the cursor, execute the query
FETCH cursor    → get the next row into variables
IF no more rows → exit loop (handled by exception handler)
CLOSE cursor    → release cursor from memory
```

### What is Exception Handling?
```sql
DECLARE CONTINUE HANDLER FOR NOT FOUND SET Is_Finished = TRUE;
```
When a cursor runs out of rows, MySQL raises a "NOT FOUND" event. Without this handler, the procedure crashes. With it, the flag `Is_Finished` is set to TRUE and the loop exits cleanly. This is exception handling.

---

### Question 1: Stored Procedure with Cursor and Exception Handling — Generate a health report for a given city.

**How it works step by step:**
1. `IN Target_City_ID VARCHAR(36)` → accepts city ID as input parameter
2. `DECLARE` → creates local variables that exist only inside this procedure
3. `DECLARE Data_Cursor CURSOR FOR SELECT...` → defines the query the cursor will iterate
4. `DECLARE CONTINUE HANDLER FOR NOT FOUND` → exception handler for when cursor has no more rows
5. `OPEN Data_Cursor` → executes the SELECT and positions cursor at first row
6. `FETCH Data_Cursor INTO ...` → gets next row and stores in variables
7. `IF Is_Finished THEN LEAVE` → exit when no more rows
8. `CLOSE Data_Cursor` → releases cursor from memory

**SQL Statement:**
```sql
DELIMITER //
CREATE PROCEDURE Procedure_Generate_City_Health_Report(
    IN Target_City_ID VARCHAR(36)
)
BEGIN
    DECLARE Is_Finished INT DEFAULT FALSE;
    DECLARE Pollutant_Name VARCHAR(100);
    DECLARE City_Average DECIMAL(10,2);

    -- Cursor: fetch avg per pollutant for the given city
    DECLARE Data_Cursor CURSOR FOR
        SELECT P.Name, AVG(R.Value)
        FROM READING R
        JOIN POLLUTANT P ON R.PollutantID = P.PollutantID
        WHERE R.LocationID = Target_City_ID
        GROUP BY P.Name;

    -- Exception handler: exits loop when no more rows
    DECLARE CONTINUE HANDLER FOR NOT FOUND
        SET Is_Finished = TRUE;

    OPEN Data_Cursor;
    Report_Loop: LOOP
        FETCH Data_Cursor INTO Pollutant_Name, City_Average;
        IF Is_Finished THEN LEAVE Report_Loop; END IF;
        SELECT Pollutant_Name AS Pollutant, City_Average AS Avg;
    END LOOP;
    CLOSE Data_Cursor;
END //
DELIMITER ;

-- Call for Delhi (loc-003)
CALL Procedure_Generate_City_Health_Report('loc-003');
```

**Output:**
```
+-----------+--------+
| Pollutant | Avg    |
+-----------+--------+
| PM2.5     | 110.55 |
+-----------+--------+
1 row in set (0.01 sec)
Query OK, 0 rows affected (0.01 sec)
```

---

### Question 2: Stored Procedure — Find all cities where a given pollutant exceeds its safe threshold.

**How it works:**
- Accepts pollutant name as input: `IN Pollutant_Input VARCHAR(100)`
- Joins READING + LOCATION + POLLUTANT
- Filters: `WHERE P.Name = Pollutant_Input AND R.Value > P.SafeThreshold`
- Shows how much each city exceeded the limit: `R.Value - P.SafeThreshold`
- Call with any pollutant name

**SQL Statement:**
```sql
DELIMITER //
CREATE PROCEDURE Procedure_Pollutant_Alert_Cities(
    IN Pollutant_Input VARCHAR(100)
)
BEGIN
    SELECT L.Name AS City, L.State,
           R.Value AS Reading, P.SafeThreshold AS Safe_Limit,
           ROUND(R.Value - P.SafeThreshold, 2) AS Exceeded_By
    FROM READING R
    JOIN LOCATION L ON R.LocationID = L.LocationID
    JOIN POLLUTANT P ON R.PollutantID = P.PollutantID
    WHERE P.Name = Pollutant_Input
    AND R.Value > P.SafeThreshold
    ORDER BY R.Value DESC;
END //
DELIMITER ;

CALL Procedure_Pollutant_Alert_Cities('PM2.5');
```

**Output:**
```
+-----------+-------------+---------+------------+-------------+
| City      | State       | Reading | Safe_Limit | Exceeded_By |
+-----------+-------------+---------+------------+-------------+
| Delhi     | Delhi       |  110.55 |      35.00 |       75.55 |
| Ahmedabad | Gujarat     |   55.08 |      35.00 |       20.08 |
| Mumbai    | Maharashtra |   48.20 |      35.00 |       13.20 |
| Kolkata   | West Bengal |   35.12 |      35.00 |        0.12 |
+-----------+-------------+---------+------------+-------------+
```

---

### Question 3: Exception Handling — Call procedure with non-existent city to demonstrate SIGNAL SQLSTATE.

**How it works:**
- `SELECT LocationID INTO City_ID` → tries to find the city
- If city not found → City_ID stays NULL
- `IF City_ID IS NULL THEN SIGNAL SQLSTATE '45000'` → manually throws a custom error
- `SET MESSAGE_TEXT` → the error message shown to user
- Without this, an unknown city would silently return empty results — confusing
- With SIGNAL, the error is clear and catchable by the application

**SQL Statement:**
```sql
DELIMITER //
CREATE PROCEDURE Procedure_City_Advisory(
    IN City_Input VARCHAR(100)
)
BEGIN
    DECLARE City_ID VARCHAR(36);
    SELECT LocationID INTO City_ID
    FROM LOCATION WHERE Name = City_Input LIMIT 1;

    IF City_ID IS NULL THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'City not found in database';
    END IF;

    SELECT L.Name, P.Name AS Pollutant, R.Value
    FROM READING R
    JOIN LOCATION L ON R.LocationID = L.LocationID
    JOIN POLLUTANT P ON R.PollutantID = P.PollutantID
    WHERE L.LocationID = City_ID;
END //
DELIMITER ;

-- Test with non-existent city
CALL Procedure_City_Advisory('Bangalore');

-- Test with existing city
CALL Procedure_City_Advisory('Delhi');
```

**Output:**
```
-- Non-existent city:
ERROR 1644 (45000): City not found in database

-- Without exception handling, this would silently return:
-- Empty set (0.00 sec)  ← confusing, no reason given

-- Existing city:
+-------+-----------+---------+
| Name  | Pollutant | Value   |
+-------+-----------+---------+
| Delhi | PM2.5     |  110.55 |
+-------+-----------+---------+
```

---

## Quick Demo Sequence for Review

Run these in order during your presentation:

```sql
-- 1. Show all tables exist
SHOW TABLES;

-- 2. Constraints
ALTER TABLE READING ADD CONSTRAINT chk_positive_value CHECK (Value >= 0);
INSERT INTO READING (ReadingID,Value,LocationID,PollutantID) VALUES (UUID(),-5.00,'loc-001','pol-001');

-- 3. Aggregates
SELECT P.Name, ROUND(AVG(R.Value),2) AS Avg, MAX(R.Value) AS Max
FROM READING R JOIN POLLUTANT P ON R.PollutantID=P.PollutantID GROUP BY P.Name;

-- 4. Views
SHOW FULL TABLES WHERE Table_type = 'VIEW';
SELECT * FROM View_Live_Air_Quality_Status;
SELECT * FROM View_Emergency_Monitoring_Zone;

-- 5. Trigger test (most impressive demo)
SELECT COUNT(*) FROM ALERT;
INSERT INTO READING (ReadingID,Value,LocationID,PollutantID) VALUES (UUID(),999.99,'loc-001','pol-001');
SELECT COUNT(*) FROM ALERT;  -- count increased = trigger worked!

-- 6. Stored Procedure
CALL Procedure_Generate_City_Health_Report('loc-003');
CALL Procedure_City_Advisory('Bangalore');  -- shows exception handling
```

---

*AirGuard — 21CSC205P Database Management Systems | Chapter 3 Guide*
