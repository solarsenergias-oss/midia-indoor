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
   API — Login do APP Android (pareamento do TV Box)
   Usa o MESMO usuário/senha do painel web. Sem sessão/cookie —
   o app usa isso só uma vez, pra escolher a tela e vincular o
   aparelho a ela (depois disso ele fala só com as rotas públicas).
   ============================================================ */
app.post('/api/tv/login', (req, res) => {
  const { email, senha } = req.body || {};
  if (!email || !senha) return res.status(400).json({ error: 'Email e senha são obrigatórios' });

  const user = db.prepare(`SELECT * FROM usuarios WHERE email = ?`).get(String(email).toLowerCase().trim());
  if (!user || !auth.verifyPassword(senha, user.senha_hash)) {
    return res.status(401).json({ error: 'Email ou senha inválidos' });
  }

  const grupos = db.prepare(`SELECT midias_ids, telas_ids FROM grupos WHERE status IS NULL OR status != 'inativo'`).all();
  const telas = db.prepare(`SELECT * FROM telas ORDER BY nome ASC`).all().map(t => {
    const totalMidias = grupos.reduce((acc, g) => {
      const telasIds = JSON.parse(g.telas_ids || '[]');
      return telasIds.includes(t.id) ? acc + JSON.parse(g.midias_ids || '[]').length : acc;
    }, 0);
    let config = {};
    try { config = JSON.parse(t.config || '{}'); } catch (e) {}
    const enderecoPartes = [t.endereco, t.numero, t.bairro, t.cidade].filter(Boolean);
    return {
      id: t.id,
      nome: t.nome,
      endereco: enderecoPartes.join(', ') || t.localizacao || null,
      orientacao: t.orientacao || 'Horizontal',
      ciclo_atualizacao_min: config.intervalo_atualizacao || null,
      total_midias: totalMidias,
    };
  });

  res.json({ success: true, telas });
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
  const telas_online = db.prepare(`SELECT COUNT(*) as c FROM telas WHERE ultima_comunicacao >= datetime('now', '-3 minutes')`).get().c;
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
/* Considera a tela online se ela se comunicou (heartbeat ou proof-of-play)
   nos últimos 3 minutos — evita depender de a TV avisar quando desliga. */
const ONLINE_LIMIAR_MINUTOS = 3;
function estaOnline(tela) {
  if (!tela.ultima_comunicacao) return false;
  const diffMs = Date.now() - new Date(tela.ultima_comunicacao + 'Z').getTime();
  return diffMs >= 0 && diffMs <= ONLINE_LIMIAR_MINUTOS * 60_000;
}
function serializarTela(tela) {
  const online = estaOnline(tela);
  return {
    ...tela,
    status: online ? 'online' : 'offline',
    disponibilidade: online ? 'em_uso' : 'disponivel',
  };
}

app.get('/api/telas', requireApiAuth, (req, res) => {
  const telas = db.prepare(`SELECT * FROM telas ORDER BY criado_em DESC`).all();
  res.json(telas.map(serializarTela));
});

app.get('/api/telas/:id', requireApiAuth, (req, res) => {
  const tela = db.prepare(`SELECT * FROM telas WHERE id = ?`).get(req.params.id);
  if (!tela) return res.status(404).json({ error: 'Tela não encontrada' });
  res.json(serializarTela(tela));
});

/* Campos do cadastro completo de tela (Info, Localização, Métricas, Configurações) */
const TELA_CAMPOS = [
  'nome', 'localizacao', 'orientacao', 'grupo_id', 'tipo_dispositivo', 'imagem',
  'telefone1', 'telefone2',
  'endereco', 'numero', 'complemento', 'bairro', 'cep', 'estado', 'cidade', 'latitude', 'longitude',
  'segmento', 'horario_inicio', 'horario_fim', 'dias_semana', 'fluxo_pessoas', 'classes_sociais',
  'config', 'anotacoes', 'favorito',
];

function normalizarTelaBody(body) {
  const out = {};
  for (const campo of TELA_CAMPOS) {
    if (!(campo in body)) continue;
    let v = body[campo];
    if (campo === 'dias_semana' && Array.isArray(v)) v = v.join(',');
    if (campo === 'classes_sociais' && Array.isArray(v)) v = JSON.stringify(v);
    if (campo === 'config' && typeof v === 'object' && v !== null) v = JSON.stringify(v);
    if (campo === 'favorito') v = v ? 1 : 0;
    out[campo] = v;
  }
  return out;
}

app.post('/api/telas', requireApiAuth, (req, res) => {
  const dados = normalizarTelaBody(req.body);
  if (!dados.nome) return res.status(400).json({ error: 'Nome é obrigatório' });

  const campos = Object.keys(dados);
  const stmt = db.prepare(
    `INSERT INTO telas (${campos.join(', ')}) VALUES (${campos.map(() => '?').join(', ')})`
  );
  const result = stmt.run(...campos.map(c => dados[c] ?? null));
  res.status(201).json(serializarTela(db.prepare(`SELECT * FROM telas WHERE id = ?`).get(result.lastInsertRowid)));
});

app.put('/api/telas/:id', requireApiAuth, (req, res) => {
  const existing = db.prepare(`SELECT * FROM telas WHERE id = ?`).get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Tela não encontrada' });

  const dados = normalizarTelaBody(req.body);
  if ('status' in req.body) dados.status = req.body.status;
  const campos = Object.keys(dados);
  if (campos.length) {
    db.prepare(`UPDATE telas SET ${campos.map(c => `${c} = ?`).join(', ')} WHERE id = ?`).run(
      ...campos.map(c => dados[c] ?? null),
      req.params.id
    );
  }
  res.json(serializarTela(db.prepare(`SELECT * FROM telas WHERE id = ?`).get(req.params.id)));
});

app.delete('/api/telas/:id', requireApiAuth, (req, res) => {
  db.prepare(`DELETE FROM telas WHERE id = ?`).run(req.params.id);
  db.prepare(`DELETE FROM comandos_remotos WHERE tela_id = ?`).run(req.params.id);
  res.json({ success: true });
});

/* ============================================================
   API — Desempenho de uma tela específica (gráfico Mensal/Diário)
   ============================================================ */
app.get('/api/telas/:id/desempenho', requireApiAuth, (req, res) => {
  const telaId = req.params.id;

  /* Diário: exibições dos últimos 7 dias por dia da semana */
  const diarias = db.prepare(`
    SELECT strftime('%w', exibido_em) as dow, COUNT(*) as c
    FROM exibicoes WHERE tela_id = ? AND exibido_em >= datetime('now', '-6 days')
    GROUP BY dow
  `).all(telaId);
  const diario = [0, 0, 0, 0, 0, 0, 0];
  diarias.forEach(l => { diario[Number(l.dow)] = l.c; });

  /* Mensal: exibições dos últimos 12 meses por mês */
  const mensais = db.prepare(`
    SELECT strftime('%m', exibido_em) as mes, COUNT(*) as c
    FROM exibicoes WHERE tela_id = ? AND exibido_em >= datetime('now', '-12 months')
    GROUP BY mes
  `).all(telaId);
  const mensal = Array(12).fill(0);
  mensais.forEach(l => { mensal[Number(l.mes) - 1] = l.c; });

  res.json({ diario, mensal });
});

/* Relatório simples de exibições da tela, em CSV (pra baixar do painel) */
app.get('/api/telas/:id/relatorio.csv', requireApiAuth, (req, res) => {
  const tela = db.prepare(`SELECT * FROM telas WHERE id = ?`).get(req.params.id);
  if (!tela) return res.status(404).send('Tela não encontrada');
  const exibicoes = db.prepare(`
    SELECT e.exibido_em, m.nome as midia_nome
    FROM exibicoes e LEFT JOIN midias m ON m.id = e.midia_id
    WHERE e.tela_id = ? ORDER BY e.exibido_em DESC LIMIT 1000
  `).all(req.params.id);

  const linhas = ['Data/hora,Mídia'];
  exibicoes.forEach(e => linhas.push(`${e.exibido_em},"${(e.midia_nome || '—').replace(/"/g, '""')}"`));

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="relatorio-${tela.nome.replace(/[^a-z0-9]+/gi, '-')}.csv"`);
  res.send('﻿' + linhas.join('\n'));
});

/* ============================================================
   API — Comandos remotos (autenticado: criar/listar; público: TV consome)
   ============================================================ */
app.get('/api/telas/:id/comandos', requireApiAuth, (req, res) => {
  res.json(db.prepare(`SELECT * FROM comandos_remotos WHERE tela_id = ? ORDER BY criado_em DESC LIMIT 30`).all(req.params.id));
});

app.post('/api/telas/:id/comandos', requireApiAuth, (req, res) => {
  const { comando } = req.body;
  if (!comando) return res.status(400).json({ error: 'Comando é obrigatório' });
  const result = db.prepare(`INSERT INTO comandos_remotos (tela_id, comando) VALUES (?, ?)`).run(req.params.id, comando);
  res.status(201).json(db.prepare(`SELECT * FROM comandos_remotos WHERE id = ?`).get(result.lastInsertRowid));
});

/* A TV busca comandos pendentes (sem auth) e o servidor já marca como "enviado" */
app.get('/api/public/telas/:id/comandos', (req, res) => {
  const pendentes = db.prepare(`SELECT * FROM comandos_remotos WHERE tela_id = ? AND status = 'pendente' ORDER BY criado_em ASC`).all(req.params.id);
  const ids = pendentes.map(c => c.id);
  if (ids.length) {
    db.prepare(`UPDATE comandos_remotos SET status = 'enviado', enviado_em = CURRENT_TIMESTAMP WHERE id IN (${ids.map(() => '?').join(',')})`).run(...ids);
  }
  res.json(pendentes);
});

/* A TV avisa quando terminou de executar um comando (sem auth) */
app.post('/api/public/telas/:id/comandos/:comandoId/concluir', (req, res) => {
  db.prepare(`UPDATE comandos_remotos SET status = 'concluido', concluido_em = CURRENT_TIMESTAMP WHERE id = ? AND tela_id = ?`)
    .run(req.params.comandoId, req.params.id);
  res.json({ success: true });
});

/* ============================================================
   API — Heartbeat de dispositivo (sem auth, chamado periodicamente pelo app Android)
   Reporta status "vivo" + dados do dispositivo pra tela "Detalhe da tela".
   ============================================================ */
app.post('/api/public/telas/:id/heartbeat', (req, res) => {
  const tela = db.prepare(`SELECT * FROM telas WHERE id = ?`).get(req.params.id);
  if (!tela) return res.status(404).json({ error: 'Tela não encontrada' });

  const {
    modelo, processador, versao_android, rooteado, versao_app, uso_memoria_mb,
    midias_baixadas_total, midias_baixadas_ok,
  } = req.body || {};

  db.prepare(`
    UPDATE telas SET
      status = 'online',
      ultima_comunicacao = CURRENT_TIMESTAMP,
      modelo = COALESCE(?, modelo),
      processador = COALESCE(?, processador),
      versao_android = COALESCE(?, versao_android),
      rooteado = COALESCE(?, rooteado),
      versao_app = COALESCE(?, versao_app),
      uso_memoria_mb = COALESCE(?, uso_memoria_mb),
      midias_baixadas_total = COALESCE(?, midias_baixadas_total),
      midias_baixadas_ok = COALESCE(?, midias_baixadas_ok)
    WHERE id = ?
  `).run(
    modelo ?? null, processador ?? null, versao_android ?? null,
    rooteado === undefined ? null : (rooteado ? 1 : 0),
    versao_app ?? null, uso_memoria_mb ?? null,
    midias_baixadas_total ?? null, midias_baixadas_ok ?? null,
    req.params.id
  );

  res.json({ success: true });
});

/* ============================================================
   API — Campanhas
   ============================================================ */
app.get('/api/campanhas', requireApiAuth, (req, res) => {
  res.json(db.prepare(`SELECT * FROM campanhas ORDER BY criado_em DESC`).all());
});

app.post('/api/campanhas', requireApiAuth, (req, res) => {
  const { nome, descricao, telas_ids } = req.body;
  if (!nome) return res.status(400).json({ error: 'Nome é obrigatório' });

  const stmt = db.prepare(`INSERT INTO campanhas (nome, descricao, telas_ids) VALUES (?, ?, ?)`);
  const result = stmt.run(nome, descricao || null, JSON.stringify(telas_ids || []));
  res.status(201).json(db.prepare(`SELECT * FROM campanhas WHERE id = ?`).get(result.lastInsertRowid));
});

app.put('/api/campanhas/:id', requireApiAuth, (req, res) => {
  const { nome, descricao, status, telas_ids } = req.body;
  const existing = db.prepare(`SELECT * FROM campanhas WHERE id = ?`).get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Campanha não encontrada' });

  db.prepare(`UPDATE campanhas SET nome = ?, descricao = ?, status = ?, telas_ids = ? WHERE id = ?`).run(
    nome ?? existing.nome,
    descricao ?? existing.descricao,
    status ?? existing.status,
    telas_ids ? JSON.stringify(telas_ids) : existing.telas_ids,
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

const MIDIA_CAMPOS = [
  'nome', 'tipo', 'url', 'campanha_id', 'orientacao',
  'cliente_id', 'categoria', 'url_horizontal', 'url_vertical',
  'duracao_segundos', 'gravar_estatisticas',
  'agenda_inicio', 'agenda_fim', 'agenda_hora_inicio', 'agenda_hora_fim', 'agenda_dias_semana',
  'status',
];

function normalizarMidiaBody(body) {
  const out = {};
  for (const campo of MIDIA_CAMPOS) {
    if (!(campo in body)) continue;
    let v = body[campo];
    if (campo === 'agenda_dias_semana' && Array.isArray(v)) v = v.join(',');
    if (campo === 'gravar_estatisticas') v = v ? 1 : 0;
    out[campo] = v;
  }
  return out;
}

/* Cria/atualiza o grupo "Inclusão rápida" gerado a partir do formulário de mídia,
   vinculando essa mídia às telas escolhidas ali sem precisar ir em "Vincular telas". */
function aplicarInclusaoRapida(midiaId, nomeMidia, telasIds) {
  const existente = db.prepare(`SELECT * FROM grupos WHERE midia_auto_id = ?`).get(midiaId);
  const telasIdsValidas = Array.isArray(telasIds) ? telasIds.map(Number).filter(Boolean) : [];
  if (!telasIdsValidas.length) {
    if (existente) db.prepare(`DELETE FROM grupos WHERE id = ?`).run(existente.id);
    return;
  }
  const nome = `Inclusão rápida — ${nomeMidia}`;
  if (existente) {
    db.prepare(`UPDATE grupos SET nome = ?, midias_ids = ?, telas_ids = ? WHERE id = ?`).run(
      nome, JSON.stringify([midiaId]), JSON.stringify(telasIdsValidas), existente.id
    );
  } else {
    db.prepare(`INSERT INTO grupos (nome, midias_ids, telas_ids, midia_auto_id) VALUES (?, ?, ?, ?)`).run(
      nome, JSON.stringify([midiaId]), JSON.stringify(telasIdsValidas), midiaId
    );
  }
}

app.post('/api/midias', requireApiAuth, (req, res) => {
  const dados = normalizarMidiaBody(req.body);
  if (!dados.nome) return res.status(400).json({ error: 'Nome é obrigatório' });

  const campos = Object.keys(dados);
  const stmt = db.prepare(`INSERT INTO midias (${campos.join(', ')}) VALUES (${campos.map(() => '?').join(', ')})`);
  const result = stmt.run(...campos.map(c => dados[c] ?? null));
  const midia = db.prepare(`SELECT * FROM midias WHERE id = ?`).get(result.lastInsertRowid);

  if (Array.isArray(req.body.telas_rapidas)) {
    aplicarInclusaoRapida(midia.id, midia.nome, req.body.telas_rapidas);
  }
  res.status(201).json(midia);
});

app.put('/api/midias/:id', requireApiAuth, (req, res) => {
  const existing = db.prepare(`SELECT * FROM midias WHERE id = ?`).get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Mídia não encontrada' });

  const dados = normalizarMidiaBody(req.body);
  const campos = Object.keys(dados);
  if (campos.length) {
    db.prepare(`UPDATE midias SET ${campos.map(c => `${c} = ?`).join(', ')} WHERE id = ?`).run(
      ...campos.map(c => dados[c] ?? null),
      req.params.id
    );
  }
  const midia = db.prepare(`SELECT * FROM midias WHERE id = ?`).get(req.params.id);

  if (Array.isArray(req.body.telas_rapidas)) {
    aplicarInclusaoRapida(midia.id, midia.nome, req.body.telas_rapidas);
  }
  res.json(midia);
});

app.delete('/api/midias/:id', requireApiAuth, (req, res) => {
  db.prepare(`DELETE FROM midias WHERE id = ?`).run(req.params.id);
  db.prepare(`DELETE FROM grupos WHERE midia_auto_id = ?`).run(req.params.id);
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
  const midia = db.prepare(`SELECT * FROM midias WHERE id = ?`).get(midia_id);
  if (!midia || midia.gravar_estatisticas !== 0) {
    db.prepare(`INSERT INTO exibicoes (tela_id, midia_id) VALUES (?, ?)`).run(tela_id, midia_id);
  }
  if (midia) {
    db.prepare(`
      UPDATE telas SET status = 'online', ultima_comunicacao = CURRENT_TIMESTAMP,
        ultima_midia_nome = ?, ultima_midia_url = ?, ultima_midia_tipo = ?
      WHERE id = ?
    `).run(midia.nome, midia.url_horizontal || midia.url_vertical || midia.url || null, midia.tipo, tela_id);
  } else {
    db.prepare(`UPDATE telas SET status = 'online', ultima_comunicacao = CURRENT_TIMESTAMP WHERE id = ?`).run(tela_id);
  }
  res.status(201).json({ success: true });
});

/* Verifica se a mídia está dentro da janela de agendamento configurada
   (datas, dias da semana e faixa de horário). Sem nada configurado, sempre exibe. */
function dentroDaAgenda(m) {
  const agora = new Date();
  const hoje = agora.toISOString().slice(0, 10);
  const hhmm = agora.toTimeString().slice(0, 5);
  const diaSemana = agora.getDay();

  if (m.agenda_inicio && hoje < m.agenda_inicio) return false;
  if (m.agenda_fim && hoje > m.agenda_fim) return false;

  const dias = (m.agenda_dias_semana || '0,1,2,3,4,5,6').split(',').filter(x => x !== '').map(Number);
  if (dias.length && !dias.includes(diaSemana)) return false;

  if (m.agenda_hora_inicio && m.agenda_hora_fim) {
    if (hhmm < m.agenda_hora_inicio || hhmm > m.agenda_hora_fim) return false;
  }
  return true;
}

/* Escolhe o arquivo certo pra orientação da tela. Mídias com upload
   (Vídeo/imagem) podem ter um arquivo horizontal e outro vertical;
   mídias por URL (YouTube/link/programática) usam sempre a mesma URL. */
function urlParaOrientacao(m, orientacaoTela) {
  if (m.url_horizontal || m.url_vertical) {
    return orientacaoTela === 'Vertical' ? (m.url_vertical || null) : (m.url_horizontal || null);
  }
  return m.url || null;
}

/* Mídias públicas para o player de TV (sem auth).
   Se vier ?tela_id=, retorna só as mídias vinculadas a essa tela
   (via "Vincular telas" / grupos), já filtradas por agendamento e
   com o arquivo certo pra orientação da tela. Sem tela_id, mantém o
   comportamento antigo (todas, sem filtro de orientação) por compatibilidade. */
app.get('/api/public/midias', (req, res) => {
  const telaId = req.query.tela_id ? Number(req.query.tela_id) : null;
  const tela = telaId ? db.prepare(`SELECT * FROM telas WHERE id = ?`).get(telaId) : null;
  const todas = db.prepare(`SELECT * FROM midias ORDER BY criado_em DESC`).all();

  let selecionadas = todas;
  if (telaId) {
    const grupos = db.prepare(`SELECT midias_ids, telas_ids FROM grupos WHERE status IS NULL OR status != 'inativo'`).all();
    const midiaIdsPermitidos = new Set();
    grupos.forEach(g => {
      const telasIds = JSON.parse(g.telas_ids || '[]');
      if (telasIds.includes(telaId)) {
        JSON.parse(g.midias_ids || '[]').forEach(id => midiaIdsPermitidos.add(id));
      }
    });
    selecionadas = todas.filter(m => midiaIdsPermitidos.has(m.id));
  }

  const orientacaoTela = tela ? (tela.orientacao || 'Horizontal') : 'Horizontal';
  const resultado = selecionadas
    .filter(m => m.status !== 'inativo')
    .filter(dentroDaAgenda)
    .map(m => ({ ...m, url: urlParaOrientacao(m, orientacaoTela) }))
    .filter(m => m.url);

  res.json(resultado);
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
