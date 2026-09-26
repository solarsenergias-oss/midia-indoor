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

/* ============================================================
   Relatórios — logger periódico de status das telas
   Grava uma "foto" do status (online/offline) de cada tela a
   cada 5 minutos em telas_status_log, pra permitir calcular a
   disponibilidade (uptime) por tela ao longo de um período em
   /api/relatorios/disponibilidade, e não só o status "agora".
   ============================================================ */
function registrarStatusTelas() {
  const telas = db.prepare(`SELECT id, ultima_comunicacao FROM telas`).all();
  if (!telas.length) return;
  const insert = db.prepare(`INSERT INTO telas_status_log (tela_id, status) VALUES (?, ?)`);
  const gravarTodas = db.transaction((lista) => {
    lista.forEach(t => insert.run(t.id, estaOnline(t) ? 'online' : 'offline'));
  });
  gravarTodas(telas);
}
registrarStatusTelas();
setInterval(registrarStatusTelas, 5 * 60 * 1000);

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
   API — Relatórios (visão geral, exibições e disponibilidade)
   ============================================================ */
app.get('/api/relatorios/overview', requireApiAuth, (req, res) => {
  const telas_total = db.prepare(`SELECT COUNT(*) as c FROM telas`).get().c;
  const telas_online = db.prepare(`SELECT COUNT(*) as c FROM telas WHERE ultima_comunicacao >= datetime('now', ?)`).get(`-${ONLINE_LIMIAR_MINUTOS} minutes`).c;
  const clientes_total = db.prepare(`SELECT COUNT(*) as c FROM clientes`).get().c;
  const campanhas_ativas = db.prepare(`SELECT COUNT(*) as c FROM campanhas WHERE status = 'ativa'`).get().c;
  const midias_total = db.prepare(`SELECT COUNT(*) as c FROM midias`).get().c;

  res.json({
    telas_total,
    telas_online,
    telas_offline: telas_total - telas_online,
    clientes_total,
    campanhas_ativas,
    midias_total,
  });
});

/* Exibições por tela num período (7 ou 30 dias) — agregado em SQL, sem N+1 */
app.get('/api/relatorios/exibicoes', requireApiAuth, (req, res) => {
  const dias = Number(req.query.dias) === 30 ? 30 : 7;
  const linhas = db.prepare(`
    SELECT t.id as tela_id, t.nome as tela_nome,
      COUNT(e.id) as total_exibicoes,
      MAX(e.exibido_em) as ultima_exibicao
    FROM telas t
    LEFT JOIN exibicoes e ON e.tela_id = t.id AND e.exibido_em >= datetime('now', ?)
    GROUP BY t.id
    ORDER BY total_exibicoes DESC, t.nome ASC
  `).all(`-${dias} days`);

  res.json({ dias, telas: linhas });
});

/* Taxa de disponibilidade (uptime) por tela num período, calculada a partir
   do histórico gravado em telas_status_log (ver registrarStatusTelas acima).
   Enquanto o histórico ainda não cobre o período pedido (ex.: logo após
   atualizar pra esta versão), cai pra um modo "instantâneo": mostra o
   status atual (online = 100%, offline = 0%) em vez de uma taxa real ao
   longo do tempo, e avisa o front-end disso em `modo`. */
