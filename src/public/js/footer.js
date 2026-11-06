/**
 * Barra de status (rodapé) de todas as telas:
 * situação do banco, usuário logado, data/hora e botão de tema.
 * No HTML basta: <footer class="statusbar"></footer>
 * (carregar depois de icones.js)
 */

(function () {
  // Esconde o que o perfil não pode usar (o main também bloqueia essas ações;
  // esconder é só conveniência). Vale para todas as telas.
  api.receiveSession((event, usuario) => {
    if (!usuario) return
    document.querySelectorAll('[data-permissao]').forEach((el) => {
      if (!usuario.permissoes.includes(el.dataset.permissao)) el.style.display = 'none'
    })
    // Títulos de grupo da barra lateral que ficaram sem nenhum item visível
    document.querySelectorAll('.lateral-grupo').forEach((titulo) => {
      let item = titulo.nextElementSibling
      let temVisivel = false
      while (item && !item.classList.contains('lateral-grupo')) {
        if (item.style.display !== 'none') temVisivel = true
        item = item.nextElementSibling
      }
      if (!temVisivel) titulo.style.display = 'none'
    })
  })

  const barra = document.querySelector('footer.statusbar')
  if (!barra) {
    api.getSession()
    return
  }

  barra.innerHTML = `
    <span class="status-banco" id="statusBanco" data-estado="conectando">Conectando ao banco...</span>
    <span class="status-usuario" id="footerUsuario" hidden></span>
    <span class="espacador"></span>
    <span id="footerRealTime" class="numero"></span>
    <button type="button" id="btnTema" class="btn btn-fantasma btn-icone"></button>`

  // Data e hora (sem segundos: atualiza a cada 15 s)
  const relogio = document.getElementById('footerRealTime')
  const atualizarRelogio = () => {
    const agora = new Date()
    const data = agora.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
    const hora = agora.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    relogio.textContent = `${data.charAt(0).toUpperCase() + data.slice(1)} · ${hora}`
  }
  atualizarRelogio()
  setInterval(atualizarRelogio, 15000)

  // Botão de tema: mostra o ícone do tema para o qual vai trocar
  const btnTema = document.getElementById('btnTema')
  const desenharBotaoTema = (tema) => {
    const escuro = tema === 'escuro'
    btnTema.innerHTML = icone(escuro ? 'sol' : 'lua', 16)
    btnTema.title = escuro ? 'Usar tema claro (Ctrl+T)' : 'Usar tema escuro (Ctrl+T)'
  }
  desenharBotaoTema(api.getTheme())
  api.onThemeChanged(desenharBotaoTema)
  btnTema.addEventListener('click', () => api.toggleTheme())

  // Situação da conexão com o banco
  const statusBanco = document.getElementById('statusBanco')
  api.dbStatus((event, status) => {
    statusBanco.dataset.estado = status
    statusBanco.textContent = status === 'conectado' ? 'Banco conectado' : 'Sem conexão com o banco'
  })

  // Usuário logado
  api.receiveSession((event, usuario) => {
    if (!usuario) return
    const p = document.getElementById('footerUsuario')
    p.hidden = false
    p.innerHTML = icone('usuario', 14)
    p.append(` ${usuario.nome} · ${usuario.perfil}`)
  })
  api.getSession()
})()
