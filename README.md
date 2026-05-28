<<<<<<< HEAD
# ConectaInclusão

Sala de aula virtual acessível para alunos com deficiência (surdos e cegos) em escolas públicas. Projeto educacional desenvolvido para o **CETI Prof. Ubiraci Carvalho** (São João da Serra/PI).

A aplicação permite que um professor crie uma sala, capte sua fala por microfone, e que dois tipos de alunos acompanhem a aula de forma sincronizada e adaptada:

- **Aluno surdo** — recebe legendas grandes em tempo real + **avatar 3D do VLibras traduzindo automaticamente para Libras**.
- **Aluno cego** — recebe síntese de voz (TTS) automática de cada fala do professor + **audiodescrição de imagens** gerada pela Groq API (Llama 4 multimodal).

---

## Sumário

1. [Stack e arquitetura](#stack-e-arquitetura)
2. [Instalação e execução](#instalação-e-execução)
3. [Estrutura de arquivos](#estrutura-de-arquivos)
4. [Funcionalidades passo a passo](#funcionalidades-passo-a-passo)
   - [Sala em tempo real](#1-sala-em-tempo-real)
   - [Painel do professor com STT](#2-painel-do-professor--captação-de-voz)
   - [Aluno surdo com avatar 3D](#3-aluno-surdo--legendas--avatar-3d-em-libras)
   - [Aluno cego com TTS + audiodescrição](#4-aluno-cego--tts--audiodescrição-de-imagens)
   - [Imagem do professor → Groq → toda a turma](#5-imagem-do-professor--groq--toda-a-turma)
5. [Eventos Socket.IO](#eventos-socketio)
6. [Estudo técnico do VLibras](#estudo-técnico-do-vlibras--a-jornada-até-a-tradução-automática)
7. [Limitações conhecidas](#limitações-conhecidas)
8. [Variáveis de ambiente](#variáveis-de-ambiente)
9. [Troubleshooting](#troubleshooting)

---

## Stack e arquitetura

| Camada | Tecnologia | Por quê |
|---|---|---|
| Backend | **Node.js + Express** | Servidor HTTP simples, zero build, fácil deploy em escolas |
| Tempo real | **Socket.IO** | Sincroniza professor ↔ alunos em qualquer dispositivo da mesma rede |
| Frontend | **HTML5 + CSS3 + Vanilla JS** | Sem framework, sem bundler — qualquer máquina antiga roda |
| Captação de voz | **Web Speech API** (Chrome/Edge) | STT nativo do navegador, `pt-BR`, sem custo |
| Tradução para Libras | **vlibras-player-webjs** (ESM via esm.sh) + **proxy do Translator API** | Avatar 3D oficial do governo federal |
| Audiodescrição de imagens | **Groq API** (`meta-llama/llama-4-scout-17b-16e-instruct`) | Tier gratuito real, sem cartão; Llama 4 multimodal; PT-BR |
| Síntese de voz (TTS) | **Web Speech API** (`SpeechSynthesis`) | Nativo, zero custo, voz PT-BR |
| Acessibilidade | **WCAG 2.1 AA** | Contraste, foco visível, `aria-live`, semântica HTML |

**Sem banco de dados.** Salas são armazenadas em memória (`Map`) — adequado para a duração de uma aula. Para persistência futura (histórico, frequência), basta adicionar SQLite ou MySQL.

**Diagrama do fluxo de fala:**

```
Professor (Chrome)            Servidor (Node)              Aluno Surdo (Chrome)
─────────────────              ───────────────              ────────────────────
Microfone
    ↓
Web Speech API (STT pt-BR)
    ↓
"professor_falou" ───────►  socket.io ──────────────►  "fala_recebida"
                            sala (Map)                     ↓
                                                       legenda grande
                                                           ↓
                                                       player.translate(texto)
                                                           ↓
                                                       POST /api/vlibras/translate
                                                           ↓ (proxy)
                                                       traducao2.vlibras.gov.br
                                                           ↓
                                                       Glosa (ex: "OLA TURMA")
                                                           ↓
                                                       Unity SendMessage('PlayerManager', 'playNow', glosa)
                                                           ↓
                                                       Avatar 3D anima
```

---

## Instalação e execução

**Pré-requisitos:** Node.js 18+ (precisa de `fetch` nativo para o proxy do tradutor), navegador **Chrome ou Edge** para o aluno (Firefox não suporta Web Speech API completa nem o player Unity de forma confiável).

### Instalar

```bash
npm install  // npm i
```

### Rodar em produção (porta 3000)

```bash
npm start
```

### Rodar em desenvolvimento (auto-reload)

```bash
npm run dev
```

### Verificar saúde

`GET http://localhost:3000/health` → `{ "status": "ok" }`

### Importante: HTTPS ou localhost

A Web Speech API e o microfone só funcionam em **HTTPS** ou **localhost**. Em rede local (IP tipo `192.168.x.x`) o Chrome bloqueia o microfone. Para uso real em escola: rodar localmente em cada máquina, ou usar túnel HTTPS (ex.: cloudflared) para acesso da rede.

---

## Estrutura de arquivos

```
ConectaInclusao/
├── server.js                       # Express + Socket.IO + proxy do tradutor
├── package.json
├── .env.example                    # PORT, CLAUDE_API_KEY (Módulo 5)
├── .gitignore
├── README.md                       # este arquivo
│
├── sockets/
│   └── room.js                     # Gerenciamento de salas em memória
│
└── public/
    ├── index.html                  # Landing — seleção de perfil
    ├── professor.html              # Painel do professor
    ├── aluno-surdo.html            # Visão do aluno surdo (com avatar)
    ├── aluno-cego.html             # Visão do aluno cego
    ├── css/
    │   ├── base.css                # Design system, WCAG AA
    │   └── components.css          # Cards, badges, legendas, player
    └── js/
        ├── socket-client.js        # Wrapper Socket.IO global
        ├── professor.js            # STT + UI do professor
        ├── aluno-surdo.js          # Player VLibras + tradução automática
        └── aluno-cego.js           # Esqueleto (Módulo 5 pendente)
```

---

## Funcionalidades passo a passo

### 1. Sala em tempo real

**Como o professor cria uma sala**

1. Abre `http://localhost:3000` → clica em "Sou Professor".
2. Em `/professor.html`, clica em **"Criar sala"**.
3. O cliente envia evento `criar_sala` ao servidor.
4. [`sockets/room.js`](sockets/room.js) gera um código de 6 caracteres aleatórios em `[A-HJ-NP-Z2-9]` (sem `I`, `O`, `0`, `1` — evita ambiguidade visual e ditado para aluno cego).
5. Servidor registra `salas.set(codigo, { professor: socketId, alunos: new Map() })`, faz `socket.join(codigo)` e emite `sala_criada { codigo }` de volta.
6. O código aparece em fonte gigante (≥96px) para ser ditado para os alunos.

**Como o aluno entra**

1. Em `/aluno-surdo.html` (ou `/aluno-cego.html`), digita o código (input auto-uppercase, filtro `[A-Z0-9]`).
2. Submit envia `entrar_sala { codigo, perfil }` com `perfil ∈ ['surdo', 'cego']`.
3. Servidor valida sala e perfil, adiciona aluno ao `Map`, emite:
   - Ao aluno: `entrada_confirmada { codigo, perfil }`
   - À sala inteira: `aluno_entrou { perfil, total, surdos, cegos }` → professor vê contadores atualizando

**Como uma fala chega**

1. Professor envia `professor_falou { texto }`.
2. Servidor verifica `socket.data.papel === 'professor'` (segurança: aluno não pode injetar mensagem) e retransmite `fala_recebida { texto, timestamp }` a todos na sala.
3. Cada aluno recebe e renderiza conforme seu perfil.

**Encerramento**

- Botão "Encerrar aula" emite `encerrar_sala` → servidor emite `sala_encerrada { motivo: 'PROFESSOR_ENCERROU' }` aos alunos e remove a sala do `Map`.
- Se o professor cair de conexão (refresh, internet ruim), o handler `disconnect` faz a mesma coisa com motivo `PROFESSOR_SAIU`. O socket do professor zera `socket.data.codigo` ao emitir `encerrar_sala` manualmente para evitar duplo disparo.

---

### 2. Painel do professor — captação de voz

**Componente:** [`public/js/professor.js`](public/js/professor.js) — objeto `CaptacaoFala`.

**Fluxo:**

1. O professor clica em **"🎤 Iniciar captação"**.
2. O navegador pede permissão para o microfone (uma vez por origem).
3. Instancia `new (window.SpeechRecognition || window.webkitSpeechRecognition)()` com:
   - `lang = 'pt-BR'`
   - `continuous = true` (não para a cada pausa)
   - `interimResults = true` (mostra prévia local)
4. Em `onresult`, percorre `event.results` a partir do `resultIndex` deste evento (não acumula).
5. Quando `result.isFinal === true`: emite `professor_falou { texto }`. **Resultados interim NÃO vão para o servidor** — isso evitaria flood e reinício do avatar a cada palavra.
6. Texto interim aparece apenas na div `#captacao-previa` (prévia local para o professor saber que está captando).

**Reinício automático em erros transitórios**

`onerror` é tratado por categorias:

- `no-speech`, `aborted` — silencioso, `onend` reinicia em 500ms.
- `network` — **contador de tentativas + backoff exponencial** (500ms → 1s → 2s → 4s → 8s). Após **5 falhas consecutivas**, exibe: *"Sem acesso ao serviço de voz do Chrome. Verifique sua internet e tente novamente."* O contador é resetado a cada `onresult` de sucesso.
- `not-allowed`, `service-not-allowed` — para imediatamente; o usuário negou microfone.
- Qualquer outro — para com mensagem de erro.

**Por que o erro `network` acontece tanto:** o Chrome envia o áudio para os servidores STT do Google. Em redes instáveis, com proxy corporativo ou em escolas com firewall agressivo, isso falha frequentemente. O backoff progressivo evita loop infinito.

**Fallback para navegadores sem suporte**

Se `window.SpeechRecognition` não existe (Firefox, Safari mobile), o botão fica desabilitado com mensagem clara e o **textarea manual** continua funcional para enviar mensagens digitadas.

---

### 3. Aluno surdo — legendas + avatar 3D em Libras

Esta é a parte com mais complexidade técnica e a que exigiu maior estudo do ecossistema VLibras. Veja a [seção de estudo](#estudo-técnico-do-vlibras--a-jornada-até-a-tradução-automática) abaixo para entender por quê.

**O que o aluno vê:**

- **Legenda gigante** (`#legenda`) — sempre a última fala do professor, fonte grande, alto contraste.
- **Histórico** (`#historico-falas`) — últimas 4 falas anteriores em fonte menor.
- **Avatar 3D do VLibras** — boneco oficial (Ícaro) animado em Unity WebGL, sinalizando em Libras automaticamente.

**Componentes técnicos:**

#### 3.1. Carregamento da biblioteca (ESM via CDN)

Em [`aluno-surdo.html`](public/aluno-surdo.html):

```html
<script type="module">
  import { VLibrasPlayer } from 'https://esm.sh/vlibras-player-webjs@2.4.2';
  window.VLibrasPlayer = VLibrasPlayer;
  window.dispatchEvent(new CustomEvent('vlibras:ready'));
</script>
```

A biblioteca [`vlibras-player-webjs`](https://www.npmjs.com/package/vlibras-player-webjs) é a SDK oficial JavaScript do `spbgovbr-vlibras`. Ela faz o middleware entre JS e o Player Unity WebGL. Não usamos o widget oficial (`vlibras-plugin.js`) porque ele só traduz por seleção de texto manual do usuário — incompatível com "tradução automática a cada nova fala".

#### 3.2. Inicialização do Player

Em [`aluno-surdo.js`](public/js/aluno-surdo.js), função `criarPlayer()`:

```js
player = new window.VLibrasPlayer({
  targetPath: 'https://vlibras.gov.br/app/target',  // assets Unity (~30MB) hospedados no gov.br
  fallbackUrl: '/api/vlibras/translate',             // nosso proxy local (motivo: ver §6)
  onReady: () => { /* sinaliza pronto, processa fila */ }
});
player.load(containerPlayer);
```

#### 3.3. Bridge Unity ⇄ JavaScript

O Unity Player espera chamar funções globais **sem prefixo** (`window.onLoadPlayer`, `window.onPlayingStateChange`, `window.GetAvatar`, `window.onProgress`, `window.onCounterGloss`, `window.onFinishWelcome`). A biblioteca v2.4.2 **não as registra** — bug confirmado lendo o source. Fazemos o bridge manualmente em `registrarBridgeUnity()`, encaminhando para `window.VLibrasPlayerManagerAdapter` (que a lib expõe).

#### 3.4. Monkey-patch do `sendMessage`

A v2.4.2 envia `SendMessage('Avatar', 'setGlosa', glosa)` + `SendMessage('Avatar', 'play', '')`, mas o Unity Player atual hospedado em `vlibras.gov.br/app` espera **`SendMessage('PlayerManager', 'playNow', glosa)`** (uma única chamada que já dispara).

Aplicamos um patch em `player.playerManager.sendMessage` que traduz:

| Chamada da lib npm | Tradução para Unity real |
|---|---|
| `('Avatar', 'setGlosa', g)` | `('PlayerManager', 'playNow', g)` + `setPauseState 0` |
| `('Avatar', 'play', '')` | `('PlayerManager', 'setPauseState', 0)` |
| `('Avatar', 'pause', '')` | `('PlayerManager', 'setPauseState', 1)` |
| `('Avatar', 'stop', '')` | `('PlayerManager', 'stopAll', '')` |
| `('Avatar', 'setUrl', u)` | `('PlayerManager', 'setBaseUrl', u)` |
| `('Avatar', 'setSpeed', s)` | `('PlayerManager', 'setSlider', s)` |
| `('Avatar', 'toggleSubtitle')` | `('PlayerManager', 'setSubtitlesState', '')` |
| `('Avatar', 'changeAvatar', n)` | `('PlayerManager', 'Change', n)` |
| `('Avatar', 'playWelcome')` | `('PlayerManager', 'playWellcome', '')` |
| `('Avatar', 'setPersonalization', p)` | `('CustomizationBridge', 'setURL', p)` |

#### 3.5. Proxy local do Translator API

Em [`server.js`](server.js), rota `POST /api/vlibras/translate`:

```js
app.post('/api/vlibras/translate', async (req, res) => {
  const texto = req.body?.text || '';
  const r = await fetch('https://traducao2.vlibras.gov.br/translate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: texto.slice(0, 4900) })
  });
  res.status(r.status).type('text/plain').send(await r.text());
});
```

Por que precisamos do proxy: o endpoint padrão da biblioteca (`https://www.vlibras.gov.br/app/trad/1`) **retorna 302 para um caminho quebrado no jsdelivr** e só aceita `GET/HEAD/OPTIONS`. O endpoint funcional é `traducao2.vlibras.gov.br/translate` mas aceita JSON enquanto a lib envia form-data — daí o proxy faz a conversão.

Também sobrescrevemos `player.translator.makeTranslationRequest` no cliente para enviar JSON diretamente.

#### 3.6. Pipeline completo (resumo)

1. Aluno entra na sala → `inicializarPlayer()` aguarda evento `vlibras:ready` (módulo ESM async).
2. Player criado → `player.load(container)` injeta canvas Unity.
3. Unity baixa assets (~30MB do gov.br, ~10-20s na primeira vez, depois cacheado em IndexedDB).
4. Unity dispara `window.onLoadPlayer()` → nosso bridge marca `vlibrasPronto = true`, refaz `setBaseUrl` (que tinha sido chamado prematuramente).
5. Professor fala → `fala_recebida` chega → `enfileirar(texto)` → `processarFila()` chama `player.translate(texto)`.
6. `player.translate` → `POST /api/vlibras/translate` → proxy → `traducao2` → glosa volta (ex.: "OLA TURMA").
7. `player.play(glosa)` → `playerManager.play` chama o patch → `SendMessage('PlayerManager', 'playNow', 'OLA TURMA')`.
8. Avatar Unity inicia animação dos sinais.

**Fila de tradução:** evita atropelo do avatar (se duas falas chegarem em sequência). Estimativa simples: `Math.max(1500, Math.min(15000, texto.length * 80))` ms entre traduções.

---

### 4. Aluno cego — TTS + audiodescrição de imagens

**Componente:** [`public/js/aluno-cego.js`](public/js/aluno-cego.js) — objeto `SinteseVoz`.

**O que o aluno (e o leitor de tela) percebem:**

- Cada fala do professor é lida **automaticamente** em voz PT-BR (Web Speech API `SpeechSynthesis`).
- Cada imagem que o professor envia: o servidor descreve via Groq (Llama 4 multimodal), devolve a legenda, e o aluno cego ouve "Professor enviou uma imagem" + a descrição.
- Controles dedicados grandes (≥56px): **🔁 Repetir última fala**, **⏸ Pausar voz**, **▶ Retomar voz**, **slider de velocidade** (0.7x a 1.5x).
- `aria-live="polite"` nas regiões de legenda e descrição → o leitor de tela do sistema também anuncia em paralelo.

**Detalhes técnicos:**

1. Ao entrar na sala, `SinteseVoz` carrega vozes (`window.speechSynthesis.getVoices()`) e escolhe a primeira `pt-BR` disponível — no Windows: *Microsoft Maria/Daniel*; macOS: *Luciana*; Linux: depende do navegador.
2. Em alguns navegadores a lista de vozes carrega assíncrono — tratamos via `onvoiceschanged`.
3. **Fila FIFO**: se duas falas chegarem em ~1s, a segunda espera a primeira terminar (`utterance.onend`). Sem isso, o `speechSynthesis` atropela falas.
4. Erros no `onerror` continuam a fila (não trava).
5. O `pause()` / `resume()` da Web Speech API funciona globalmente (não por utterance).

---

### 5. Imagem do professor → Groq → toda a turma

**Componentes:** [`public/js/professor.js`](public/js/professor.js) (seção imagem) + [`server.js`](server.js) (rota `/api/descrever-imagem`).

**Fluxo passo a passo:**

1. Professor clica **"📷 Selecionar imagem"** → escolhe arquivo (JPEG/PNG/WebP/GIF).
2. `redimensionarImagem(file)`: lê via `FileReader`, desenha em `<canvas>` com lado máximo de **1280px** e exporta como `image/jpeg` a 85% de qualidade. Reduz arquivos típicos de smartphone de 4-8MB para ~200KB.
3. Preview aparece + chamada automática a `descreverImagem(dataUrl)`.
4. Cliente faz `POST /api/descrever-imagem` com `{ dataUrl }`.
5. **Servidor:** `server.js` aceita até 8MB JSON, valida o data URL e monta o payload Groq (API compatível com OpenAI Chat Completions):
   ```json
   {
     "model": "meta-llama/llama-4-scout-17b-16e-instruct",
     "messages": [{
       "role": "user",
       "content": [
         { "type": "text", "text": "<prompt pedagógico>" },
         { "type": "image_url", "image_url": { "url": "data:image/jpeg;base64,..." } }
       ]
     }],
     "temperature": 0.4,
     "max_tokens": 350
   }
   ```
6. Servidor chama `https://api.groq.com/openai/v1/chat/completions` com header `Authorization: Bearer ${GROQ_API_KEY}` (a chave **fica apenas no servidor**, nunca no cliente).
7. Groq retorna `choices[0].message.content` — extrai a legenda em PT-BR.
8. Cliente exibe a legenda em um `<textarea>` editável + dois botões: **"Gerar nova descrição"** (refazer) e **"Enviar para a turma"**.
9. Ao enviar: `socket.emit('professor_enviou_imagem', { dataUrl, legenda })`.
10. Servidor retransmite `imagem_recebida` a todos na sala.
11. **Aluno surdo:** exibe `<img>` + envia `legenda` para o avatar VLibras traduzir (já vai pelo pipeline do §3).
12. **Aluno cego:** TTS lê *"Professor enviou uma imagem"* + a legenda; também adiciona `<img alt="legenda">` para que o leitor de tela do sistema também anuncie.

**Prompt pedagógico** (hardcoded em [`server.js`](server.js)):

> *"Descreva esta imagem em português brasileiro, de forma clara e didática, para um aluno cego de aproximadamente 14 anos acompanhando uma aula. Seja objetivo (2 a 4 frases curtas). Mencione objetos, pessoas, cores predominantes, ações e contexto. Evite julgamentos, inferências e termos técnicos desnecessários. Comece direto pela descrição, sem 'Esta imagem mostra'."*

Editar esse prompt em `server.js` é o ponto único de ajuste pedagógico — mudar tom, profundidade, idade alvo, etc.

**Por que Groq e não Gemini/Claude?**

| Critério | Groq (Llama 4) | Google Gemini | Claude (Anthropic) |
|---|---|---|---|
| Tier gratuito permanente | ✅ Sem cartão | ⚠️ Free tier varia por projeto | ❌ Só trial |
| Visão multimodal | ✅ Nativa | ✅ Nativa | ✅ Nativa |
| Qualidade PT-BR | ✅ Boa | ✅ Excelente | ✅ Excelente |
| Velocidade | ✅ Muito rápido (~500ms) | ✅ Rápido | Moderado |
| Setup | 1 chave em [console.groq.com](https://console.groq.com/keys) | Conta Google | Cartão de crédito |
| Custo escola pública | Zero | Zero (se free tier funcionar) | Inviável |

A chave Groq é gratuita e sem cartão em [https://console.groq.com/keys](https://console.groq.com/keys).

---

## Eventos Socket.IO

| Evento | Direção | Payload | Quando |
|---|---|---|---|
| `criar_sala` | cliente → servidor | (vazio) | Professor clica "Criar sala" |
| `sala_criada` | servidor → professor | `{ codigo }` | Sala registrada |
| `entrar_sala` | aluno → servidor | `{ codigo, perfil }` | Aluno submete form |
| `entrada_confirmada` | servidor → aluno | `{ codigo, perfil }` | Validação OK |
| `aluno_entrou` | servidor → sala | `{ perfil, total, surdos, cegos }` | Após `entrar_sala` |
| `aluno_saiu` | servidor → sala | `{ perfil, total, surdos, cegos }` | Disconnect de aluno |
| `professor_falou` | professor → servidor | `{ texto }` | STT final ou textarea manual |
| `fala_recebida` | servidor → sala | `{ texto, timestamp }` | Retransmissão |
| `professor_enviou_imagem` | professor → servidor | `{ dataUrl, legenda? }` | Upload de imagem (Módulo 5) |
| `imagem_recebida` | servidor → sala | `{ dataUrl, legenda, timestamp }` | Retransmissão |
| `encerrar_sala` | professor → servidor | (vazio) | Botão "Encerrar aula" |
| `sala_encerrada` | servidor → sala | `{ motivo }` | `PROFESSOR_ENCERROU` ou `PROFESSOR_SAIU` |
| `erro` | servidor → cliente | `{ motivo }` | `SALA_NAO_ENCONTRADA`, `PERFIL_INVALIDO` |

---

## Estudo técnico do VLibras — a jornada até a tradução automática

Esta seção documenta os 6 obstáculos enfrentados e como cada um foi resolvido. Pode parecer longa, mas reflete o estado real do ecossistema VLibras em produção em **maio/2026** — qualquer pessoa tentando a mesma integração vai esbarrar nas mesmas coisas.

### Tentativa 1 — Widget oficial + heurística de seleção

**Abordagem:** carregar `https://vlibras.gov.br/app/vlibras-plugin.js`, deixar o widget injetar o avatar no canto da tela, e simular o gesto nativo a cada fala:
1. Atualizar um `<div vw-translate-target>` com o texto novo
2. Criar seleção programática (`window.getSelection().addRange(range)`)
3. Disparar `mouseup` em `document` e no elemento
4. Procurar o botão "Traduzir" flutuante (com 6 seletores possíveis: `[vp]`, `[vw-translate]`, `.vpw-btn-translate`, etc.)
5. Clicar nele programaticamente

**Resultado:** ❌ Não funciona de forma confiável. O widget oficial **foi deliberadamente projetado para tradução por gesto humano**. Alguns navegadores bloqueiam cliques programáticos em respostas a eventos sintéticos. E o atributo `vw-translate-target` não é oficialmente documentado.

**Lição:** o widget gov.br não é uma SDK programática — é um produto de acessibilidade para usuário final.

### Tentativa 2 — UMD do pacote `vlibras-player-webjs`

**Descoberta:** o `spbgovbr-vlibras` mantém uma biblioteca npm oficial (`vlibras-player-webjs`) que expõe `new VLibrasPlayer({...})` com método `player.translate(text)` — exatamente o que queríamos. Internamente faz `POST` ao Translator API e `SendMessage` ao Unity Player.

**Abordagem:** instalar via npm, servir o build `dist/umd/vlibras-player.min.js` (44KB) pelo Express em `/vendor/`, e usar via `<script src>` simples.

**Resultado:** ❌ O `window.VLibras` ficava `undefined`. Investigando o UMD:

```js
!function(e,t){
  ...
  e.VLibras=t()
}(this, function(){
  return function(){
    var e,t,r={};
    ...
    return r.default;  // ← nunca populado!
  }()
});
```

O UMD termina com `return r.default` mas **nada nunca seta `r.default`**. Build quebrado. Confirmado contando: `VLibrasPlayer.js` sozinho tem 20KB no CJS, mas o UMD inteiro tem 44KB — falta código.

**Lição:** o build UMD publicado no npm é incompleto. Use ESM.

### Tentativa 3 — ESM via `esm.sh`

**Abordagem:** usar `esm.sh` (CDN que serve qualquer pacote npm como ESM funcional no browser):

```html
<script type="module">
  import { VLibrasPlayer } from 'https://esm.sh/vlibras-player-webjs@2.4.2';
  window.VLibrasPlayer = VLibrasPlayer;
</script>
```

**Resultado:** ✅ A classe carrega. ❌ Mas o callback `onLoad` da config nunca dispara. E a tradução não rola — apenas o avatar aparece estático.

**Investigação no source:**
- O construtor aceita `onReady`, não `onLoad`. `onLoad` é um **método protegido** da classe (sobrescrevível por subclasse), não uma opção do construtor — o código `onLoad: () => ...` que passamos era simplesmente ignorado.

**Correção:** trocar `onLoad` por `onReady`.

### Tentativa 4 — Bridge das funções globais do Unity

**Resultado da tentativa 3:** o avatar aparecia mas Unity loga:
```
ReferenceError: onPlayingStateChange is not defined
ReferenceError: GetAvatar is not defined
ReferenceError: onLoadPlayer is not defined
```

**Causa:** o Unity Player usa `JS_Eval_EvalJS` para chamar funções globais (sem prefixo) quando precisa notificar o JS host. A biblioteca npm expõe um `PlayerManagerAdapter` em `window.VLibrasPlayerManagerAdapter` com os métodos certos (`onStateChange`, `onGetAvatar`, etc.) **mas nunca registra as funções globais que o Unity busca**.

**Correção:** registrar manualmente as 6 funções globais, encaminhando para o adapter:

```js
window.onLoadPlayer = function() { /* ... */ };
window.onPlayingStateChange = (a, b, c) => adapter.onStateChange(a, b, c);
window.GetAvatar = a => adapter.onGetAvatar(a);
window.onProgress = a => adapter.onProgress(a);
window.onCounterGloss = (a, b) => adapter.onCounterGloss(a, b);
window.onFinishWelcome = a => adapter.onFinishWelcome(a);
```

**Resultado:** ✅ Os erros de ReferenceError sumiram. ❌ Mas surgiu um novo: `SendMessage: object Avatar not found!` repetido.

### Tentativa 5 — Endpoint do Translator API quebrado

**Sintoma adicional nos logs:**
```
GET https://cdn.jsdelivr.net/gh/spbgovbr-vlibras/vlibras-portal@sgd/app/trad/1
→ 403 Forbidden
```

**Investigação com `curl`:**
```
$ curl -v https://www.vlibras.gov.br/app/trad/1
HTTP/1.1 302 Found
location: https://cdn.jsdelivr.net/gh/spbgovbr-vlibras/vlibras-portal@sgd/app/trad/1
access-control-allow-methods: GET,HEAD,OPTIONS
```

O endpoint padrão da biblioteca **redireciona 302 para um caminho que não existe no jsdelivr** (`trad/1` é um endpoint REST, não um arquivo) e só aceita `GET/HEAD/OPTIONS` (não POST). **A produção do gov.br está com config quebrada.**

**Descoberta do endpoint correto:**
```
$ curl -X POST https://traducao2.vlibras.gov.br/translate \
       -H 'Content-Type: application/json' \
       -d '{"text":"ola mundo"}'
OLA MUNDO
```

`traducao2.vlibras.gov.br/translate` funciona, mas usa **JSON** enquanto a biblioteca envia **form-data**.

**Correção:**

1. **Proxy local** em `server.js`: recebe JSON, encaminha para `traducao2`, devolve glosa.
2. **Sobrescrever `player.translator.makeTranslationRequest`** no cliente para usar JSON via `fetch('/api/vlibras/translate', ...)`.
3. Passar `fallbackUrl: '/api/vlibras/translate'` no construtor.

**Resultado:** ✅ A tradução PT-BR → glosa funcionou. Logs mostraram:
```
[VLibras] traduzindo: olá turma
[VLibras] glosa: OLA TURMA
```
❌ Mas o avatar ainda não animava, e o erro `SendMessage: object Avatar not found!` continuava.

### Tentativa 6 — Mapeamento do GameObject

**Investigação no GitHub:** o source do [`PlayerManagerAdapter`](https://github.com/spbgovbr-vlibras/vlibras-player-webjs/blob/master/src/PlayerManagerAdapter.js) (upstream) usa **`GAME_OBJECT = "PlayerManager"`** com métodos antigos. A versão npm v2.4.2 foi **reescrita** com nomes "modernos" — `Avatar`, `setGlosa`, `play`, `setUrl` — que **não batem** com o Unity Player que o gov.br hospeda em produção.

**Evidência:** no log do Unity ao carregar, vimos referências a `Icaro_NovoEstilo` (GameObject do avatar), mas nenhum chamado `Avatar`. O Unity loga `SendMessage: object Avatar not found!` porque esse GameObject simplesmente não existe na cena.

**Correção:** monkey-patch em `playerManager.sendMessage` traduzindo todos os nomes — `Avatar` vira `PlayerManager`, `setGlosa+play` colapsa em `playNow(glosa)`, etc. (tabela completa em [§3.4](#34-monkey-patch-do-sendmessage)).

**Resultado final:** ✅ **Avatar 3D anima automaticamente** a cada fala do professor, sem nenhum clique do aluno.

### Resumo da jornada

| Tentativa | Camada do problema | Diagnóstico |
|---|---|---|
| 1 | Widget oficial não é programático | Foi por design — só tradução por gesto humano |
| 2 | UMD npm quebrado | Falta `r.default` — build incompleto |
| 3 | Callback errado | `onLoad` é método protegido, deveria ser `onReady` |
| 4 | Bridge Unity faltando | Lib não registra funções globais que o Unity chama |
| 5 | Endpoint REST quebrado | gov.br retorna 302 para path inexistente; endpoint real é outro |
| 6 | Nomes de GameObject errados | Lib usa `Avatar`/`setGlosa`; Unity real usa `PlayerManager`/`playNow` |

**Lição geral:** o ecossistema VLibras tem código fonte aberto, mas a coordenação entre repositórios (`vlibras-web-browsers`, `vlibras-player-webjs`, Unity build em produção) é frouxa. Cada peça evolui em ritmo próprio e quebra a compatibilidade silenciosamente. Documentação técnica é escassa. Uma integração real exige ler o source, testar com `curl`, e patchar bugs.

---

## Limitações conhecidas

- **STT só em Chrome/Edge** — Firefox e Safari mobile não têm Web Speech API completa. Textarea manual continua funcionando como fallback.
- **STT precisa de HTTPS ou localhost** — Chrome bloqueia microfone em HTTP em rede.
- **STT depende da Internet** — Chrome envia áudio para servidores STT do Google. Redes com firewall agressivo (algumas escolas) podem falhar com erro `network`. Backoff progressivo + mensagem clara após 5 falhas.
- **Avatar Unity demora 5-20s na primeira vez** — assets (~30MB) baixados do gov.br e cacheados em IndexedDB. Visitas seguintes são rápidas.
- **Tradutor depende do gov.br** — se `traducao2.vlibras.gov.br` cair, a tradução para Libras para. Avatar continua estático mas legenda em texto continua funcionando.
- **Audiodescrição depende da Groq API** — 30 req/min free tier. Se exceder ou se Groq cair, a imagem é enviada mas sem legenda automática (o professor pode digitar manualmente).
- **TTS depende de voz PT-BR instalada** — no Windows é nativo; em algumas distros Linux precisa instalar via espeak ou similar. Sem voz, o leitor de tela do sistema cobre via `aria-live`.
- **A biblioteca `vlibras-player-webjs@2.4.2` tem bugs estruturais** — corrigidos por monkey-patches neste projeto. Se a lib for atualizada, os patches precisam ser revisados.
- **Salas em memória** — não persistem se o servidor reiniciar. Para histórico/relatórios, precisa adicionar banco (Módulo 5+).

---

## Variáveis de ambiente

| Variável | Padrão | Uso |
|---|---|---|
| `PORT` | `3000` | Porta do servidor HTTP |
| `GROQ_API_KEY` | — | **Obrigatória** para upload de imagem com audiodescrição. Gratuita em [console.groq.com/keys](https://console.groq.com/keys) |
| `GROQ_MODEL` | `meta-llama/llama-4-scout-17b-16e-instruct` | Modelo multimodal Groq. Alternativa: `meta-llama/llama-4-maverick-17b-128e-instruct` (maior, mais lento) |

Copie `.env.example` para `.env` e preencha. **`.env` está no `.gitignore`** — nunca comite a chave.

**Como obter a chave Groq gratuita:**

1. Acesse [https://console.groq.com/keys](https://console.groq.com/keys) e faça login (Google/GitHub — não precisa cartão).
2. Clique em **"Create API Key"** → dê um nome → copie a chave (começa com `gsk_...`).
3. Cole em `.env`:
   ```
   GROQ_API_KEY=gsk_...sua_chave_real
   ```
4. Reinicie o servidor (`npm start`). No console deve aparecer `✓ Groq configurado`.
5. Verifique em `http://localhost:3000/health` que retorna `"groq_configurado": true`.

Limites do tier gratuito (em maio/2026): ~30 requisições/minuto, sem limite diário rígido para uso casual. Resposta típica: 300-800ms.

---

## Troubleshooting

### "Sem acesso ao serviço de voz do Chrome"

A Web Speech API do Chrome falhou 5 vezes consecutivas com erro `network`. Causas mais comuns:
- Internet instável
- Firewall/proxy corporativo bloqueando `speech.googleapis.com`
- VPN ativa

Tente em outra rede ou peça desbloqueio do domínio. O textarea manual sempre funciona como alternativa.

### "Biblioteca VLibras não carregou em 15s"

`esm.sh` está inacessível. Verifique:
- Conexão com Internet
- Firewall não está bloqueando `esm.sh`
- Pode hospedar o pacote local: `npm install vlibras-player-webjs` e servir como `/vendor/` (precisa build próprio porque o UMD do npm está quebrado).

### "Avatar demorou para carregar"

Unity demora ≥30s. Causas:
- Internet lenta para baixar assets do gov.br (~30MB)
- `vlibras.gov.br/app/target` indisponível
- Cache do IndexedDB do navegador corrompido — limpe via DevTools → Application → IndexedDB

### Avatar carregou mas não anima

Verifique no DevTools console:
- Se aparecer `[VLibras] erro tradução: HTTP XXX` — proxy está falhando, veja seção de logs do servidor.
- Se aparecer `SendMessage: object X not found!` para outros objetos além de `Avatar` — o Unity Player foi atualizado e os mapeamentos no patch precisam ser revisados.
- Se nenhum log aparecer após o professor falar — STT do professor não está enviando `professor_falou` (veja `professor.js`).

### Imagem enviada mas sem audiodescrição / "Groq HTTP 429" ou "Groq HTTP 401"

Verifique:

1. `GET http://localhost:3000/health` → `"groq_configurado"` deve ser `true`.
2. Erro `401 Unauthorized` → chave Groq inválida ou expirada. Recrie em [console.groq.com/keys](https://console.groq.com/keys).
3. Erro `429 Rate limit` → mais de 30 req/min. Aguarde alguns segundos.
4. Erro `400` mencionando `model_not_found` → Groq descontinuou o modelo. Troque `GROQ_MODEL` no `.env` (alternativas válidas em [console.groq.com/docs/models](https://console.groq.com/docs/models)).
5. Erro `400` em imagem muito grande → o cliente já reduz para 1280px / JPEG 85%; se ainda falhar, abaixe a qualidade em `redimensionarImagem` (`canvas.toDataURL('image/jpeg', 0.75)`).
6. Imagem foi enviada com legenda vazia → o aluno cego ouve *"O professor enviou uma imagem, mas a descrição automática não foi gerada"*. O professor pode digitar uma legenda manual no `<textarea>` antes de "Enviar para a turma".

### Aluno cego não fala nada / TTS silencioso

- A voz PT-BR não está instalada no sistema. No Windows: Configurações → Hora e idioma → Idioma e região → Adicionar idioma → Português (Brasil) → Opções → baixar pacote de fala.
- Algumas versões do Chrome travam o `SpeechSynthesis` se a aba estiver oculta — mantenha a aba do aluno cego ativa.
- Permissão de áudio: clique no ícone do cadeado na barra de endereço e libere "Som".

### Código da sala "esqueceu" caracteres

O alfabeto exclui `I`, `O`, `0`, `1` para evitar confusão visual e ambiguidade ao ditar para aluno cego. Códigos como `IOQI` não existem por design.

---

## Créditos e contexto

- **Escola:** CETI Prof. Ubiraci Carvalho — São João da Serra/PI
- **VLibras:** Software Público Brasileiro mantido por [spbgovbr-vlibras](https://github.com/spbgovbr-vlibras) (LAVID/UFPB)
- **Avatares:** Ícaro e Hozana — personagens oficiais do VLibras
- **Translator API:** `traducao2.vlibras.gov.br/translate` (gov.br)
- **Player Unity:** hospedado em `vlibras.gov.br/app/target/`
=======
# ConectaInclusao
Trabalho Escolar
>>>>>>> 9f240f2df006832def414b4a964bcefd6c276ff8