app.get('/api/relatorios/disponibilidade', requireApiAuth, (req, res) => {
  const dias = Number(req.query.dias) === 30 ? 30 : 7;
  const totalRegistros = db.prepare(`SELECT COUNT(*) as c FROM telas_status_log WHERE registrado_em >= datetime('now', ?)`).get(`-${dias} days`).c;

  if (!totalRegistros) {
    const telas = db.prepare(`SELECT * FROM telas ORDER BY nome ASC`).all().map(serializarTela);
    return res.json({
      dias,
      modo: 'instantaneo',
      telas: telas.map(t => ({
        tela_id: t.id,
        tela_nome: t.nome,
        disponibilidade_pct: t.status === 'online' ? 100 : 0,
      })),
    });
  }

  const linhas = db.prepare(`
    SELECT t.id as tela_id, t.nome as tela_nome,
      COUNT(l.id) as total_registros,
      SUM(CASE WHEN l.status = 'online' THEN 1 ELSE 0 END) as registros_online
    FROM telas t
    LEFT JOIN telas_status_log l ON l.tela_id = t.id AND l.registrado_em >= datetime('now', ?)
    GROUP BY t.id
    ORDER BY t.nome ASC
  `).all(`-${dias} days`);

  res.json({
    dias,
    modo: 'historico',
    telas: linhas.map(l => ({
      tela_id: l.tela_id,
      tela_nome: l.tela_nome,
      disponibilidade_pct: l.total_registros ? Math.round((l.registros_online / l.total_registros) * 100) : null,
    })),
  });
});

/* ============================================================
   API — WhatsApp CRM
   ============================================================ */
const WHATSAPP_FUNIL_ETAPAS = ['Novo', 'Em conversa', 'Proposta enviada', 'Fechado', 'Perdido'];

function getWhatsappConfig() {
  return db.prepare(`SELECT * FROM whatsapp_config ORDER BY id DESC LIMIT 1`).get() || null;
}

function serializarContatoWhatsapp(contato) {
  if (!contato) return contato;
  const etiquetas = db.prepare(`
    SELECT e.* FROM whatsapp_etiquetas e
    JOIN whatsapp_contato_etiquetas ce ON ce.etiqueta_id = e.id
    WHERE ce.contato_id = ?
    ORDER BY e.nome ASC
  `).all(contato.id);
  return { ...contato, etiquetas };
}

/* Envia uma mensagem de texto via WhatsApp Cloud API (Graph API da Meta).
   Não quebra se a config estiver vazia/placeholder — só reporta erro. */
async function enviarMensagemWhatsapp(telefone, texto) {
  const config = getWhatsappConfig();
  if (!config || !config.phone_number_id || !config.access_token) {
    return { ok: false, error: 'WhatsApp não configurado — vá em Configurações' };
  }
  try {
    const resp = await fetch(`https://graph.facebook.com/v20.0/${config.phone_number_id}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.access_token}`,
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: telefone,
        type: 'text',
        text: { body: texto },
      }),
    });
    const dados = await resp.json().catch(() => ({}));
    if (!resp.ok) {
      return { ok: false, error: dados?.error?.message || 'Falha ao enviar mensagem pela API do WhatsApp' };
    }
    return { ok: true, wa_message_id: dados?.messages?.[0]?.id || null };
  } catch (err) {
    return { ok: false, error: 'Erro de conexão com a API do WhatsApp' };
  }
}

/* ---------- Configuração ---------- */
app.get('/api/whatsapp/config', requireApiAuth, (req, res) => {
  res.json(getWhatsappConfig() || {
    phone_number_id: '', waba_id: '', access_token: '', webhook_verify_token: '',
  });
});

