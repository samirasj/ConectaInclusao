# Conecta Inclusão — Roadmap de Desenvolvimento

Plano em **fases incrementais**. Cada fase entrega valor por conta própria — vocês podem parar em qualquer uma e ainda ter um produto funcional.

> **Filosofia:** começar pequeno, validar com usuários reais a cada fase, só evoluir o que funcionar. Não construir tudo de uma vez.

---

## ✅ FASE 0 — Setup local (essa semana) -- Concluído

**Objetivo:** ter o ambiente de desenvolvimento rodando na máquina de cada integrante da equipe.

**Tempo:** 1 a 2 dias.
**Custo:** R$ 0.

### O que precisa instalar

1. **Editor de código** — [Visual Studio Code](https://code.visualstudio.com/) (gratuito, melhor pra iniciantes)
2. **Git** — [git-scm.com/downloads](https://git-scm.com/downloads). É como salvar "fotos do projeto" pra não perder código nem brigar quando dois mexem ao mesmo tempo.
3. **Conta no GitHub** — onde o código vai ficar guardado online ([github.com](https://github.com))
4. **Navegador Chrome ou Edge** — outros não suportam Web Speech API em português

### Como rodar o MVP localmente

O MVP é HTML/CSS/JS puro. Mas **não pode** ser aberto direto com duplo clique (`file://`) porque:
- A Web Speech API exige contexto seguro (HTTPS ou localhost)
- O Service Worker (futuro PWA) não funciona em `file://`

Solução: rodar um servidor local. **Opção mais simples** (já vem no Python que provavelmente está na máquina):

```bash
# Abra o terminal/prompt na pasta do projeto e digite:
python3 -m http.server 8000

# Depois abra no navegador:
# http://localhost:8000
```

No Windows, se `python3` não funcionar, tente `python` ou `py`.

**Alternativa com Node.js** (se preferirem):

```bash
npx serve .
```

### Estrutura recomendada do projeto

```
conecta-inclusao/
├── index.html              ← o MVP (renomeado de conecta-inclusao.html)
├── README.md               ← descrição do projeto
├── ROADMAP.md              ← este arquivo
├── pitch.html              ← deck para apresentação
└── .gitignore              ← arquivos a ignorar
```

### Subir para o GitHub (pra equipe colaborar)

```bash
# Dentro da pasta do projeto:
git init
git add .
git commit -m "Primeira versão do MVP"
git branch -M main
git remote add origin https://github.com/SEU-USUARIO/conecta-inclusao.git
git push -u origin main
```

Quem nunca usou Git, recomendo o curso gratuito [Git e GitHub - Curso em Vídeo](https://www.youtube.com/playlist?list=PLHz_AreHm4dm7ZULPAmadvNhH6vk9oNZA) (Gustavo Guanabara, em português).

**Critério de pronto:** todos os 5 integrantes da equipe conseguem clonar o repositório, rodar `python3 -m http.server 8000` e ver o MVP funcionando em `http://localhost:8000`.

---

## ✅ FASE 1 — MVP web básico funcional (já entregue)

**Objetivo:** ter um produto demonstrável dos três módulos no navegador.

**Status:** **CONCLUÍDA** com o arquivo `index.html` que você já tem.

### O que essa fase entrega

- Tela de seleção de perfil (Professor, Aluno Surdo, Aluno Cego)
- Painel do Professor com captura de áudio em tempo real
- Visão do Aluno Surdo com legendas grandes + VLibras embutido
- Visão do Aluno Cego com TTS + descrição de imagens via Claude
- Configurações de acessibilidade (3 temas, 3 tamanhos, espaçamentos, simplificação textual)

### Como demonstrar

Abra **duas abas** ou **dois dispositivos** no mesmo `http://localhost:8000`:
- Aba 1: entre como Professor → "Iniciar aula" → fale no microfone
- Aba 2: entre como Aluno Surdo ou Cego

> **Importante:** nesta fase, as duas abas **não conversam entre si** ainda — cada uma roda independente. A sincronização entre dispositivos vem na Fase 4. Para o pitch, vocês simulam manualmente: o professor fala, e a equipe explica que numa próxima fase isso será sincronizado em rede.

### Validação sugerida nesta fase

Antes de partir pra próxima, **testem com 3 usuários reais**:
- 1 professor da escola
- 1 aluno surdo (procurem alguém da APAS local, FENEIS, ou da própria escola)
- 1 aluno cego ou com baixa visão (Fundação Dorina Nowill tem rede no Piauí)

Pergunte:
- O que você entendeu?
- O que ficou confuso?
- Em sala de aula, isso ajudaria?

**Critério de pronto:** pelo menos 1 usuário de cada perfil testou e deu feedback escrito.

---

## 🟡 FASE 2 — PWA: instalável no celular (2 semanas)

**Objetivo:** transformar o MVP em app instalável **sem precisar de App Store ou Play Store**.

**Tempo:** 1 a 2 semanas.
**Custo:** R$ 0.

### O que vocês ganham

Quando alguém acessar o site no celular Android (Chrome) ou iPhone (Safari):
- Aparece um botão **"Instalar"** ou **"Adicionar à tela inicial"**
- Vira ícone na tela inicial, igual app de loja
- Abre em tela cheia, sem barra do navegador
- Funciona offline (parte das funções)

### O que adicionar ao projeto

Três arquivos novos + alguns ajustes no `index.html`:

#### 1. `manifest.json` (declaração do app)

```json
{
  "name": "Conecta Inclusão",
  "short_name": "Conecta",
  "description": "Acessibilidade multimodal em sala de aula",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#FDF8EE",
  "theme_color": "#0F4C5C",
  "lang": "pt-BR",
  "icons": [
    { "src": "/icons/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icons/icon-512.png", "sizes": "512x512", "type": "image/png" },
    { "src": "/icons/icon-maskable-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
  ]
}
```

#### 2. `sw.js` (service worker — cache offline)

```javascript
const CACHE = 'conecta-v1';
const ASSETS = ['/', '/index.html', '/manifest.json'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)));
});

self.addEventListener('fetch', (e) => {
  e.respondWith(caches.match(e.request).then(r => r || fetch(e.request)));
});
```

#### 3. Ícones

Gerem ícones em 192px e 512px usando [maskable.app/editor](https://maskable.app/editor). Coloquem em `/icons/`.

#### 4. Adicionar no `<head>` do `index.html`

```html
<link rel="manifest" href="/manifest.json">
<meta name="theme-color" content="#0F4C5C">
<link rel="apple-touch-icon" href="/icons/apple-touch-icon.png">
<script>
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js');
  }
</script>
```

**Critério de pronto:** instalar o app num celular Android real, abrir e ver que parece um app nativo.

> ⚠ Atenção iOS: no iPhone, a Web Speech API para reconhecimento de fala tem suporte limitado. TTS funciona. Esse é um problema conhecido que será resolvido na Fase 4 com Whisper no backend.

---

## 🟡 FASE 3 — Domínio próprio + hospedagem grátis (1 semana)

**Objetivo:** sair do localhost e ter `conectainclusao.com.br` na internet.

**Tempo:** ~3 dias.
**Custo:** R$ 40/ano (só o domínio).

### Passo a passo

1. **Registrar o domínio** no [Registro.br](https://registro.br) — `conectainclusao.com.br` por R$ 40/ano (R$ 3,33/mês). Pagamento por boleto.

2. **Criar conta no [Cloudflare](https://cloudflare.com)** (gratuita).

3. **Ativar o Cloudflare Pages**:
   - No painel da Cloudflare, vá em "Workers & Pages" → "Pages"
   - "Connect to Git" → conecte sua conta do GitHub
   - Escolha o repositório `conecta-inclusao`
   - Build settings: deixe em branco (é só HTML estático)
   - Deploy

4. **Apontar o domínio**:
   - No Cloudflare Pages, vá em "Custom domains" → adicione `conectainclusao.com.br`
   - O Cloudflare vai dar uns DNS pra configurar no Registro.br
   - No Registro.br, vá no seu domínio → "Editar DNS" → cole os nameservers da Cloudflare

5. Espere 5 a 30 minutos. Pronto: `https://conectainclusao.com.br` no ar.

### Alternativas se Cloudflare for complicado

| Serviço | Custo | Dificuldade | Observação |
|---|---|---|---|
| **GitHub Pages** | Grátis | Fácil | Sem CDN brasileiro, mais lento |
| **Cloudflare Pages** | Grátis | Médio | Recomendado, CDN no Brasil |
| **Vercel** | Grátis | Fácil | Mais focado em apps Next.js |
| **Netlify** | Grátis | Fácil | Boa pra projetos pequenos |

**Critério de pronto:** abrir `https://conectainclusao.com.br` em qualquer celular e funcionar.

---

## 🟠 FASE 4 — Backend e sincronização real (4 a 6 semanas)

**Objetivo:** professor numa tela, aluno em outra, **conversando de verdade pela internet**.

**Tempo:** 4 a 6 semanas (requer um integrante focado em backend).
**Custo:** ~R$ 30/mês (Hetzner) + R$ 0 (Supabase grátis).

### O que muda

Hoje, cada aba do MVP roda isolada. Nesta fase, criamos um **servidor central** que:
- Conecta o professor aos alunos da turma em tempo real
- Persiste perfis de usuário, aulas anteriores, descrições já geradas
- Permite o professor criar uma "sala de aula" com código (ex: "AULA-A7K2") que o aluno entra
- Esconde a chave da API Claude do navegador (essencial para segurança)

### Stack proposta

- **Backend:** Node.js + Express + Socket.IO (WebSocket pra tempo real)
- **Banco:** Supabase (PostgreSQL gratuito + autenticação pronta)
- **Servidor:** Hetzner Cloud CX22 (€4,90/mês ≈ R$ 28)
- **Proxy Claude:** o backend faz as chamadas pra Claude API e devolve só o resultado pro frontend

### O que cada integrante pode fazer em paralelo

| Pessoa | Tarefa |
|---|---|
| Dev backend | Subir Hetzner, instalar Node.js + Caddy, montar API Socket.IO |
| Dev frontend | Adaptar o `index.html` pra conectar via WebSocket |
| Dev banco | Modelar tabelas no Supabase (users, schools, lessons, transcripts) |
| Designer | Refinar interface, criar fluxo de "entrar em sala com código" |
| Validação | Continuar testes com usuários reais nas escolas |

### Modelo de dados sugerido (Supabase)

```sql
-- Usuários (professores e alunos)
create table users (
  id uuid primary key default gen_random_uuid(),
  email text unique,
  name text not null,
  role text check (role in ('teacher', 'student_deaf', 'student_blind')),
  school_id uuid references schools(id),
  created_at timestamptz default now()
);

-- Escolas
create table schools (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  city text not null,
  state text default 'PI'
);

-- Aulas
create table lessons (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid references users(id),
  code text unique not null,        -- ex: "AULA-A7K2"
  subject text,
  started_at timestamptz default now(),
  ended_at timestamptz
);

-- Transcrições (cada fala do professor)
create table transcripts (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid references lessons(id),
  text text not null,
  created_at timestamptz default now()
);

-- Imagens descritas pela IA
create table images (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid references lessons(id),
  url text not null,
  description text not null,
  simplified text,
  created_at timestamptz default now()
);
```

**Critério de pronto:** professor inicia uma aula com código AULA-XYZ, dois alunos entram com esse código de outros dispositivos, e ambos recebem a fala/imagens em tempo real.

---

## 🔴 FASE 5 — Produção e refinamento (contínuo)

**Objetivo:** virar produto sério, validado e escalado.

**Tempo:** 6 a 12 meses.

### Itens do roadmap longo

| Tarefa | Por quê | Prioridade |
|---|---|---|
| Whisper self-hosted no backend | Reconhecimento de fala mais preciso que Web Speech API, resolve problema do iOS | Alta |
| Dashboard do professor | Métricas de engajamento dos alunos PCD (alinha com KPIs do projeto) | Alta |
| Glossário pedagógico em Libras | Validação com tradutores surdos pra matemática, química, biologia | Média |
| Integração SIGEduc / Google Sala de Aula | Adoção mais fácil pelas escolas | Média |
| Audiodescrição via Azure Neural TTS | Voz ainda mais natural que a do Chrome | Baixa |
| Reconhecimento de Libras (visão reversa) | Permite aluno surdo responder em Libras direto | Baixa (Fase 1 do roadmap longo) |
| Suporte a surdocegueira (háptico) | Inclusão ainda mais ampla | Baixa (Fase 2) |

---

## 💰 Custo total esperado por fase

| Fase | Custo de setup | Custo mensal |
|---|---|---|
| Fase 0 — Local | R$ 0 | R$ 0 |
| Fase 1 — MVP (concluída) | R$ 0 | R$ 0 |
| Fase 2 — PWA | R$ 0 | R$ 0 |
| Fase 3 — Domínio + hospedagem | R$ 40 (domínio) | R$ 3,33 |
| Fase 4 — Backend + banco | R$ 0 | ~R$ 30 + uso de IA (~R$ 30 a R$ 100) |
| **Total Fase 1-4** | **R$ 40** | **~R$ 60 a R$ 130/mês** |

---

## 🎯 Indicadores de sucesso (KPIs)

Pra cada fase, registrem se atingiram:

| Indicador | Linha de base | Meta (1 ano após produção) |
|---|---|---|
| Escolas usando ativamente | 0 | 5 (piloto Piauí) |
| Alunos PCD impactados | 0 | 50+ |
| Evasão escolar entre PCD nas escolas piloto | 22% | 8% |
| Interações/aluno/dia | 0,3 | 2,5 |
| Satisfação de professores | — | NPS 50+ |

---

## 🆘 Como começar amanhã

Se vocês têm 1 hora hoje:
1. Cada integrante cria conta no GitHub.
2. Um integrante (líder técnico) cria o repositório `conecta-inclusao` e dá acesso aos outros.
3. Sobem o `index.html` (renomeado), `pitch.html`, `README.md` e este `ROADMAP.md`.
4. Cada um clona o repositório na sua máquina, instala Python (se ainda não tem), e roda `python3 -m http.server 8000`.

Se vocês têm 1 dia:
1. Faz tudo acima.
2. Marca uma reunião de 1h pra alinhar quem faz o quê na Fase 2.
3. Quem ficar com PWA já cria o `manifest.json` e o `sw.js`.

Se vocês têm 1 semana:
1. PWA concluída.
2. Domínio comprado.
3. Site no ar.
4. Pitch ensaiado 3 vezes com cronômetro.

---

## 📚 Recursos pra estudar

| Tema | Onde aprender |
|---|---|
| HTML/CSS/JS básico | [MDN Web Docs - Aprenda Web](https://developer.mozilla.org/pt-BR/docs/Learn) |
| Git e GitHub | [Curso em Vídeo - Gustavo Guanabara](https://www.youtube.com/playlist?list=PLHz_AreHm4dm7ZULPAmadvNhH6vk9oNZA) |
| PWA | [web.dev/learn/pwa](https://web.dev/learn/pwa/) (em inglês, mas com tradução) |
| Acessibilidade (WCAG) | [Cartilha de Acessibilidade Web do W3C](https://www.w3.org/WAI/fundamentals/accessibility-intro/pt-br) |
| Node.js + Socket.IO | [Socket.IO Docs](https://socket.io/docs/v4/) |
| Supabase | [supabase.com/docs](https://supabase.com/docs) |

---

**Lembre-se:** vocês não precisam fazer tudo. Cada fase entrega um produto funcional. O Conecta Inclusão como **MVP do navegador** (Fase 1) já é o suficiente para vencer o hackathon. As outras fases são pra depois — pra transformar o vencedor do hackathon em produto real que muda a vida de alunos PCD no Piauí.

> A diferença entre projeto que ganha hackathon e projeto que muda o mundo é o que vocês fazem **depois** que as luzes apagam.

Boa sorte. 🟧
