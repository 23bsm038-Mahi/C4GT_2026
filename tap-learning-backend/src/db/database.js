const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const { env } = require('../config/env');

function initializeDatabase() {
  const directory = path.dirname(env.databasePath);
  fs.mkdirSync(directory, { recursive: true });

  const db = new DatabaseSync(env.databasePath);
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS partners (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active'
    );

    CREATE TABLE IF NOT EXISTS students (
      id TEXT PRIMARY KEY,
      full_name TEXT NOT NULL,
      mobile_number TEXT NOT NULL,
      partner_id TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE (mobile_number, partner_id),
      FOREIGN KEY (partner_id) REFERENCES partners(id)
    );

    CREATE TABLE IF NOT EXISTS courses (
      id INTEGER PRIMARY KEY,
      course_title TEXT NOT NULL,
      description TEXT NOT NULL,
      course_category TEXT NOT NULL,
      partner_id TEXT NOT NULL,
      lessons_json TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (partner_id) REFERENCES partners(id)
    );

    CREATE TABLE IF NOT EXISTS enrollments (
      student_id TEXT NOT NULL,
      course_id INTEGER NOT NULL,
      progress INTEGER NOT NULL DEFAULT 0,
      partner_id TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      PRIMARY KEY (student_id, course_id),
      FOREIGN KEY (student_id) REFERENCES students(id),
      FOREIGN KEY (course_id) REFERENCES courses(id),
      FOREIGN KEY (partner_id) REFERENCES partners(id)
    );

    CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY,
      refresh_token TEXT NOT NULL,
      student_id TEXT NOT NULL,
      partner_id TEXT NOT NULL,
      expires_at INTEGER NOT NULL,
      refresh_expires_at INTEGER NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (student_id) REFERENCES students(id),
      FOREIGN KEY (partner_id) REFERENCES partners(id)
    );

    CREATE TABLE IF NOT EXISTS feedback (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      student_id TEXT,
      student_name TEXT NOT NULL,
      course_id INTEGER,
      feedback TEXT NOT NULL,
      partner_id TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (student_id) REFERENCES students(id),
      FOREIGN KEY (course_id) REFERENCES courses(id),
      FOREIGN KEY (partner_id) REFERENCES partners(id)
    );

    CREATE INDEX IF NOT EXISTS idx_feedback_partner_course ON feedback(partner_id, course_id);
    CREATE INDEX IF NOT EXISTS idx_sessions_student ON sessions(student_id);
    CREATE INDEX IF NOT EXISTS idx_courses_partner ON courses(partner_id);
    CREATE INDEX IF NOT EXISTS idx_enrollments_student ON enrollments(student_id);
  `);

  seedDatabase(db);
  return db;
}

function seedDatabase(db) {
  const now = new Date().toISOString();
  const partnerIds = env.allowedPartners.length
    ? env.allowedPartners
    : [env.defaultPartnerId];

  const insertPartner = db.prepare(`
    INSERT OR IGNORE INTO partners (id, name, status)
    VALUES (?, ?, 'active')
  `);
  const insertCourse = db.prepare(`
    INSERT OR IGNORE INTO courses (
      id,
      course_title,
      description,
      course_category,
      partner_id,
      lessons_json,
      updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  for (const partnerId of partnerIds) {
    insertPartner.run(partnerId, `Partner ${partnerId}`);
    insertCourse.run(
      101,
      'Digital Skills',
      'Intro course',
      'Foundation',
      partnerId,
      JSON.stringify([{ id: 1, title: 'Lesson 1', duration: '10 min' }]),
      now
    );
    insertCourse.run(
      102,
      'Citizen Services 101',
      'Learn the basics of civic service delivery.',
      'Public Service',
      partnerId,
      JSON.stringify([
        { id: 1, title: 'Intro', duration: '10 min' },
        { id: 2, title: 'Case Study', duration: '15 min' },
      ]),
      now
    );
  }
}

module.exports = {
  initializeDatabase,
};
