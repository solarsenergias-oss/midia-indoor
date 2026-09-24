const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const db = require('./db');
const auth = require('./auth');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '500mb' }));

/* ---------- Upload de arquivos de mídia (imagens/vídeos) ---------- */
const uploadsDir = path.join(__dirname, '../public/uploads/midias');
fs.mkdirSync(uploadsDir, { recursive: true });

const uploadStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || '';
    const nomeUnico = `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
    cb(null, nomeUnico);
  },
});
const upload = multer({ storage: uploadStorage, limits: { fileSize: 200 * 1024 * 1024 } });

/* ---------- Cookie parsing simples (sem dependência extra) ---------- */
app.use((req, res, next) => {
  req.cookies = {};
  const header = req.headers.cookie;
  if (header) {
    header.split(';').forEach(pair => {
      const idx = pair.indexOf('=');
      if (idx > -1) {
        const key = pair.slice(0, idx).trim();
        const val = decodeURIComponent(pair.slice(idx + 1).trim());
        req.cookies[key] = val;
      }
    });
  }
  next();
});

function setCookie(res, name, value, maxAgeSeconds) {
  res.setHeader('Set-Cookie', `${name}=${encodeURIComponent(value)}; Path=/; HttpOnly; Max-Age=${maxAgeSeconds}; SameSite=Lax`);
}
function clearCookie(res, name) {
  res.setHeader('Set-Cookie', `${name}=; Path=/; HttpOnly; Max-Age=0; SameSite=Lax`);
}

/* Cria usuário padrão na primeira execução */
auth.seedDefaultUser();

/* ---------- Healthcheck ---------- */
app.get('/healthcheck', (req, res) => res.status(200).json({ status: 'ok' }));

/* ============================================================
   API — Autenticação
   ============================================================ */
app.post('/api/login', (req, res) => {
  const { email, senha } = req.body;
  if (!email || !senha) return res.status(400).json({ error: 'Email e senha são obrigatórios' });

  const user = db.prepare(`SELECT * FROM usuarios WHERE email = ?`).get(email.toLowerCase().trim());
  if (!user || !auth.verifyPassword(senha, user.senha_hash)) {
    return res.status(401).json({ error: 'Email ou senha inválidos' });
  }

  const token = auth.createSession(user.id);
  setCookie(res, 'session_token', token, 30 * 24 * 60 * 60);
  res.json({ success: true, user: { id: user.id, nome: user.nome, email: user.email } });
});

app.post('/api/logout', (req, res) => {
  const token = req.cookies?.session_token;
  if (token) auth.destroySession(token);
  clearCookie(res, 'session_token');
  res.json({ success: true });
});

app.get('/api/me', (req, res) => {
  const session = auth.getSession(req.cookies?.session_token);
  if (!session) return res.status(401).json({ error: 'Não autenticado' });
  const user = db.prepare(`SELECT id, nome, email FROM usuarios WHERE id = ?`).get(session.user_id);
  res.json(user);
});

app.put('/api/me', (req, res) => {
  const session = auth.getSession(req.cookies?.session_token);
  if (!session) return res.status(401).json({ error: 'Não autenticado' });

  const { nome, nova_senha } = req.body;
  const existing = db.prepare(`SELECT * FROM usuarios WHERE id = ?`).get(session.user_id);

  if (nova_senha && nova_senha.length < 6) {
    return res.status(400).json({ error: 'A senha deve ter pelo menos 6 caracteres' });
  }

  const novoHash = nova_senha ? auth.hashPassword(nova_senha) : existing.senha_hash;
  db.prepare(`UPDATE usuarios SET nome = ?, senha_hash = ? WHERE id = ?`).run(
    nome || existing.nome,
    novoHash,
    session.user_id
  );

  const updated = db.prepare(`SELECT id, nome, email FROM usuarios WHERE id = ?`).get(session.user_id);
  res.json(updated);
});

/* ============================================================
   Middleware de autenticação para rotas protegidas da API
   ============================================================ */
function requireApiAuth(req, res, next) {
  const session = auth.getSession(req.cookies?.session_token);
  if (!session) return res.status(401).json({ error: 'Não autenticado' });
  req.userId = session.user_id;
  next();
}

/* ============================================================
   API — Stats
   ============================================================ */
app.get('/api/stats', requireApiAuth, (req, res) => {
  const telas_online = db.prepare(`SELECT COUNT(*) as c FROM telas WHERE status = 'online'`).get().c;
  const telas_total = db.prepare(`SELECT COUNT(*) as c FROM telas`).get().c;
  const campanhas_ativas = db.prepare(`SELECT COUNT(*) as c FROM campanhas WHERE status = 'ativa'`).get().c;
  const exibicoes_hoje = db.prepare(`SELECT COUNT(*) as c FROM exibicoes WHERE date(exibido_em) = date('now')`).get().c;

  /* Exibições reais dos últimos 7 dias, por dia da semana (0=domingo ... 6=sábado) */
  const linhas = db.prepare(`
    SELECT strftime('%w', exibido_em) as dow, COUNT(*) as c
    FROM exibicoes
    WHERE exibido_em >= datetime('now', '-6 days')
    GROUP BY dow
  `).all();
  const desempenho_semana = [0, 0, 0, 0, 0, 0, 0];
  linhas.forEach(l => { desempenho_semana[Number(l.dow)] = l.c; });

  res.json({
    telas_online,
    telas_offline: telas_total - telas_online,
    telas_total,
    campanhas_ativas,
    exibicoes_hoje,
    desempenho_semana,
  });
});

/* ============================================================
   API — Telas
   ============================================================ */
app.get('/api/telas', requireApiAuth, (req, res) => {
  res.json(db.prepare(`SELECT * FROM telas ORDER BY criado_em DESC`).all());
});

app.post('/api/telas', requireApiAuth, (req, res) => {
  const { nome, localizacao, orientacao, grupo_id } = req.body;
  if (!nome) return res.status(400).json({ error: 'Nome é obrigatório' });

  const stmt = db.prepare(`INSERT INTO telas (nome, localizacao, orientacao, grupo_id) VALUES (?, ?, ?, ?)`);
  const result = stmt.run(nome, localizacao || null, orientacao || 'Horizontal', grupo_id || null);
  res.status(201).json(db.prepare(`SELECT * FROM telas WHERE id = ?`).get(result.lastInsertRowid));
});

app.put('/api/telas/:id', requireApiAuth, (req, res) => {
  const { nome, localizacao, orientacao, status } = req.body;
  const existing = db.prepare(`SELECT * FROM telas WHERE id = ?`).get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Tela não encontrada' });

  db.prepare(`UPDATE telas SET nome = ?, localizacao = ?, orientacao = ?, status = ? WHERE id = ?`).run(
    nome ?? existing.nome,
    localizacao ?? existing.localizacao,
    orientacao ?? existing.orientacao,
    status ?? existing.status,
    req.params.id
  );
  res.json(db.prepare(`SELECT * FROM telas WHERE id = ?`).get(req.params.id));
});

app.delete('/api/telas/:id', requireApiAuth, (req, res) => {
  db.prepare(`DELETE FROM telas WHERE id = ?`).run(req.params.id);
  res.json({ success: true });
});

/* ============================================================
   API — Campanhas
   ============================================================ */
app.get('/api/campanhas', requireApiAuth, (req, res) => {
  res.json(db.prepare(`SELECT * FROM campanhas ORDER BY criado_em DESC`).all());
});

app.post('/api/campanhas', requireApiAuth, (req, res) => {
  const { nome, descricao } = req.body;
  if (!nome) return res.status(400).json({ error: 'Nome é obrigatório' });

  const stmt = db.prepare(`INSERT INTO campanhas (nome, descricao) VALUES (?, ?)`);
  const result = stmt.run(nome, descricao || null);
  res.status(201).json(db.prepare(`SELECT * FROM campanhas WHERE id = ?`).get(result.lastInsertRowid));
});

app.put('/api/campanhas/:id', requireApiAuth, (req, res) => {
  const { nome, descricao, status } = req.body;
  const existing = db.prepare(`SELECT * FROM campanhas WHERE id = ?`).get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Campanha não encontrada' });

  db.prepare(`UPDATE campanhas SET nome = ?, descricao = ?, status = ? WHERE id = ?`).run(
    nome ?? existing.nome,
    descricao ?? existing.descricao,
    status ?? existing.status,
    req.params.id
  );
  res.json(db.prepare(`SELECT * FROM campanhas WHERE id = ?`).get(req.params.id));
});

app.delete('/api/campanhas/:id', requireApiAuth, (req, res) => {
  db.prepare(`DELETE FROM campanhas WHERE id = ?`).run(req.params.id);
  res.json({ success: true });
});

/* ============================================================
   API — Upload de arquivo (usado pela tela "Nova mídia")
   ============================================================ */
app.post('/api/upload', requireApiAuth, upload.single('arquivo'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Nenhum arquivo enviado' });
  res.status(201).json({ url: `/uploads/midias/${req.file.filename}`, nome: req.file.originalname });
});

/* ============================================================
   API — Mídias
   ============================================================ */
app.get('/api/midias', requireApiAuth, (req, res) => {
  res.json(db.prepare(`SELECT * FROM midias ORDER BY criado_em DESC`).all());
});

app.post('/api/midias', requireApiAuth, (req, res) => {
  const { nome, tipo, url, campanha_id, orientacao } = req.body;
  if (!nome) return res.status(400).json({ error: 'Nome é obrigatório' });

  const stmt = db.prepare(`INSERT INTO midias (nome, tipo, url, campanha_id, orientacao) VALUES (?, ?, ?, ?, ?)`);
  const result = stmt.run(nome, tipo || null, url || null, campanha_id || null, orientacao || 'Paisagem');
  res.status(201).json(db.prepare(`SELECT * FROM midias WHERE id = ?`).get(result.lastInsertRowid));
});

app.put('/api/midias/:id', requireApiAuth, (req, res) => {
  const { nome, url, orientacao, status } = req.body;
  const existing = db.prepare(`SELECT * FROM midias WHERE id = ?`).get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Mídia não encontrada' });

  db.prepare(`UPDATE midias SET nome = ?, url = ?, orientacao = ?, status = ? WHERE id = ?`).run(
    nome ?? existing.nome,
    url ?? existing.url,
    orientacao ?? existing.orientacao,
    status ?? existing.status,
    req.params.id
  );
  res.json(db.prepare(`SELECT * FROM midias WHERE id = ?`).get(req.params.id));
});

app.delete('/api/midias/:id', requireApiAuth, (req, res) => {
  db.prepare(`DELETE FROM midias WHERE id = ?`).run(req.params.id);
  res.json({ success: true });
});

/* ============================================================
   API — Grupos de mídia
   ============================================================ */
app.get('/api/grupos', requireApiAuth, (req, res) => {
  res.json(db.prepare(`SELECT * FROM grupos ORDER BY criado_em DESC`).all());
});

app.post('/api/grupos', requireApiAuth, (req, res) => {
  const { nome, imagem, midias_ids, telas_ids } = req.body;
  if (!nome) return res.status(400).json({ error: 'Nome é obrigatório' });

  const stmt = db.prepare(`INSERT INTO grupos (nome, imagem, midias_ids, telas_ids) VALUES (?, ?, ?, ?)`);
  const result = stmt.run(nome, imagem || null, JSON.stringify(midias_ids || []), JSON.stringify(telas_ids || []));
  res.status(201).json(db.prepare(`SELECT * FROM grupos WHERE id = ?`).get(result.lastInsertRowid));
});

app.put('/api/grupos/:id', requireApiAuth, (req, res) => {
  const { nome, imagem, midias_ids, telas_ids, status } = req.body;
  const existing = db.prepare(`SELECT * FROM grupos WHERE id = ?`).get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Grupo não encontrado' });

  db.prepare(`UPDATE grupos SET nome = ?, imagem = ?, midias_ids = ?, telas_ids = ?, status = ? WHERE id = ?`).run(
    nome ?? existing.nome,
    imagem ?? existing.imagem,
    midias_ids ? JSON.stringify(midias_ids) : existing.midias_ids,
    telas_ids ? JSON.stringify(telas_ids) : existing.telas_ids,
    status ?? existing.status,
    req.params.id
  );
  res.json(db.prepare(`SELECT * FROM grupos WHERE id = ?`).get(req.params.id));
});

app.delete('/api/grupos/:id', requireApiAuth, (req, res) => {
  db.prepare(`DELETE FROM grupos WHERE id = ?`).run(req.params.id);
  res.json({ success: true });
});

/* ============================================================
   API — RSS Personalizado
   ============================================================ */
app.get('/api/rss', requireApiAuth, (req, res) => {
  res.json(db.prepare(`SELECT * FROM rss_feeds ORDER BY criado_em DESC`).all());
});

app.post('/api/rss', requireApiAuth, (req, res) => {
  const { titulo, fonte, link, cor_fundo, cor_fonte, telas_ids } = req.body;
  if (!titulo) return res.status(400).json({ error: 'Título é obrigatório' });

  const stmt = db.prepare(`INSERT INTO rss_feeds (titulo, fonte, link, cor_fundo, cor_fonte, telas_ids) VALUES (?, ?, ?, ?, ?, ?)`);
  const result = stmt.run(titulo, fonte || null, link || null, cor_fundo || '#000000', cor_fonte || '#ffffff', JSON.stringify(telas_ids || []));
  res.status(201).json(db.prepare(`SELECT * FROM rss_feeds WHERE id = ?`).get(result.lastInsertRowid));
});

app.delete('/api/rss/:id', requireApiAuth, (req, res) => {
  db.prepare(`DELETE FROM rss_feeds WHERE id = ?`).run(req.params.id);
  res.json({ success: true });
});

/* ============================================================
   API — Instagram
   ============================================================ */
app.get('/api/instagram', requireApiAuth, (req, res) => {
  res.json(db.prepare(`SELECT * FROM instagram_perfis ORDER BY criado_em DESC`).all());
});

app.post('/api/instagram', requireApiAuth, (req, res) => {
  const { usuario, telas_ids } = req.body;
  if (!usuario) return res.status(400).json({ error: 'Usuário é obrigatório' });

  const stmt = db.prepare(`INSERT INTO instagram_perfis (usuario, telas_ids) VALUES (?, ?)`);
  const result = stmt.run(usuario, JSON.stringify(telas_ids || []));
  res.status(201).json(db.prepare(`SELECT * FROM instagram_perfis WHERE id = ?`).get(result.lastInsertRowid));
});

app.delete('/api/instagram/:id', requireApiAuth, (req, res) => {
  db.prepare(`DELETE FROM instagram_perfis WHERE id = ?`).run(req.params.id);
  res.json({ success: true });
});

/* ============================================================
   API — Clientes
   ============================================================ */
app.get('/api/clientes', requireApiAuth, (req, res) => {
  res.json(db.prepare(`SELECT * FROM clientes ORDER BY criado_em DESC`).all());
});

app.post('/api/clientes', requireApiAuth, (req, res) => {
  const { nome, email, telefone, cidade } = req.body;
  if (!nome) return res.status(400).json({ error: 'Nome é obrigatório' });

  const stmt = db.prepare(`INSERT INTO clientes (nome, email, telefone, cidade) VALUES (?, ?, ?, ?)`);
  const result = stmt.run(nome, email || null, telefone || null, cidade || null);
  res.status(201).json(db.prepare(`SELECT * FROM clientes WHERE id = ?`).get(result.lastInsertRowid));
});

app.put('/api/clientes/:id', requireApiAuth, (req, res) => {
  const { nome, email, telefone, cidade } = req.body;
  const existing = db.prepare(`SELECT * FROM clientes WHERE id = ?`).get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Cliente não encontrado' });

  db.prepare(`UPDATE clientes SET nome = ?, email = ?, telefone = ?, cidade = ? WHERE id = ?`).run(
    nome ?? existing.nome,
    email ?? existing.email,
    telefone ?? existing.telefone,
    cidade ?? existing.cidade,
    req.params.id
  );
  res.json(db.prepare(`SELECT * FROM clientes WHERE id = ?`).get(req.params.id));
});

app.delete('/api/clientes/:id', requireApiAuth, (req, res) => {
  db.prepare(`DELETE FROM clientes WHERE id = ?`).run(req.params.id);
  res.json({ success: true });
});

/* ============================================================
   API — Proof of play (TV registra exibição) — pública, sem auth
   ============================================================ */
app.post('/api/exibicoes', (req, res) => {
  const { tela_id, midia_id } = req.body;
  db.prepare(`INSERT INTO exibicoes (tela_id, midia_id) VALUES (?, ?)`).run(tela_id, midia_id);
  db.prepare(`UPDATE telas SET status = 'online', ultima_comunicacao = CURRENT_TIMESTAMP WHERE id = ?`).run(tela_id);
  res.status(201).json({ success: true });
});

/* Mídias públicas para o player de TV (sem auth) */
app.get('/api/public/midias', (req, res) => {
  res.json(db.prepare(`SELECT * FROM midias ORDER BY criado_em DESC`).all());
});

/* ============================================================
   Static files & Pages
   ============================================================ */
app.use(express.static(path.join(__dirname, '../public')));

app.get('/', (req, res) => {
  const session = auth.getSession(req.cookies?.session_token);
  if (!session) return res.redirect('/login.html');
  res.sendFile(path.join(__dirname, '../public/admin/index.html'));
});

app.get('/tv', (req, res) => res.sendFile(path.join(__dirname, '../public/tv/index.html')));

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

module.exports = app;
