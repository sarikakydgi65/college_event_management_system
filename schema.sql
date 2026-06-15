-- ==========================================
-- College Event Management System Database Script
-- Target Database: MySQL 8.0+ (InnoDB Engine)
-- ==========================================

-- Create Database if not exists and work in its context
CREATE DATABASE IF NOT EXISTS college_event_management;
USE college_event_management;

-- Clear any existing tables to ensure a clean drop-and-rebuild sequence
SET FOREIGN_KEY_CHECKS = 0;
DROP TABLE IF EXISTS CLASSROOM_BOOKING;
DROP TABLE IF EXISTS FEEDBACK;
DROP TABLE IF EXISTS REGISTRATION;
DROP TABLE IF EXISTS ORGANIZER;
DROP TABLE IF EXISTS CLASSROOM;
DROP TABLE IF EXISTS EVENT;
DROP TABLE IF EXISTS STUDENT;
SET FOREIGN_KEY_CHECKS = 1;

-- ==========================================
-- 1. TABLE CREATIONS WITH DATA TYPES & CONSTRAINTS
-- ==========================================

-- STUDENT TABLE: Holds basic details for college students
CREATE TABLE STUDENT (
    student_id INT AUTO_INCREMENT,
    name VARCHAR(100) NOT NULL,
    department VARCHAR(50) NOT NULL,
    year INT NOT NULL CHECK (year BETWEEN 1 AND 4),
    email VARCHAR(100) NOT NULL UNIQUE,
    phone VARCHAR(20) NOT NULL,
    PRIMARY KEY (student_id),
    INDEX idx_student_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- EVENT TABLE: Holds information on academic or cultural campus events
CREATE TABLE EVENT (
    event_id INT AUTO_INCREMENT,
    event_name VARCHAR(150) NOT NULL,
    event_date DATE NOT NULL,
    venue VARCHAR(100) NOT NULL,
    description TEXT,
    max_capacity INT NOT NULL CHECK (max_capacity > 0),
    PRIMARY KEY (event_id),
    INDEX idx_event_date (event_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ORGANIZER TABLE: Stores organizer information associated to a specific event
CREATE TABLE ORGANIZER (
    organizer_id INT AUTO_INCREMENT,
    organizer_name VARCHAR(100) NOT NULL,
    organizer_role VARCHAR(100) NOT NULL,
    event_id INT NOT NULL,
    phone VARCHAR(20) NOT NULL,
    PRIMARY KEY (organizer_id),
    -- One event has exactly or at most one organizer
    UNIQUE KEY (event_id),
    CONSTRAINT fk_organizer_event 
        FOREIGN KEY (event_id) REFERENCES EVENT (event_id)
        ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- REGISTRATION TABLE: Maps students to their enrolled events safely without duplicates
CREATE TABLE REGISTRATION (
    registration_id INT AUTO_INCREMENT,
    student_id INT NOT NULL,
    event_id INT NOT NULL,
    attendance_status ENUM('Present', 'Absent', 'Registered') NOT NULL DEFAULT 'Registered',
    PRIMARY KEY (registration_id),
    -- Constraint to prevent duplicate registrations for the same event
    UNIQUE KEY uq_student_event (student_id, event_id),
    CONSTRAINT fk_registration_student 
        FOREIGN KEY (student_id) REFERENCES STUDENT (student_id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_registration_event 
        FOREIGN KEY (event_id) REFERENCES EVENT (event_id)
        ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- FEEDBACK TABLE: Captures ratings and notes from attendees after events
CREATE TABLE FEEDBACK (
    feedback_id INT AUTO_INCREMENT,
    student_id INT NOT NULL,
    event_id INT NOT NULL,
    rating INT NOT NULL CHECK (rating BETWEEN 1 AND 5),
    comments TEXT NOT NULL,
    PRIMARY KEY (feedback_id),
    -- Prevent a student from giving feedback multiple times for the same event
    UNIQUE KEY uq_feedback_student_event (student_id, event_id),
    CONSTRAINT fk_feedback_student 
        FOREIGN KEY (student_id) REFERENCES STUDENT (student_id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_feedback_event 
        FOREIGN KEY (event_id) REFERENCES EVENT (event_id)
        ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- CLASSROOM TABLE: Details for halls/rooms available for bookings
CREATE TABLE CLASSROOM (
    classroom_id INT AUTO_INCREMENT,
    block_name VARCHAR(50) NOT NULL,
    room_number VARCHAR(20) NOT NULL,
    capacity INT NOT NULL CHECK (capacity > 0),
    availability_status ENUM('Available', 'Occupied') NOT NULL DEFAULT 'Available',
    PRIMARY KEY (classroom_id),
    -- Ensure individual room identity per block is unique
    UNIQUE KEY uq_block_room (block_name, room_number)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- CLASSROOM_BOOKING TABLE: Stores bookings made for specific events inside classrooms
CREATE TABLE CLASSROOM_BOOKING (
    booking_id INT AUTO_INCREMENT,
    event_id INT NOT NULLUnique, -- One event is allocated to one classroom booking
    classroom_id INT NOT NULL,
    booking_date DATE NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    booking_status ENUM('Confirmed', 'Cancelled') NOT NULL DEFAULT 'Confirmed',
    PRIMARY KEY (booking_id),
    -- Basic logic check: end time must succeed start time
    CONSTRAINT chk_booking_times CHECK (start_time < end_time),
    CONSTRAINT fk_booking_event 
        FOREIGN KEY (event_id) REFERENCES EVENT (event_id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_booking_classroom 
        FOREIGN KEY (classroom_id) REFERENCES CLASSROOM (classroom_id)
        ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


-- ==========================================
-- 2. TRANSACTIONS & DOUBLE BOOKING PREVENTION (SQL TRIGGER)
-- ==========================================
DELIMITER $$

-- Trigger to reject confirmed bookings that overlap with another active booking of the same classroom.
CREATE TRIGGER trg_prevent_double_booking
BEFORE INSERT ON CLASSROOM_BOOKING
FOR EACH ROW
BEGIN
    DECLARE overlap_count INT DEFAULT 0;
    
    -- Check if booking is 'Confirmed' and overlaps with an existing 'Confirmed' booking of the same classroom on the same day.
    IF NEW.booking_status = 'Confirmed' THEN
        SELECT COUNT(*)
        INTO overlap_count
        FROM CLASSROOM_BOOKING
        WHERE classroom_id = NEW.classroom_id
          AND booking_date = NEW.booking_date
          AND booking_status = 'Confirmed'
          -- The overlap formula checks if the periods intersect
          AND NOT (NEW.end_time <= start_time OR NEW.start_time >= end_time);
        
        IF overlap_count > 0 THEN
            SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Double booking detected! This classroom is already reserved during the chosen timeframe.';
        END IF;
    END IF;
END$$

-- Trigger to handle updates and preserve conflict check
CREATE TRIGGER trg_prevent_double_booking_update
BEFORE UPDATE ON CLASSROOM_BOOKING
FOR EACH ROW
BEGIN
    DECLARE overlap_count INT DEFAULT 0;
    
    IF NEW.booking_status = 'Confirmed' THEN
        SELECT COUNT(*)
        INTO overlap_count
        FROM CLASSROOM_BOOKING
        WHERE classroom_id = NEW.classroom_id
          AND booking_date = NEW.booking_date
          AND booking_status = 'Confirmed'
          AND booking_id <> NEW.booking_id -- ignore itself
          -- The overlap formula checks if the periods intersect
          AND NOT (NEW.end_time <= start_time OR NEW.start_time >= end_time);
        
        IF overlap_count > 0 THEN
            SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Double booking detected! This classroom is already reserved during the chosen timeframe.';
        END IF;
    END IF;
END$$

DELIMITER ;


-- ==========================================
-- 3. INSERTING REALISTIC SAMPLE DATA
-- ==========================================

-- Inserting Students (6 records)
INSERT INTO STUDENT (student_id, name, department, year, email, phone) VALUES
(1, 'Alice Vance', 'Computer Science', 3, 'alice.vance@college.edu', '555-0101'),
(2, 'Bob Sterling', 'Information Technology', 2, 'bob.sterling@college.edu', '555-0102'),
(3, 'Charlie Dev', 'Electronics Engineering', 4, 'charlie.dev@college.edu', '555-0103'),
(4, 'Diana Prince', 'Computer Science', 1, 'diana.prince@college.edu', '555-0104'),
(5, 'Ethan Hunt', 'Mechanical Engineering', 3, 'ethan.hunt@college.edu', '555-0105'),
(6, 'Fiona Glenanne', 'Electrical Science', 2, 'fiona.g@college.edu', '555-0106');

-- Inserting Events (4 events, mix of past and upcoming relative to current date 2026-05-28)
-- Upcoming Events (Dates after 2026-05-28)
-- Past Events (Dates on or before 2026-05-28)
INSERT INTO EVENT (event_id, event_name, event_date, venue, description, max_capacity) VALUES
(101, 'National Tech Symposium', '2026-06-15', 'Main Auditorium', 'Annual national-level tech research showcase and coding hackathon.', 150),
(102, 'Art & Culture Fest 2026', '2026-06-22', 'Open Air Theater', 'An interactive display of painting, music, drama and cultural heritage.', 250),
(103, 'AI & Robotics Workshop', '2026-05-10', 'Seminar Hall B', 'Hands-on training session on generative models and physical robotics controls.', 40),
(104, 'Orientation Ceremony 2026', '2026-05-25', 'Conference Room Alpha', 'Welcoming and introducing freshers to the college guidelines and facilities.', 100);

-- Inserting Organizer (Associate with National Tech Symposium, event_id = 101)
INSERT INTO ORGANIZER (organizer_id, organizer_name, organizer_role, event_id, phone) VALUES
(1, 'Professor Marcus Vance', 'Senior CS Coordinator', 101, '555-0900');

-- Inserting Registrations (9 registrations across events, with mix of attendance status)
INSERT INTO REGISTRATION (student_id, event_id, attendance_status) VALUES
-- Registrations for Event 101 (Upcoming)
(1, 101, 'Registered'),
(2, 101, 'Registered'),
(3, 101, 'Registered'),
(4, 101, 'Registered'),
-- Registrations for Event 103 (Past, Attendance Logged)
(1, 103, 'Present'),
(3, 103, 'Absent'),
(5, 103, 'Present'),
-- Registrations for Event 104 (Past, Attendance Logged)
(2, 104, 'Present'),
(4, 104, 'Present'),
(6, 104, 'Absent');

-- Inserting Feedbacks (Ratings 3-5 for completed events 103 and 104)
INSERT INTO FEEDBACK (student_id, event_id, rating, comments) VALUES
(1, 103, 5, 'Superb hands-on experience! The robotics lab instructors were incredibly clear and patient.'),
(5, 103, 4, 'Great material, but I wish we had an extra hour to complete the robotic arm calibration project.'),
(2, 104, 3, 'Decent orientation. Found the guidelines slightly boring but the campus tour part was fun!'),
(4, 104, 5, 'Wonderfully organized! The welcome kits and visual directories were extremely helpful for a freshman.');

-- Inserting Classrooms (3 classrooms)
INSERT INTO CLASSROOM (classroom_id, block_name, room_number, capacity, availability_status) VALUES
(1, 'Sir C.V. Raman Block', 'Room 302', 60, 'Available'),
(2, 'Alan Turing Annex', 'Seminar Hall B', 45, 'Occupied'),
(3, 'Vikram Sarabhai Tower', 'Auditorium Annex', 120, 'Available');

-- Inserting Classroom Bookings (2 bookings, illustrating a non-overlapping flow and testing conflict)
INSERT INTO CLASSROOM_BOOKING (booking_id, event_id, classroom_id, booking_date, start_time, end_time, booking_status) VALUES
-- Booking for event 103
(201, 103, 2, '2026-05-10', '09:00:00', '13:00:00', 'Confirmed'),
-- Booking for event 101
(202, 101, 3, '2026-06-15', '09:30:00', '15:30:00', 'Confirmed');


-- ==========================================
-- 4. PRIMARY SQL QUERIES (FROM THE CORE TASKS)
-- ==========================================

-- Query 1: List all upcoming events with their date and venue.
-- Uses the anchor date from instructions (2026-05-28) to define "upcoming" properly.
SELECT 
    event_id, 
    event_name, 
    event_date, 
    venue 
FROM EVENT 
WHERE event_date >= '2026-05-28' 
ORDER BY event_date ASC;

-- Query 2: Count total registrations for each event.
SELECT 
    e.event_id, 
    e.event_name, 
    COUNT(r.registration_id) AS total_registrations 
FROM EVENT e 
LEFT JOIN REGISTRATION r ON e.event_id = r.event_id 
GROUP BY e.event_id, e.event_name
ORDER BY total_registrations DESC;

-- Query 3: List students and their attendance status for a particular event (event_id = 101)
SELECT 
    s.student_id, 
    s.name, 
    s.department, 
    r.attendance_status 
FROM REGISTRATION r 
JOIN STUDENT s ON r.student_id = s.student_id 
WHERE r.event_id = 101;

-- Query 4: Show all available classrooms (not booked/vacant) on a given date and time slot.
-- Inputs: Date: '2026-06-15', Time slot: '10:00:00' to '12:00:00'
-- Result should exclude Vikram Sarabhai Tower (Auditorium Annex) since it has Booking 202 on 2026-06-15 during 09:30 - 15:30.
SELECT 
    classroom_id, 
    block_name, 
    room_number, 
    capacity 
FROM CLASSROOM 
WHERE classroom_id NOT IN (
    SELECT classroom_id 
    FROM CLASSROOM_BOOKING 
    WHERE booking_date = '2026-06-15' 
      AND booking_status = 'Confirmed'
      -- Overlap math: booking starts before chosen end AND ends after chosen start
      AND start_time < '12:00:00' 
      AND end_time > '10:00:00'
);

-- Query 5: Display feedback with rating greater than or equal to 4.
SELECT 
    f.feedback_id, 
    s.name AS student_name, 
    e.event_name, 
    f.rating, 
    f.comments 
FROM FEEDBACK f 
JOIN STUDENT s ON f.student_id = s.student_id 
JOIN EVENT e ON f.event_id = e.event_id 
WHERE f.rating >= 4
ORDER BY f.rating DESC;


-- ==========================================
-- 5. ADDITIONAL USEFUL QUERIES
-- ==========================================

-- Query 6: Show attendance percentage per event (calculated from past finished events)
SELECT 
    e.event_id, 
    e.event_name, 
    COUNT(r.registration_id) AS total_registrations,
    SUM(CASE WHEN r.attendance_status = 'Present' THEN 1 ELSE 0 END) AS present_count,
    ROUND(
        (SUM(CASE WHEN r.attendance_status = 'Present' THEN 1 ELSE 0 END) / COUNT(r.registration_id)) * 100, 
        2
    ) AS attendance_percentage 
FROM EVENT e 
JOIN REGISTRATION r ON e.event_id = r.event_id 
GROUP BY e.event_id, e.event_name
HAVING COUNT(r.registration_id) > 0;

-- Query 7: List all events registered by a specific student (student_id = 1), with attendance status
SELECT 
    e.event_id, 
    e.event_name, 
    e.event_date, 
    r.attendance_status 
FROM REGISTRATION r 
JOIN EVENT e ON r.event_id = e.event_id 
WHERE r.student_id = 1;

-- Query 8: Find the most popular event on campus based on highest registration counts
SELECT 
    e.event_id, 
    e.event_name, 
    COUNT(r.registration_id) AS registration_count,
    e.venue
FROM EVENT e 
LEFT JOIN REGISTRATION r ON e.event_id = r.event_id 
GROUP BY e.event_id, e.event_name, e.venue
ORDER BY registration_count DESC 
LIMIT 1;


-- ==========================================
-- 6. DOUBLE BOOKING TESTING SCENARIO (DEMONSTRATIVE TRIGGER FAILURE)
-- ==========================================
-- This insert is designed to FAIL with a custom message. Uncomment to test in MySQL editor:
-- INSERT INTO CLASSROOM_BOOKING (event_id, classroom_id, booking_date, start_time, end_time, booking_status) 
-- VALUES (102, 3, '2026-06-15', '11:00:00', '13:00:00', 'Confirmed');
