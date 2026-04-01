function upsertStudent(db, { fullName, mobileNumber, partnerId }) {
  const now = new Date().toISOString();
  const existingStudent = db.prepare(`
    SELECT id, full_name, mobile_number, partner_id
    FROM students
    WHERE mobile_number = ? AND partner_id = ?
  `).get(mobileNumber, partnerId);

  if (existingStudent) {
    db.prepare(`
      UPDATE students
      SET full_name = ?, updated_at = ?
      WHERE id = ?
    `).run(fullName, now, existingStudent.id);

    return {
      id: existingStudent.id,
      full_name: fullName,
      mobile_number: mobileNumber,
      partner_id: partnerId,
    };
  }

  const id = `STU-${String(Date.now()).slice(-6)}`;
  db.prepare(`
    INSERT INTO students (id, full_name, mobile_number, partner_id, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(id, fullName, mobileNumber, partnerId, now, now);

  const courses = db.prepare(`
    SELECT id
    FROM courses
    WHERE partner_id = ?
  `).all(partnerId);

  const insertEnrollment = db.prepare(`
    INSERT OR IGNORE INTO enrollments (student_id, course_id, progress, partner_id, updated_at)
    VALUES (?, ?, ?, ?, ?)
  `);

  for (const course of courses) {
    insertEnrollment.run(id, course.id, course.id === 101 ? 50 : 20, partnerId, now);
  }

  return {
    id,
    full_name: fullName,
    mobile_number: mobileNumber,
    partner_id: partnerId,
  };
}

function getStudentById(db, studentId, partnerId) {
  return db.prepare(`
    SELECT id, full_name, mobile_number, partner_id
    FROM students
    WHERE id = ? AND partner_id = ?
  `).get(studentId, partnerId);
}

module.exports = {
  upsertStudent,
  getStudentById,
};
