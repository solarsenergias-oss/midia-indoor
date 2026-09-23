# 🎬 Mídia Indoor - Digital Signage Platform

Platform completa de digital signage para propaganda em TVs com suporte offline-first e automatização completa.

## 🚀 Características

- ✅ **Express.js + SQLite** - Stack simples e eficiente
- ✅ **Offline-First** - Service Worker + Cache API para funcionamento sem internet
- ✅ **Admin Panel** - 14 páginas funcionales para gerenciar campanhas, telas e mídias
- ✅ **TV Player** - Player automático com rotação de conteúdo
- ✅ **Proof-of-Play** - Rastreamento de exibições com UNIQUE INDEX
- ✅ **Worker Automatizado** - 7 jobs rodando em background
- ✅ **Pricing Plans** - Free/Pro/Enterprise com limites por plano
- ✅ **Docker Ready** - Dockerfile + docker-compose para deploy simples

## 📋 Requisitos

- Node.js 22+
- npm ou yarn
- Para deploy: Docker + docker-compose

## 🏃 Quick Start (Local)

\`\`\`bash
npm install
npm start
# Admin: http://localhost:3000/admin (admin/admin123)
# TV Player: http://localhost:3000/tv?tela_id=tela-1
\`\`\`

## 🐳 Deploy com Docker

\`\`\`bash
docker-compose up -d
\`\`\`
