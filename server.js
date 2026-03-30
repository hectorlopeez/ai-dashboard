const express = require('express');
const { GoogleAuth } = require('google-auth-library');

const app = express();
app.use(express.json({ limit: '20mb' }));
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  res.header('Access-Control-Allow-Methods', 'POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

const PROJECT = process.env.GCP_PROJECT || '';
const LOCATION = 'us-central1';
const PORT = 3000;

app.get('/ping', (req, res) => res.json({ ok: true }));

app.post('/generate', async (req, res) => {
  try {
    if (!PROJECT) throw new Error('GCP_PROJECT no configurado');
    const auth = new GoogleAuth({
      scopes: ['https://www.googleapis.com/auth/cloud-platform']
    });
    const token = await auth.getAccessToken();
    const model = req.body.model || 'gemini-2.0-flash-exp';
    const url = `https://${LOCATION}-aiplatform.googleapis.com/v1/projects/${PROJECT}/locations/${LOCATION}/publishers/google/models/${model}:generateContent`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(req.body.payload)
    });
    const data = await response.json();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log('Backend corriendo en http://localhost:' + PORT);
  console.log('Proyecto Google Cloud: ' + (PROJECT || 'NO CONFIGURADO'));
});
