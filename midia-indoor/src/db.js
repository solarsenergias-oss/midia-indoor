import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.join(__dirname, '../data/midia.db');

export const db = new Database(dbPath);

export function initializeDatabase() {
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  const tables = [
    `CREATE TABLE IF NOT EXISTS config (
      id INTEGER PRIMARY KEY,
      chave TEXT UNIQUE,
      valor TEXT,
      data_criacao DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
    
    `CREATE TABLE IF NOT EXISTS sessoes (
      id TEXT PRIMARY KEY,
      usuario TEXT,
      data_criacao DATETIME DEFAULT CURRENT_TIMESTAMP,
      data_expiracao DATETIME,
      ativo INTEGER DEFAULT 1
    )`,

    `CREATE TABLE IF NOT EXISTS telas (
      id TEXT PRIMARY KEY,
      nome TEXT NOT NULL,
      localizacao TEXT,
      latitude REAL,
      longitude REAL,
      resolucao TEXT,
      status TEXT DEFAULT 'offline',
      ultimo_ping DATETIME,
      data_criacao DATETIME DEFAULT CURRENT_TIMESTAMP,
      plano_id TEXT
    )`,

    `CREATE TABLE IF NOT EXISTS campanhas (
      id TEXT PRIMARY KEY,
      nome TEXT NOT NULL,
      descricao TEXT,
      data_inicio DATE,
      data_fim DATE,
      ativa INTEGER DEFAULT 1,
      data_criacao DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,

    `CREATE TABLE IF NOT EXISTS midias (
      id TEXT PRIMARY KEY,
      nome TEXT NOT NULL,
      tipo TEXT,
      tamanho INTEGER,
      duracao INTEGER,
      url TEXT,
      data_criacao DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,

    `CREATE TABLE IF NOT EXISTS exibicoes (
      id TEXT PRIMARY KEY,
      tela_id TEXT NOT NULL,
      midia_id TEXT NOT NULL,
      inicio DATETIME,
      fim DATETIME,
      data_registro DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(tela_id, inicio, midia_id),
      FOREIGN KEY(tela_id) REFERENCES telas(id),
      FOREIGN KEY(midia_id) REFERENCES midias(id)
    )`,

    `CREATE TABLE IF NOT EXISTS planos (
      id TEXT PRIMARY KEY,
      nome TEXT NOT NULL,
      descricao TEXT,
      preco REAL,
      max_telas INTEGER,
      max_campanhas INTEGER,
      max_midias INTEGER
    )`
  ];

  tables.forEach(sql => db.exec(sql));
  console.log('✅ Database initialized');
}
