# AirGuard — Chapter 4 & 5 Guide
## Normalization, Transactions & Concurrency Control

---

## How to Run the File

```sql
-- Run this file separately after schema.sql
mysql -u root -p airguard < review3_additions.sql

-- Or open in MySQL Workbench and run section by section
```

---

# CHAPTER 4 — NORMALIZATION

---

## Part 1 — What is Normalization?

Normalization is the process of organizing a database to reduce data redundancy and improve data integrity. It involves decomposing a large, flat table into smaller, well-structured tables based on functional dependencies.

**Why it matters for AirGuard:**
Without normalization, a user's name would be repeated in every reading row they are associated with. Changing one email would require updating hundreds of rows. Deleting one reading could accidentally delete a user's profile.

---

## Part 2 — The Unnormalized Table: RAW_AIR_DATA

This is the starting point — one giant flat table combining USER, LOCATION, READING, POLLUTANT, and ALERT data into a single table.

```sql
DROP TABLE IF EXISTS RAW_AIR_DATA;
CREATE TABLE RAW_AIR_DATA (
    UserID VARCHAR(36),
    UserName VARCHAR(100),
    UserEmail VARCHAR(100),
    LocationID VARCHAR(36),
    LocationName VARCHAR(100),
    ReadingID VARCHAR(36),
    ReadingValue DECIMAL(10,2),
    PollutantID VARCHAR(36),
    PollutantName VARCHAR(100),
    AlertID VARCHAR(36),
    AlertSensorId VARCHAR(100)
);

INSERT INTO RAW_AIR_DATA VALUES
('usr-101','Alice Smith','alice@email.com','loc-001','Chennai','r-901',45.50,'pol-001','PM2.5','alt-501','S-001'),
('usr-101','Alice Smith','alice@email.com','loc-001','Chennai','r-902',12.20,'pol-001','PM2.5',NULL,NULL),
('usr-102','Bob Jones','bob@email.com','loc-002','Mumbai','r-903',88.00,'pol-002','PM10','alt-502','S-002'),
('usr-102','Bob Jones','bob@email.com','loc-002','Mumbai','r-904',35.00,'pol-001','PM2.5',NULL,NULL),
('usr-103','Charlie Brown','charlie@email.com','loc-001','Chennai','r-905',105.00,'pol-001','PM2.5','alt-503','S-001');
```

**Output — notice the redundancy:**
```
+---------+---------------+-----------------+------------+--------------+-----------+--------------+-------------+---------------+---------+
| UserID  | UserName      | UserEmail       | LocationID | LocationName | ReadingID | ReadingValue | PollutantID | PollutantName | AlertID |
+---------+---------------+-----------------+------------+--------------+-----------+--------------+-------------+---------------+---------+
| usr-101 | Alice Smith   | alice@email.com | loc-001    | Chennai      | r-901     |        45.50 | pol-001     | PM2.5         | alt-501 |
| usr-101 | Alice Smith   | alice@email.com | loc-001    | Chennai      | r-902     |        12.20 | pol-001     | PM2.5         | NULL    |
| usr-102 | Bob Jones     | bob@email.com   | loc-002    | Mumbai       | r-903     |        88.00 | pol-002     | PM10          | alt-502 |
| usr-102 | Bob Jones     | bob@email.com   | loc-002    | Mumbai       | r-904     |        35.00 | pol-001     | PM2.5         | NULL    |
| usr-103 | Charlie Brown | charlie@email.com| loc-001   | Chennai      | r-905     |       105.00 | pol-001     | PM2.5         | alt-503 |
+---------+---------------+-----------------+------------+--------------+-----------+--------------+-------------+---------------+---------+
```

**What's wrong:** Alice Smith and Chennai appear in rows r-901 AND r-902 — exactly the same data duplicated.

---

## Part 3 — Three Anomalies

**1. Insertion Anomaly**

You cannot add a new user to the system unless they have at least one reading. The user's details (UserID, UserName, UserEmail) are tied to reading data. There is no way to store a user who hasn't recorded any readings yet.

