// ConectaInclusao - servidor (Modulos 2, 3, 5)
// Logica de salas/eventos vive em sockets/room.js.

require('dotenv').config();

const path = require('path');
const http = require('http');
const express = require('express');
const { Server } = require('socket.io');
const { register } = require('./sockets/room');

const PORT = process.env.PORT || 3000;
const GROQ_API_KEY = process.env.GROQ_API_KEY || '';
const GROQ_MODEL = process.env.GROQ_MODEL || 'meta-llama/llama-4-scout-17b-16e-instruct';

const app = express();
const httpServer = http.createServer(app);
const io = new Server(httpServer, {
  // Sockets de imagem podem chegar perto de 1MB (data URL). Web Speech
  // não usa socket, mas o canal de imagem do professor sim.
  maxHttpBufferSize: 5 * 1024 * 1024
});

// JSON limite grande para receber data URL de imagens do professor.
app.use(express.json({ limit: '8mb' }));

// Servir frontend estatico
const publicDir = path.join(__dirname, 'public');
app.use(express.static(publicDir));

app.get('/', (req, res) => {
  res.sendFile(path.join(publicDir, 'index.html'));
});

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    groq_configurado: !!GROQ_API_KEY,
    modelo: GROQ_MODEL
  });
});

// ---------- VLibras Translator Proxy ----------
// O endpoint antigo (www.vlibras.gov.br/app/trad/1) retorna 302 para um
// caminho quebrado no jsdelivr. Endpoint funcional: traducao2 + JSON.
app.post('/api/vlibras/translate', async (req, res) => {
  const texto = (req.body && req.body.text) || '';
  if (!texto || typeof texto !== 'string') {
    return res.status(400).type('text/plain').send('text obrigatório');
  }
  try {
    const r = await fetch('https://traducao2.vlibras.gov.br/translate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: texto.slice(0, 4900) })
    });
    const glosa = await r.text();
    res.status(r.status).type('text/plain').send(glosa);
  } catch (e) {
    res.status(502).type('text/plain').send('translator_unreachable: ' + e.message);
  }
});

// ---------- Groq: audiodescrição de imagens (Módulo 5) ----------
// Recebe { dataUrl } (data:image/...;base64,...) e devolve { legenda }.
// A chave Groq fica APENAS no servidor; cliente nunca a vê.
// API compatível com OpenAI: chat.completions com content multimodal.
app.post('/api/descrever-imagem', async (req, res) => {
  if (!GROQ_API_KEY) {
    return res.status(503).json({
      erro: 'GROQ_API_KEY não configurada no servidor (.env). ' +
            'Obtenha em https://console.groq.com/keys'
    });
  }
  const dataUrl = req.body && req.body.dataUrl;
  if (!dataUrl || typeof dataUrl !== 'string' || !dataUrl.startsWith('data:image/')) {
    return res.status(400).json({ erro: 'dataUrl de imagem obrigatório.' });
  }
  if (!/^data:image\/[a-zA-Z+]+;base64,/.test(dataUrl)) {
    return res.status(400).json({ erro: 'dataUrl mal formada.' });
  }

  // Prompt pedagógico — descrição clara, breve, sem inferências.
  const prompt =
    'Descreva esta imagem em português brasileiro, de forma clara e ' +
    'didática, para um aluno cego de aproximadamente 14 anos acompanhando ' +
    'uma aula. Seja objetivo (2 a 4 frases curtas). Mencione objetos, ' +
    'pessoas, cores predominantes, ações e contexto. Evite julgamentos, ' +
    'inferências e termos técnicos desnecessários. Comece direto pela ' +
    'descrição, sem "Esta imagem mostra".';

  try {
    const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${GROQ_API_KEY}`
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: prompt },
              { type: 'image_url', image_url: { url: dataUrl } }
            ]
          }
        ],
        temperature: 0.4,
        max_tokens: 350
      })
    });
    if (!r.ok) {
      const erroTxt = await r.text();
      return res.status(r.status).json({
        erro: `Groq HTTP ${r.status}`,
        detalhe: erroTxt.slice(0, 500)
      });
    }
    const data = await r.json();
    const legenda =
      data &&
      data.choices &&
      data.choices[0] &&
      data.choices[0].message &&
      data.choices[0].message.content;
    if (!legenda) {
      return res.status(502).json({
        erro: 'resposta do Groq sem texto',
        detalhe: JSON.stringify(data).slice(0, 500)
      });
    }
    res.json({ legenda: legenda.trim() });
  } catch (e) {
    res.status(502).json({ erro: 'groq_unreachable', detalhe: e.message });
  }
});

register(io);

httpServer.listen(PORT, () => {
  console.log(`ConectaInclusao rodando em http://localhost:${PORT}`);
  if (!GROQ_API_KEY) {
    console.warn('⚠️  GROQ_API_KEY não definida — upload de imagem do professor não funcionará.');
    console.warn('    Obtenha uma chave gratuita em https://console.groq.com/keys');
  } else {
    console.log(`✓ Groq configurado (modelo: ${GROQ_MODEL})`);
  }
});
