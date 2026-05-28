// ConectaInclusao - logica do aluno surdo (Modulos 2 + 3)

(function () {
  const C = window.ConectaSocket;

  const formEntrar = document.getElementById('form-entrar');
  const inputCodigo = document.getElementById('codigo');
  const secaoEntrar = document.getElementById('secao-entrar');
  const secaoAula = document.getElementById('secao-aula');
  const statusAula = document.getElementById('status-aula');
  const statusVlibras = document.getElementById('status-vlibras');
  const legenda = document.getElementById('legenda');
  const historicoFalas = document.getElementById('historico-falas');
  const containerImagem = document.getElementById('container-imagem');
  const aviso = document.getElementById('aviso');
  const containerPlayer = document.getElementById('vlibras-player');

  inputCodigo.addEventListener('input', () => {
    inputCodigo.value = inputCodigo.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
  });

  // Auto-preenche se o link veio com ?codigo=XYZ123. Não auto-submete
  // porque o avatar VLibras precisa de gesture do usuário para começar.
  const paramCodigo = new URLSearchParams(window.location.search).get('codigo');
  if (paramCodigo && /^[A-Z0-9]{6}$/.test(paramCodigo.toUpperCase())) {
    inputCodigo.value = paramCodigo.toUpperCase();
    const btn = formEntrar.querySelector('button[type="submit"]');
    if (btn) {
      btn.focus();
      btn.textContent = '👉 Entrar agora na sala ' + paramCodigo.toUpperCase();
    }
  }

  function mostrarAviso(msg, erro) {
    aviso.textContent = msg;
    aviso.classList.remove('hidden', 'aviso--erro');
    if (erro) aviso.classList.add('aviso--erro');
  }

  // ============================================================
  // VLibras Player — biblioteca oficial vlibras-player-webjs.
  // Diferente do widget, esta lib expõe player.translate(texto)
  // que dispara tradução + animação programaticamente, sem o
  // aluno precisar selecionar nada na tela.
  // ============================================================
  let player = null;
  let vlibrasPronto = false;

  // O Unity Player do VLibras chama funções globais sem prefixo para
  // sinalizar eventos (onLoadPlayer, GetAvatar, etc). A biblioteca
  // vlibras-player-webjs expõe um PlayerManagerAdapter em
  // window.VLibrasPlayerManagerAdapter mas não registra essas funções
  // globais — então fazemos a ponte manualmente aqui.
  function registrarBridgeUnity() {
    const bridge = function (metodo) {
      return function () {
        const adapter = window.VLibrasPlayerManagerAdapter;
        if (adapter && typeof adapter[metodo] === 'function') {
          adapter[metodo].apply(adapter, arguments);
        }
      };
    };
    window.onLoadPlayer = function () {
      // Só agora o GameObject "Avatar" existe no Unity. A biblioteca
      // chamou setBaseUrl prematuramente no setupPlayerManagerEvents
      // (gerando "object Avatar not found!"). Refazemos aqui para que
      // o dicionário seja realmente carregado.
      const adapter = window.VLibrasPlayerManagerAdapter;
      if (adapter && adapter.currentBaseUrl) {
        try { adapter.setBaseUrl(adapter.currentBaseUrl); } catch (e) {}
      }
      if (adapter && !vlibrasPronto && player) {
        vlibrasPronto = true;
        statusVlibras.textContent = 'Avatar de Libras pronto. Tradução automática ativa.';
        statusVlibras.classList.remove('captacao__status--erro');
        statusVlibras.classList.add('captacao__status--ativo');
        if (filaTraducao.length > 0 && !processando) processarFila();
      }
    };
    window.onPlayingStateChange = bridge('onStateChange');
    window.GetAvatar = bridge('onGetAvatar');
    window.onProgress = bridge('onProgress');
    window.onCounterGloss = bridge('onCounterGloss');
    window.onFinishWelcome = bridge('onFinishWelcome');
    window.onError = function (erro) {
      console.warn('[VLibras Unity] erro:', erro);
    };
  }

  function criarPlayer() {
    try {
      registrarBridgeUnity();

      // targetPath: pasta com Unity build do avatar oficial.
      // Reutilizamos a build pública do gov.br para não precisar
      // hospedar 50+ MB de assets Unity localmente.
      // fallbackUrl: o endpoint antigo do gov.br (app/trad/1) está
      // devolvendo 302 para um caminho quebrado no jsdelivr. Usamos
      // nosso proxy local que chama traducao2.vlibras.gov.br/translate.
      player = new window.VLibrasPlayer({
        targetPath: 'https://vlibras.gov.br/app/target',
        fallbackUrl: '/api/vlibras/translate',
        onReady: function () {
          // onReady dispara quando o adapter recebe 'load'. Pode ser
          // antes do Unity estar 100% pronto — onLoadPlayer também
          // dispara depois e finaliza a marcação.
          if (!vlibrasPronto) {
            vlibrasPronto = true;
            statusVlibras.textContent = 'Avatar carregado. Tradução automática ativa.';
            statusVlibras.classList.add('captacao__status--ativo');
            if (filaTraducao.length > 0 && !processando) processarFila();
          }
        }
      });

      // Sobrescreve o método interno de tradução para enviar JSON em
      // vez de form-data (formato esperado pelo nosso proxy + endpoint
      // traducao2 do gov.br).
      if (player.translator) {
        player.translator.makeTranslationRequest = function (texto) {
          return fetch('/api/vlibras/translate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: texto })
          });
        };
      }

      // CRÍTICO: a biblioteca npm v2.4.2 envia SendMessage('Avatar', ...)
      // com nomes de método modernos. O Unity Player atual hospedado em
      // vlibras.gov.br/app espera GameObject 'PlayerManager' com nomes
      // antigos (playNow em vez de setGlosa+play, etc). Patcheamos o
      // sendMessage do adapter para fazer a tradução em runtime.
      const adapter = player.playerManager;
      if (adapter && typeof adapter.sendMessage === 'function') {
        adapter._glosaPendente = null;
        adapter.sendMessage = function (objectName, methodName, value) {
          if (!this.player || !this.player.SendMessage) return;
          const send = (obj, met, val) => {
            try { this.player.SendMessage(obj, met, val); }
            catch (e) { console.warn('[VLibras] SendMessage falhou:', obj, met, e); }
          };
          if (objectName === 'Avatar') {
            switch (methodName) {
              case 'setGlosa':
                // No Unity atual, playNow recebe a glosa e já dispara
                this._glosaPendente = value;
                send('PlayerManager', 'playNow', value);
                send('PlayerManager', 'setPauseState', 0);
                return;
              case 'play':
                // setGlosa já chamou playNow; aqui só garante pause=0
                send('PlayerManager', 'setPauseState', 0);
                this._glosaPendente = null;
                return;
              case 'pause':
                return send('PlayerManager', 'setPauseState', 1);
              case 'stop':
                return send('PlayerManager', 'stopAll', '');
              case 'setUrl':
                return send('PlayerManager', 'setBaseUrl', value);
              case 'setSpeed':
                return send('PlayerManager', 'setSlider', value);
              case 'toggleSubtitle':
                return send('PlayerManager', 'setSubtitlesState', '');
              case 'changeAvatar':
                return send('PlayerManager', 'Change', value);
              case 'playWelcome':
                return send('PlayerManager', 'playWellcome', '');
              case 'setPersonalization':
                return send('CustomizationBridge', 'setURL', value);
              default:
                return send('PlayerManager', methodName, value);
            }
          }
          return send(objectName, methodName, value);
        };
      }

      // Listeners de diagnóstico — ajudam a entender o que está
      // acontecendo se a tradução falhar silenciosamente.
      const ev = player.getEventEmitter && player.getEventEmitter();
      if (ev && typeof ev.on === 'function') {
        ev.on('translation:start', (d) => console.log('[VLibras] traduzindo:', d.text));
        ev.on('translation:complete', (d) => console.log('[VLibras] glosa:', d.gloss));
        ev.on('translation:error', (d) => console.warn('[VLibras] erro tradução:', d.error));
        ev.on('animation:start', () => console.log('[VLibras] animação iniciada'));
        ev.on('animation:complete', () => console.log('[VLibras] animação concluída'));
      }

      player.load(containerPlayer);

      // Timeout de segurança caso onReady/onLoadPlayer não disparem em 60s.
      setTimeout(function () {
        if (!vlibrasPronto) {
          statusVlibras.textContent =
            'Avatar demorou para carregar — verifique sua conexão. Legendas em texto continuam funcionando.';
          statusVlibras.classList.add('captacao__status--erro');
        }
      }, 60000);
    } catch (e) {
      statusVlibras.textContent = 'Erro ao inicializar avatar: ' + (e.message || e);
      statusVlibras.classList.add('captacao__status--erro');
    }
  }

  // A biblioteca é carregada via <script type="module"> no HTML, que é
  // assíncrono. Tratamos os dois casos: já carregada ou aguardando evento.
  function inicializarPlayer() {
    if (window.VLibrasPlayer) {
      criarPlayer();
      return;
    }
    statusVlibras.textContent = 'Carregando biblioteca do avatar...';
    let resolvido = false;
    const aoCarregar = function () {
      if (resolvido) return;
      resolvido = true;
      criarPlayer();
    };
    window.addEventListener('vlibras:ready', aoCarregar, { once: true });
    // Fallback de polling caso o evento se perca (carregamento muito rápido).
    const inicio = Date.now();
    const id = setInterval(function () {
      if (window.VLibrasPlayer) {
        clearInterval(id);
        aoCarregar();
      } else if (Date.now() - inicio > 15000) {
        clearInterval(id);
        if (!resolvido) {
          statusVlibras.textContent =
            'Biblioteca VLibras não carregou em 15s. Verifique sua conexão com esm.sh.';
          statusVlibras.classList.add('captacao__status--erro');
        }
      }
    }, 500);
  }

  // ============================================================
  // Fila de tradução: evita atropelo do avatar.
  // Estimativa simples: ~80ms por caractere (~1s por palavra média).
  // ============================================================
  const filaTraducao = [];
  let processando = false;

  function enfileirar(texto) {
    filaTraducao.push(texto);
    if (!processando) processarFila();
  }

  function processarFila() {
    if (filaTraducao.length === 0) {
      processando = false;
      return;
    }
    processando = true;
    const texto = filaTraducao.shift();
    enviarTextoParaVLibras(texto);
    const espera = Math.max(1500, Math.min(15000, texto.length * 80));
    setTimeout(processarFila, espera);
  }

  // ============================================================
  // Envio do texto para o player — API oficial.
  // player.translate(texto) faz internamente:
  //   1) POST ao Translator API → recebe glosa
  //   2) SendMessage para o Unity Player → animação inicia
  // Sem seleção, sem clique, sem heurística.
  // ============================================================
  function enviarTextoParaVLibras(texto) {
    if (!texto) return;
    if (!player || !vlibrasPronto) return;
    try {
      player.translate(texto);
    } catch (e) {
      // Erro pontual de tradução — segue a vida; a próxima fala tentará de novo.
    }
  }

  // ============================================================
  // Histórico curto (últimas 4 falas anteriores).
  // ============================================================
  const HISTORICO_MAX = 4;
  let ultimaFala = '';

  function atualizarLegenda(texto) {
    if (ultimaFala) {
      const item = document.createElement('li');
      item.textContent = ultimaFala;
      historicoFalas.insertBefore(item, historicoFalas.firstChild);
      while (historicoFalas.children.length > HISTORICO_MAX) {
        historicoFalas.removeChild(historicoFalas.lastChild);
      }
    }
    ultimaFala = texto;
    legenda.textContent = texto;
    legenda.classList.remove('legenda--vazia');
  }

  formEntrar.addEventListener('submit', (e) => {
    e.preventDefault();
    const codigo = inputCodigo.value.trim();
    if (codigo.length !== 6) {
      mostrarAviso('O código deve ter 6 caracteres.', true);
      return;
    }
    C.entrarSala(codigo, 'surdo');
  });

  C.onEvento('entrada_confirmada', (data) => {
    secaoEntrar.classList.add('hidden');
    secaoAula.classList.remove('hidden');
    statusAula.textContent = `Conectado na sala ${data.codigo}. Aguardando o professor...`;
    aviso.classList.add('hidden');
    inicializarPlayer();
  });

  C.onEvento('fala_recebida', (data) => {
    atualizarLegenda(data.texto);
    enfileirar(data.texto);
  });

  C.onEvento('imagem_recebida', (data) => {
    containerImagem.innerHTML = '';
    const img = document.createElement('img');
    img.src = data.dataUrl;
    img.alt = data.legenda || 'Imagem enviada pelo professor';
    img.className = 'imagem-recebida';
    containerImagem.appendChild(img);
    if (data.legenda) {
      atualizarLegenda(data.legenda);
      enfileirar(data.legenda);
    }
  });

  C.onEvento('sala_encerrada', () => {
    mostrarAviso('A aula foi encerrada pelo professor.', true);
    statusAula.textContent = 'Aula encerrada.';
    inputCodigo.disabled = true;
  });

  C.onEvento('erro', (data) => {
    if (data.motivo === 'SALA_NAO_ENCONTRADA') {
      mostrarAviso('Sala não encontrada. Verifique o código com o professor.', true);
    } else {
      mostrarAviso(`Erro: ${data.motivo}`, true);
    }
  });

  // ============================================================
  // Sinalizar ao professor (levantar mão).
  // ============================================================
  const TEXTOS_SINAL = {
    duvida: '✓ Dúvida enviada ao professor.',
    rapido: '✓ Pedido enviado: está rápido demais.',
    repetir: '✓ Pedido enviado: pode repetir.'
  };
  const statusSinal = document.getElementById('status-sinal');
  document.querySelectorAll('.btn--sinal').forEach((btn) => {
    btn.addEventListener('click', () => {
      const tipo = btn.dataset.tipo;
      C.sinalizar(tipo);
      statusSinal.textContent = TEXTOS_SINAL[tipo] || '✓ Sinal enviado.';
      statusSinal.classList.add('captacao__status--ativo');
      btn.disabled = true;
      setTimeout(() => { btn.disabled = false; }, 4000);
    });
  });

  C.onEvento('mao_atendida', () => {
    statusSinal.textContent = '✓ Professor reconheceu seu pedido.';
    statusSinal.classList.add('captacao__status--ativo');
  });
})();
