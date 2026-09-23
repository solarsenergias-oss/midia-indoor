import express from 'express';
import cors from 'cors';
import { db, initializeDatabase } from './db.js';
import { Worker } from './worker.js';

const app = express();
const PORT = 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Initialize database
initializeDatabase();

// Start background worker
const worker = new Worker(db);
worker.start();

// Routes
app.post('/api/login', (req, res) => {
  const { usuario, senha } = req.body;
  if (usuario === 'admin' && senha === 'admin123') {
    const sessaoId = Math.random().toString(36).substr(2, 9);
    db.prepare('INSERT INTO sessoes (id, usuario, data_expiracao) VALUES (?, ?, datetime(\'now\', \'+30 days\'))').run(sessaoId, usuario);
    res.json({ sucesso: true, sessao_id: sessaoId });
  } else {
    res.status(401).json({ sucesso: false });
  }
});

app.get('/api/telas', (req, res) => {
  const telas = db.prepare('SELECT * FROM telas').all();
  res.json(telas);
});

app.post('/api/telas', (req, res) => {
  const { nome, localizacao } = req.body;
  const id = Math.random().toString(36).substr(2, 9);
  db.prepare('INSERT INTO telas (id, nome, localizacao) VALUES (?, ?, ?)').run(id, nome, localizacao);
  res.json({ id, nome, localizacao });
});

app.get('/api/campanhas', (req, res) => {
  const campanhas = db.prepare('SELECT * FROM campanhas').all();
  res.json(campanhas);
});

app.get('/api/midias', (req, res) => {
  const midias = db.prepare('SELECT * FROM midias').all();
  res.json(midias);
});

app.get('/tv', (req, res) => {
  res.sendFile(new URL('../public/tv/index.html', import.meta.url).pathname);
});

app.get('/admin', (req, res) => {
  res.sendFile(new URL('../public/admin/index.html', import.meta.url).pathname);
});

app.get('/healthcheck', (req, res) => {
  res.json({ status: 'ok' });
});

app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
  console.log(`📊 Admin: http://localhost:${PORT}/admin`);
  console.log(`📺 TV Player: http://localhost:${PORT}/tv`);
});
