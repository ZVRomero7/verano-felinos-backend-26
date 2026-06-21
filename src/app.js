import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import apiRouter from './routes/api.js';
import webRouter from './routes/web.js';

// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load config.json securely in ES Modules
const configPath = path.join(__dirname, '../config.json');
let config;
try {
  config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
} catch (error) {
  console.error('[Error] Failed to read or parse config.json:', error.message);
  process.exit(1);
}

const app = express();
const port = process.env.PORT || 3000;

// Enable CORS and body parsers
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static assets from SVG folder
app.use('/SVG', express.static(path.join(__dirname, '../SVG')));

// Mount routes
app.use('/api/v1', apiRouter);
app.use('/', webRouter);

// Basic health check endpoint using config values
app.get('/', (req, res) => {
  res.json({
    status: 'online',
    project: config.project.name,
    environment: config.project.environment,
    base_url: config.project.base_url
  });
});

// Start server
app.listen(port, () => {
  console.log(`\n==================================================`);
  console.log(`🚀 ${config.project.name} is running!`);
  console.log(`📡 URL: http://localhost:${port}`);
  console.log(`🌍 Configured Base URL: ${config.project.base_url}`);
  console.log(`🛠️  Environment: ${config.project.environment}`);
  console.log(`==================================================\n`);
});

export default app;
