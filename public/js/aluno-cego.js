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

  inputCodigo.addEventListener('input', () => {
    inputCodigo.value = inputCodigo.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
  });

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
  // Estado para "repetir última fala"
  // ============================================================
  let ultimaFala = '';

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
      // Frase inicial para confirmar que o áudio está saindo.
      SinteseVoz.falar('Você entrou na sala ' + data.codigo + '. Aguardando o professor.');
    }
  });

  C.onEvento('fala_recebida', (data) => {
    atualizarLegenda(data.texto);
    ultimaFala = data.texto;
    SinteseVoz.falar(data.texto);
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
      // Guardar a descrição como última fala para o botão "Repetir".
      ultimaFala = textoFalado;
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
})();
