-- Create the database
CREATE DATABASE IF NOT EXISTS airguard;
USE airguard;

-- Drop tables in reverse FK order for clean setup
DROP TABLE IF EXISTS ALERT;
DROP TABLE IF EXISTS RECOMMENDATION;
DROP TABLE IF EXISTS READING;
DROP TABLE IF EXISTS POLLUTANT;
DROP TABLE IF EXISTS USER_LOCATION;
DROP TABLE IF EXISTS USER;
DROP TABLE IF EXISTS LOCATION;
DROP TABLE IF EXISTS WEATHER_API;

-- 1. WEATHER_API
CREATE TABLE WEATHER_API (
    API_ID VARCHAR(36) PRIMARY KEY,
    Name VARCHAR(100) NOT NULL,
    EndpointURL VARCHAR(255) NOT NULL
);
INSERT INTO WEATHER_API VALUES ('api-001', 'OpenWeatherMap Air Pollution API', 'http://api.openweathermap.org/data/2.5/air_pollution');

-- 2. LOCATION
CREATE TABLE LOCATION (
    LocationID VARCHAR(36) PRIMARY KEY,
    Name VARCHAR(100) NOT NULL,
    State VARCHAR(100) NOT NULL,
    Latitude DECIMAL(9,6) NOT NULL,
    Longitude DECIMAL(9,6) NOT NULL,
    API_ID VARCHAR(36),
    FOREIGN KEY (API_ID) REFERENCES WEATHER_API(API_ID)
);
INSERT INTO LOCATION VALUES 
  ('loc-001', 'Chennai', 'Tamil Nadu', 13.08, 80.27, 'api-001'),
  ('loc-002', 'Mumbai', 'Maharashtra', 19.08, 72.88, 'api-001'),
  ('loc-003', 'Delhi', 'Delhi', 28.61, 77.21, 'api-001'),
  ('loc-004', 'Kolkata', 'West Bengal', 22.57, 88.36, 'api-001'),
  ('loc-005', 'Hyderabad', 'Telangana', 17.39, 78.49, 'api-001'),
  ('loc-006', 'Ahmedabad', 'Gujarat', 23.02, 72.57, 'api-001');

-- 3. USER
CREATE TABLE USER (
    UserID VARCHAR(36) PRIMARY KEY,
    UserName VARCHAR(100) NOT NULL UNIQUE,
    FtnName VARCHAR(100),
    Email VARCHAR(100) UNIQUE NOT NULL,
    Password VARCHAR(255) NOT NULL,
    UpdateRate INT DEFAULT 60
);
INSERT INTO USER (UserID, UserName, FtnName, Email, Password) VALUES
  ('usr-001', 'admin', 'System Admin', 'admin@airguard.com', 'admin123'),
  ('usr-002', 'rahul_s', 'Rahul Sharma', 'rahul@example.com', 'rahul123'),
  ('usr-003', 'priya_m', 'Priya Mehta', 'priya@example.com', 'priya123'),
  ('usr-004', 'amit_v', 'Amit Verma', 'amit@example.com', 'amit123'),
  ('usr-005', 'sneha_k', 'Sneha Kapoor', 'sneha@example.com', 'sneha123'),
  ('usr-006', 'vikram_j', 'Vikram Joshi', 'vikram@example.com', 'vikram123');

-- 4. USER_LOCATION
CREATE TABLE USER_LOCATION (
    UserID VARCHAR(36),
    LocationID VARCHAR(36),
    SubscribedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (UserID, LocationID),
    FOREIGN KEY (UserID) REFERENCES USER(UserID),
    FOREIGN KEY (LocationID) REFERENCES LOCATION(LocationID)
);
INSERT INTO USER_LOCATION VALUES
  ('usr-001', 'loc-001', NOW()),
  ('usr-001', 'loc-003', NOW()),
  ('usr-002', 'loc-002', NOW()),
  ('usr-003', 'loc-004', NOW()),
  ('usr-004', 'loc-005', NOW()),
  ('usr-005', 'loc-006', NOW());

-- 5. POLLUTANT
CREATE TABLE POLLUTANT (
    PollutantID VARCHAR(36) PRIMARY KEY,
    Name VARCHAR(100) NOT NULL,
    Unit VARCHAR(20),
    SafeThreshold DECIMAL(10,2)
);
INSERT INTO POLLUTANT VALUES
  ('pol-001', 'PM2.5', 'μg/m³', 35.00),
  ('pol-002', 'PM10',  'μg/m³', 75.00),
  ('pol-003', 'NO2',   'μg/m³', 40.00),
  ('pol-004', 'CO',    'mg/m³', 4.00),
  ('pol-005', 'O3',    'μg/m³', 100.00),
  ('pol-006', 'SO2',   'μg/m³', 20.00);