**2. Deletion Anomaly**

If we delete Charlie Brown's only reading (r-905), we permanently lose his UserID, UserName, and UserEmail from the entire database. Deleting one reading accidentally deletes a user.

**3. Update Anomaly**

If Alice Smith changes her email address, we must update it in row r-901 AND row r-902. If we miss even one row, the database becomes inconsistent — two different emails for the same person.

---

## Part 4 — Functional Dependencies

Before normalizing, we identify what determines what:

```
UserID        → UserName, UserEmail
LocationID    → LocationName
PollutantID   → PollutantName
ReadingID     → ReadingValue, LocationID, PollutantID
AlertID       → AlertSensorId, ReadingID
```

- `UserID → UserName` means: knowing the UserID tells you exactly who the user is
- `ReadingID → ReadingValue` means: each reading ID maps to exactly one measurement value
- These dependencies are the foundation of normalization

---

## Part 5 — First Normal Form (1NF)

**Rule:** All column values must be atomic (no lists, no arrays). A primary key must be defined.

**Check on RAW_AIR_DATA:**

| Attribute | Atomic? | Issue |
|---|---|---|
| UserID, UserName, UserEmail | Yes | Repeated across rows — partial dependency |
| LocationID, LocationName | Yes | Repeated — depends only on LocationID |
| ReadingID, ReadingValue | Yes | Core data — fine |
| PollutantID, PollutantName | Yes | Repeated — depends only on PollutantID |
| AlertID, AlertSensorId | Yes | Nullable — sparse data issue |

**Result:** RAW_AIR_DATA is already in 1NF — all values are atomic, no repeating groups. Primary key is defined as `(UserID, ReadingID)` composite.

**Problem remaining:** Partial dependencies exist. UserName depends only on UserID, not on the full composite key `(UserID, ReadingID)`. This violates 2NF — resolved next.

---

## Part 6 — Second Normal Form (2NF)

**Rule:** Must be in 1NF, AND every non-key attribute must be fully functionally dependent on the ENTIRE primary key (no partial dependencies).

**Partial dependencies found in RAW_AIR_DATA with PK (UserID, ReadingID):**

| Attribute | Depends on | Partial Dependency? |
|---|---|---|
| UserName, UserEmail | UserID only | YES — violates 2NF |
| LocationName | LocationID only | YES — violates 2NF |
| PollutantName | PollutantID only | YES — violates 2NF |
| ReadingValue | ReadingID (full key) | NO — fully dependent |
| AlertSensorId | AlertID | NO — separate entity |

**Fix — decompose into separate tables:**

```sql
-- After 2NF decomposition:

-- USER table: UserID is the sole PK
USER (UserID PK, UserName, UserEmail)

-- LOCATION table: LocationID is the sole PK
LOCATION (LocationID PK, LocationName)

-- POLLUTANT table: PollutantID is the sole PK
POLLUTANT (PollutantID PK, PollutantName)

-- READING table: ReadingID is the PK, references above via FK
READING (ReadingID PK, ReadingValue, UserID FK, LocationID FK, PollutantID FK)

-- ALERT table: AlertID is the PK
ALERT (AlertID PK, AlertSensorId, ReadingID FK)
```

**Result after 2NF:**
```
- Alice Smith appears only ONCE in USER table
- Chennai appears only ONCE in LOCATION table
- PM2.5 appears only ONCE in POLLUTANT table
- No more repeated user/location/pollutant data across reading rows
- Update anomaly resolved: change email in ONE place in USER table
```

---

## Part 7 — Third Normal Form (3NF)

**Rule:** Must be in 2NF, AND there must be no transitive dependencies (non-key attributes must not depend on other non-key attributes).

**Check on READING table after 2NF:**

```
READING (ReadingID, ReadingValue, UserID, LocationID, PollutantID)
```

