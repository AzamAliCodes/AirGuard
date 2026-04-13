/*
==========================================================================
    AIRGUARD DBMS REVIEW - PART 1: NORMALIZATION DEMONSTRATION
==========================================================================
*/

USE airguard;

-- 1. Create one large unnormalized table
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

-- 2. Insert 4-5 rows showing redundancy
INSERT INTO RAW_AIR_DATA VALUES 
('usr-101', 'Alice Smith', 'alice@email.com', 'loc-001', 'Chennai', 'r-901', 45.50, 'pol-001', 'PM2.5', 'alt-501', 'S-001'),
('usr-101', 'Alice Smith', 'alice@email.com', 'loc-001', 'Chennai', 'r-902', 12.20, 'pol-001', 'PM2.5', NULL, NULL),
('usr-102', 'Bob Jones', 'bob@email.com', 'loc-002', 'Mumbai', 'r-903', 88.00, 'pol-002', 'PM10', 'alt-502', 'S-002'),
('usr-102', 'Bob Jones', 'bob@email.com', 'loc-002', 'Mumbai', 'r-904', 35.00, 'pol-001', 'PM2.5', NULL, NULL),
('usr-103', 'Charlie Brown', 'charlie@email.com', 'loc-001', 'Chennai', 'r-905', 105.00, 'pol-001', 'PM2.5', 'alt-503', 'S-001');

/*
SAMPLE OUTPUT (Redundancy visualization):
+---------+-------------+-----------------+------------+--------------+-----------+--------------+-------------+---------------+---------+---------------+
| UserID  | UserName    | UserEmail       | LocationID | LocationName | ReadingID | ReadingValue | PollutantID | PollutantName | AlertID | AlertSensorId |
+---------+-------------+-----------------+------------+--------------+-----------+--------------+-------------+---------------+---------+---------------+
| usr-101 | Alice Smith | alice@email.com | loc-001    | Chennai      | r-901     | 45.50        | pol-001     | PM2.5         | alt-501 | S-001         |
| usr-101 | Alice Smith | alice@email.com | loc-001    | Chennai      | r-902     | 12.20        | pol-001     | PM2.5         | NULL    | NULL          |
+---------+-------------+-----------------+------------+--------------+-----------+--------------+-------------+---------------+---------+---------------+
Note how 'Alice Smith' and 'Chennai' details are repeated multiple times.
*/

/*
ANOMALIES EXPLAINED:
1. Insertion Anomaly: We cannot add a new USER unless they have a READING or an ALERT, because those 
   fields might be part of a composite key or required by the flat structure.
2. Deletion Anomaly: If we delete the only reading for 'Charlie Brown' (r-905), we also lose 
   his UserID, Name, and Email information from this table.
3. Update Anomaly: If 'Alice Smith' changes her email, we must update it in EVERY row where she appears.
   If we miss one row (e.g., r-902), the database becomes inconsistent.
*/

/*
DECOMPOSITION STEPS:

STEP 1: 1NF (First Normal Form)
- Ensure all columns are atomic (no lists in cells).
- Define a Primary Key (UserID, ReadingID).
- Result: Already achieved as data is flat and atomic.

STEP 2: 2NF (Second Normal Form)
- Must be in 1NF.
- Remove Partial Functional Dependencies (attributes must depend on the WHOLE primary key).
- Result: 
  - USER table (UserID -> UserName, UserEmail)
  - READING table (ReadingID -> ReadingValue, UserID, LocationID, PollutantID)
  - Now, UserName no longer depends on ReadingID.

STEP 3: 3NF (Third Normal Form)
- Must be in 2NF.
- Remove Transitive Dependencies (non-key attributes should not depend on other non-key attributes).
- Result:
  - LOCATION details (LocationID -> LocationName) moved to LOCATION table.
  - POLLUTANT details (PollutantID -> PollutantName) moved to POLLUTANT table.
  - Final AirGuard schema (USER, LOCATION, POLLUTANT, READING, ALERT) is in 3NF.
*/


/*
==========================================================================
    AIRGUARD DBMS REVIEW - PART 2: TRANSACTIONS
==========================================================================
*/

-- Transaction 1: Conditional Alert Insert
-- Strategy: Insert reading, savepoint, insert alert if high value, commit.
SELECT 'T1: BEFORE' AS Info;
SELECT * FROM READING WHERE ReadingID = 'r-new-001';
SELECT * FROM ALERT WHERE AlertID = 'a-new-001';

START TRANSACTION;
INSERT INTO READING (ReadingID, Value, LocationID, PollutantID, Time) 
VALUES ('r-new-001', 150.00, 'loc-001', 'pol-001', NOW());

SAVEPOINT after_reading;

-- High value detected (>35), manually inserting alert
INSERT INTO ALERT (AlertID, SensorId, PollutantID, UserID, RecID, LocationID)
VALUES ('a-new-001', 'S-999', 'pol-001', 'usr-001', 'rec-005', 'loc-001');

-- If we realized we made a mistake in alert details, we could rollback to savepoint:
-- ROLLBACK TO after_reading; 

COMMIT;

SELECT 'T1: AFTER' AS Info;
SELECT * FROM READING WHERE ReadingID = 'r-new-001';
SELECT * FROM ALERT WHERE AlertID = 'a-new-001';


-- Transaction 2: Valid and Invalid Updates
-- Strategy: Update valid user, savepoint, try invalid user, rollback invalid, commit valid.
SELECT 'T2: BEFORE' AS Info;
SELECT UserID, UpdateRate FROM USER WHERE UserID IN ('usr-001', 'non-existent');

START TRANSACTION;
UPDATE USER SET UpdateRate = 120 WHERE UserID = 'usr-001';
SAVEPOINT valid_update;