-- 6. READING
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
INSERT INTO READING (ReadingID, Value, LocationID, PollutantID, Time) VALUES 
  -- Chennai (Optimal)
  (UUID(), 12.50, 'loc-001', 'pol-001', NOW()), (UUID(), 28.10, 'loc-001', 'pol-002', NOW()), (UUID(), 15.20, 'loc-001', 'pol-003', NOW()), 
  (UUID(), 0.45, 'loc-001', 'pol-004', NOW()), (UUID(), 22.10, 'loc-001', 'pol-005', NOW()), (UUID(), 8.30, 'loc-001', 'pol-006', NOW()),
  
  -- Mumbai (Moderate)
  (UUID(), 48.20, 'loc-002', 'pol-001', NOW()), (UUID(), 85.00, 'loc-002', 'pol-002', NOW()), (UUID(), 38.40, 'loc-002', 'pol-003', NOW()), 
  (UUID(), 1.80, 'loc-002', 'pol-004', NOW()), (UUID(), 45.30, 'loc-002', 'pol-005', NOW()), (UUID(), 12.50, 'loc-002', 'pol-006', NOW()),
  
  -- Delhi (CRITICAL - Edge Case)
  (UUID(), 185.50, 'loc-003', 'pol-001', NOW()), (UUID(), 210.30, 'loc-003', 'pol-002', NOW()), (UUID(), 75.80, 'loc-003', 'pol-003', NOW()), 
  (UUID(), 5.20, 'loc-003', 'pol-004', NOW()), (UUID(), 95.00, 'loc-003', 'pol-005', NOW()), (UUID(), 42.10, 'loc-003', 'pol-006', NOW()),
  
  -- Kolkata (Fair)
  (UUID(), 38.12, 'loc-004', 'pol-001', NOW()), (UUID(), 62.40, 'loc-004', 'pol-002', NOW()), (UUID(), 28.50, 'loc-004', 'pol-003', NOW()), 
  (UUID(), 1.10, 'loc-004', 'pol-004', NOW()), (UUID(), 35.20, 'loc-004', 'pol-005', NOW()), (UUID(), 15.60, 'loc-004', 'pol-006', NOW()),
  
  -- Hyderabad (Optimal)
  (UUID(), 18.00, 'loc-005', 'pol-001', NOW()), (UUID(), 35.20, 'loc-005', 'pol-002', NOW()), (UUID(), 12.40, 'loc-005', 'pol-003', NOW()), 
  (UUID(), 0.35, 'loc-005', 'pol-004', NOW()), (UUID(), 32.50, 'loc-005', 'pol-005', NOW()), (UUID(), 6.20, 'loc-005', 'pol-006', NOW()),
  
  -- Ahmedabad (Moderate)
  (UUID(), 58.08, 'loc-006', 'pol-001', NOW()), (UUID(), 92.40, 'loc-006', 'pol-002', NOW()), (UUID(), 42.10, 'loc-006', 'pol-003', NOW()), 
  (UUID(), 2.40, 'loc-006', 'pol-004', NOW()), (UUID(), 55.30, 'loc-006', 'pol-005', NOW()), (UUID(), 22.80, 'loc-006', 'pol-006', NOW());

-- 7. RECOMMENDATION
CREATE TABLE RECOMMENDATION (
    RecID VARCHAR(36) PRIMARY KEY,
    Name VARCHAR(100) NOT NULL,
    Description TEXT,
    Category VARCHAR(50),
    PollutantID VARCHAR(36),
    FOREIGN KEY (PollutantID) REFERENCES POLLUTANT(PollutantID)
);
INSERT INTO RECOMMENDATION (RecID, Name, Description, Category, PollutantID) VALUES
  ('rec-001', 'Outdoor Activities', 'Air quality is excellent. Perfect for jogging.', 'Optimal', 'pol-001'),
  ('rec-002', 'Window Ventilation', 'Ideal time to ventilate your home.', 'Optimal', 'pol-001'),
  ('rec-003', 'Sensitive Precautions', 'Sensitive groups should limit outdoor exertion.', 'Fair', 'pol-001'),
  ('rec-004', 'Reduce Intensity', 'Consider shortening outdoor exercise sessions.', 'Fair', 'pol-002'),
  ('rec-005', 'Mask Recommended', 'High pollution. Use an N95 mask.', 'Moderate', 'pol-001'),
  ('rec-006', 'Stay Indoors', 'Poor air quality. Avoid outdoor activities.', 'Poor', 'pol-001');

