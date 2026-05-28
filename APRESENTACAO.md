# Relatório de Apresentação — ConectaInclusão

> Sala de aula virtual acessível para alunos surdos e cegos
> Escola: **CETI Prof. Ubiraci Carvalho — São João da Serra/PI**

---

## 1. O que é o ConectaInclusão? (slide de abertura)

É um site que transforma o computador em uma **sala de aula inclusiva**. O professor fala normalmente, e o sistema entrega a aula em **três formatos ao mesmo tempo**:

- **Para o aluno surdo** → legenda gigante na tela + um boneco 3D oficial do governo (VLibras) que traduz a fala em **Libras (Língua Brasileira de Sinais)** automaticamente.
- **Para o aluno cego** → o computador lê em voz alta tudo que o professor disse e descreve as imagens (em desenvolvimento).
- **Para o professor** → um painel simples onde ele só precisa **falar no microfone**. Tudo o resto acontece sozinho.

**Frase de impacto para abrir a apresentação:**
> "Imagine uma aula onde o professor fala uma vez, e ela chega traduzida para Libras, em texto e em voz, ao mesmo tempo, para cada aluno do jeito que ele precisa receber."

---

## 2. Por que esse projeto existe? (motivação)

Em muitas escolas públicas, **um intérprete de Libras não está sempre disponível**, e alunos cegos dependem de materiais que nem sempre são acessíveis. O ConectaInclusão usa **tecnologias gratuitas e abertas** do governo brasileiro e do navegador para resolver isso **sem custo** e em **computadores antigos**.

---

## 3. Como funciona, na prática (passo a passo simples)

**Fluxo resumido das três telas:**

- **`/professor.html`** → clica em **"Criar sala"** → faz **captação de áudio** (fala no microfone) + pode **selecionar imagens** para audiodescrição automática.
- **`/aluno-surdo.html`** → digita o código da sala → o **avatar VLibras traduz tudo** para Libras automaticamente (fala e imagens).
- **`/aluno-cego.html`** → digita o código da sala → recebe **TTS automático** (computador lê em voz alta) + **audiodescrição** das imagens enviadas pelo professor.

**Passo a passo na aula:**

1. O professor abre o site no computador e clica em **"Criar sala"**.
2. O sistema gera um **código de 6 letras** (ex.: `KMRT78`) em fonte gigante.
3. O professor dita esse código para a turma.
4. Cada aluno abre o site no celular ou computador e digita o código, escolhendo **"Sou surdo"** ou **"Sou cego"**.
5. O professor clica em **"🎤 Iniciar captação"** e começa a aula falando normalmente.
6. Se quiser mostrar uma imagem (foto de um mapa, gráfico, esquema do livro), o professor seleciona o arquivo → o sistema **gera automaticamente uma descrição em texto** usando IA → envia imagem + descrição para os alunos.
7. Tudo chega na hora, **traduzido automaticamente**, para cada aluno conforme seu perfil.

**Analogia para apresentar:** *"É como uma rádio escolar com slides: cada ouvinte escolhe se quer escutar em voz, ler em texto, ou ver em Libras — e a imagem que aparece no quadro chega descrita em palavras para quem não enxerga."*

---

## 4. Como foi construído — a "receita" técnica (em linguagem simples)

### 4.1. Os ingredientes (stack tecnológica)

| Peça | O que faz | Por que escolhemos |
|---|---|---|
| **HTML + CSS + JavaScript puro** | Cria as telas | Funciona em qualquer computador, mesmo antigo, **sem precisar instalar nada** |
| **Node.js + Express** | Servidor que liga professor e alunos | Leve, gratuito, fácil de rodar na escola |
| **Socket.IO** | "Telefone em tempo real" entre as telas | Permite que a fala do professor apareça **na hora** no aluno |
| **Web Speech API** | Microfone que vira texto | Já vem dentro do Chrome — não precisa pagar nada |
| **VLibras Player** | O boneco 3D que faz os sinais | É **oficial do governo brasileiro**, com avatares Ícaro e Hozana |
| **Groq API + Llama 4 Vision** | IA que "enxerga" imagens e descreve em português | **Gratuita** (sem cartão), rápida, com modelo multimodal de ponta |

### 4.2. A arquitetura (diagrama para o slide)

```
   PROFESSOR                  SERVIDOR                  ALUNO SURDO
   ---------                  --------                  -----------
   Fala no microfone     →   Recebe e         →    Mostra legenda gigante
   (vira texto)              reenvia para           +
                             todos da sala          Boneco 3D faz os sinais
   Envia imagem          →   Pede descrição          +
                             à IA Groq               Mostra imagem com legenda
                             (Llama 4 Vision)
                                                    ALUNO CEGO
                                                    ----------
                                                    Computador lê em voz alta
                                                    + lê a audiodescrição da imagem
```