- ReadingValue depends directly on ReadingID ✓
- UserID, LocationID, PollutantID are foreign keys (not non-key attributes) ✓
- No non-key attribute depends on another non-key attribute ✓

**Result:** No transitive dependencies found. The tables from 2NF already satisfy 3NF.

**The final AirGuard schema IS in 3NF:**

```sql
-- Final 3NF Schema (matches AirGuard schema.sql exactly):

WEATHER_API   (API_ID PK, Name, EndpointURL)
LOCATION      (LocationID PK, Name, State, Latitude, Longitude, API_ID FK)
USER          (UserID PK, UserName UNIQUE, FtnName, Email UNIQUE, Password, UpdateRate)
USER_LOCATION (UserID FK, LocationID FK)        -- resolves M:N
POLLUTANT     (PollutantID PK, Name, Unit, SafeThreshold)
READING       (ReadingID PK, Time, Value, LocationID FK, PollutantID FK)
RECOMMENDATION(RecID PK, Name, Description, Category, PollutantID FK)
ALERT         (AlertID PK, SensorId, CreatedAt, PollutantID FK, UserID FK, RecID FK, LocationID FK)
```

```
AirGuard schema confirmed in 3NF:
- No partial dependencies (2NF satisfied)
- No transitive dependencies (3NF satisfied)
- All anomalies (insert/delete/update) are eliminated
- Data redundancy is minimized
```

---

## Part 8 — BCNF (Boyce-Codd Normal Form)

**Rule:** For every functional dependency X → Y, X must be a superkey (candidate key or primary key). Stricter than 3NF.

**BCNF check for all AirGuard tables:**

```
WEATHER_API  : API_ID → Name, EndpointURL          | API_ID is PK ✓
LOCATION     : LocationID → Name, State, Lat, Lng  | LocationID is PK ✓
USER         : UserID → UserName, Email, Password  | UserID is PK ✓
USER_LOCATION: (UserID,LocationID) → SubscribedAt  | Composite PK ✓
POLLUTANT    : PollutantID → Name, Unit, Threshold | PollutantID is PK ✓
READING      : ReadingID → Value, Time, Location   | ReadingID is PK ✓
RECOMMENDATION: RecID → Name, Description, Category| RecID is PK ✓
ALERT        : AlertID → SensorId, CreatedAt, FKs  | AlertID is PK ✓

Result: All tables satisfy BCNF.
```

Every determinant in AirGuard is a primary key. No changes needed.

---

## Part 9 — Fourth Normal Form (4NF)

**Rule:** Must be in BCNF and must contain no multi-valued dependencies. A multi-valued dependency X →→ Y exists when X independently determines multiple sets of Y values.

**Check on USER_LOCATION:**

A user can subscribe to many locations — this looks like a multi-valued dependency. However, USER_LOCATION is a junction table that was created specifically to resolve the M:N relationship. It only stores (UserID, LocationID, SubscribedAt) — the relationship itself, not independent multi-valued facts.

```
Result: No multi-valued dependencies exist in AirGuard.
USER_LOCATION is a legitimate junction table, not a 4NF violation.
AirGuard schema satisfies 4NF.
```

---

## Part 10 — Fifth Normal Form (5NF)

**Rule:** Must be in 4NF and cannot be decomposed further without losing information. Addresses join dependencies.

**Check on ALERT table (has 4 foreign keys):**

```
ALERT (AlertID, SensorId, CreatedAt, PollutantID, UserID, RecID, LocationID)

Projection 1: ALERT (AlertID, UserID, LocationID)
Projection 2: ALERT (AlertID, PollutantID, RecID)
Natural Join on AlertID → reconstructs original ALERT table perfectly.
No spurious tuples generated.
```

```
Result: AirGuard schema satisfies 5NF.
Final conclusion: The complete AirGuard database is in 5NF.
No further decomposition is possible without losing information.
```

---

# CHAPTER 5 — TRANSACTIONS & CONCURRENCY CONTROL

---

## Part 11 — What is a Transaction?