-- 8. ALERT
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
INSERT INTO ALERT (AlertID, SensorId, PollutantID, UserID, RecID, LocationID, CreatedAt) VALUES
  (UUID(), 'S-001', 'pol-001', 'usr-001', 'rec-005', 'loc-001', NOW()),
  (UUID(), 'S-002', 'pol-001', 'usr-002', 'rec-003', 'loc-002', NOW()),
  (UUID(), 'S-003', 'pol-002', 'usr-003', 'rec-004', 'loc-004', NOW()),
  (UUID(), 'S-004', 'pol-003', 'usr-004', 'rec-005', 'loc-005', NOW()),
  (UUID(), 'S-005', 'pol-001', 'usr-005', 'rec-005', 'loc-006', NOW()),
  (UUID(), 'S-006', 'pol-001', 'usr-001', 'rec-003', 'loc-003', NOW());

-- --- ADVANCED DBMS FEATURES (EASY TO EXPLAIN) ---

-- 9. VIEW: SHOW CURRENT LIVE STATUS (Joins & Subqueries)
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

-- 10. VIEW: CITY WISE AVERAGES (Aggregate Functions & Group By)
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

-- 11. VIEW: EMERGENCY MONITORING ZONE (Set Operations: UNION)
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

-- 12. STORED PROCEDURE: GENERATE DAILY HEALTH REPORT (Cursor & Exception Handling)
DELIMITER //
CREATE PROCEDURE Procedure_Generate_City_Health_Report(IN Target_City_ID VARCHAR(36))
BEGIN
    DECLARE Is_Finished INT DEFAULT FALSE;
    DECLARE Current_Pollutant_Name VARCHAR(100);
    DECLARE Calculated_Average DECIMAL(10,2);
    
    DECLARE Data_Cursor CURSOR FOR 
        SELECT POLLUTANT.Name, AVG(READING.Value) 
        FROM READING
        JOIN POLLUTANT ON READING.PollutantID = POLLUTANT.PollutantID 
        WHERE READING.LocationID = Target_City_ID 
        GROUP BY POLLUTANT.Name;
        
    DECLARE CONTINUE HANDLER FOR NOT FOUND SET Is_Finished = TRUE;

    OPEN Data_Cursor;
    
    Report_Loop: LOOP
        FETCH Data_Cursor INTO Current_Pollutant_Name, Calculated_Average;
        IF Is_Finished THEN 
            LEAVE Report_Loop; 
        END IF;
        
        SELECT Current_Pollutant_Name AS Pollutant, Calculated_Average AS City_Average;
    END LOOP;

    CLOSE Data_Cursor;
END //
DELIMITER ;

-- 13. TRIGGER: AUTOMATIC EMERGENCY ALERT (Triggers)
DELIMITER //
CREATE TRIGGER Trigger_Check_Pollution_And_Alert
AFTER INSERT ON READING
FOR EACH ROW
BEGIN
    DECLARE Pollutant_Safe_Limit DECIMAL(10,2);
    DECLARE Suggested_Health_Rec_ID VARCHAR(36);
    
    SELECT SafeThreshold INTO Pollutant_Safe_Limit 
    FROM POLLUTANT WHERE PollutantID = NEW.PollutantID;
    
    IF NEW.Value > Pollutant_Safe_Limit THEN
        -- Select a recommendation for the exceeded pollutant
        SELECT RecID INTO Suggested_Health_Rec_ID 
        FROM RECOMMENDATION WHERE PollutantID = NEW.PollutantID LIMIT 1;
        
        -- Insert alerts for ALL users subscribed to this specific location
        INSERT INTO ALERT (AlertID, PollutantID, UserID, RecID, LocationID, CreatedAt)
        SELECT UUID(), NEW.PollutantID, UserID, Suggested_Health_Rec_ID, NEW.LocationID, NOW()
        FROM USER_LOCATION
        WHERE LocationID = NEW.LocationID;
    END IF;
END //
DELIMITER ;
