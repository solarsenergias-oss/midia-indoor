const crypto = require('crypto');
const db = require('./db');

/* ---------- Password hashing (scrypt, sem dependências externas) ---------- */
function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(password, stored) {
  const [salt, hash] = stored.split(':');
  const hashToCompare = crypto.scryptSync(password, salt, 64).toString('hex');
  return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(hashToCompare, 'hex'));
}

/* ---------- Sessions ---------- */
function createSession(userId) {
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(); // 30 dias
  db.prepare(`INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)`).run(token, userId, expiresAt);
  return token;
}

function getSession(token) {
  if (!token) return null;
  const session = db.prepare(`SELECT * FROM sessions WHERE token = ? AND expires_at > datetime('now')`).get(token);
  return session || null;
}

function destroySession(token) {
  db.prepare(`DELETE FROM sessions WHERE token = ?`).run(token);
}

/* ---------- Middleware ---------- */
function requireAuth(req, res, next) {
  const token = req.cookies?.session_token;
  const session = getSession(token);
  if (!session) {
    return res.status(401).json({ error: 'Não autenticado' });
  }
  req.userId = session.user_id;
  next();
}

/* ---------- Seed usuário padrão ---------- */
function seedDefaultUser() {
  const existing = db.prepare(`SELECT * FROM usuarios WHERE email = ?`).get('solarsenergias@gmail.com');
  if (!existing) {
    const hash = hashPassword('midia2024');
    db.prepare(`INSERT INTO usuarios (nome, email, senha_hash) VALUES (?, ?, ?)`).run('Marcos', 'solarsenergias@gmail.com', hash);
    console.log('✅ Usuário padrão criado: solarsenergias@gmail.com / midia2024');
  }
}

module.exports = { hashPassword, verifyPassword, createSession, getSession, destroySession, requireAuth, seedDefaultUser };