### 4.3. Como o boneco 3D entra na história (a parte mais especial do projeto)

O VLibras é o **tradutor oficial do governo brasileiro para Libras**. Ele tem um boneco em 3D que faz os sinais de verdade. Para conseguir que esse boneco traduzisse **a cada nova fala automaticamente** (e não a cada clique do usuário, como ele faz por padrão), foi preciso:

1. **Carregar o boneco** dentro da página do aluno surdo.
2. **Mandar a fala do professor para o tradutor** (que transforma "olá turma" em "OLA TURMA" — a "glosa", que é como Libras representa frases).
3. **Pedir para o boneco animar** a glosa.

Isso parece simples, mas foi a parte mais difícil do projeto — e gerou um **estudo técnico inteiro**, descrito na próxima seção.

---

## 5. O estudo realizado — a "aventura" do VLibras (resumo simplificado)

> Esta é a melhor história para a apresentação. Mostra que o grupo **estudou de verdade**.

Quando o grupo tentou colocar o boneco 3D do VLibras para funcionar automaticamente, **6 problemas diferentes apareceram em sequência**. Cada um exigiu pesquisa e leitura de código aberto:

| # | Problema encontrado | Solução |
|---|---|---|
| 1 | O "widget" oficial do VLibras só traduz quando o usuário **clica com o mouse**. Não dava para automatizar. | Trocamos por uma **biblioteca de programador** (vlibras-player-webjs). |
| 2 | A versão simples dessa biblioteca **estava com defeito** (faltava código). | Usamos uma versão **moderna (ESM)** servida pela CDN `esm.sh`. |
| 3 | O código de exemplo da internet usava um nome de função errado (`onLoad`); o correto era `onReady`. | Lemos o código-fonte e corrigimos. |
| 4 | O boneco 3D precisa "conversar" com o site usando 6 funções específicas, e a biblioteca **não as registrava**. | Criamos uma "ponte" manualmente, registrando essas funções. |
| 5 | O endereço do tradutor oficial estava **quebrado** (retornava erro 302 para um caminho inexistente). | Descobrimos um endereço alternativo (`traducao2.vlibras.gov.br`) e criamos um **proxy local** no servidor. |
| 6 | O boneco esperava receber a ordem com um nome (`PlayerManager`), mas a biblioteca enviava com outro nome (`Avatar`). | Aplicamos um "tradutor de comandos" (monkey-patch) que converte os nomes na hora. |

**Mensagem para a plateia:** *"Trabalhar com tecnologias gratuitas do governo significa ler muito código, testar com paciência, e às vezes consertar coisas que a documentação oficial nem menciona. Foi assim que aprendemos que **programar não é só escrever — é também investigar**."*

---

## 6. Funcionalidades aplicadas (uma a uma, explicadas)

### 6.1. Criação de salas com código curto
- O servidor gera um código de **6 letras** (ex.: `KMRT78`).
- **Importante:** não usamos as letras `I`, `O`, e os números `0`, `1`, porque eles **se confundem facilmente** (especialmente ao ditar para um aluno cego).
- A sala fica guardada **só na memória** do servidor — quando a aula acaba, ela some. Isso é proposital: leve, rápido e respeita a privacidade.

### 6.2. Captação de voz do professor (Speech-to-Text)
- O microfone capta a fala.
- O **Google Chrome** transforma o áudio em texto, em **português do Brasil**.
- O texto **só é enviado quando a frase termina** (não palavra por palavra) — assim o boneco não fica reiniciando a tradução o tempo todo.
- **Se a internet falhar:** o sistema tenta de novo automaticamente (5 vezes, com intervalos cada vez maiores: 0,5s → 1s → 2s → 4s → 8s). Depois disso, mostra um aviso amigável.
- **Se o microfone não funcionar:** existe um campo de texto manual para o professor digitar.

### 6.3. Comunicação em tempo real (Socket.IO)
- Pense num "WhatsApp interno" da sala: o que o professor fala, todos os alunos recebem **na mesma hora**.
- **Segurança:** o servidor verifica se quem está mandando a mensagem é mesmo o professor. Aluno não consegue "fingir" ser o professor.

### 6.4. Legenda gigante para o aluno surdo
- A última fala do professor aparece em **letra enorme, com alto contraste** (preto/branco — segue a norma WCAG 2.1 AA de acessibilidade).
- As **4 falas anteriores** ficam em letra menor, como um histórico.

