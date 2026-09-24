const express = require('express');
const cors = require('cors');
const path = require('path');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '500mb' }));
app.use(express.static(path.join(__dirname, '../public')));

// Healthcheck endpoint
app.get('/healthcheck', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

// API Routes
app.get('/api/status', (req, res) => {
  res.json({ status: 'Mídia Indoor API running' });
});

// Serve index files
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/admin/index.html'));
});

app.get('/tv', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/tv/index.html'));
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

module.exports = app;