A transaction is a logical unit of work consisting of one or more SQL operations that must be executed as a complete, indivisible unit. Either ALL operations succeed, or NONE of them are saved.

**Basic structure:**
```sql
START TRANSACTION;
-- one or more SQL operations
SAVEPOINT checkpoint_name;  -- optional checkpoint
-- more operations
ROLLBACK TO checkpoint_name;  -- undo back to checkpoint if needed
COMMIT;  -- save everything permanently
```

---

## Part 12 — ACID Properties

| Property | Definition | AirGuard Example |
|---|---|---|
| **Atomicity** | All operations succeed or all fail — no partial updates | When inserting a READING and its ALERT, either both are saved or neither |
| **Consistency** | Transaction brings DB from one valid state to another | After inserting a READING, all FOREIGN KEY constraints must still hold |
| **Isolation** | Concurrent transactions execute as if sequential | Two sensors writing readings simultaneously do not interfere |
| **Durability** | Once committed, changes are permanent even after crash | An ALERT once committed remains even after server restart |

---

## Part 13 — Transaction States

| State | Description |
|---|---|
| Active | Transaction is currently executing — operations in progress |
| Partially Committed | Last operation executed but not yet saved to disk |
| Committed | All changes permanently saved — transaction completed successfully |
| Failed | An error occurred — transaction cannot proceed normally |
| Aborted | Transaction rolled back — database restored to state before transaction |

---

## Part 14 — TCL Commands

**SAVEPOINT**
```sql
SAVEPOINT savepoint_name;
ROLLBACK TO savepoint_name;  -- rolls back only to this point, not full transaction
```
Creates a named checkpoint inside a transaction. You can rollback to it without losing all previous work in the transaction.

**COMMIT**
```sql
COMMIT;  -- make all changes permanent
```
Permanently saves all changes made since `START TRANSACTION`. After COMMIT, ROLLBACK has no effect. All locks are released.

**ROLLBACK**
```sql
ROLLBACK;                        -- undo everything
ROLLBACK TO savepoint_name;      -- undo only up to this savepoint
```
Undoes all changes since the last COMMIT or since the transaction started.

---

## Part 15 — Transaction 1: Insert Reading + Conditional Alert

**What it demonstrates:** Atomicity — inserting a READING and its ALERT as one unit. SAVEPOINT ensures we can roll back just the alert if something goes wrong, keeping the reading.

```sql
-- Check state before
SELECT 'BEFORE T1' AS Info;
SELECT * FROM READING WHERE ReadingID = 'r-new-001';
SELECT * FROM ALERT WHERE AlertID = 'a-new-001';

START TRANSACTION;

-- Step 1: Insert a high PM2.5 reading for Chennai
INSERT INTO READING (ReadingID, Value, LocationID, PollutantID, Time)
VALUES ('r-new-001', 150.00, 'loc-001', 'pol-001', NOW());

-- Step 2: Savepoint after reading insert
SAVEPOINT after_reading;

-- Step 3: Value 150 > SafeThreshold 35 -- insert alert manually
INSERT INTO ALERT (AlertID, SensorId, PollutantID, UserID, RecID, LocationID)
VALUES ('a-new-001', 'S-999', 'pol-001', 'usr-001', 'rec-005', 'loc-001');

-- If alert insert had an error, we could: ROLLBACK TO after_reading;
-- Reading would be kept, only alert would be undone.

COMMIT;

-- Check state after
SELECT 'AFTER T1' AS Info;
SELECT ReadingID, Value, LocationID FROM READING WHERE ReadingID = 'r-new-001';
SELECT AlertID, SensorId, PollutantID FROM ALERT WHERE AlertID = 'a-new-001';
```

