// ConectaInclusao - gerenciamento de salas em memoria (Modulo 2)
// Sem persistencia. Quando o professor sai, a sala morre.

const salas = new Map(); // codigo -> { professor: socketId, alunos: Map<socketId, perfil>, criadaEm }

const PERFIS_VALIDOS = ['surdo', 'cego'];
// Alfabeto sem caracteres ambíguos (I, O, 0, 1) para evitar erro de digitação.
const ALFABETO = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function gerarCodigo() {
  // 6 caracteres; tenta de novo se colidir com sala ativa
  let codigo;
  do {
    codigo = '';
    for (let i = 0; i < 6; i++) {
      codigo += ALFABETO[Math.floor(Math.random() * ALFABETO.length)];
    }
  } while (salas.has(codigo));
  return codigo;
}

function contagemPorPerfil(sala) {
  let surdos = 0;
  let cegos = 0;
  for (const perfil of sala.alunos.values()) {
    if (perfil === 'surdo') surdos++;
    else if (perfil === 'cego') cegos++;
  }
  return { surdos, cegos, total: sala.alunos.size };
}

function register(io) {
  io.on('connection', (socket) => {
    console.log(`[room] cliente conectado: ${socket.id}`);

    socket.on('criar_sala', () => {
      const codigo = gerarCodigo();
      const sala = {
        professor: socket.id,
        alunos: new Map(),
        criadaEm: Date.now()
      };
      salas.set(codigo, sala);
      socket.data.codigo = codigo;
      socket.data.papel = 'professor';
      socket.join(codigo);
      socket.emit('sala_criada', { codigo });
      console.log(`[room] sala criada: ${codigo} por ${socket.id}`);
    });

    socket.on('entrar_sala', (payload) => {
      const codigo = payload && payload.codigo ? String(payload.codigo).toUpperCase() : '';
      const perfil = payload && payload.perfil;

      const sala = salas.get(codigo);
      if (!sala) {
        socket.emit('erro', { motivo: 'SALA_NAO_ENCONTRADA' });
        return;
      }
      if (!PERFIS_VALIDOS.includes(perfil)) {
        socket.emit('erro', { motivo: 'PERFIL_INVALIDO' });
        return;
      }

      sala.alunos.set(socket.id, perfil);
      socket.data.codigo = codigo;
      socket.data.papel = 'aluno';
      socket.data.perfil = perfil;
      socket.join(codigo);

      const contagem = contagemPorPerfil(sala);
      socket.emit('entrada_confirmada', { codigo, perfil });
      io.to(codigo).emit('aluno_entrou', {
        perfil,
        total: contagem.total,
        surdos: contagem.surdos,
        cegos: contagem.cegos
      });
      console.log(`[room] aluno ${perfil} entrou em ${codigo} (total ${contagem.total})`);
    });

    socket.on('professor_falou', (payload) => {
      const codigo = socket.data.codigo;
      if (!codigo || socket.data.papel !== 'professor') return;
      const texto = payload && typeof payload.texto === 'string' ? payload.texto : '';
      if (!texto) return;
      io.to(codigo).emit('fala_recebida', { texto, timestamp: Date.now() });
    });

    socket.on('professor_enviou_imagem', (payload) => {
      const codigo = socket.data.codigo;
      if (!codigo || socket.data.papel !== 'professor') return;
      const dataUrl = payload && payload.dataUrl;
      if (!dataUrl) return;
      io.to(codigo).emit('imagem_recebida', {
        dataUrl,
        legenda: payload.legenda || '',
        timestamp: Date.now()
      });
    });

    // Encerramento explícito da sala pelo professor (sem desconectar o socket).
    socket.on('encerrar_sala', () => {
      const codigo = socket.data.codigo;
      if (!codigo || socket.data.papel !== 'professor') return;
      const sala = salas.get(codigo);
      if (!sala) return;
      io.to(codigo).emit('sala_encerrada', { motivo: 'PROFESSOR_ENCERROU' });
      salas.delete(codigo);
      // Limpa estado do socket do professor para evitar duplo encerramento no disconnect.
      socket.data.codigo = null;
      socket.leave(codigo);
      console.log(`[room] sala ${codigo} encerrada explicitamente pelo professor`);
    });

    socket.on('disconnect', (reason) => {
      const codigo = socket.data.codigo;
      const papel = socket.data.papel;
      if (!codigo) {
        console.log(`[room] desconectou sem sala: ${socket.id} (${reason})`);
        return;
      }
      const sala = salas.get(codigo);
      if (!sala) return;

      if (papel === 'professor') {
        io.to(codigo).emit('sala_encerrada', { motivo: 'PROFESSOR_SAIU' });
        salas.delete(codigo);
        console.log(`[room] sala ${codigo} encerrada (professor saiu)`);
      } else if (papel === 'aluno') {
        const perfil = sala.alunos.get(socket.id);
        sala.alunos.delete(socket.id);
        const contagem = contagemPorPerfil(sala);
        io.to(codigo).emit('aluno_saiu', {
          perfil,
          total: contagem.total,
          surdos: contagem.surdos,
          cegos: contagem.cegos
        });
        console.log(`[room] aluno saiu de ${codigo} (total ${contagem.total})`);
      }
    });
  });
}

module.exports = { register };
