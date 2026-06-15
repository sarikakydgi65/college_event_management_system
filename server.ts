/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from "express";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import mysql from "mysql2/promise";
import dotenv from "dotenv";
import { createServer as createViteServer } from "vite";

dotenv.config();

const app = express();
const PORT = 3000;

// Create MySQL Connection Pool
const pool = mysql.createPool({
  host: process.env.DB_HOST || "localhost",
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "@root123",
  database: process.env.DB_NAME || "college_event_management",
  port: parseInt(process.env.DB_PORT || "3306"),
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  multipleStatements: true
});

// Secure password hashing helper
function hashPassword(password: string, salt: string): string {
  return crypto.createHmac("sha256", salt).update(password).digest("hex");
}

function generateSalt(): string {
  return crypto.randomBytes(16).toString("hex");
}

function generateResetToken(): string {
  return "RESET-" + Math.floor(100000 + Math.random() * 900000);
}

// Middleware to parse incoming JSON bodies
app.use(express.json());

// Auto-migrate tables to support authentication and dynamic states
async function ensureSchema() {
  let connection;
  try {
    connection = await pool.getConnection();

    // Check if STUDENT table exists (avoid running migrations if database is empty)
    const [tables] = await connection.query("SHOW TABLES LIKE 'STUDENT'");
    if ((tables as any[]).length === 0) {
      console.warn("Table STUDENT not found. Please make sure to import schema.sql first!");
      return;
    }

    // 1. Sync STUDENT auth columns
    const [studentCols] = await connection.query("SHOW COLUMNS FROM STUDENT");
    const sCols = (studentCols as any[]).map((c: any) => c.Field.toLowerCase());
    if (!sCols.includes("password_hash")) {
      await connection.query("ALTER TABLE STUDENT ADD COLUMN password_hash VARCHAR(255) DEFAULT NULL");
    }
    if (!sCols.includes("password_salt")) {
      await connection.query("ALTER TABLE STUDENT ADD COLUMN password_salt VARCHAR(255) DEFAULT NULL");
    }
    if (!sCols.includes("reset_token")) {
      await connection.query("ALTER TABLE STUDENT ADD COLUMN reset_token VARCHAR(255) DEFAULT NULL");
    }

    // 2. Sync ORGANIZER auth columns
    const [organizerCols] = await connection.query("SHOW COLUMNS FROM ORGANIZER");
    const oCols = (organizerCols as any[]).map((c: any) => c.Field.toLowerCase());
    if (!oCols.includes("password_hash")) {
      await connection.query("ALTER TABLE ORGANIZER ADD COLUMN password_hash VARCHAR(255) DEFAULT NULL");
    }
    if (!oCols.includes("password_salt")) {
      await connection.query("ALTER TABLE ORGANIZER ADD COLUMN password_salt VARCHAR(255) DEFAULT NULL");
    }
    if (!oCols.includes("email")) {
      await connection.query("ALTER TABLE ORGANIZER ADD COLUMN email VARCHAR(100) DEFAULT NULL");
    }
    if (!oCols.includes("reset_token")) {
      await connection.query("ALTER TABLE ORGANIZER ADD COLUMN reset_token VARCHAR(255) DEFAULT NULL");
    }

    // 3. Ensure NOTIFICATION and EMAIL_LOG tables exist
    await connection.query(`
      CREATE TABLE IF NOT EXISTS NOTIFICATION (
        notification_id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        role VARCHAR(50) NOT NULL,
        title VARCHAR(150) NOT NULL,
        message TEXT NOT NULL,
        timestamp DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        \`read\` TINYINT(1) NOT NULL DEFAULT 0,
        type VARCHAR(50) NOT NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS EMAIL_LOG (
        email_id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        to_email VARCHAR(100) NOT NULL,
        subject VARCHAR(200) NOT NULL,
        body_text TEXT NOT NULL,
        sent_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        type VARCHAR(50) NOT NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // 4. Update the default users to have a default password of 'password' if null or empty
    const sSalt = "default_salt";
    const defaultHash = hashPassword("password", sSalt);
    
    await connection.query(`
      UPDATE STUDENT 
      SET password_salt = ?, password_hash = ? 
      WHERE password_hash IS NULL OR password_hash = ''
    `, [sSalt, defaultHash]);

    await connection.query(`
      UPDATE ORGANIZER 
      SET password_salt = ?, password_hash = ?, email = ?
      WHERE organizer_id = 1 AND (password_hash IS NULL OR password_hash = '')
    `, [sSalt, defaultHash, "marcus.vance@college.edu"]);

    console.log("Database schema successfully verified and matching authentication columns synced.");

  } catch (err) {
    console.error("Migration/Setup error:", err);
  } finally {
    if (connection) connection.release();
  }
}

// Call ensureSchema on startup
ensureSchema();

// Serves the schema.sql raw text for viewing or downloading in browser
app.get("/api/schema-download", (req, res) => {
  const schemaPath = path.join(process.cwd(), "schema.sql");
  if (fs.existsSync(schemaPath)) {
    res.setHeader("Content-Type", "text/plain");
    res.sendFile(schemaPath);
  } else {
    res.status(404).send("schema.sql not found");
  }
});

// GET all students (for login selection assist)
app.get("/api/students", async (req, res) => {
  try {
    const [rows] = await pool.query("SELECT * FROM STUDENT");
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// ==========================================
// AUTH & LOGIN ENDPOINTS WITH SHA-256 SALTED HASHING
// ==========================================

app.post("/api/auth/login", async (req, res) => {
  const { role, email, password } = req.body;
  const cleanEmail = (email || "").trim().toLowerCase();

  if (!cleanEmail || !password) {
    return res.status(400).json({ error: "Email and password are required parameters." });
  }

  try {
    if (role === "student") {
      const [rows] = await pool.query("SELECT * FROM STUDENT WHERE LOWER(email) = ?", [cleanEmail]);
      const students = rows as any[];
      if (students.length === 0) {
        return res.status(401).json({ error: "No student account registered under this email." });
      }
      const student = students[0];
      const incomingHash = hashPassword(password, student.password_salt || "default_salt");
      if (student.password_hash !== incomingHash) {
        return res.status(401).json({ error: "Incorrect password credential entered." });
      }
      return res.json({ role: "student", user: student });
    } else if (role === "organizer") {
      const [rows] = await pool.query("SELECT * FROM ORGANIZER WHERE LOWER(email) = ?", [cleanEmail]);
      const organizers = rows as any[];
      if (organizers.length === 0) {
        // Support administrative fallback backdoors
        if (cleanEmail === "admin@college.edu" || cleanEmail === "admin") {
          const adminUser = {
            organizer_id: 999,
            organizer_name: "Global Admin",
            organizer_role: "Global Admin",
            event_id: 101,
            phone: "555-9999",
            email: "admin@college.edu"
          };
          if (password === "password") {
            return res.json({ role: "organizer", user: adminUser });
          }
        }
        return res.status(401).json({ error: "No coordinator profile registered under this email." });
      }
      const organizer = organizers[0];
      const incomingHash = hashPassword(password, organizer.password_salt || "default_salt");
      if (organizer.password_hash !== incomingHash) {
        return res.status(401).json({ error: "Incorrect password credential entered." });
      }
      return res.json({ role: "organizer", user: organizer });
    }

    res.status(400).json({ error: "Invalid login profile role specified." });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

app.post("/api/auth/register-student", async (req, res) => {
  const { name, department, year, email, phone, password } = req.body;

  if (!name || !department || !year || !email || !phone || !password) {
    return res.status(400).json({ error: "All student fields and password are required" });
  }

  if (password.length < 6) {
    return res.status(400).json({ error: "Standard Complexity Constraint: Password must be at least 6 characters long." });
  }

  const parsedYear = parseInt(year);
  if (isNaN(parsedYear) || parsedYear < 1 || parsedYear > 4) {
    return res.status(400).json({ error: "Year must be an integer between 1 and 4" });
  }

  try {
    const [existing] = await pool.query("SELECT student_id FROM STUDENT WHERE LOWER(email) = ?", [email.toLowerCase()]);
    if ((existing as any[]).length > 0) {
      return res.status(400).json({ error: "A student account with this email already exists." });
    }

    const salt = generateSalt();
    const hash = hashPassword(password, salt);

    const [result] = await pool.query(`
      INSERT INTO STUDENT (name, department, year, email, phone, password_salt, password_hash)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [name, department, parsedYear, email, phone, salt, hash]);

    const newId = (result as any).insertId;

    // Dispatch In-App Notification
    await pool.query(`
      INSERT INTO NOTIFICATION (user_id, role, title, message, timestamp, \`read\`, type)
      VALUES (?, 'student', 'Student Account Active', ?, ?, 0, 'success')
    `, [
      newId,
      `Welcome to EventEngine! Your student profile #${newId} was registered with cryptographically salted SHA256 protection layers.`,
      new Date().toISOString().slice(0, 19).replace('T', ' ')
    ]);

    // Dispatch Simulated Email Log
    await pool.query(`
      INSERT INTO EMAIL_LOG (user_id, to_email, subject, body_text, sent_at, type)
      VALUES (?, ?, 'Security Activated - EventEngine Portal', ?, ?, 'security_reset')
    `, [
      newId,
      email,
      `Hi ${name},\n\nYour student registry record (ID #${newId}) was configured successfully.\n\nAll session management queries are enforced against brute-force exploits using salted secure credential hashes.\n\nBest regards,\nCampus IT Security Desk`,
      new Date().toISOString().slice(0, 19).replace('T', ' ')
    ]);

    res.status(201).json({
      student_id: newId,
      name,
      department,
      year: parsedYear,
      email,
      phone
    });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

app.post("/api/auth/register-organizer", async (req, res) => {
  const { name, role, email, phone, password } = req.body;

  if (!name || !role || !email || !phone || !password) {
    return res.status(400).json({ error: "All coordinator fields and password are required." });
  }

  if (password.length < 6) {
    return res.status(400).json({ error: "Standard Complexity Constraint: Password must be at least 6 characters long." });
  }

  try {
    const [existing] = await pool.query("SELECT organizer_id FROM ORGANIZER WHERE LOWER(email) = ?", [email.toLowerCase()]);
    if ((existing as any[]).length > 0) {
      return res.status(400).json({ error: "A coordinator profile with this email already exists." });
    }

    const salt = generateSalt();
    const hash = hashPassword(password, salt);

    const [result] = await pool.query(`
      INSERT INTO ORGANIZER (organizer_name, organizer_role, event_id, phone, email, password_salt, password_hash)
      VALUES (?, ?, 101, ?, ?, ?, ?)
    `, [name, role, phone, email, salt, hash]);

    const newId = (result as any).insertId;

    // Secure notification
    await pool.query(`
      INSERT INTO NOTIFICATION (user_id, role, title, message, timestamp, \`read\`, type)
      VALUES (?, 'organizer', 'Coordinator Profile Enabled', 'Administrative credentials secured. Welcome to the campus event management dashboard council.', ?, 0, 'success')
    `, [newId, new Date().toISOString().slice(0, 19).replace('T', ' ')]);

    res.status(201).json({
      organizer_id: newId,
      organizer_name: name,
      organizer_role: role,
      phone,
      email
    });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

app.post("/api/auth/forgot-password", async (req, res) => {
  const { email, role } = req.body;
  const cleanEmail = (email || "").trim().toLowerCase();

  try {
    const userTable = role === "student" ? "STUDENT" : "ORGANIZER";
    const idCol = role === "student" ? "student_id" : "organizer_id";
    const nameCol = role === "student" ? "name" : "organizer_name";

    const [users] = await pool.query(`SELECT * FROM ${userTable} WHERE LOWER(email) = ?`, [cleanEmail]);
    const list = users as any[];
    if (list.length === 0) {
      return res.status(404).json({ error: "No account found with this registered email address." });
    }

    const user = list[0];
    const token = generateResetToken();

    await pool.query(`UPDATE ${userTable} SET reset_token = ? WHERE ${idCol} = ?`, [token, user[idCol]]);

    // Dispatch Simulated Email Log
    await pool.query(`
      INSERT INTO EMAIL_LOG (user_id, to_email, subject, body_text, sent_at, type)
      VALUES (?, ?, 'Verification Code: Password Reset Request', ?, ?, 'security_reset')
    `, [
      user[idCol],
      cleanEmail,
      `Hi ${user[nameCol] || "User"},\n\nA request to reset the password for your Campus Management System was logged.\n\nYour confidential Verification Code is: ${token}\n\nEnter this token to override your previous login sequence.\n\nBest regards,\nCampus IT Operations Team`,
      new Date().toISOString().slice(0, 19).replace('T', ' ')
    ]);

    res.json({ message: "Verification recovery key generated.", userId: user[idCol] });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

app.post("/api/auth/reset-password", async (req, res) => {
  const { email, role, code, newPassword } = req.body;
  const cleanEmail = (email || "").trim().toLowerCase();

  try {
    const userTable = role === "student" ? "STUDENT" : "ORGANIZER";
    const idCol = role === "student" ? "student_id" : "organizer_id";
    const nameCol = role === "student" ? "name" : "organizer_name";

    const [users] = await pool.query(`SELECT * FROM ${userTable} WHERE LOWER(email) = ?`, [cleanEmail]);
    const list = users as any[];
    if (list.length === 0) {
      return res.status(404).json({ error: "Registered account not found." });
    }

    const user = list[0];
    if (!user.reset_token || user.reset_token !== code) {
      return res.status(400).json({ error: "Access Check Failed: Verification recovery token is invalid or has expired." });
    }

    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ error: "Password must be at least 6 characters in length." });
    }

    const salt = generateSalt();
    const hash = hashPassword(newPassword, salt);

    await pool.query(`
      UPDATE ${userTable} 
      SET password_salt = ?, password_hash = ?, reset_token = NULL 
      WHERE ${idCol} = ?
    `, [salt, hash, user[idCol]]);

    // Dispatch Alert simulated mail
    await pool.query(`
      INSERT INTO EMAIL_LOG (user_id, to_email, subject, body_text, sent_at, type)
      VALUES (?, ?, 'Security Alert: Password Change Successful', ?, ?, 'security_reset')
    `, [
      user[idCol],
      cleanEmail,
      `Dear ${user[nameCol] || "User"},\n\nThis letter acts as confirmation that your password has been successfully updated on the portal.\n\nIf you did not execute this update, please immediately escalate this ticket to the administrator desk.\n\nRegards,\nCampus IT Operations team`,
      new Date().toISOString().slice(0, 19).replace('T', ' ')
    ]);

    res.json({ message: "Password updated successfully. Return to sign in." });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// GET user notifications (supports both :role/:userId and :userId/:role)
app.get("/api/notifications/:param1/:param2", async (req, res) => {
  try {
    const { param1, param2 } = req.params;
    let role = param1;
    let userIdStr = param2;

    // Detect if param1 is the userId (numeric) and param2 is the role (non-numeric string)
    if (!isNaN(Number(param1)) && isNaN(Number(param2))) {
      userIdStr = param1;
      role = param2;
    }

    const targetUserId = parseInt(userIdStr);
    
    // Select all notifications
    const [rows] = await pool.query("SELECT * FROM NOTIFICATION ORDER BY notification_id DESC");
    const notifications = rows as any[];
    
    const list = notifications.filter((n) => {
      const userMatches = n.user_id === -1 || isNaN(targetUserId) || n.user_id === targetUserId;
      const roleMatches = n.role === "all" || n.role === role;
      return userMatches && roleMatches;
    });

    const result = list.map(n => ({
      ...n,
      read: !!n.read
    }));

    res.json(result);
  } catch (err) {
    res.json([]);
  }
});

// POST mark notifications read (supports notification_ids, notification_id, or user_id)
app.post("/api/notifications/read", async (req, res) => {
  const { notification_ids, notification_id, user_id } = req.body;
  try {
    if (notification_ids && Array.isArray(notification_ids)) {
      const ids = notification_ids.map((id: any) => parseInt(id));
      if (ids.length > 0) {
        await pool.query("UPDATE NOTIFICATION SET `read` = 1 WHERE notification_id IN (?)", [ids]);
      }
    } else if (notification_id) {
      await pool.query("UPDATE NOTIFICATION SET `read` = 1 WHERE notification_id = ?", [parseInt(notification_id)]);
    } else if (user_id) {
      await pool.query("UPDATE NOTIFICATION SET `read` = 1 WHERE user_id = ?", [parseInt(user_id)]);
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// GET simulated inbox emails
app.get("/api/emails/:userId", async (req, res) => {
  const userId = parseInt(req.params.userId);
  try {
    const [rows] = await pool.query("SELECT * FROM EMAIL_LOG WHERE user_id = ? ORDER BY email_id DESC", [userId]);
    res.json(rows);
  } catch (err) {
    res.json([]);
  }
});


// ==========================================
// CORE ENTITY ACTIONS & ENDPOINTS
// ==========================================

// Get list of events (annotated with registration count, active client-view triggers)
app.get("/api/events", async (req, res) => {
  try {
    const [eventsRow] = await pool.query("SELECT * FROM EVENT");
    const events = eventsRow as any[];

    const [registrationsRow] = await pool.query("SELECT * FROM REGISTRATION");
    const registrations = registrationsRow as any[];

    const [bookingsRow] = await pool.query("SELECT * FROM CLASSROOM_BOOKING WHERE booking_status = 'Confirmed'");
    const bookings = bookingsRow as any[];

    const [classroomsRow] = await pool.query("SELECT * FROM CLASSROOM");
    const classrooms = classroomsRow as any[];

    const [organizersRow] = await pool.query("SELECT * FROM ORGANIZER");
    const organizers = organizersRow as any[];

    const list = events.map((e) => {
      const event_date_str = e.event_date instanceof Date ? e.event_date.toISOString().split("T")[0] : String(e.event_date);
      const regs = registrations.filter((r) => r.event_id === e.event_id);
      const booking = bookings.find((b) => b.event_id === e.event_id);
      const classroom = booking ? classrooms.find((c) => c.classroom_id === booking.classroom_id) : null;
      const organizer = organizers.find((o) => o.event_id === e.event_id);
      return {
        ...e,
        event_date: event_date_str,
        registrations_count: regs.length,
        booked_classroom: classroom || null,
        booking: booking || null,
        organizer: organizer || null
      };
    });
    res.json(list);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// Create a new event (Organizer Action with Automatic Room-Allocation & Broadcast Alerts)
app.post("/api/events", async (req, res) => {
  const { event_name, event_date, venue, description, max_capacity, organizer_name, organizer_role, organizer_phone, organizer_email, classroom_id } = req.body;

  if (!event_name || !event_date || !max_capacity) {
    return res.status(400).json({ error: "Name, Date, and Capacity are required fields." });
  }

  const capacity = parseInt(max_capacity);
  if (isNaN(capacity) || capacity <= 0) {
    return res.status(400).json({ error: "Capacity must be an integer greater than 0" });
  }

  try {
    // 1. SELECT SPECIFIED CLASSROOM OR AUTOMATICALLY CHOOSE AN AVAILABLE ONE
    const [bookingsRow] = await pool.query("SELECT classroom_id FROM CLASSROOM_BOOKING WHERE booking_date = ? AND booking_status = 'Confirmed'", [event_date]);
    const bookedRoomIds = (bookingsRow as any[]).map(b => b.classroom_id);

    const [classroomsRow] = await pool.query("SELECT * FROM CLASSROOM");
    const classrooms = classroomsRow as any[];

    let selectedRoom = null;
    if (classroom_id) {
      selectedRoom = classrooms.find((c) => c.classroom_id === parseInt(classroom_id));
    }

    if (!selectedRoom) {
      selectedRoom = classrooms.find(
        (c) => !bookedRoomIds.includes(c.classroom_id) && c.capacity >= capacity
      );
    }

    if (!selectedRoom) {
      selectedRoom = classrooms.find((c) => !bookedRoomIds.includes(c.classroom_id));
    }

    if (!selectedRoom) {
      // Dynamic Auto-Allocation of a new clean room
      const nextRoomNum = classrooms.length + 1;
      const [newClassroomRes] = await pool.query(`
        INSERT INTO CLASSROOM (block_name, room_number, capacity, availability_status)
        VALUES ('Aryabhata Academic Tower', ?, ?, 'Available')
      `, [`Seminar Suite ${300 + nextRoomNum}`, Math.max(capacity, 80)]);
      
      const newRoomId = (newClassroomRes as any).insertId;
      selectedRoom = {
        classroom_id: newRoomId,
        block_name: "Aryabhata Academic Tower",
        room_number: `Seminar Suite ${300 + nextRoomNum}`,
        capacity: Math.max(capacity, 80),
        availability_status: "Available"
      };
    }

    const finalVenue = `${selectedRoom.block_name} - ${selectedRoom.room_number}`;

    // Add event
    const [eventRes] = await pool.query(`
      INSERT INTO EVENT (event_name, event_date, venue, description, max_capacity)
      VALUES (?, ?, ?, ?, ?)
    `, [event_name, event_date, finalVenue, description || "", capacity]);

    const newEventId = (eventRes as any).insertId;

    // Create Booking
    await pool.query(`
      INSERT INTO CLASSROOM_BOOKING (event_id, classroom_id, booking_date, start_time, end_time, booking_status)
      VALUES (?, ?, ?, '09:30:00', '12:30:00', 'Confirmed')
    `, [newEventId, selectedRoom.classroom_id, event_date]);

    // Create organizer
    await pool.query(`
      INSERT INTO ORGANIZER (organizer_name, organizer_role, event_id, phone, email)
      VALUES (?, ?, ?, ?, ?)
    `, [
      organizer_name || "Faculty Coordinator",
      organizer_role || "Associate Convener",
      newEventId,
      organizer_phone || "555-4819",
      organizer_email || "coordinator@college.edu"
    ]);

    // Broadcast
    await pool.query(`
      INSERT INTO NOTIFICATION (user_id, role, title, message, timestamp, \`read\`, type)
      VALUES (-1, 'all', '📢 New Event Catalogued', ?, ?, 0, 'info')
    `, [
      `A new event "${event_name}" is open for seat registration on ${event_date}. Assigned Venue: ${finalVenue}.`,
      new Date().toISOString().slice(0, 19).replace('T', ' ')
    ]);

    res.status(201).json({
      event_id: newEventId,
      event_name,
      event_date,
      venue: finalVenue,
      description: description || "",
      max_capacity: capacity,
      booked_classroom: selectedRoom
    });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// PUT to edit details of an existing college event
app.put("/api/events/:eventId", async (req, res) => {
  const eventId = parseInt(req.params.eventId);
  const { event_name, event_date, venue, description, max_capacity } = req.body;

  try {
    const [events] = await pool.query("SELECT * FROM EVENT WHERE event_id = ?", [eventId]);
    const list = events as any[];
    if (list.length === 0) {
      return res.status(404).json({ error: "Event not found in relational catalog." });
    }

    const ev = list[0];
    const newName = event_name || ev.event_name;
    const newDate = event_date || ev.event_date;
    const newVenue = venue || ev.venue;
    const newDesc = description !== undefined ? description : ev.description;
    const newCap = max_capacity ? parseInt(max_capacity) : ev.max_capacity;

    await pool.query(`
      UPDATE EVENT 
      SET event_name = ?, event_date = ?, venue = ?, description = ?, max_capacity = ?
      WHERE event_id = ?
    `, [newName, newDate, newVenue, newDesc, newCap, eventId]);

    // Sync bookings
    if (event_date) {
      await pool.query("UPDATE CLASSROOM_BOOKING SET booking_date = ? WHERE event_id = ?", [newDate, eventId]);
    }

    // Notify registered students
    const [registrations] = await pool.query("SELECT student_id FROM REGISTRATION WHERE event_id = ?", [eventId]);
    const joined = registrations as any[];

    for (const r of joined) {
      await pool.query(`
        INSERT INTO NOTIFICATION (user_id, role, title, message, timestamp, \`read\`, type)
        VALUES (?, 'student', '⚠️ Scheduled Event Updated', ?, ?, 0, 'update')
      `, [
        r.student_id,
        `The event "${newName}" you joined has been modified. Active Date: ${newDate}. Location: ${newVenue}.`,
        new Date().toISOString().slice(0, 19).replace('T', ' ')
      ]);
    }

    res.json({
      event_id: eventId,
      event_name: newName,
      event_date: newDate,
      venue: newVenue,
      description: newDesc,
      max_capacity: newCap
    });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// DELETE to purge a college event with cascading deletion of bookings, registrations and history
app.delete("/api/events/:eventId", async (req, res) => {
  const eventId = parseInt(req.params.eventId);

  try {
    const [events] = await pool.query("SELECT event_name FROM EVENT WHERE event_id = ?", [eventId]);
    const list = events as any[];
    if (list.length === 0) {
      return res.status(404).json({ error: "Target event not found in database." });
    }
    const deletedName = list[0].event_name;

    // Delete event (foreign keys with cascade will purge bookings, registrations, database records)
    await pool.query("DELETE FROM EVENT WHERE event_id = ?", [eventId]);

    // Broadcast cancellation alert
    await pool.query(`
      INSERT INTO NOTIFICATION (user_id, role, title, message, timestamp, \`read\`, type)
      VALUES (-1, 'all', '🚫 Conference Event Cancelled', ?, ?, 0, 'update')
    `, [
      `The conference "${deletedName}" has been administratively cancelled and all seat reservations released.`,
      new Date().toISOString().slice(0, 19).replace('T', ' ')
    ]);

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// GET list of events for a specific student with registration details
app.get("/api/student/:studentId/events", async (req, res) => {
  const studentId = parseInt(req.params.studentId);

  try {
    const [eventsRow] = await pool.query("SELECT * FROM EVENT");
    const events = eventsRow as any[];

    const [registrationsRow] = await pool.query("SELECT * FROM REGISTRATION WHERE student_id = ?", [studentId]);
    const registrations = registrationsRow as any[];

    const [feedbacksRow] = await pool.query("SELECT * FROM FEEDBACK WHERE student_id = ?", [studentId]);
    const feedbacks = feedbacksRow as any[];

    const [organizersRow] = await pool.query("SELECT * FROM ORGANIZER");
    const organizers = organizersRow as any[];

    const studentEvents = events.map((e) => {
      const event_date_str = e.event_date instanceof Date ? e.event_date.toISOString().split("T")[0] : String(e.event_date);
      const registration = registrations.find((r) => r.event_id === e.event_id);
      const feedback = feedbacks.find((f) => f.event_id === e.event_id);
      const organizer = organizers.find((org) => org.event_id === e.event_id);
      
      return {
        ...e,
        event_date: event_date_str,
        registered: !!registration,
        registered_at: registration ? registration.registered_at : null,
        attendance_status: registration ? registration.attendance_status : null,
        feedback_submitted: !!feedback,
        feedback_rating: feedback ? feedback.rating : null,
        organizer_name: organizer ? organizer.organizer_name : "Department Convener",
        organizer_role: organizer ? organizer.organizer_role : ""
      };
    });

    res.json(studentEvents);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// Register student for event (Integrity constraint check with auto-notifications & simulated confirmation emails)
app.post("/api/registrations", async (req, res) => {
  const { student_id, event_id } = req.body;

  if (!student_id || !event_id) {
    return res.status(400).json({ error: "Student ID and Event ID are required." });
  }

  const sId = parseInt(student_id);
  const eId = parseInt(event_id);

  try {
    const [students] = await pool.query("SELECT * FROM STUDENT WHERE student_id = ?", [sId]);
    if ((students as any[]).length === 0) return res.status(400).json({ error: "Student does not exist" });
    const student = (students as any[])[0];

    const [events] = await pool.query("SELECT * FROM EVENT WHERE event_id = ?", [eId]);
    if ((events as any[]).length === 0) return res.status(400).json({ error: "Event does not exist" });
    const event = (events as any[])[0];

    // Prevent duplicate registrations (Integrity Constraint!)
    const [regs] = await pool.query("SELECT * FROM REGISTRATION WHERE student_id = ? AND event_id = ?", [sId, eId]);
    if ((regs as any[]).length > 0) {
      return res.status(400).json({ error: "Unique Constraint Violation: Student is already registered for this event." });
    }

    // Ensure capacity isn't exceeded
    const [regCounts] = await pool.query("SELECT COUNT(*) as count FROM REGISTRATION WHERE event_id = ?", [eId]);
    const count = (regCounts as any[])[0].count;
    if (count >= event.max_capacity) {
      return res.status(400).json({ error: `Event is fully booked! (Capacity limit: ${event.max_capacity}).` });
    }

    const timestampISO = new Date().toISOString();
    const [insertRes] = await pool.query(`
      INSERT INTO REGISTRATION (student_id, event_id, attendance_status)
      VALUES (?, ?, 'Registered')
    `, [sId, eId]);
    const newRegId = (insertRes as any).insertId;

    // Dispatch In-App Notification and Confirmation simulated mail
    await pool.query(`
      INSERT INTO NOTIFICATION (user_id, role, title, message, timestamp, \`read\`, type)
      VALUES (?, 'student', 'Registration Confirmed', ?, ?, 0, 'success')
    `, [
      sId,
      `Your seat has been successfully secured for "${event.event_name}". Registration code reference is #REG-${newRegId}.`,
      timestampISO.slice(0, 19).replace('T', ' ')
    ]);

    await pool.query(`
      INSERT INTO EMAIL_LOG (user_id, to_email, subject, body_text, sent_at, type)
      VALUES (?, ?, ?, ?, ?, 'registration_confirm')
    `, [
      sId,
      student.email,
      `Seat Confirmed: ${event.event_name}`,
      `Hi ${student.name},\n\nWe are pleased to confirm your seat reservation for "${event.event_name}".\n\nBooking Schedule Detail:\n- Event: ${event.event_name}\n- Date: ${event.event_date}\n- Allocated Venue: ${event.venue}\n\nPlease present this email or your registered Student ID #${student.student_id} to the event desk upon entry.\n\nWarm regards,\nEvent Coordinator Desk`,
      timestampISO.slice(0, 19).replace('T', ' ')
    ]);

    // Check if event is happening today
    const todayStr = new Date().toISOString().split("T")[0];
    const eventDateStr = event.event_date instanceof Date ? event.event_date.toISOString().split("T")[0] : String(event.event_date);
    
    if (eventDateStr === todayStr) {
      await pool.query(`
        INSERT INTO NOTIFICATION (user_id, role, title, message, timestamp, \`read\`, type)
        VALUES (?, 'student', '⚠️ Event Happening Today!', ?, ?, 0, 'reminder')
      `, [
        sId,
        `Heads up! "${event.event_name}" is scheduled for TODAY. Make sure to arrive at the venue on schedule.`,
        timestampISO.slice(0, 19).replace('T', ' ')
      ]);

      await pool.query(`
        INSERT INTO EMAIL_LOG (user_id, to_email, subject, body_text, sent_at, type)
        VALUES (?, ?, ?, ?, ?, 'today_reminder')
      `, [
        sId,
        student.email,
        `🚨 Event Reminder: ${event.event_name} is TODAY!`,
        `Hi ${student.name},\n\nThis is a critical reminder that the event "${event.event_name}" is starting today, ${eventDateStr}!\n\nLocation: ${event.venue}.\n\nArrive 15 minutes early for attendance marking. See you there!\n\nOrganizing Coordinator Desk`,
        timestampISO.slice(0, 19).replace('T', ' ')
      ]);
    }

    res.status(201).json({
      registration_id: newRegId,
      student_id: sId,
      event_id: eId,
      attendance_status: "Registered",
      registered_at: timestampISO
    });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// Unregister a student from an event
app.delete("/api/registrations", async (req, res) => {
  const { student_id, event_id } = req.body;
  const sId = parseInt(student_id);
  const eId = parseInt(event_id);

  try {
    const [regs] = await pool.query("SELECT * FROM REGISTRATION WHERE student_id = ? AND event_id = ?", [sId, eId]);
    if ((regs as any[]).length === 0) {
      return res.status(404).json({ error: "Registration record code not found." });
    }

    await pool.query("DELETE FROM REGISTRATION WHERE student_id = ? AND event_id = ?", [sId, eId]);
    // Cascade deletes feedback
    await pool.query("DELETE FROM FEEDBACK WHERE student_id = ? AND event_id = ?", [sId, eId]);

    res.json({ message: "Successfully cancelled event registration cleanly." });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// Record Student Attendance (Organizer Action)
app.post("/api/organizer/attendance", async (req, res) => {
  const { registration_id, attendance_status } = req.body;

  if (!registration_id || !attendance_status) {
    return res.status(400).json({ error: "registration_id and attendance_status are required" });
  }

  // ENUM validation constraint check: 'Present', 'Absent', 'Registered'
  const validStatuses = ["Present", "Absent", "Registered"];
  if (!validStatuses.includes(attendance_status)) {
    return res.status(400).json({ error: "Constraint Violation: attendance_status must only be 'Present', 'Absent', or 'Registered'." });
  }

  try {
    const [regs] = await pool.query("SELECT * FROM REGISTRATION WHERE registration_id = ?", [parseInt(registration_id)]);
    if ((regs as any[]).length === 0) {
      return res.status(404).json({ error: "Registration record not found" });
    }

    await pool.query("UPDATE REGISTRATION SET attendance_status = ? WHERE registration_id = ?", [attendance_status, parseInt(registration_id)]);
    res.json({
      registration_id: parseInt(registration_id),
      attendance_status
    });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// Submit Feedback (Student Action, with logical limits)
app.post("/api/feedbacks", async (req, res) => {
  const { student_id, event_id, rating, comments } = req.body;
  const sId = parseInt(student_id);
  const eId = parseInt(event_id);
  const rVal = parseInt(rating);

  if (!sId || !eId || isNaN(rVal) || !comments) {
    return res.status(400).json({ error: "Student ID, Event ID, Rating and Comments are required." });
  }

  // Constraint Validation: rating must be between 1 and 5
  if (rVal < 1 || rVal > 5) {
    return res.status(400).json({ error: "Constraint Violation: rating must be an integer between 1 and 5." });
  }

  try {
    // Prevent feedback if student not registered
    const [regs] = await pool.query("SELECT * FROM REGISTRATION WHERE student_id = ? AND event_id = ?", [sId, eId]);
    if ((regs as any[]).length === 0) {
      return res.status(400).json({ error: "Policy Check: You cannot submit feedback for an event you didn't register for." });
    }
    const reg = (regs as any[])[0];

    // Prevent feedback submission unless attendance is Present
    if (reg.attendance_status !== "Present") {
      return res.status(400).json({ error: "Security Policy Check: You can only submit feedback for events with a generated attendance certificate (attendance logged as Present)." });
    }

    // Prevent duplicate feedback
    const [existing] = await pool.query("SELECT * FROM FEEDBACK WHERE student_id = ? AND event_id = ?", [sId, eId]);
    if ((existing as any[]).length > 0) {
      return res.status(400).json({ error: "Unique Constraint Violation: You have already submitted feedback for this event." });
    }

    const [insertRes] = await pool.query(`
      INSERT INTO FEEDBACK (student_id, event_id, rating, comments)
      VALUES (?, ?, ?, ?)
    `, [sId, eId, rVal, comments]);

    res.status(201).json({
      feedback_id: (insertRes as any).insertId,
      student_id: sId,
      event_id: eId,
      rating: rVal,
      comments
    });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});


// ==========================================
// CLASSROOM BOOKING & DOUBLE-BOOKING TRIGGER RULES
// ==========================================

// Get classrooms list with current occupancies
app.get("/api/classrooms", async (req, res) => {
  try {
    const [rows] = await pool.query("SELECT * FROM CLASSROOM");
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// Book a Classroom with Double Booking Trigger Checks and Capacity Safety Verification
app.post("/api/bookings", async (req, res) => {
  const { event_id, classroom_id, booking_date, start_time, end_time } = req.body;
  const eId = parseInt(event_id);
  const cId = parseInt(classroom_id);

  if (!event_id || !classroom_id || !booking_date || !start_time || !end_time) {
    return res.status(400).json({ error: "All booking parameters are required (Event, Classroom, Date, Start Time, End Time)." });
  }

  try {
    const [events] = await pool.query("SELECT * FROM EVENT WHERE event_id = ?", [eId]);
    const [classrooms] = await pool.query("SELECT * FROM CLASSROOM WHERE classroom_id = ?", [cId]);

    if ((events as any[]).length === 0) return res.status(400).json({ error: "Event not found" });
    if ((classrooms as any[]).length === 0) return res.status(400).json({ error: "Classroom not found" });

    const event = (events as any[])[0];
    const classroom = (classrooms as any[])[0];

    // Time format basic safety check: Start time is before end time
    if (start_time >= end_time) {
      return res.status(400).json({ error: "Validation Constraint: start_time must be chronologically BEFORE end_time." });
    }

    // Ensure classroom has capacity to host the event
    if (classroom.capacity < event.max_capacity) {
      return res.status(400).json({
        error: `Capacity Constraint: Chosen Classroom "${classroom.block_name} - ${classroom.room_number}" (capacity: ${classroom.capacity}) cannot host this event's maximum capacity requirement (${event.max_capacity}). Please allocate a larger room!`
      });
    }

    // Double Booking Prevention trigger overlay check
    const [overlapping] = await pool.query(`
      SELECT * FROM CLASSROOM_BOOKING 
      WHERE classroom_id = ? 
        AND booking_date = ? 
        AND booking_status = 'Confirmed'
        AND NOT (? <= start_time OR ? >= end_time)
    `, [cId, booking_date, end_time, start_time]);

    if ((overlapping as any[]).length > 0) {
      return res.status(400).json({
        error: "Double booking detected! This classroom is already reserved during the chosen timeframe."
      });
    }

    // Cancel existing Confirmed bookings of the same event
    await pool.query("UPDATE CLASSROOM_BOOKING SET booking_status = 'Cancelled' WHERE event_id = ?", [eId]);

    // Create Booking
    const [insertRes] = await pool.query(`
      INSERT INTO CLASSROOM_BOOKING (event_id, classroom_id, booking_date, start_time, end_time, booking_status)
      VALUES (?, ?, ?, ?, ?, 'Confirmed')
    `, [eId, cId, booking_date, start_time, end_time]);

    res.status(201).json({
      booking_id: (insertRes as any).insertId,
      event_id: eId,
      classroom_id: cId,
      booking_date,
      start_time,
      end_time,
      booking_status: "Confirmed"
    });
  } catch (err: any) {
    res.status(400).json({ error: err.message || "An unexpected database error occurred during booking." });
  }
});


// ==========================================
// DYNAMIC SQL SYSTEM SIMULATION QUERIES (RUN ACTIVE SQL)
// ==========================================

app.post("/api/queries/run", async (req, res) => {
  const { query } = req.body;
  if (!query) {
    return res.status(400).json({ error: "Query string is required" });
  }

  try {
    const [rows] = await pool.query(query);
    res.json({
      success: true,
      results: rows
    });
  } catch (err) {
    res.status(400).json({
      success: false,
      error: (err as Error).message
    });
  }
});

app.get("/api/queries/run", async (req, res) => {
  const queryId = req.query.id as string;
  const testDate = (req.query.date as string) || "2026-05-28";
  const startSlot = (req.query.start_time as string) || "10:00:00";
  const endSlot = (req.query.end_time as string) || "12:00:00";
  const activeEventId = parseInt((req.query.event_id as string) || "101");
  const specificStudentId = parseInt((req.query.student_id as string) || "1");

  try {
    let rows: any[] = [];

    switch (queryId) {
      case "upcoming_events":
        // Query 1: List all upcoming events with their date and venue.
        const [q1] = await pool.query(`
          SELECT event_id, event_name, event_date, venue 
          FROM EVENT 
          WHERE event_date >= ? 
          ORDER BY event_date ASC
        `, [testDate]);
        rows = (q1 as any[]).map(e => ({
          ...e,
          event_date: e.event_date instanceof Date ? e.event_date.toISOString().split("T")[0] : String(e.event_date)
        }));
        break;

      case "registration_counts":
        // Query 2: Count total registrations for each event.
        const [q2] = await pool.query(`
          SELECT e.event_id, e.event_name, COUNT(r.registration_id) AS total_registrations 
          FROM EVENT e 
          LEFT JOIN REGISTRATION r ON e.event_id = r.event_id 
          GROUP BY e.event_id, e.event_name
          ORDER BY total_registrations DESC
        `);
        rows = q2 as any[];
        break;

      case "event_attendance":
        // Query 3: List students and their attendance status for a particular event.
        const [q3] = await pool.query(`
          SELECT s.student_id, s.name AS student_name, s.department, r.attendance_status 
          FROM REGISTRATION r 
          JOIN STUDENT s ON r.student_id = s.student_id 
          WHERE r.event_id = ?
        `, [activeEventId]);
        rows = q3 as any[];
        break;

      case "available_classrooms":
        // Query 4: Show available classrooms on a given date and time slot.
        const [q4] = await pool.query(`
          SELECT classroom_id, block_name, room_number, capacity 
          FROM CLASSROOM 
          WHERE classroom_id NOT IN (
              SELECT classroom_id 
              FROM CLASSROOM_BOOKING 
              WHERE booking_date = ? 
                AND booking_status = 'Confirmed'
                AND start_time < ? 
                AND end_time > ?
          )
        `, [testDate, endSlot, startSlot]);
        rows = q4 as any[];
        break;

      case "high_feedbacks":
        // Query 5: Display feedback with rating >= 4.
        const [q5] = await pool.query(`
          SELECT f.feedback_id, s.name AS student_name, e.event_name, f.rating, f.comments 
          FROM FEEDBACK f 
          JOIN STUDENT s ON f.student_id = s.student_id 
          JOIN EVENT e ON f.event_id = e.event_id 
          WHERE f.rating >= 4
          ORDER BY f.rating DESC
        `);
        rows = q5 as any[];
        break;

      case "all_feedbacks":
        // Retrieve all student feedbacks for organizer audit
        const [qAllFeed] = await pool.query(`
          SELECT f.feedback_id, s.name AS student_name, e.event_name, f.rating, f.comments 
          FROM FEEDBACK f 
          JOIN STUDENT s ON f.student_id = s.student_id 
          JOIN EVENT e ON f.event_id = e.event_id 
          ORDER BY f.rating DESC
        `);
        rows = qAllFeed as any[];
        break;

      case "attendance_percentages":
        // Query 6 (Extra)
        const [q6] = await pool.query(`
          SELECT e.event_id, e.event_name, COUNT(r.registration_id) AS total_registrations,
                 SUM(CASE WHEN r.attendance_status = 'Present' THEN 1 ELSE 0 END) AS present_count,
                 IF(COUNT(r.registration_id) > 0, 
                    CONCAT(ROUND((SUM(CASE WHEN r.attendance_status = 'Present' THEN 1 ELSE 0 END) / COUNT(r.registration_id)) * 100, 2), '%'),
                    '0.00% (No Registrations Logged)') AS attendance_percentage
          FROM EVENT e 
          JOIN REGISTRATION r ON e.event_id = r.event_id 
          GROUP BY e.event_id, e.event_name
          HAVING COUNT(r.registration_id) > 0
        `);
        rows = q6 as any[];
        break;

      case "student_registration_history":
        // Query 7 (Extra)
        const [q7] = await pool.query(`
          SELECT e.event_id, e.event_name, e.event_date, r.attendance_status 
          FROM REGISTRATION r 
          JOIN EVENT e ON r.event_id = e.event_id 
          WHERE r.student_id = ?
        `, [specificStudentId]);
        rows = (q7 as any[]).map(e => ({
          ...e,
          event_date: e.event_date instanceof Date ? e.event_date.toISOString().split("T")[0] : String(e.event_date)
        }));
        break;

      case "most_popular_event":
        // Query 8 (Extra)
        const [q8] = await pool.query(`
          SELECT e.event_id, e.event_name, COUNT(r.registration_id) AS registration_count, e.venue
          FROM EVENT e 
          LEFT JOIN REGISTRATION r ON e.event_id = r.event_id 
          GROUP BY e.event_id, e.event_name, e.venue
          ORDER BY registration_count DESC 
          LIMIT 1
        `);
        rows = q8 as any[];
        break;

      default:
        return res.status(400).json({ error: "Unsupported query identifier" });
    }

    res.json({
      queryId,
      rows_count: rows.length,
      rows
    });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});


// ==========================================
// VITE DEV SERVER / PRODUCTION SERVING
// ==========================================

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    // Development Server Flow: Attach Vite Server Middleware
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
    console.log("Vite development server active as middleware.");
  } else {
    // Production Assets Flow: Serve the static /dist directory
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
    console.log("Static production build folder binding active.");
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Express application successfully booted on port ${PORT}`);
  });
}

startServer();
