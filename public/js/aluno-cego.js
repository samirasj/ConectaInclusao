// ConectaInclusao - logica do aluno cego (Modulos 2 + 5)
// Web Speech API SpeechSynthesis lê automaticamente as falas do professor
// e as audiodescrições de imagens geradas pela Gemini. Aria-live também
// está presente para complementar com o leitor de tela do sistema.

(function () {
  const C = window.ConectaSocket;

  const formEntrar = document.getElementById('form-entrar');
  const inputCodigo = document.getElementById('codigo');
  const secaoEntrar = document.getElementById('secao-entrar');
  const secaoAula = document.getElementById('secao-aula');
  const statusAula = document.getElementById('status-aula');
  const legenda = document.getElementById('legenda');
  const descricaoImagem = document.getElementById('descricao-imagem');
  const containerImagem = document.getElementById('container-imagem');
  const aviso = document.getElementById('aviso');

  const btnRepetir = document.getElementById('btn-repetir');
  const btnPausarTts = document.getElementById('btn-pausar-tts');
  const btnRetomarTts = document.getElementById('btn-retomar-tts');
  const inputVelocidade = document.getElementById('velocidade-tts');
  const valorVelocidade = document.getElementById('valor-velocidade');
  const statusAudioProfessor = document.getElementById('status-audio-professor');
  const audioProfessor = document.getElementById('audio-professor');
  const btnMutarProfessor = document.getElementById('btn-mutar-professor');
  const btnMutarProfessorRotulo = document.getElementById('btn-mutar-professor-rotulo');

  inputCodigo.addEventListener('input', () => {
    inputCodigo.value = inputCodigo.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
  });

  // Auto-preenche e auto-entra se o link veio com ?codigo=XYZ123.
  // Browser exige gesture do usuário para autoplay de áudio/TTS — por isso
  // não submetemos sem clique se vier sem código.
  const paramCodigo = new URLSearchParams(window.location.search).get('codigo');
  if (paramCodigo && /^[A-Z0-9]{6}$/.test(paramCodigo.toUpperCase())) {
    inputCodigo.value = paramCodigo.toUpperCase();
    // Não submete sozinho — o aluno cego precisa de um gesture para o TTS
    // funcionar. Foca o botão de entrar para que Enter ou clique único basta.
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
  // Síntese de voz (Web Speech API).
  // Mantém uma fila FIFO para evitar atropelo quando duas falas
  // chegam em sequência; cada item é lido por completo.
  // ============================================================
  const SinteseVoz = (function () {
    const sintese = window.speechSynthesis;
    const suportado = !!sintese;
    const fila = [];
    let falando = false;
    let vozPtBR = null;
    let taxa = 1.0;

    function carregarVozes() {
      if (!suportado) return;
      const vozes = sintese.getVoices();
      // Procura a melhor voz PT-BR. Em geral nomes começam com "pt-BR"
      // ou "Microsoft Maria/Daniel" (Windows) ou "Luciana" (macOS).
      vozPtBR =
        vozes.find((v) => v.lang === 'pt-BR') ||
        vozes.find((v) => v.lang && v.lang.startsWith('pt')) ||
        null;
    }

    if (suportado) {
      carregarVozes();
      // Em alguns navegadores a lista de vozes carrega async.
      if (typeof sintese.onvoiceschanged !== 'undefined') {
        sintese.onvoiceschanged = carregarVozes;
      }
    }

    function falar(texto) {
      if (!suportado || !texto) return;
      console.log('[TTS] enfileirando:', texto.slice(0, 60) + (texto.length > 60 ? '…' : ''));
      fila.push(texto);
      if (!falando) processar();
    }

    function processar() {
      if (fila.length === 0) {
        falando = false;
        return;
      }
      falando = true;
      const texto = fila.shift();
      // Workaround bug conhecido do Chrome: speechSynthesis fica preso
      // após ~15s sem uso. Cancelar antes de speak destrava o engine.
      try { sintese.cancel(); } catch (e) {}
      const u = new SpeechSynthesisUtterance(texto);
      u.lang = 'pt-BR';
      u.rate = taxa;
      u.pitch = 1.0;
      u.volume = 1.0;
      if (vozPtBR) u.voice = vozPtBR;
      u.onstart = function () {
        console.log('[TTS] falando:', texto.slice(0, 60) + (texto.length > 60 ? '…' : ''));
      };
      u.onend = function () {
        console.log('[TTS] terminou (fila restante:', fila.length + ')');
        processar();
      };
      u.onerror = function (ev) {
        console.warn('[TTS] erro:', ev.error || ev);
        processar();
      };
      // O Chrome também tem bug onde speak silencia se chamado antes do
      // engine "acordar". setTimeout 0 dá um tick a mais.
      setTimeout(function () {
        sintese.speak(u);
      }, 0);
    }

    function pausar() { if (suportado) sintese.pause(); }
    function retomar() { if (suportado) sintese.resume(); }
    function limparFila() {
      fila.length = 0;
      if (suportado) sintese.cancel();
      falando = false;
    }
    function setTaxa(v) {
      taxa = v;
    }

    return {
      suportado,
      falar,
      pausar,
      retomar,
      limparFila,
      setTaxa
    };
  })();

  // ============================================================
  // Histórico navegável (últimas 10 falas). Atalhos:
  //   ↑/↓ = navega
  //   Enter = relê item selecionado
  //   Espaço = pausa/retoma TTS
  //   R = repete última fala
  //   M = muta/desmuta voz do professor
  //   1/2/3 = sinaliza dúvida/rápido/repetir
  // ============================================================
  const HIST_MAX = 10;
  const historicoFalas = []; // strings, índice 0 = mais antiga
  let indiceNavegacao = -1; // -1 = sem seleção
  let ultimaFala = '';

  function adicionarAoHistorico(texto) {
    historicoFalas.push(texto);
    while (historicoFalas.length > HIST_MAX) historicoFalas.shift();
    indiceNavegacao = -1;
  }

  function navegarHistorico(direcao) {
    if (historicoFalas.length === 0) {
      SinteseVoz.falar('Histórico vazio.');
      return;
    }
    if (indiceNavegacao === -1) {
      indiceNavegacao = historicoFalas.length - 1;
    } else {
      indiceNavegacao = Math.max(0, Math.min(historicoFalas.length - 1, indiceNavegacao + direcao));
    }
    const item = historicoFalas[indiceNavegacao];
    const numero = indiceNavegacao + 1;
    const total = historicoFalas.length;
    SinteseVoz.limparFila();
    SinteseVoz.falar(`Fala ${numero} de ${total}: ${item}`);
  }

  function relerSelecionado() {
    if (indiceNavegacao < 0 || indiceNavegacao >= historicoFalas.length) return;
    SinteseVoz.limparFila();
    SinteseVoz.falar(historicoFalas[indiceNavegacao]);
  }

  function atualizarLegenda(texto) {
    legenda.textContent = texto;
    legenda.classList.remove('legenda--vazia');
  }

  // ============================================================
  // Entrada na sala
  // ============================================================
  formEntrar.addEventListener('submit', (e) => {
    e.preventDefault();
    const codigo = inputCodigo.value.trim();
    if (codigo.length !== 6) {
      mostrarAviso('O código deve ter 6 caracteres.', true);
      return;
    }
    C.entrarSala(codigo, 'cego');
  });

  C.onEvento('entrada_confirmada', (data) => {
    secaoEntrar.classList.add('hidden');
    secaoAula.classList.remove('hidden');
    statusAula.textContent = `Conectado na sala ${data.codigo}. Aguardando o professor.`;
    aviso.classList.add('hidden');
    if (!SinteseVoz.suportado) {
      mostrarAviso('Seu navegador não suporta síntese de voz; o leitor de tela ainda funcionará.', true);
    } else {
      SinteseVoz.falar('Você entrou na sala ' + data.codigo + '. Aguardando o professor.');
      // Dica curta de acessibilidade na primeira entrada.
      SinteseVoz.falar('Pressione a tecla interrogação a qualquer momento para ouvir os atalhos disponíveis.');
    }
    // Se o professor já estava transmitindo voz, pede para receber.
    if (data.audioProfessorAtivo) {
      audioProfessorAtivo = true;
      atualizarStatusAudioProfessor();
      C.solicitarAudioProfessor();
    }
  });

  C.onEvento('fala_recebida', (data) => {
    atualizarLegenda(data.texto);
    ultimaFala = data.texto;
    adicionarAoHistorico(data.texto);
    if (deveLerFalasComTts()) {
      SinteseVoz.falar(data.texto);
    } else {
      console.log('[TTS] pulando fala (voz do professor ao vivo está ativa)');
    }
  });

  C.onEvento('imagem_recebida', (data) => {
    console.log('[Imagem recebida] legenda:', data.legenda || '(vazia)');

    // Exibe imagem (com alt) para o leitor de tela, mesmo que o aluno
    // cego não veja — o leitor também anunciará via alt.
    containerImagem.innerHTML = '';
    if (data.dataUrl) {
      const img = document.createElement('img');
      img.src = data.dataUrl;
      img.alt = data.legenda || 'Imagem enviada pelo professor';
      img.className = 'imagem-recebida';
      containerImagem.appendChild(img);
    }

    const temLegenda = !!(data.legenda && data.legenda.trim());
    const textoVisivel = temLegenda
      ? data.legenda
      : 'O professor enviou uma imagem, mas a descrição automática não foi gerada.';
    descricaoImagem.textContent = '📷 ' + textoVisivel;
    descricaoImagem.classList.remove('hidden');

    // Fala: anúncio + descrição em UMA ÚNICA utterance para evitar que
    // o engine do navegador encerre entre as duas e perca a descrição.
    if (temLegenda) {
      const textoFalado =
        'Professor enviou uma imagem. Audiodescrição: ' + data.legenda;
      SinteseVoz.falar(textoFalado);
      ultimaFala = textoFalado;
      adicionarAoHistorico(textoFalado);
    } else {
      SinteseVoz.falar('Professor enviou uma imagem, mas a descrição não foi gerada.');
    }
  });

  C.onEvento('sala_encerrada', () => {
    mostrarAviso('A aula foi encerrada pelo professor.', true);
    statusAula.textContent = 'Aula encerrada.';
    inputCodigo.disabled = true;
    SinteseVoz.limparFila();
    SinteseVoz.falar('A aula foi encerrada pelo professor.');
  });

  C.onEvento('erro', (data) => {
    if (data.motivo === 'SALA_NAO_ENCONTRADA') {
      mostrarAviso('Sala não encontrada. Verifique o código com o professor.', true);
    } else {
      mostrarAviso(`Erro: ${data.motivo}`, true);
    }
  });

  // ============================================================
  // Módulo 6 — recepção de áudio do professor via WebRTC.
  // O servidor faz signaling; o áudio em si flui P2P.
  // Quando ativo, pulamos o TTS sintético das falas (mas mantemos
  // o TTS para audiodescrições de imagens).
  // ============================================================
  let audioProfessorAtivo = false;
  // Mute local do aluno: silencia o áudio remoto SEM derrubar a conexão
  // (o professor continua transmitindo, só este aluno não ouve).
  let mutadoLocal = false;
  let pcProfessor = null;
  let socketIdProfessor = null;

  const RTC_CONFIG = { iceServers: [] };

  function atualizarStatusAudioProfessor() {
    if (audioProfessorAtivo && mutadoLocal) {
      statusAudioProfessor.textContent = '🔇 Você silenciou a voz do professor. Leitor de texto está ativo.';
      statusAudioProfessor.classList.remove('captacao__status--ativo');
    } else if (audioProfessorAtivo) {
      statusAudioProfessor.textContent = '🔴 Voz do professor ao vivo.';
      statusAudioProfessor.classList.add('captacao__status--ativo');
      statusAudioProfessor.classList.remove('captacao__status--erro');
    } else {
      statusAudioProfessor.textContent = 'Voz do professor desligada. Usando leitor de texto.';
      statusAudioProfessor.classList.remove('captacao__status--ativo');
    }
    // Botão só funciona quando há voz ao vivo do professor para silenciar.
    btnMutarProfessor.disabled = !audioProfessorAtivo;
    btnMutarProfessor.setAttribute('aria-pressed', mutadoLocal ? 'true' : 'false');
    btnMutarProfessorRotulo.textContent = mutadoLocal
      ? 'Voltar a ouvir o professor'
      : 'Silenciar voz do professor';
  }

  // Determina se o TTS sintético deve ler as falas do professor:
  // só quando a voz ao vivo NÃO está chegando para este aluno
  // (professor desligou OU este aluno silenciou).
  function deveLerFalasComTts() {
    return !audioProfessorAtivo || mutadoLocal;
  }

  async function tratarOfferProfessor(origem, offer) {
    socketIdProfessor = origem;
    // Fecha conexão anterior, se houver.
    if (pcProfessor) {
      try { pcProfessor.close(); } catch (e) {}
    }
    pcProfessor = new RTCPeerConnection(RTC_CONFIG);

    pcProfessor.ontrack = (ev) => {
      console.log('[WebRTC] track recebida do professor');
      audioProfessor.srcObject = ev.streams[0];
      // play() é necessário porque alguns navegadores bloqueiam autoplay
      // sem gesture; já tivemos um gesture (clicou para entrar na sala).
      audioProfessor.play().catch((e) => {
        console.warn('[WebRTC] autoplay bloqueado:', e.message);
        statusAudioProfessor.textContent =
          'Toque na tela para ativar o áudio do professor (política de autoplay).';
      });
    };

    pcProfessor.onicecandidate = (ev) => {
      if (ev.candidate) {
        C.enviarSinalWebRtc(socketIdProfessor, 'ice', ev.candidate);
      }
    };

    pcProfessor.onconnectionstatechange = () => {
      console.log('[WebRTC] conexão →', pcProfessor.connectionState);
    };

    try {
      await pcProfessor.setRemoteDescription(offer);
      const answer = await pcProfessor.createAnswer();
      await pcProfessor.setLocalDescription(answer);
      C.enviarSinalWebRtc(socketIdProfessor, 'answer', answer);
    } catch (e) {
      console.warn('[WebRTC] falha ao responder offer:', e);
    }
  }

  C.onEvento('webrtc_signal', async (data) => {
    if (!data) return;
    const { origem, tipo, dados } = data;
    if (tipo === 'offer') {
      return tratarOfferProfessor(origem, dados);
    }
    if (tipo === 'ice' && pcProfessor) {
      try { await pcProfessor.addIceCandidate(dados); } catch (e) {}
    }
  });

  C.onEvento('audio_professor_status', (data) => {
    audioProfessorAtivo = !!(data && data.ativo);
    atualizarStatusAudioProfessor();
    if (audioProfessorAtivo) {
      // Se o aluno não silenciou localmente, para o TTS — a voz real assumirá.
      if (!mutadoLocal) SinteseVoz.limparFila();
      // Solicita a oferta WebRTC ao professor (mesmo se mutado, mantemos a
      // conexão para que o aluno possa desmutar a qualquer momento).
      C.solicitarAudioProfessor();
    } else {
      // Professor desligou microfone — derruba conexão e volta ao TTS.
      if (pcProfessor) {
        try { pcProfessor.close(); } catch (e) {}
        pcProfessor = null;
      }
      audioProfessor.srcObject = null;
    }
  });

  btnMutarProfessor.addEventListener('click', () => {
    if (!audioProfessorAtivo) return;
    mutadoLocal = !mutadoLocal;
    // Silencia o <audio> sem derrubar a conexão WebRTC.
    audioProfessor.muted = mutadoLocal;
    atualizarStatusAudioProfessor();
    if (mutadoLocal) {
      // Avisa que volta a usar TTS, sem fala pendente para não atropelar.
      SinteseVoz.falar('Voz do professor silenciada. Leitor de texto ligado.');
    } else {
      // Volta a ouvir voz real → silencia TTS para evitar dupla narração.
      SinteseVoz.limparFila();
    }
  });

  // ============================================================
  // Controles de TTS
  // ============================================================
  btnRepetir.addEventListener('click', () => {
    if (!ultimaFala) {
      SinteseVoz.falar('Nenhuma fala para repetir ainda.');
      return;
    }
    SinteseVoz.falar(ultimaFala);
  });

  btnPausarTts.addEventListener('click', () => {
    SinteseVoz.pausar();
    btnPausarTts.disabled = true;
    btnRetomarTts.disabled = false;
  });

  btnRetomarTts.addEventListener('click', () => {
    SinteseVoz.retomar();
    btnPausarTts.disabled = false;
    btnRetomarTts.disabled = true;
  });

  inputVelocidade.addEventListener('input', () => {
    const v = parseFloat(inputVelocidade.value) || 1.0;
    SinteseVoz.setTaxa(v);
    valorVelocidade.textContent = v.toFixed(1);
  });

  // ============================================================
  // Sinalizar ao professor (levantar mão).
  // ============================================================
  const TEXTOS_SINAL = {
    duvida: 'Dúvida enviada ao professor.',
    rapido: 'Pedido de "está rápido" enviado ao professor.',
    repetir: 'Pedido de "pode repetir" enviado ao professor.'
  };
  const statusSinal = document.getElementById('status-sinal');
  document.querySelectorAll('.btn--sinal').forEach((btn) => {
    btn.addEventListener('click', () => {
      const tipo = btn.dataset.tipo;
      C.sinalizar(tipo);
      const msg = TEXTOS_SINAL[tipo] || 'Sinal enviado.';
      statusSinal.textContent = '✓ ' + msg;
      statusSinal.classList.add('captacao__status--ativo');
      // Confirma com voz curta sem atrapalhar o fluxo da aula.
      SinteseVoz.falar(msg);
      // Desabilita o botão por 4s para evitar spam.
      btn.disabled = true;
      setTimeout(() => { btn.disabled = false; }, 4000);
    });
  });

  C.onEvento('mao_atendida', () => {
    statusSinal.textContent = '✓ Professor reconheceu seu pedido.';
    statusSinal.classList.add('captacao__status--ativo');
    SinteseVoz.falar('Professor reconheceu seu pedido.');
  });

  // ============================================================
  // Atalhos de teclado globais (após entrar na sala).
  // ============================================================
  let atalhosAtivos = false;
  let ttsPausado = false;
  C.onEvento('entrada_confirmada', () => { atalhosAtivos = true; });

  function disparaSinalPorTipo(tipo) {
    const btn = document.querySelector('.btn--sinal[data-tipo="' + tipo + '"]');
    if (btn && !btn.disabled) btn.click();
  }

  window.addEventListener('keydown', (e) => {
    if (!atalhosAtivos) return;
    // Ignora atalhos quando o foco está em campo de texto (improvável aqui).
    const alvo = e.target;
    if (alvo && (alvo.tagName === 'INPUT' || alvo.tagName === 'TEXTAREA')) return;

    switch (e.key) {
      case 'ArrowUp':
        e.preventDefault();
        navegarHistorico(-1);
        break;
      case 'ArrowDown':
        e.preventDefault();
        navegarHistorico(1);
        break;
      case 'Enter':
        if (indiceNavegacao >= 0) { e.preventDefault(); relerSelecionado(); }
        break;
      case ' ':
        e.preventDefault();
        if (ttsPausado) { SinteseVoz.retomar(); ttsPausado = false; SinteseVoz.falar('Retomando.'); }
        else { SinteseVoz.pausar(); ttsPausado = true; }
        break;
      case 'r': case 'R':
        if (ultimaFala) { SinteseVoz.limparFila(); SinteseVoz.falar(ultimaFala); }
        break;
      case 'm': case 'M':
        if (audioProfessorAtivo) btnMutarProfessor.click();
        break;
      case '1':
        disparaSinalPorTipo('duvida');
        break;
      case '2':
        disparaSinalPorTipo('rapido');
        break;
      case '3':
        disparaSinalPorTipo('repetir');
        break;
      case '?':
        // Anuncia ajuda.
        SinteseVoz.limparFila();
        SinteseVoz.falar(
          'Atalhos disponíveis: setas para navegar no histórico. Enter para reler. ' +
          'Espaço pausa a voz. Letra R repete a última fala. Letra M silencia ou retoma a voz do professor. ' +
          'Teclas 1, 2 e 3 enviam dúvida, está rápido, ou pode repetir.'
        );
        break;
    }
  });
})();