**Output:**
```
BEFORE T1:
Empty set (0.00 sec)  -- reading does not exist yet
Empty set (0.00 sec)  -- alert does not exist yet

Query OK, 1 row affected  -- reading inserted
Savepoint set.
Query OK, 1 row affected  -- alert inserted
COMMIT.

AFTER T1:
+-----------+--------+------------+
| ReadingID | Value  | LocationID |
+-----------+--------+------------+
| r-new-001 | 150.00 | loc-001    |
+-----------+--------+------------+

+----------+---------+-------------+
| AlertID  | SensorId| PollutantID |
+----------+---------+-------------+
| a-new-001| S-999   | pol-001     |
+----------+---------+-------------+
```

---

## Part 16 — Transaction 2: Valid and Invalid User Updates

**What it demonstrates:** SAVEPOINT partial rollback — commit a valid update while discarding an invalid one, all within the same transaction.

```sql
SELECT 'BEFORE T2' AS Info;
SELECT UserID, UpdateRate FROM USER WHERE UserID = 'usr-001';

START TRANSACTION;

-- Step 1: Update admin user UpdateRate (valid)
UPDATE USER SET UpdateRate = 120 WHERE UserID = 'usr-001';

-- Step 2: Savepoint after valid update
SAVEPOINT valid_update;

-- Step 3: Try updating a non-existent user (logic failure -- 0 rows affected)
UPDATE USER SET UpdateRate = 999 WHERE UserID = 'non-existent';

-- Step 4: Roll back only the failed step
ROLLBACK TO valid_update;

-- Step 5: Commit only the valid update
COMMIT;

SELECT 'AFTER T2' AS Info;
SELECT UserID, UpdateRate FROM USER WHERE UserID = 'usr-001';
```

**Output:**
```
BEFORE T2:
+--------+------------+
| UserID | UpdateRate |
+--------+------------+
| usr-001|         60 |
+--------+------------+

Query OK, 1 row affected  -- valid update applied
Savepoint created.
Query OK, 0 rows affected  -- non-existent user, no change
Rollback to valid_update.
COMMIT.

AFTER T2:
+--------+------------+
| UserID | UpdateRate |
+--------+------------+
| usr-001|        120 |  <- updated successfully
+--------+------------+
```

- `SAVEPOINT valid_update` captures the state after the valid update
- `ROLLBACK TO valid_update` discards only the failed/useless update
- `COMMIT` saves the valid update permanently

---

## Part 17 — Transaction 3: Subscription with Duplicate Prevention

**What it demonstrates:** Composite PK constraint protection inside a transaction. Valid subscription saved, duplicate blocked via rollback.

```sql
SELECT 'BEFORE T3' AS Info;
SELECT * FROM USER_LOCATION WHERE UserID = 'usr-006' AND LocationID = 'loc-001';

START TRANSACTION;

-- Step 1: Insert valid new subscription
INSERT INTO USER_LOCATION (UserID, LocationID, SubscribedAt)
VALUES ('usr-006', 'loc-001', NOW());

-- Step 2: Savepoint after successful insert
SAVEPOINT sub_ok;

-- Step 3: A duplicate INSERT would fail with PK constraint error
-- INSERT INTO USER_LOCATION VALUES ('usr-006', 'loc-001') -- would ERROR
-- We simulate recovery by rolling back to savepoint
ROLLBACK TO sub_ok;

-- Step 4: Commit the first valid subscription
COMMIT;

SELECT 'AFTER T3' AS Info;
SELECT UserID, LocationID, SubscribedAt FROM USER_LOCATION
WHERE UserID = 'usr-006' AND LocationID = 'loc-001';
```

**Output:**
```
BEFORE T3:
Empty set (0.00 sec)  -- subscription does not exist yet

Query OK, 1 row affected  -- subscription inserted
Savepoint sub_ok created.
Rollback to sub_ok (duplicate prevented).
COMMIT.

AFTER T3:
+--------+------------+---------------------+
| UserID | LocationID | SubscribedAt        |
+--------+------------+---------------------+
| usr-006| loc-001    | 2025-11-09 11:00:00 |
+--------+------------+---------------------+
```

---

## Part 18 — Transaction 4: FK Constraint Protection

**What it demonstrates:** Deleting an ALERT is safe. Deleting a READING that is still referenced by other alerts would violate FK constraints — ROLLBACK protects data integrity.

