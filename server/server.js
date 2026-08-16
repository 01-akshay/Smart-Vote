// BioVote AI — local JSON-file server
//
// A tiny Express server that stores the whole app state (elections, voters,
// audit log, security log, fraud events) in a plain JSON file on disk
// (server/db.json). Unlike browser localStorage, this survives closing the
// browser, clearing site data, restarting your computer, or coming back
// days later — as long as db.json isn't deleted, the data is there.
//
// Run with:  npm run server   (keep this running in its own terminal)
// Then run:  npm run dev      (in a second terminal) to start the React app.

import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_FILE = path.join(__dirname, 'db.json');
const PORT = process.env.PORT || 4787;

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

function readDb() {
  try {
    const raw = fs.readFileSync(DB_FILE, 'utf-8');
    return JSON.parse(raw);
  } catch (e) {
    return null; // file missing or empty — treated as "no saved state yet"
  }
}

function writeDb(data) {
  // write to a temp file then rename, so a crash mid-write can't corrupt db.json
  const tmp = DB_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf-8');
  fs.renameSync(tmp, DB_FILE);
}

app.get('/api/state', (req, res) => {
  const data = readDb();
  if (data === null) return res.status(404).json({ error: 'no saved state yet' });
  res.json(data);
});

app.put('/api/state', (req, res) => {
  try {
    writeDb(req.body || {});
    res.json({ ok: true });
  } catch (e) {
    console.error('BioVote AI server: failed to write db.json', e);
    res.status(500).json({ ok: false, error: String(e) });
  }
});

app.listen(PORT, () => {
  console.log(`BioVote AI local JSON server running at http://localhost:${PORT}`);
  console.log(`Data file: ${DB_FILE}`);
});
