function mapCourseRow(row) {
  return {
    id: row.id,
    course_title: row.course_title,
    description: row.description,
    course_category: row.course_category,
    lessons: JSON.parse(row.lessons_json || '[]'),
  };
}

function listCoursesForStudent(db, { studentId, partnerId }) {
  const rows = db.prepare(`
    SELECT c.id, c.course_title, c.description, c.course_category, c.lessons_json
    FROM courses c
    INNER JOIN enrollments e
      ON e.course_id = c.id
     AND e.student_id = ?
     AND e.partner_id = c.partner_id
    WHERE c.partner_id = ?
    ORDER BY c.id ASC
  `).all(studentId, partnerId);

  return rows.map(mapCourseRow);
}

function listProgressForStudent(db, { studentId, partnerId }) {
  return db.prepare(`
    SELECT course_id, progress
    FROM enrollments
    WHERE student_id = ? AND partner_id = ?
    ORDER BY course_id ASC
  `).all(studentId, partnerId);
}

module.exports = {
  listCoursesForStudent,
  listProgressForStudent,
};