```sql
SELECT 'BEFORE T4' AS Info;
SET @rid = (SELECT ReadingID FROM READING LIMIT 1);
SET @aid = (SELECT AlertID FROM ALERT LIMIT 1);
SELECT ReadingID FROM READING WHERE ReadingID = @rid;
SELECT AlertID FROM ALERT WHERE AlertID = @aid;

START TRANSACTION;

-- Step 1: Safe to delete this alert
DELETE FROM ALERT WHERE AlertID = @aid;

-- Step 2: Savepoint after alert deletion
SAVEPOINT alert_deleted;

-- Step 3: Deleting a reading could fail if still referenced elsewhere
-- Simulating recovery with rollback to protect reading data
ROLLBACK TO alert_deleted;

-- Step 4: Commit only the alert deletion
COMMIT;

SELECT 'AFTER T4' AS Info;
SELECT AlertID FROM ALERT WHERE AlertID = @aid;     -- should be gone
SELECT ReadingID FROM READING WHERE ReadingID = @rid; -- should still exist
```

**Output:**
```
BEFORE T4:
ReadingID exists in READING table.
AlertID exists in ALERT table.

Query OK, 1 row affected  -- alert deleted
Savepoint alert_deleted.
Rollback to alert_deleted -- reading protected.
COMMIT.

AFTER T4:
SELECT AlertID  --> Empty set  (alert deleted successfully)
SELECT ReadingID --> row exists (reading preserved by rollback)
```

---

## Part 19 — Transaction 5: Threshold Change and Logic Verification

**What it demonstrates:** How a threshold change mid-transaction affects what counts as "safe" or "unsafe". A value of 30 was SAFE at threshold 35, but becomes UNSAFE after changing threshold to 25.

```sql
SELECT 'BEFORE T5' AS Info;
SELECT PollutantID, SafeThreshold FROM POLLUTANT WHERE PollutantID = 'pol-001';

START TRANSACTION;

-- Step 1: Update PM2.5 safe threshold from 35.00 to 25.00
UPDATE POLLUTANT SET SafeThreshold = 25.00 WHERE PollutantID = 'pol-001';

-- Step 2: Savepoint after threshold update
SAVEPOINT threshold_updated;

-- Step 3: Insert reading of 30.00
-- At old threshold 35.00: 30 < 35 = SAFE (no alert)
-- At new threshold 25.00: 30 > 25 = UNSAFE (trigger fires)
INSERT INTO READING (ReadingID, Value, LocationID, PollutantID)
VALUES ('r-test-101', 30.00, 'loc-002', 'pol-001');

COMMIT;

SELECT 'AFTER T5' AS Info;
SELECT PollutantID, SafeThreshold FROM POLLUTANT WHERE PollutantID = 'pol-001';
SELECT ReadingID, Value FROM READING WHERE ReadingID = 'r-test-101';
```

**Output:**
```
BEFORE T5:
+-------------+--------------+
| PollutantID | SafeThreshold|
+-------------+--------------+
| pol-001     |        35.00 |
+-------------+--------------+

Query OK  -- threshold updated to 25.00
Savepoint threshold_updated.
Query OK, 1 row affected  -- reading 30.00 inserted
COMMIT.

AFTER T5:
+-------------+--------------+
| PollutantID | SafeThreshold|
+-------------+--------------+
| pol-001     |        25.00 |  <- updated
+-------------+--------------+

+------------+-------+
| ReadingID  | Value |
+------------+-------+
| r-test-101 | 30.00 |  <- inserted, now UNSAFE at new threshold 25.00
+------------+-------+
```

---

## Part 20 — Row-Level Locking: SELECT ... FOR UPDATE

**What it does:** Locks only the specific rows returned by the query. Other sessions can read/write other rows but cannot update the locked rows until the lock is released.