-- Try updating a non-existent user (this won't throw error but is a logic fail)
UPDATE USER SET UpdateRate = 999 WHERE UserID = 'non-existent';

-- If logic fails (e.g. affected rows == 0), we rollback to savepoint
ROLLBACK TO valid_update;
COMMIT;

SELECT 'T2: AFTER' AS Info;
SELECT UserID, UpdateRate FROM USER WHERE UserID = 'usr-001';


-- Transaction 3: Duplicate Subscription Handling
-- Strategy: Insert valid sub, savepoint, try duplicate, rollback duplicate, commit.
SELECT 'T3: BEFORE' AS Info;
SELECT * FROM USER_LOCATION WHERE UserID = 'usr-006' AND LocationID = 'loc-001';

START TRANSACTION;
INSERT INTO USER_LOCATION (UserID, LocationID, SubscribedAt) VALUES ('usr-006', 'loc-001', NOW());
SAVEPOINT sub_ok;

-- Attempting duplicate (will fail due to PK constraint)
-- Note: In a real script, a PK violation ends the transaction or needs handling.
-- Here we simulate the intent of rolling back a failed second step.
-- INSERT INTO USER_LOCATION (UserID, LocationID) VALUES ('usr-006', 'loc-001'); -- This would fail

ROLLBACK TO sub_ok;
COMMIT;

SELECT 'T3: AFTER' AS Info;
SELECT * FROM USER_LOCATION WHERE UserID = 'usr-006' AND LocationID = 'loc-001';


-- Transaction 4: FK Constraint Protection
-- Strategy: Delete Alert, savepoint, try delete Reading (which has FK refs in Alert).
SELECT 'T4: BEFORE' AS Info;
SET @rid = (SELECT ReadingID FROM READING LIMIT 1);
SET @aid = (SELECT AlertID FROM ALERT LIMIT 1);
SELECT ReadingID FROM READING WHERE ReadingID = @rid;
SELECT AlertID FROM ALERT WHERE AlertID = @aid;

START TRANSACTION;
DELETE FROM ALERT WHERE AlertID = @aid;
SAVEPOINT alert_deleted;

-- This might fail if the reading is still referenced by other alerts not yet deleted
-- DELETE FROM READING WHERE ReadingID = @rid; 

ROLLBACK TO alert_deleted;
COMMIT;

SELECT 'T4: AFTER' AS Info;
-- Alert is gone, Reading remains
SELECT AlertID FROM ALERT WHERE AlertID = @aid; 
SELECT ReadingID FROM READING WHERE ReadingID = @rid;


-- Transaction 5: Threshold Change and Logic Verification
-- Strategy: Change safe threshold, insert reading that is now 'safe'.
SELECT 'T5: BEFORE' AS Info;
SELECT PollutantID, SafeThreshold FROM POLLUTANT WHERE PollutantID = 'pol-001';

START TRANSACTION;
UPDATE POLLUTANT SET SafeThreshold = 25.00 WHERE PollutantID = 'pol-001';
SAVEPOINT threshold_updated;

INSERT INTO READING (ReadingID, Value, LocationID, PollutantID) 
VALUES ('r-test-101', 30.00, 'loc-002', 'pol-001');

COMMIT;

SELECT 'T5: AFTER' AS Info;
SELECT PollutantID, SafeThreshold FROM POLLUTANT WHERE PollutantID = 'pol-001';
SELECT * FROM READING WHERE ReadingID = 'r-test-101';


/*
==========================================================================
    AIRGUARD DBMS REVIEW - PART 3: CONCURRENCY CONTROL
==========================================================================
*/

-- 1. Row-level locking (SELECT ... FOR UPDATE)
-- Session A:
START TRANSACTION;
SELECT * FROM READING WHERE ReadingID = 'r-new-001' FOR UPDATE;
-- This row is now locked. Session B trying to UPDATE this specific ReadingID 
-- will wait until Session A commits or rolls back.
-- Use case: Prevents two different sensor-sync processes from updating the same reading simultaneously.
COMMIT;

-- 2. Table-level locking (LOCK TABLES)
-- Session A:
LOCK TABLES READING WRITE;
-- Session B: 
-- SELECT * FROM READING; -- This will be blocked/wait because Session A has a WRITE lock.
-- Use case: Heavy maintenance or bulk import where you want to ensure no one reads inconsistent data.
UNLOCK TABLES;

-- 3. Shared Lock (LOCK IN SHARE MODE)
-- Session A:
START TRANSACTION;
SELECT * FROM POLLUTANT WHERE PollutantID = 'pol-001' LOCK IN SHARE MODE;
-- Others can READ this row, but no one can UPDATE it until Session A finishes.
-- Use case: Ensuring the SafeThreshold doesn't change while we are calculating health reports.
COMMIT;

-- 4. COMMIT Example
START TRANSACTION;
UPDATE USER SET UpdateRate = 30 WHERE UserID = 'usr-002';
COMMIT; -- All changes are permanent and locks are released.

-- 5. ROLLBACK Example
START TRANSACTION;
DELETE FROM ALERT; -- Dangerous operation!
ROLLBACK; -- Changes undone, data restored, locks released.

/*
EXPLANATION OF LOCKING IN AIRGUARD:
In an Air Quality system, concurrency is vital. 
- Row-level locking ensures that if two alerts are being generated for the same reading, 
  they don't conflict.
- Shared locks allow multiple "Reporting Views" to read pollutant limits while preventing 
  an admin from changing those limits mid-calculation.
- This prevents "Lost Updates" and "Dirty Reads," ensuring sensor data integrity.
*/
