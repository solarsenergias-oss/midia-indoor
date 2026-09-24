const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const dataDir = path.join(__dirname, '../data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const dbPath = path.join(dataDir, 'midia-indoor.db');
const db = new Database(dbPath);

db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS telas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT NOT NULL,
    localizacao TEXT,
    orientacao TEXT DEFAULT 'Horizontal',
    status TEXT DEFAULT 'offline',
    grupo_id INTEGER,
    ultima_comunicacao DATETIME,
    criado_em DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS campanhas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT NOT NULL,
    descricao TEXT,
    status TEXT DEFAULT 'ativa',
    dias_semana TEXT DEFAULT '0,1,2,3,4,5,6',
    hora_inicio TEXT DEFAULT '00:00',
    hora_fim TEXT DEFAULT '23:59',
    criado_em DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS midias (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT NOT NULL,
    tipo TEXT,
    url TEXT,
    campanha_id INTEGER,
    criado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (campanha_id) REFERENCES campanhas(id) ON DELETE SET NULL
  );

  CREATE TABLE IF NOT EXISTS clientes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT NOT NULL,
    email TEXT,
    telefone TEXT,
    cidade TEXT,
    status TEXT DEFAULT 'ativo',
    criado_em DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS exibicoes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tela_id INTEGER,
    midia_id INTEGER,
    exibido_em DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (tela_id) REFERENCES telas(id) ON DELETE CASCADE,
    FOREIGN KEY (midia_id) REFERENCES midias(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS usuarios (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    senha_hash TEXT NOT NULL,
    criado_em DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS sessions (
    token TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL,
    expires_at DATETIME NOT NULL,
    criado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES usuarios(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS grupos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT NOT NULL,
    imagem TEXT,
    midias_ids TEXT DEFAULT '[]',
    telas_ids TEXT DEFAULT '[]',
    status TEXT DEFAULT 'ativo',
    criado_em DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS rss_feeds (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    titulo TEXT NOT NULL,
    fonte TEXT,
    link TEXT,
    cor_fundo TEXT DEFAULT '#000000',
    cor_fonte TEXT DEFAULT '#ffffff',
    telas_ids TEXT DEFAULT '[]',
    status TEXT DEFAULT 'ativo',
    criado_em DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS instagram_perfis (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    usuario TEXT NOT NULL,
    telas_ids TEXT DEFAULT '[]',
    status TEXT DEFAULT 'ativo',
    criado_em DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

/* Migração leve: adiciona colunas novas em midias caso o banco já exista sem elas */
const midiaCols = db.prepare(`PRAGMA table_info(midias)`).all().map(c => c.name);
if (!midiaCols.includes('orientacao')) db.exec(`ALTER TABLE midias ADD COLUMN orientacao TEXT DEFAULT 'Paisagem'`);
if (!midiaCols.includes('status')) db.exec(`ALTER TABLE midias ADD COLUMN status TEXT DEFAULT 'ativo'`);
if (!midiaCols.includes('grupo_id')) db.exec(`ALTER TABLE midias ADD COLUMN grupo_id INTEGER`);

/* Migração leve: campanhas precisam saber em quais telas devem aparecer */
const campanhaCols = db.prepare(`PRAGMA table_info(campanhas)`).all().map(c => c.name);
if (!campanhaCols.includes('telas_ids')) db.exec(`ALTER TABLE campanhas ADD COLUMN telas_ids TEXT DEFAULT '[]'`);

/* Migração leve: cadastro completo de telas (tipo de dispositivo, localização no mapa,
   métricas do ponto e configurações de reprodução/rodapé) */
const telaCols = db.prepare(`PRAGMA table_info(telas)`).all().map(c => c.name);
const telaColsNovas = {
  tipo_dispositivo: `TEXT DEFAULT 'tv_monitor_tablet'`,
  imagem: `TEXT`,
  telefone1: `TEXT`,
  telefone2: `TEXT`,
  endereco: `TEXT`,
  numero: `TEXT`,
  complemento: `TEXT`,
  bairro: `TEXT`,
  cep: `TEXT`,
  estado: `TEXT`,
  cidade: `TEXT`,
  latitude: `REAL`,
  longitude: `REAL`,
  segmento: `TEXT`,
  horario_inicio: `TEXT`,
  horario_fim: `TEXT`,
  dias_semana: `TEXT DEFAULT '0,1,2,3,4,5,6'`,
  fluxo_pessoas: `INTEGER`,
  classes_sociais: `TEXT DEFAULT '[]'`,
  config: `TEXT DEFAULT '{}'`,
};
Object.entries(telaColsNovas).forEach(([col, ddl]) => {
  if (!telaCols.includes(col)) db.exec(`ALTER TABLE telas ADD COLUMN ${col} ${ddl}`);
});

/* Migração leve: mídias completas (cliente, categoria, arquivo por orientação,
   duração, estatísticas e agendamento) */
const midiaColsNovas = {
  cliente_id: `INTEGER`,
  categoria: `TEXT`,
  url_horizontal: `TEXT`,
  url_vertical: `TEXT`,
  duracao_segundos: `INTEGER DEFAULT 10`,
  gravar_estatisticas: `INTEGER DEFAULT 1`,
  agenda_inicio: `TEXT`,
  agenda_fim: `TEXT`,
  agenda_hora_inicio: `TEXT`,
  agenda_hora_fim: `TEXT`,
  agenda_dias_semana: `TEXT DEFAULT '0,1,2,3,4,5,6'`,
};
const midiaColsAtuais = db.prepare(`PRAGMA table_info(midias)`).all().map(c => c.name);
Object.entries(midiaColsNovas).forEach(([col, ddl]) => {
  if (!midiaColsAtuais.includes(col)) db.exec(`ALTER TABLE midias ADD COLUMN ${col} ${ddl}`);
});

/* Migração leve: marca grupos criados pela "Inclusão rápida" dentro de Nova mídia,
   pra poder atualizar em vez de duplicar a cada edição */
const grupoCols = db.prepare(`PRAGMA table_info(grupos)`).all().map(c => c.name);
if (!grupoCols.includes('midia_auto_id')) db.exec(`ALTER TABLE grupos ADD COLUMN midia_auto_id INTEGER`);

module.exports = db;
