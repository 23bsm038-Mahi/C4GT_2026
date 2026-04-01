const crypto = require('node:crypto');
const { env } = require('../config/env');

function nowMs() {
  return Date.now();
}

function nowIso() {
  return new Date().toISOString();
}

function generateAuthToken() {
  return crypto.randomBytes(24).toString('hex');
}

function generateRefreshToken() {
  return crypto.randomBytes(32).toString('hex');
}

function createSession(db, { studentId, partnerId }) {
  const token = generateAuthToken();
  const refreshToken = generateRefreshToken();
  const createdAt = nowIso();
  const expiresAt = nowMs() + env.authTokenTtlMs;
  const refreshExpiresAt = nowMs() + env.refreshTokenTtlMs;

  db.prepare(`
    INSERT INTO sessions (
      token,
      refresh_token,
      student_id,
      partner_id,
      expires_at,
      refresh_expires_at,
      created_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(token, refreshToken, studentId, partnerId, expiresAt, refreshExpiresAt, createdAt);

  return {
    access_token: token,
    refresh_token: refreshToken,
    expires_in: Math.floor(env.authTokenTtlMs / 1000),
    refresh_expires_in: Math.floor(env.refreshTokenTtlMs / 1000),
  };
}

function rotateSession(db, { refreshToken, partnerId }) {
  const session = db.prepare(`
    SELECT token, refresh_token, student_id, partner_id, refresh_expires_at
    FROM sessions
    WHERE refresh_token = ? AND partner_id = ?
  `).get(refreshToken, partnerId);

  if (!session || Number(session.refresh_expires_at) <= nowMs()) {
    return null;
  }

  db.prepare(`DELETE FROM sessions WHERE token = ?`).run(session.token);
  return {
    session: createSession(db, {
      studentId: session.student_id,
      partnerId: session.partner_id,
    }),
    studentId: session.student_id,
  };
}

function getSessionFromRequest(db, authorizationHeader = '', partnerId = '') {
  const rawHeader = String(authorizationHeader || '').trim();
  const token = rawHeader.replace(/^token\s+/i, '');

  if (!token) {
    return null;
  }

  const session = db.prepare(`
    SELECT token, student_id, partner_id, expires_at
    FROM sessions
    WHERE token = ? AND partner_id = ?
  `).get(token, partnerId);

  if (!session || Number(session.expires_at) <= nowMs()) {
    return null;
  }

  return session;
}

module.exports = {
  createSession,
  rotateSession,
  getSessionFromRequest,
};
