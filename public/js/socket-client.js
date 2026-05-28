// ConectaInclusao - wrapper Socket.IO compartilhado pelos 3 perfis (Modulo 2)

(function () {
  const socket = window.io();

  function criarSala() {
    socket.emit('criar_sala');
  }

  function entrarSala(codigo, perfil) {
    socket.emit('entrar_sala', { codigo: String(codigo).toUpperCase(), perfil });
  }

  function enviarFala(texto) {
    socket.emit('professor_falou', { texto });
  }

  function enviarImagem(dataUrl, legenda) {
    socket.emit('professor_enviou_imagem', { dataUrl, legenda: legenda || '' });
  }

  function encerrarSala() {
    socket.emit('encerrar_sala');
  }

  function onEvento(nome, callback) {
    socket.on(nome, callback);
  }

  window.ConectaSocket = {
    socket,
    criarSala,
    entrarSala,
    enviarFala,
    enviarImagem,
    encerrarSala,
    onEvento
  };
})();