### 6.5. Avatar 3D em Libras
- Boneco oficial do VLibras (avatares **Ícaro** ou **Hozana**).
- Roda em Unity WebGL (jogo 3D dentro do navegador).
- Faz os sinais automaticamente a cada fala do professor.
- Tem uma **fila** interna: se o professor falar duas vezes seguidas, o boneco termina a primeira antes de começar a segunda, sem atropelar.
- Cache em IndexedDB: na primeira aula demora ~10–20s para carregar (30MB), depois fica rápido.

### 6.6. Aluno cego — síntese de voz e audiodescrição (Módulo 5 ✅)
- O computador **lê em voz alta** tudo que o professor falar (Text-to-Speech do navegador, em português do Brasil).
- Quando o professor **envia uma imagem**:
  1. O navegador do professor **redimensiona** a imagem (máximo 1280px, JPEG qualidade 0.85) para reduzir o tamanho.
  2. A imagem vai para o servidor → o servidor chama a **API do Groq com o modelo Llama 4 Vision**.
  3. A IA olha a imagem e **escreve uma descrição em português brasileiro**, focando no que é educacionalmente relevante.
  4. A descrição volta como **legenda automática** e é enviada junto com a imagem para todos os alunos da sala.
  5. No aluno cego, a descrição é **lida em voz alta automaticamente** logo após o aviso *"Professor enviou uma imagem"*.
  6. No aluno surdo, a descrição é **traduzida em Libras pelo avatar VLibras** + aparece em texto.
- **Por que Groq + Llama 4 Vision?** A chave é gratuita (sem cartão de crédito), o modelo é rápido (~1-2 segundos por imagem) e a qualidade da descrição em português é excelente para uso pedagógico.
- **Tolerância a falhas:** se a IA falhar (sem internet, sem chave, limite atingido), a imagem ainda é enviada — sem legenda automática, mas o professor pode digitar uma legenda manual.

### 6.7. Painel do professor
- 3 colunas: controles, histórico de falas, contadores de alunos conectados.
- Mostra **quantos alunos surdos e cegos** estão na sala em tempo real.
- Botões grandes, acessíveis pelo teclado.

### 6.8. Acessibilidade visual e por teclado
- Cores seguem a norma **WCAG 2.1 AA** (contraste mínimo garantido).
- Foco visível ao usar `Tab`.
- Uso de `aria-live` para que leitores de tela anunciem novas mensagens.

---

## 7. Limitações e próximos passos (seja honesto na apresentação)

**O que ainda pode ser melhorado:**
- Persistência: quando o servidor desliga, o histórico some. Para guardar frequência/relatórios, precisaria adicionar um banco de dados.
- Login de professores e alunos (hoje qualquer pessoa com o código entra).
- Gravação da aula para o aluno revisar depois.

**Limites técnicos honestos:**
- Só funciona bem em **Chrome ou Edge** (Firefox e Safari não têm microfone completo).
- Precisa de **internet** (o reconhecimento de voz, o tradutor VLibras e a IA Groq dependem da nuvem).
- O microfone só funciona em **HTTPS** ou rodando em `localhost` (regra de segurança dos navegadores).
- A audiodescrição depende da chave Groq estar configurada no servidor (`GROQ_API_KEY` no arquivo `.env`).

---

## 8. Fechamento para a apresentação

**Sugestão de fala final:**

> *"O ConectaInclusão não inventou a roda. Ele usa o reconhecimento de voz do Google, o tradutor de Libras do governo brasileiro, e a inteligência artificial Llama 4 Vision via Groq — todas tecnologias que já existem e estão disponíveis de graça. O que fizemos foi **costurar tudo isso** em uma sala de aula que funciona em qualquer computador da nossa escola, em tempo real. Inclusão não precisa ser cara nem complicada — precisa de gente disposta a integrar o que já existe."*

---

## Dicas extras para a apresentação

1. **Faça uma demonstração ao vivo** — abra duas janelas no mesmo computador (professor + aluno surdo). Fale "olá turma" e mostre o boneco sinalizando.
2. **Mostre o código da sala em letra gigante** na tela — é visualmente impactante.
3. **Tenha um plano B**: se a internet falhar na hora, mostre um **vídeo gravado** da demo funcionando.
4. **Foque na história do VLibras** (seção 5) — é a parte que prova que vocês **estudaram** e não só "copiaram da internet".
5. **Compare com a alternativa**: contratar intérprete custa caro; este sistema é gratuito.