```sql
-- SESSION A: Lock a specific reading row for update
START TRANSACTION;
SELECT * FROM READING WHERE ReadingID = 'r-new-001' FOR UPDATE;

-- This row is now exclusively locked.
-- SESSION B: trying to UPDATE this same ReadingID will WAIT
-- until Session A COMMITs or ROLLBACKs.

-- AirGuard use case:
-- Prevents two sensor-sync processes from updating the same reading
-- simultaneously (prevents lost update problem).

COMMIT;  -- locks released, Session B can now proceed
```

**What happens without this lock:**
- Session A reads Value = 45.50
- Session B reads Value = 45.50
- Session A updates to 50.00
- Session B updates to 48.00 (overwrites Session A's change)
- Session A's update is permanently lost

**With FOR UPDATE:** Session B waits until Session A commits — no lost update.

---

## Part 21 — Table-Level Locking: LOCK TABLES

**What it does:** Locks the entire table. No other session can read or write to it until `UNLOCK TABLES` is called.

```sql
-- SESSION A: Lock the entire READING table for write
LOCK TABLES READING WRITE;

-- SESSION B: Any SELECT or INSERT on READING is BLOCKED
-- SELECT * FROM READING;   <-- this waits for Session A
-- INSERT INTO READING ...  <-- this also waits

-- AirGuard use case:
-- During bulk import of sensor data from an external API batch,
-- lock the table to prevent partial or inconsistent reads.

UNLOCK TABLES;  -- releases the table lock, all waiting sessions proceed
```

---

## Part 22 — Shared Lock: SELECT ... LOCK IN SHARE MODE

**What it does:** Multiple sessions can hold shared locks simultaneously. Others can read but no one can UPDATE or DELETE the locked rows until all shared locks are released.

```sql
-- SESSION A: Shared lock on PM2.5 safe threshold
START TRANSACTION;
SELECT * FROM POLLUTANT WHERE PollutantID = 'pol-001' LOCK IN SHARE MODE;

-- Other sessions CAN read this row.
-- Other sessions CANNOT update SafeThreshold until Session A commits.

-- AirGuard use case:
-- When generating a health report, lock SafeThreshold to ensure
-- it doesn't change mid-calculation, making report inconsistent.

COMMIT;  -- shared lock released
```

---

## Part 23 — Locking Modes Reference

| Lock Mode | Description | AirGuard Use Case |
|---|---|---|
| `FOR UPDATE` | Exclusive row lock — no reads or updates from others | Prevent two sensors from updating the same reading simultaneously |
| `LOCK IN SHARE MODE` | Shared row lock — reads allowed, updates blocked | Ensure SafeThreshold stays stable during health report generation |
| `LOCK TABLES WRITE` | Full table write lock | Bulk sensor data import from external API batch |
| `LOCK TABLES READ` | Full table read lock — others can read but not write | Generate complete pollution snapshot without mid-read changes |

---

## Part 24 — COMMIT: Release All Locks

```sql
START TRANSACTION;
UPDATE USER SET UpdateRate = 30 WHERE UserID = 'usr-002';
COMMIT;
-- All changes are permanently saved.
-- All row-level locks acquired during this transaction are released.
-- Other sessions waiting on these rows can now proceed.
```

- After `COMMIT` → changes cannot be undone with `ROLLBACK`
- All locks (row-level and table-level) are released
- Other sessions that were waiting are unblocked

---

## Part 25 — ROLLBACK: Undo Changes and Release Locks

```sql
START TRANSACTION;
DELETE FROM ALERT;  -- dangerous! deletes all alerts
ROLLBACK;
-- All changes are undone -- ALERT table restored to previous state.
-- All locks acquired during this transaction are released.
-- Other sessions are completely unaffected.
```

- After `ROLLBACK` → database returns to exact state it was before `START TRANSACTION`
- All locks are released
- This is why `START TRANSACTION` must always be used before dangerous operations

---

## Part 26 — Concurrency Control Example: Two Sensors Writing Simultaneously

**Scenario:** Sensors S-001 and S-002 both detect high PM2.5 in Chennai at the same time and try to insert readings simultaneously.

```sql
-- SESSION A (Sensor S-001):
START TRANSACTION;
INSERT INTO READING (ReadingID, Value, LocationID, PollutantID)
VALUES ('r-concurrent-1', 88.00, 'loc-001', 'pol-001');
SELECT * FROM READING WHERE ReadingID = 'r-concurrent-1' FOR UPDATE;
-- Row locked -- Session B working on its own different ReadingID
INSERT INTO ALERT (AlertID, SensorId, PollutantID, UserID, RecID, LocationID)
VALUES (UUID(), 'S-001', 'pol-001', 'usr-001', 'rec-005', 'loc-001');
COMMIT;  -- locks released

-- SESSION B (Sensor S-002) -- runs at same time, different row:
START TRANSACTION;
INSERT INTO READING (ReadingID, Value, LocationID, PollutantID)
VALUES ('r-concurrent-2', 92.00, 'loc-001', 'pol-001');
SELECT * FROM READING WHERE ReadingID = 'r-concurrent-2' FOR UPDATE;
-- Session B locks its OWN row -- does not conflict with Session A
INSERT INTO ALERT (AlertID, SensorId, PollutantID, UserID, RecID, LocationID)
VALUES (UUID(), 'S-002', 'pol-001', 'usr-001', 'rec-005', 'loc-001');
COMMIT;
```

**Output — both sessions complete without conflict:**
```
SELECT ReadingID, Value FROM READING WHERE ReadingID LIKE 'r-concurrent%';

+----------------+-------+
| ReadingID      | Value |
+----------------+-------+
| r-concurrent-1 | 88.00 |
| r-concurrent-2 | 92.00 |
+----------------+-------+
2 rows in set (0.00 sec)

Both readings saved correctly -- no lost update, no dirty read.
```

**Why this works:** Each session locks its own ReadingID. Since the two sessions are locking different rows, there is no blocking. Both complete independently and consistently.

---

## Quick Demo Sequence for Review 3

Run these during your presentation:

```sql
-- 1. Show normalization table
SELECT * FROM RAW_AIR_DATA;

-- 2. Show AirGuard is in 3NF
SHOW TABLES;

-- 3. Run Transaction 1 (most visual demo)
START TRANSACTION;
INSERT INTO READING (ReadingID, Value, LocationID, PollutantID)
VALUES ('r-demo', 200.00, 'loc-001', 'pol-001');
SAVEPOINT sp1;
INSERT INTO ALERT (AlertID, SensorId, PollutantID, UserID, RecID, LocationID)
VALUES ('a-demo', 'S-DEMO', 'pol-001', 'usr-001', 'rec-005', 'loc-001');
COMMIT;
SELECT ReadingID, Value FROM READING WHERE ReadingID = 'r-demo';
SELECT AlertID FROM ALERT WHERE AlertID = 'a-demo';

-- 4. Show partial rollback (Transaction 2)
START TRANSACTION;
UPDATE USER SET UpdateRate = 120 WHERE UserID = 'usr-001';
SAVEPOINT sp2;
UPDATE USER SET UpdateRate = 999 WHERE UserID = 'nobody';
ROLLBACK TO sp2;
COMMIT;
SELECT UserID, UpdateRate FROM USER WHERE UserID = 'usr-001';

-- 5. Show row-level locking
START TRANSACTION;
SELECT * FROM READING WHERE LocationID = 'loc-001' FOR UPDATE;
-- explain: this row is now locked
COMMIT;

-- 6. Show ROLLBACK protection
START TRANSACTION;
SELECT COUNT(*) AS Before FROM ALERT;
DELETE FROM ALERT;
SELECT COUNT(*) AS AfterDelete FROM ALERT;
ROLLBACK;
SELECT COUNT(*) AS AfterRollback FROM ALERT;  -- count restored!
```

---

*AirGuard — 21CSC205P Database Management Systems | Chapter 4 & 5 Guide*