app.put('/api/whatsapp/config', requireApiAuth, (req, res) => {
  const { phone_number_id, waba_id, access_token, webhook_verify_token } = req.body;
  const existente = getWhatsappConfig();

  if (existente) {
    db.prepare(`
      UPDATE whatsapp_config SET phone_number_id = ?, waba_id = ?, access_token = ?, webhook_verify_token = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(phone_number_id || '', waba_id || '', access_token || '', webhook_verify_token || '', existente.id);
  } else {
    db.prepare(`
      INSERT INTO whatsapp_config (phone_number_id, waba_id, access_token, webhook_verify_token)
      VALUES (?, ?, ?, ?)
    `).run(phone_number_id || '', waba_id || '', access_token || '', webhook_verify_token || '');
  }

  res.json(getWhatsappConfig());
});

/* ---------- Contatos ---------- */
app.get('/api/whatsapp/contatos', requireApiAuth, (req, res) => {
  const { tag, etapa, busca } = req.query;
  let sql = `SELECT DISTINCT c.* FROM whatsapp_contatos c`;
  const where = [];
  const params = [];

  if (tag) {
    sql += ` JOIN whatsapp_contato_etiquetas ce ON ce.contato_id = c.id`;
    where.push(`ce.etiqueta_id = ?`);
    params.push(tag);
  }
  if (etapa) { where.push(`c.etapa_funil = ?`); params.push(etapa); }
  if (busca) { where.push(`(c.nome LIKE ? OR c.telefone LIKE ?)`); params.push(`%${busca}%`, `%${busca}%`); }
  if (where.length) sql += ` WHERE ` + where.join(' AND ');
  sql += ` ORDER BY c.atualizado_em DESC`;

  const contatos = db.prepare(sql).all(...params);
  res.json(contatos.map(serializarContatoWhatsapp));
});

app.post('/api/whatsapp/contatos', requireApiAuth, (req, res) => {
  const { telefone, nome, etapa_funil } = req.body;
  if (!telefone) return res.status(400).json({ error: 'Telefone é obrigatório' });

  try {
    const stmt = db.prepare(`INSERT INTO whatsapp_contatos (telefone, nome, etapa_funil) VALUES (?, ?, ?)`);
    const result = stmt.run(String(telefone).trim(), nome || null, etapa_funil || 'Novo');
    const contato = db.prepare(`SELECT * FROM whatsapp_contatos WHERE id = ?`).get(result.lastInsertRowid);
    res.status(201).json(serializarContatoWhatsapp(contato));
  } catch (err) {
    res.status(400).json({ error: 'Já existe um contato cadastrado com esse telefone' });
  }
});

app.put('/api/whatsapp/contatos/:id', requireApiAuth, (req, res) => {
  const existing = db.prepare(`SELECT * FROM whatsapp_contatos WHERE id = ?`).get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Contato não encontrado' });

  const { nome, telefone, etapa_funil } = req.body;
  db.prepare(`
    UPDATE whatsapp_contatos SET nome = ?, telefone = ?, etapa_funil = ?, atualizado_em = CURRENT_TIMESTAMP WHERE id = ?
  `).run(nome ?? existing.nome, telefone ?? existing.telefone, etapa_funil ?? existing.etapa_funil, req.params.id);

  res.json(serializarContatoWhatsapp(db.prepare(`SELECT * FROM whatsapp_contatos WHERE id = ?`).get(req.params.id)));
});

app.put('/api/whatsapp/contatos/:id/etapa', requireApiAuth, (req, res) => {
  const { etapa_funil } = req.body;
  if (!WHATSAPP_FUNIL_ETAPAS.includes(etapa_funil)) return res.status(400).json({ error: 'Etapa de funil inválida' });

  const existing = db.prepare(`SELECT * FROM whatsapp_contatos WHERE id = ?`).get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Contato não encontrado' });

  db.prepare(`UPDATE whatsapp_contatos SET etapa_funil = ?, atualizado_em = CURRENT_TIMESTAMP WHERE id = ?`).run(etapa_funil, req.params.id);
  res.json(serializarContatoWhatsapp(db.prepare(`SELECT * FROM whatsapp_contatos WHERE id = ?`).get(req.params.id)));
});

app.delete('/api/whatsapp/contatos/:id', requireApiAuth, (req, res) => {
  db.prepare(`DELETE FROM whatsapp_contatos WHERE id = ?`).run(req.params.id);
  res.json({ success: true });
});

/* Cria (ou retorna, se já existir) a conversa desse contato — usado pelo
   painel de Atendimento antes de abrir o chat ou enviar a 1ª mensagem. */
app.post('/api/whatsapp/contatos/:id/conversa', requireApiAuth, (req, res) => {
  const contato = db.prepare(`SELECT * FROM whatsapp_contatos WHERE id = ?`).get(req.params.id);
  if (!contato) return res.status(404).json({ error: 'Contato não encontrado' });

  let conversa = db.prepare(`SELECT * FROM whatsapp_conversas WHERE contato_id = ?`).get(contato.id);
  if (!conversa) {
    const result = db.prepare(`INSERT INTO whatsapp_conversas (contato_id) VALUES (?)`).run(contato.id);
    conversa = db.prepare(`SELECT * FROM whatsapp_conversas WHERE id = ?`).get(result.lastInsertRowid);
  }
  res.json(conversa);
});

/* ---------- Anotações do contato (log de atividade, não editável) ---------- */
app.get('/api/whatsapp/contatos/:id/notas', requireApiAuth, (req, res) => {
  res.json(db.prepare(`SELECT * FROM whatsapp_notas WHERE contato_id = ? ORDER BY criado_em DESC`).all(req.params.id));
});

app.post('/api/whatsapp/contatos/:id/notas', requireApiAuth, (req, res) => {
  const { texto } = req.body;
  if (!texto || !texto.trim()) return res.status(400).json({ error: 'Texto da anotação é obrigatório' });

  const result = db.prepare(`INSERT INTO whatsapp_notas (contato_id, texto) VALUES (?, ?)`).run(req.params.id, texto.trim());
  res.status(201).json(db.prepare(`SELECT * FROM whatsapp_notas WHERE id = ?`).get(result.lastInsertRowid));
});

/* ---------- Etiquetas ---------- */
app.get('/api/whatsapp/etiquetas', requireApiAuth, (req, res) => {
  res.json(db.prepare(`SELECT * FROM whatsapp_etiquetas ORDER BY nome ASC`).all());
});

app.post('/api/whatsapp/etiquetas', requireApiAuth, (req, res) => {
  const { nome, cor } = req.body;
  if (!nome) return res.status(400).json({ error: 'Nome é obrigatório' });

  const result = db.prepare(`INSERT INTO whatsapp_etiquetas (nome, cor) VALUES (?, ?)`).run(nome, cor || '#6C5CE0');
  res.status(201).json(db.prepare(`SELECT * FROM whatsapp_etiquetas WHERE id = ?`).get(result.lastInsertRowid));
});

app.put('/api/whatsapp/etiquetas/:id', requireApiAuth, (req, res) => {
  const existing = db.prepare(`SELECT * FROM whatsapp_etiquetas WHERE id = ?`).get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Etiqueta não encontrada' });

  const { nome, cor } = req.body;
  db.prepare(`UPDATE whatsapp_etiquetas SET nome = ?, cor = ? WHERE id = ?`).run(nome ?? existing.nome, cor ?? existing.cor, req.params.id);
  res.json(db.prepare(`SELECT * FROM whatsapp_etiquetas WHERE id = ?`).get(req.params.id));
});

app.delete('/api/whatsapp/etiquetas/:id', requireApiAuth, (req, res) => {
  db.prepare(`DELETE FROM whatsapp_etiquetas WHERE id = ?`).run(req.params.id);
  res.json({ success: true });
});

app.post('/api/whatsapp/contatos/:id/etiquetas', requireApiAuth, (req, res) => {
  const { etiqueta_id, ativo } = req.body;
  if (ativo) {
    db.prepare(`INSERT OR IGNORE INTO whatsapp_contato_etiquetas (contato_id, etiqueta_id) VALUES (?, ?)`).run(req.params.id, etiqueta_id);
  } else {
    db.prepare(`DELETE FROM whatsapp_contato_etiquetas WHERE contato_id = ? AND etiqueta_id = ?`).run(req.params.id, etiqueta_id);
  }
  res.json(serializarContatoWhatsapp(db.prepare(`SELECT * FROM whatsapp_contatos WHERE id = ?`).get(req.params.id)));
});

/* ---------- Modelos de mensagem (templates) ---------- */
app.get('/api/whatsapp/templates', requireApiAuth, (req, res) => {
  res.json(db.prepare(`SELECT * FROM whatsapp_templates ORDER BY criado_em DESC`).all());
});

app.post('/api/whatsapp/templates', requireApiAuth, (req, res) => {
  const { nome, categoria, corpo } = req.body;
  if (!nome || !corpo) return res.status(400).json({ error: 'Nome e corpo da mensagem são obrigatórios' });

  const result = db.prepare(`INSERT INTO whatsapp_templates (nome, categoria, corpo) VALUES (?, ?, ?)`).run(nome, categoria || null, corpo);
  res.status(201).json(db.prepare(`SELECT * FROM whatsapp_templates WHERE id = ?`).get(result.lastInsertRowid));
});

app.put('/api/whatsapp/templates/:id', requireApiAuth, (req, res) => {
  const existing = db.prepare(`SELECT * FROM whatsapp_templates WHERE id = ?`).get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Modelo não encontrado' });

  const { nome, categoria, corpo } = req.body;
  db.prepare(`UPDATE whatsapp_templates SET nome = ?, categoria = ?, corpo = ? WHERE id = ?`).run(
    nome ?? existing.nome, categoria ?? existing.categoria, corpo ?? existing.corpo, req.params.id
  );
  res.json(db.prepare(`SELECT * FROM whatsapp_templates WHERE id = ?`).get(req.params.id));
});

app.delete('/api/whatsapp/templates/:id', requireApiAuth, (req, res) => {
  db.prepare(`DELETE FROM whatsapp_templates WHERE id = ?`).run(req.params.id);
  res.json({ success: true });
});

/* ---------- Conversas e mensagens (Atendimento / Inbox) ---------- */
app.get('/api/whatsapp/conversas', requireApiAuth, (req, res) => {
  const conversas = db.prepare(`
    SELECT co.*, c.nome as contato_nome, c.telefone as contato_telefone, c.etapa_funil,
      (SELECT texto FROM whatsapp_mensagens m WHERE m.conversa_id = co.id ORDER BY m.criado_em DESC LIMIT 1) as ultima_mensagem_texto
    FROM whatsapp_conversas co
    JOIN whatsapp_contatos c ON c.id = co.contato_id
    ORDER BY co.ultima_mensagem_em DESC
  `).all();
  res.json(conversas);
});

app.get('/api/whatsapp/conversas/:id/mensagens', requireApiAuth, (req, res) => {
  const conversa = db.prepare(`SELECT * FROM whatsapp_conversas WHERE id = ?`).get(req.params.id);
  if (!conversa) return res.status(404).json({ error: 'Conversa não encontrada' });

  db.prepare(`UPDATE whatsapp_conversas SET nao_lida = 0 WHERE id = ?`).run(req.params.id);
  res.json(db.prepare(`SELECT * FROM whatsapp_mensagens WHERE conversa_id = ? ORDER BY criado_em ASC`).all(req.params.id));
});

app.post('/api/whatsapp/conversas/:id/mensagens', requireApiAuth, async (req, res) => {
  const conversa = db.prepare(`SELECT * FROM whatsapp_conversas WHERE id = ?`).get(req.params.id);
  if (!conversa) return res.status(404).json({ error: 'Conversa não encontrada' });
  const contato = db.prepare(`SELECT * FROM whatsapp_contatos WHERE id = ?`).get(conversa.contato_id);

  const { texto } = req.body;
  if (!texto || !texto.trim()) return res.status(400).json({ error: 'Texto é obrigatório' });

  const envio = await enviarMensagemWhatsapp(contato.telefone, texto.trim());
  const result = db.prepare(`
    INSERT INTO whatsapp_mensagens (conversa_id, direcao, texto, status, wa_message_id)
    VALUES (?, 'saida', ?, ?, ?)
  `).run(req.params.id, texto.trim(), envio.ok ? 'enviado' : 'falhou', envio.wa_message_id || null);

  db.prepare(`UPDATE whatsapp_conversas SET ultima_mensagem_em = CURRENT_TIMESTAMP WHERE id = ?`).run(req.params.id);

  const mensagem = db.prepare(`SELECT * FROM whatsapp_mensagens WHERE id = ?`).get(result.lastInsertRowid);
  if (!envio.ok) return res.status(201).json({ ...mensagem, aviso: envio.error });
  res.status(201).json(mensagem);
});

/* ---------- Métricas de conversão ---------- */
app.get('/api/whatsapp/metricas', requireApiAuth, (req, res) => {
  const por_etapa = {};
  WHATSAPP_FUNIL_ETAPAS.forEach(e => { por_etapa[e] = 0; });
  db.prepare(`SELECT etapa_funil, COUNT(*) as c FROM whatsapp_contatos GROUP BY etapa_funil`).all().forEach(l => {
    if (l.etapa_funil in por_etapa) por_etapa[l.etapa_funil] = l.c;
  });

  const contatos_por_dia = db.prepare(`
    SELECT date(criado_em) as dia, COUNT(*) as c
    FROM whatsapp_contatos
    WHERE criado_em >= datetime('now', '-30 days')
    GROUP BY dia ORDER BY dia ASC
  `).all();

  res.json({ etapas: WHATSAPP_FUNIL_ETAPAS, por_etapa, contatos_por_dia });
});

/* ============================================================
   API — Webhook do WhatsApp Cloud API (Meta) — PÚBLICO, sem auth,
   pois é a própria Meta quem chama essas rotas diretamente.
   ============================================================ */
app.get('/api/public/whatsapp/webhook', (req, res) => {
  const modo = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];
  const config = getWhatsappConfig();

  if (modo === 'subscribe' && config && config.webhook_verify_token && token === config.webhook_verify_token) {
    return res.status(200).send(challenge);
  }
  res.sendStatus(403);
});

app.post('/api/public/whatsapp/webhook', (req, res) => {
  try {
    const entry = req.body?.entry?.[0];
    const change = entry?.changes?.[0];
    const value = change?.value;

    const mensagensRecebidas = value?.messages || [];
    mensagensRecebidas.forEach(msg => {
      const telefone = msg?.from;
      if (!telefone) return;
      const nomeContato = value?.contacts?.[0]?.profile?.name || null;

      let contato = db.prepare(`SELECT * FROM whatsapp_contatos WHERE telefone = ?`).get(telefone);
      if (!contato) {
        const result = db.prepare(`INSERT INTO whatsapp_contatos (telefone, nome) VALUES (?, ?)`).run(telefone, nomeContato);
        contato = db.prepare(`SELECT * FROM whatsapp_contatos WHERE id = ?`).get(result.lastInsertRowid);
      }

      let conversa = db.prepare(`SELECT * FROM whatsapp_conversas WHERE contato_id = ?`).get(contato.id);
      if (!conversa) {
        const result = db.prepare(`INSERT INTO whatsapp_conversas (contato_id) VALUES (?)`).run(contato.id);
        conversa = db.prepare(`SELECT * FROM whatsapp_conversas WHERE id = ?`).get(result.lastInsertRowid);
      }

      const texto = msg?.text?.body || (msg?.type ? `[${msg.type}]` : null);
      db.prepare(`
        INSERT INTO whatsapp_mensagens (conversa_id, direcao, texto, status, wa_message_id)
        VALUES (?, 'entrada', ?, 'recebido', ?)
      `).run(conversa.id, texto, msg?.id || null);

      db.prepare(`UPDATE whatsapp_conversas SET ultima_mensagem_em = CURRENT_TIMESTAMP, nao_lida = 1 WHERE id = ?`).run(conversa.id);
    });

    const statusUpdates = value?.statuses || [];
    statusUpdates.forEach(st => {
      if (!st?.id) return;
      db.prepare(`UPDATE whatsapp_mensagens SET status = ? WHERE wa_message_id = ?`).run(st.status || 'atualizado', st.id);
    });
  } catch (err) {
    console.error('Erro ao processar webhook do WhatsApp:', err);
  }
  /* Sempre responde 200 rápido — a Meta reenvia (e pode até suspender o
     webhook) se a resposta demorar ou vier com erro. */
  res.sendStatus(200);
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
