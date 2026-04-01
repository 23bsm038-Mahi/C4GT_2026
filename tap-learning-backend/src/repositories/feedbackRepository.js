function buildFeedbackName(id) {
  return `FDBK-${String(id).padStart(4, '0')}`;
}

function createFeedback(db, payload) {
  const now = new Date().toISOString();
  const temporaryName = `PENDING-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const result = db.prepare(`
    INSERT INTO feedback (
      name,
      student_id,
      student_name,
      course_id,
      feedback,
      partner_id,
      created_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    temporaryName,
    payload.studentId || null,
    payload.studentName,
    payload.courseId || null,
    payload.feedback,
    payload.partnerId,
    now
  );
  const feedbackId = Number(result.lastInsertRowid || 0);
  const name = buildFeedbackName(feedbackId);

  db.prepare(`
    UPDATE feedback
    SET name = ?
    WHERE id = ?
  `).run(name, feedbackId);

  return getFeedbackByName(db, name, payload.partnerId);
}

function listFeedback(db, { partnerId, courseId = null }) {
  if (courseId !== null && courseId !== undefined && courseId !== '') {
    return db.prepare(`
      SELECT name, student_id, student_name, course_id, feedback, partner_id, created_at
      FROM feedback
      WHERE partner_id = ? AND course_id = ?
      ORDER BY created_at DESC
    `).all(partnerId, Number(courseId));
  }

  return db.prepare(`
    SELECT name, student_id, student_name, course_id, feedback, partner_id, created_at
    FROM feedback
    WHERE partner_id = ?
    ORDER BY created_at DESC
  `).all(partnerId);
}

function getFeedbackByName(db, name, partnerId) {
  return db.prepare(`
    SELECT name, student_id, student_name, course_id, feedback, partner_id, created_at
    FROM feedback
    WHERE name = ? AND partner_id = ?
  `).get(name, partnerId) || null;
}

module.exports = {
  createFeedback,
  listFeedback,
  getFeedbackByName,
};
