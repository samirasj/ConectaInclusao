// ConectaInclusao - logica do painel do professor (Modulos 2 + 3)

(function () {
  const C = window.ConectaSocket;

  const formAula = document.getElementById('form-aula');
  const btnCriar = document.getElementById('btn-criar');
  const secaoSala = document.getElementById('secao-sala');
  const secaoCaptacao = document.getElementById('secao-captacao');
  const secaoFala = document.getElementById('secao-fala');
  const secaoEncerrar = document.getElementById('secao-encerrar');
  const codigoEl = document.getElementById('codigo-sala');
  const contagemSurdos = document.getElementById('contagem-surdos');
  const contagemCegos = document.getElementById('contagem-cegos');
  const formFala = document.getElementById('form-fala');
  const textoFala = document.getElementById('texto-fala');
  const btnEncerrar = document.getElementById('btn-encerrar');
  const aviso = document.getElementById('aviso');

  const btnCaptacao = document.getElementById('btn-captacao');
  const btnCaptacaoRotulo = document.getElementById('btn-captacao-rotulo');
  const captacaoStatus = document.getElementById('captacao-status');
  const captacaoPrevia = document.getElementById('captacao-previa');

  // ---------- Elementos do Módulo 5 (imagem + audiodescrição) ----------
  const secaoImagem = document.getElementById('secao-imagem');
  const inputImagem = document.getElementById('input-imagem');
  const rotuloInputImagem = document.getElementById('rotulo-input-imagem');
  const previewWrapper = document.getElementById('preview-imagem-wrapper');
  const previewImagem = document.getElementById('preview-imagem');
  const statusImagem = document.getElementById('status-imagem');
  const legendaImagem = document.getElementById('legenda-imagem');
  const labelLegendaImagem = document.getElementById('label-legenda-imagem');
  const botoesImagem = document.getElementById('botoes-imagem');
  const btnDescreverNovamente = document.getElementById('btn-descrever-novamente');
  const btnEnviarImagem = document.getElementById('btn-enviar-imagem');

  function mostrarAviso(msg, erro) {
    aviso.textContent = msg;
    aviso.classList.remove('hidden', 'aviso--erro');
    if (erro) aviso.classList.add('aviso--erro');
  }

  // ============================================================
  // CaptacaoFala - encapsula Web Speech API (Modulo 3)
  // ============================================================
  const CaptacaoFala = (function () {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    const suportado = !!SR;

    let recognition = null;
    let ativo = false;        // usuário pediu para ficar ouvindo
    let rodando = false;      // estado interno do objeto recognition
    let onStatus = function () {};
    let onPrevia = function () {};
    let onFinal = function () {};
    let reinicioTimer = null;
    let tentativasNetwork = 0;       // tentativas consecutivas de reconexão por 'network'
    let ultimoErro = null;           // último erro recebido, usado para backoff no onend
    const MAX_TENTATIVAS_NETWORK = 5; // desiste após 5 falhas seguidas de rede

    function criar() {
      const r = new SR();
      r.lang = 'pt-BR';
      r.continuous = true;
      r.interimResults = true;
      r.maxAlternatives = 1;

      r.onstart = function () {
        rodando = true;
        onStatus('Ouvindo...', 'ativo');
      };

      r.onresult = function (event) {
        // Reset do contador: STT funcionou, então a rede está OK.
        tentativasNetwork = 0;
        let interim = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const res = event.results[i];
          const transcript = res[0] && res[0].transcript ? res[0].transcript : '';
          if (res.isFinal) {
            const texto = transcript.trim();
            if (texto) onFinal(texto);
          } else {
            interim += transcript;
          }
        }
        onPrevia(interim.trim());
      };

      r.onerror = function (event) {
        const erro = event.error || 'desconhecido';
        ultimoErro = erro;

        if (erro === 'no-speech' || erro === 'aborted') {
          // transitório silencioso: deixa o onend reiniciar sem alarde
          return;
        }
        if (erro === 'network') {
          tentativasNetwork++;
          if (tentativasNetwork >= MAX_TENTATIVAS_NETWORK) {
            ativo = false;
            onStatus(
              'Sem acesso ao serviço de voz do Chrome. Verifique sua internet e tente novamente.',
              'erro'
            );
            return;
          }
          onStatus(
            'Instabilidade de rede (tentativa ' + tentativasNetwork + '/' + MAX_TENTATIVAS_NETWORK + ')...',
            'reconectando'
          );
          return;
        }
        if (erro === 'not-allowed' || erro === 'service-not-allowed') {
          ativo = false;
          onStatus('Permissão de microfone negada.', 'erro');
          return;
        }
        ativo = false;
        onStatus('Erro: ' + erro, 'erro');
      };

      r.onend = function () {
        rodando = false;
        onPrevia('');
        if (!ativo) {
          onStatus('Pausado.', 'pausado');
          return;
        }
        // Backoff progressivo apenas para erros de rede; demais reiniciam rápido.
        const delay = ultimoErro === 'network'
          ? Math.min(500 * Math.pow(2, tentativasNetwork - 1), 8000)
          : 500;
        ultimoErro = null;
        if (reinicioTimer) clearTimeout(reinicioTimer);
        reinicioTimer = setTimeout(function () {
          if (ativo && !rodando) {
            try {
              recognition.start();
            } catch (e) {
              // start() pode falhar se já estiver rodando; ignora.
            }
          }
        }, delay);
      };

      return r;
    }

    function iniciar() {
      if (!suportado) return false;
      if (!recognition) recognition = criar();
      ativo = true;
      tentativasNetwork = 0;   // reset ao iniciar manualmente
      ultimoErro = null;
      try {
        recognition.start();
      } catch (e) {
        // Já estava rodando; ok.
      }
      return true;
    }

    function pausar() {
      ativo = false;
      if (reinicioTimer) {
        clearTimeout(reinicioTimer);
        reinicioTimer = null;
      }
      if (recognition && rodando) {
        try { recognition.stop(); } catch (e) {}
      }
      onStatus('Pausado.', 'pausado');
      onPrevia('');
    }

    return {
      suportado: suportado,
      estaAtivo: function () { return ativo; },
      iniciar: iniciar,
      pausar: pausar,
      onStatus: function (cb) { onStatus = cb; },
      onPrevia: function (cb) { onPrevia = cb; },
      onFinal: function (cb) { onFinal = cb; }
    };
  })();

  // ---------- UI da captação ----------
  function setStatusCaptacao(msg, tipo) {
    captacaoStatus.textContent = msg;
    captacaoStatus.classList.remove(
      'captacao__status--ativo',
      'captacao__status--pausado',
      'captacao__status--erro',
      'captacao__status--reconectando'
    );
    if (tipo) captacaoStatus.classList.add('captacao__status--' + tipo);
  }

  function atualizarBotaoCaptacao(ativo) {
    btnCaptacao.setAttribute('aria-pressed', ativo ? 'true' : 'false');
    btnCaptacao.classList.toggle('btn--captacao-ativa', ativo);
    btnCaptacaoRotulo.textContent = ativo ? '⏸ Pausar captação' : 'Iniciar captação';
  }

  CaptacaoFala.onStatus(function (msg, tipo) {
    setStatusCaptacao(msg, tipo);
    atualizarBotaoCaptacao(CaptacaoFala.estaAtivo());
  });

  CaptacaoFala.onPrevia(function (texto) {
    captacaoPrevia.textContent = texto || '';
  });

  CaptacaoFala.onFinal(function (texto) {
    C.enviarFala(texto);
  });

  if (!CaptacaoFala.suportado) {
    btnCaptacao.disabled = true;
    setStatusCaptacao(
      'Seu navegador não suporta reconhecimento de voz. Use Chrome ou Edge.',
      'erro'
    );
  }

  btnCaptacao.addEventListener('click', function () {
    if (!CaptacaoFala.suportado) return;
    if (CaptacaoFala.estaAtivo()) {
      CaptacaoFala.pausar();
    } else {
      CaptacaoFala.iniciar();
    }
    atualizarBotaoCaptacao(CaptacaoFala.estaAtivo());
  });

  // ---------- Resto do fluxo (Modulo 2) ----------
  formAula.addEventListener('submit', (e) => {
    e.preventDefault();
    btnCriar.disabled = true;
    C.criarSala();
  });

  formFala.addEventListener('submit', (e) => {
    e.preventDefault();
    const texto = textoFala.value.trim();
    if (!texto) return;
    C.enviarFala(texto);
    textoFala.value = '';
  });

  btnEncerrar.addEventListener('click', () => {
    if (CaptacaoFala.estaAtivo()) CaptacaoFala.pausar();
    // Encerra a sala via evento explícito (mantém o socket vivo).
    C.encerrarSala();
    mostrarAviso('Aula encerrada. Recarregue a página para criar outra sala.');
    secaoCaptacao.classList.add('hidden');
    secaoFala.classList.add('hidden');
    secaoEncerrar.classList.add('hidden');
  });

  C.onEvento('sala_criada', (data) => {
    codigoEl.textContent = data.codigo;
    secaoSala.classList.remove('hidden');
    secaoCaptacao.classList.remove('hidden');
    secaoFala.classList.remove('hidden');
    secaoImagem.classList.remove('hidden');
    secaoEncerrar.classList.remove('hidden');
    formAula.classList.add('hidden');
  });

  // ============================================================
  // Módulo 5 — upload de imagem + audiodescrição via Gemini
  // ============================================================

  // Redimensiona a imagem antes de enviar para reduzir payload.
  // Máximo 1280px (lado maior) e JPEG qualidade 0.85 cobrem audiodescrição
  // sem perder detalhes relevantes e mantêm a request bem abaixo de 1MB.
  function redimensionarImagem(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = function (e) {
        const img = new Image();
        img.onload = function () {
          const MAX = 1280;
          let { width, height } = img;
          if (width > MAX || height > MAX) {
            if (width >= height) {
              height = Math.round((height * MAX) / width);
              width = MAX;
            } else {
              width = Math.round((width * MAX) / height);
              height = MAX;
            }
          }
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);
          // JPEG é menor que PNG para fotos; Gemini aceita os dois.
          const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
          resolve(dataUrl);
        };
        img.onerror = () => reject(new Error('Imagem inválida.'));
        img.src = e.target.result;
      };
      reader.onerror = () => reject(new Error('Falha ao ler o arquivo.'));
      reader.readAsDataURL(file);
    });
  }

  let dataUrlAtual = null;

  async function descreverImagem(dataUrl) {
    statusImagem.textContent = '⏳ Gerando descrição da imagem...';
    statusImagem.classList.remove('captacao__status--erro', 'captacao__status--ativo');
    botoesImagem.classList.add('hidden');
    legendaImagem.classList.add('hidden');
    labelLegendaImagem.classList.add('hidden');
    try {
      const resp = await fetch('/api/descrever-imagem', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dataUrl })
      });
      const dados = await resp.json().catch(() => ({}));
      if (!resp.ok) {
        throw new Error(dados.erro || `HTTP ${resp.status}`);
      }
      if (!dados.legenda) {
        throw new Error('resposta sem legenda');
      }
      legendaImagem.value = dados.legenda;
      legendaImagem.classList.remove('hidden');
      labelLegendaImagem.classList.remove('hidden');
      botoesImagem.classList.remove('hidden');
      statusImagem.textContent = '✓ Descrição pronta. Você pode editar antes de enviar.';
      statusImagem.classList.add('captacao__status--ativo');
    } catch (e) {
      statusImagem.textContent = 'Erro ao gerar descrição: ' + e.message;
      statusImagem.classList.add('captacao__status--erro');
      // Mesmo com erro, permite enviar imagem sem legenda automática.
      legendaImagem.value = '';
      legendaImagem.classList.remove('hidden');
      labelLegendaImagem.classList.remove('hidden');
      botoesImagem.classList.remove('hidden');
    }
  }

  inputImagem.addEventListener('change', async (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      statusImagem.textContent = 'Arquivo selecionado não é uma imagem.';
      statusImagem.classList.add('captacao__status--erro');
      return;
    }
    rotuloInputImagem.textContent = file.name;
    try {
      const dataUrl = await redimensionarImagem(file);
      dataUrlAtual = dataUrl;
      previewImagem.src = dataUrl;
      previewWrapper.classList.remove('hidden');
      await descreverImagem(dataUrl);
    } catch (err) {
      statusImagem.textContent = 'Erro ao processar imagem: ' + err.message;
      statusImagem.classList.add('captacao__status--erro');
    }
  });

  btnDescreverNovamente.addEventListener('click', () => {
    if (dataUrlAtual) descreverImagem(dataUrlAtual);
  });

  btnEnviarImagem.addEventListener('click', () => {
    if (!dataUrlAtual) {
      statusImagem.textContent = 'Selecione uma imagem antes.';
      statusImagem.classList.add('captacao__status--erro');
      return;
    }
    const legenda = legendaImagem.value.trim();
    C.enviarImagem(dataUrlAtual, legenda);
    statusImagem.textContent = '✓ Imagem enviada para a turma.';
    statusImagem.classList.remove('captacao__status--erro');
    statusImagem.classList.add('captacao__status--ativo');
  });

  C.onEvento('aluno_entrou', (data) => {
    contagemSurdos.textContent = data.surdos;
    contagemCegos.textContent = data.cegos;
    mostrarAviso(`Um aluno ${data.perfil} entrou. Total: ${data.total}.`);
  });

  C.onEvento('aluno_saiu', (data) => {
    contagemSurdos.textContent = data.surdos;
    contagemCegos.textContent = data.cegos;
    mostrarAviso(`Um aluno ${data.perfil || ''} saiu. Total: ${data.total}.`);
  });
})();
