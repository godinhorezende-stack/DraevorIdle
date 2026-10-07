// As telas de OPERAÇÃO da Engine: "Testes e beta" (modo beta), "Configurações" (manutenção e Server Save) e "Servidor" (quem está online, com IP, e o reinício). São controles do SERVIDOR em
// execução, não editores de arquivo: o estado do modo beta e da manutenção é do processo (volta ao padrão no reinício) e toda ação de risco
// pede confirmação e fica no registro. Os dados e as regras vêm de `admin/operacao.mjs` (`operacao`, `operacao/beta`, `operacao/…`).
import { el, cabecalho, confirmar, msg } from './editor-ui.mjs';

const quando = (ms) => (ms ? new Date(ms).toLocaleString('pt-BR') : '—');
const secao = (titulo, ...filhos) => el('section', { class: 'hunt-sec' }, el('h3', {}, titulo), ...filhos);
const metrica = (rotulo, valor, dica = null) => el('div', { class: 'eng-metrica', title: dica ?? '' }, el('span', {}, rotulo), el('b', {}, valor ?? '—'));
const estadoPill = (ligado, textoLigado, textoDesligado) => el('span', { class: `selo ${ligado ? 'aviso' : 'ok'}`, style: 'font-size:13px;padding:3px 12px' }, ligado ? textoLigado : textoDesligado);
const lista = (itens) => el('ul', { class: 'op-lista' }, itens.map((t) => el('li', {}, t)));

export function criarTelasDeOperacao({ api, raiz, irPara }) {
  // ------------------------------------------------------------------ Testes e beta
  const B = { estado: null };
  async function desenharBeta() {
    B.estado = await api('operacao/beta');
    pintarBeta();
  }
  async function alternarBeta() {
    const ligar = !B.estado.ativo;
    const ok = await confirmar(ligar ? 'Ligar o modo beta?' : 'Desligar o modo beta?', ligar
      ? 'Vale para TODOS os jogadores do servidor, na hora: VIP/Instance/Divine sem premium e bosses sem level, task nem recarga. O que for ganho entra na economia real.'
      : 'Volta o acesso normal (premium, pergaminho, level, recarga) para todos, na hora. Nada foi gravado nos personagens. Atos em "beta" deixam de valer.', { ok: ligar ? 'Ligar para todos' : 'Desligar', perigo: ligar });
    if (!ok) return;
    const r = await api('operacao/beta', { ativo: ligar });
    if (r.ok === false) return msg((r.erros ?? ['Não alterou.']).join(' '), 'erro');
    msg(`Modo beta ${r.ativo ? 'ligado' : 'desligado'}${r.ativo === B.estado.padraoDoBoot ? '' : ' — volta ao padrão do boot no próximo reinício'}.`, 'ok');
    await desenharBeta();
  }
  function pintarBeta() {
    const e = B.estado;
    raiz().replaceChildren(
      cabecalho('Testes e beta', 'O interruptor do modo beta do servidor: acesso livre a hunts VIP/Instance/Divine e a bosses para testar conteúdo. É um controle do servidor em execução — não edita arquivos.'),
      el('div', { class: 'hunt-painel' },
        secao('Estado do modo beta',
          el('div', { class: 'op-linha' }, estadoPill(e.ativo, 'LIGADO para todos os jogadores', 'Desligado'), el('button', { type: 'button', class: e.ativo ? '' : 'primario', onclick: alternarBeta }, e.ativo ? 'Desligar o modo beta' : 'Ligar o modo beta')),
          el('div', { class: 'dica' }, `Padrão ao iniciar o servidor: ${e.padraoDoBoot ? 'ligado' : 'desligado'} (${e.origemDoPadrao}). Mudar aqui vale até o próximo reinício; para mudar o padrão, edite gamedata/modo-beta.json ou use MODO_BETA=0|1 no ambiente e faça o deploy.`)),
        secao('O que o beta libera', lista(e.libera)),
        secao('O que NÃO muda', lista(e.naoMuda)),
        secao('Alcance', el('div', { class: 'eng-metricas' }, metrica('Hunts VIP', e.alcance.vips), metrica('Hunts especiais (Instance)', e.alcance.especiais), metrica('Hunts divinas', e.alcance.divinas), metrica('Bosses', e.alcance.bosses))),
        secao('Atos do editor carregados neste servidor',
          e.atosDoEditor.length
            ? el('table', {}, el('thead', {}, el('tr', {}, ['Ato', 'Nº no jogo', 'Estado', 'Fases', 'Vale agora?'].map((h) => el('th', {}, h)))), el('tbody', {}, e.atosDoEditor.map((a) => el('tr', {}, el('td', {}, `${a.nome} (${a.id})`), el('td', {}, a.numero), el('td', {}, el('span', { class: 'selo' }, a.estado)), el('td', {}, a.fases), el('td', {}, el('span', { class: `selo ${a.valeAgora ? 'ok' : 'aviso'}` }, a.valeAgora ? 'sim' : a.estado === 'beta' ? 'não — só com o beta ligado' : 'não'))))))
            : el('div', { class: 'dica' }, 'Nenhum ato do editor foi carregado neste boot. Um ato só vale depois de salvo como beta/publicado, commitado e publicado (deploy + reinício).'),
          irPara ? el('button', { type: 'button', onclick: () => irPara('atos') }, 'Abrir Acts e campanhas') : null),
        el('div', { class: 'dica' }, 'Hoje esta tela é protegida só pelo bloqueio de rede do servidor (túnel SSH). O login de administrador entra numa etapa seguinte.')));
  }

  // ------------------------------------------------------------------ Configurações
  const C = { estado: null, mensagem: '', auditoria: [] };
  async function desenharConfig() {
    C.estado = await api('operacao');
    C.auditoria = (await api('auditoria?limite=60')).eventos ?? [];
    C.mensagem = C.estado.manutencao.mensagem;
    pintarConfig();
  }
  async function alternarManutencao() {
    const ligar = !C.estado.manutencao.ativa;
    const texto = C.mensagem.trim();
    if (texto.length > C.estado.manutencao.maxMensagem) return msg(`A mensagem tem até ${C.estado.manutencao.maxMensagem} caracteres.`, 'erro');
    const ok = await confirmar(ligar ? 'Ligar o modo de manutenção?' : 'Desligar o modo de manutenção?', ligar
      ? 'Bloqueia ENTRADAS novas no jogo, com a mensagem abaixo. Quem já está jogando continua; caçadas offline seguem correndo. Nada de caçada, XP, loot ou recompensa é tocado.'
      : 'Libera as entradas novas de novo.', { ok: ligar ? 'Ligar manutenção' : 'Desligar', perigo: ligar });
    if (!ok) return;
    const r = await api('operacao/manutencao', { ativo: ligar, mensagem: texto || null });
    if (r.ok === false) return msg((r.erros ?? ['Não alterou.']).join(' '), 'erro');
    msg(`Manutenção ${r.ativa ? 'ligada' : 'desligada'}.`, 'ok');
    await desenharConfig();
  }
  async function executarSave() {
    const ok = await confirmar('Executar o Server Save agora?', 'Roda a rotina de salvamento já, sem mexer na agenda. Os jogadores conectados recebem o aviso global do Server Save. O offline farm é preservado.', { ok: 'Executar agora' });
    if (!ok) return;
    msg('Executando o Server Save…', 'aviso');
    const r = await api('operacao/server-save', {});
    if (r?.ok === false) return msg((r.erros ?? ['Falhou.']).join(' '), 'erro');
    msg('Server Save executado.', 'ok');
    await desenharConfig();
  }
  function pintarConfig() {
    const e = C.estado;
    const ss = e.serverSave;
    const cfg = ss.situacao?.config;
    raiz().replaceChildren(
      cabecalho('Configurações', 'Controles do servidor em execução: manutenção e Server Save. Os valores do Server Save vêm do código e das variáveis de ambiente (SERVER_SAVE_*) — aqui só se consulta e se dispara a execução manual.'),
      el('div', { class: 'hunt-painel' },
        secao('Modo de manutenção',
          el('div', { class: 'op-linha' }, estadoPill(e.manutencao.ativa, 'MANUTENÇÃO LIGADA — entradas bloqueadas', 'Desligado'), el('button', { type: 'button', class: e.manutencao.ativa ? 'primario' : 'perigo', onclick: alternarManutencao }, e.manutencao.ativa ? 'Desligar manutenção' : 'Ligar manutenção')),
          el('label', { class: 'campo' }, `Mensagem mostrada a quem tenta entrar (até ${e.manutencao.maxMensagem} caracteres)`, el('textarea', { rows: 3, maxlength: e.manutencao.maxMensagem, oninput: (ev) => { C.mensagem = ev.target.value; } }, C.mensagem)),
          el('div', { class: 'dica' }, 'Volta ao padrão no reinício do servidor (a variável SERVER_SAVE_MAINTENANCE_MODE define o padrão).')),
        secao('Server Save',
          ss.rodando
            ? [el('div', { class: 'eng-metricas' }, metrica('Situação', ss.situacao.rodando ? 'rodando agora' : 'aguardando'), metrica('Próximo horário', quando(ss.proximoSlot), `${cfg.horaLocal} em ${cfg.timezone}`), metrica('Último ciclo', quando(ss.situacao.ultimo)), metrica('Processo', ss.processo)),
              el('table', { class: 'bib-sub' }, el('tbody', {}, [['Ativo', cfg.enabled ? 'sim' : 'não'], ['Intervalo', `${cfg.intervalHours} h`], ['Horário local', `${cfg.horaLocal} (${cfg.timezone})`], ['Avisos antes (min)', (cfg.warningsMinutes ?? []).join(', ')], ['Lote', cfg.batchSize]].map(([k, v]) => el('tr', {}, el('th', {}, k), el('td', {}, String(v)))))),
              el('div', { class: 'op-linha' }, el('button', { type: 'button', onclick: executarSave, disabled: !!ss.situacao.rodando }, 'Executar agora'), el('span', { class: 'dica' }, 'Roda já, sem mexer na agenda; os jogadores recebem o aviso global.'))]
            : el('div', { class: 'dica' }, 'O Server Save não está rodando neste processo (acontece quando o servidor roda sem banco de produção ou o recurso está desligado).'),
          ss.ciclos.length ? el('table', {}, el('thead', {}, el('tr', {}, ['Slot', 'Estado', 'Líder', 'Iniciado', 'Concluído', 'Resultado'].map((h) => el('th', {}, h)))), el('tbody', {}, ss.ciclos.map((c) => el('tr', {}, el('td', {}, quando(c.slot)), el('td', {}, el('span', { class: `selo ${c.estado === 'concluido' ? 'ok' : c.estado === 'falhou' ? 'erro' : ''}` }, c.estado)), el('td', {}, c.lider ?? '—'), el('td', {}, quando(c.iniciado_em)), el('td', {}, quando(c.concluido_em)), el('td', { class: 'dica' }, c.resultado ? String(c.resultado).slice(0, 80) : '—'))))) : null),
        secao('Registro de alterações administrativas',
          el('div', { class: 'dica' }, 'Cada login, gravação, operação e tentativa recusada fica registrado de forma permanente (quem, quando, de onde, o quê e o resultado). Não guarda o conteúdo editado nem senhas.'),
          C.auditoria.length ? el('table', {}, el('thead', {}, el('tr', {}, ['Quando', 'Quem', 'Tipo', 'O quê', 'Resultado'].map((h) => el('th', {}, h)))),
            el('tbody', {}, C.auditoria.map((a) => el('tr', {}, el('td', { class: 'dica' }, quando(a.quando)), el('td', {}, a.quem ?? '—'), el('td', {}, el('span', { class: `selo ${a.tipo === 'recusado' || a.tipo === 'login-falha' ? 'erro' : ''}` }, a.tipo)), el('td', {}, [a.rota, a.resumo?.acao, a.resumo?.key ?? a.resumo?.id].filter(Boolean).join(' · ') || a.motivo || '—'), el('td', {}, a.ok === false ? el('span', { class: 'selo erro' }, 'falhou') : a.codigo ? el('span', { class: 'selo aviso' }, a.codigo) : el('span', { class: 'selo ok' }, 'ok')))))) : el('div', { class: 'dica' }, 'Nenhum evento registrado ainda.')),
        secao('Ações desta sessão do servidor', e.registro.length ? el('table', { class: 'bib-sub' }, el('tbody', {}, e.registro.map((r) => el('tr', {}, el('td', { class: 'dica' }, quando(r.quando)), el('td', {}, r.acao), el('td', {}, r.detalhe))))) : el('div', { class: 'dica' }, 'Nenhuma ação de operação desde o último boot.')),
        el('div', { class: 'dica' }, 'Protegido hoje só pelo bloqueio de rede (túnel SSH). O login de administrador e o registro permanente de ações entram numa etapa seguinte.')));
  }

  // ------------------------------------------------------------------ Servidor (quem está online e o reinício)
  const V = { estado: null, relogio: null, motivo: '' };
  const duracao = (ms) => {
    const s = Math.max(0, Math.round(ms / 1000));
    if (s < 60) return `${s} s`;
    const m = Math.floor(s / 60);
    if (m < 60) return `${m} min`;
    const h = Math.floor(m / 60);
    return h < 48 ? `${h} h ${m % 60} min` : `${Math.floor(h / 24)} d ${h % 24} h`;
  };
  async function desenharServidor() {
    V.estado = await api('operacao/servidor');
    pintarServidor();
    // A tela se atualiza sozinha enquanto está aberta (a cada 5 s); sai da tela, para.
    clearInterval(V.relogio);
    V.relogio = setInterval(async () => {
      if (!document.querySelector('.op-servidor')) return clearInterval(V.relogio);
      V.estado = await api('operacao/servidor').catch(() => V.estado);
      pintarServidor();
    }, 5000);
  }
  async function reiniciar() {
    const e = V.estado;
    const ok = await confirmar('Reiniciar o servidor agora?', `${e.totais.personagens} personagem(ns) e ${e.totais.contas} conta(s) online recebem o aviso, todo mundo é gravado e o processo sai em 5 segundos. ${e.processo.supervisionado ? 'O Docker sobe o servidor de novo sozinho (restart: unless-stopped); a Engine fica fora do ar por alguns segundos.' : 'ATENÇÃO: este processo não parece supervisionado (não é produção/Docker): ele só PARA — alguém precisa subir de novo.'}`, { ok: 'Reiniciar', perigo: true });
    if (!ok) return;
    const r = await api('operacao/reiniciar', { motivo: V.motivo.trim() || null });
    if (r.ok === false) return msg((r.erros ?? ['Não reiniciou.']).join(' '), 'erro');
    msg(`Reinício agendado: ${r.avisados} jogador(es) avisado(s). O servidor sai em instantes.`, 'aviso');
    await desenharServidor();
  }
  function pintarServidor() {
    const e = V.estado;
    const t = e.totais;
    raiz().replaceChildren(
      cabecalho('Servidor', 'Quem está online agora (contas, personagens e de onde conectam) e o reinício do processo. Atualiza sozinho a cada 5 segundos.'),
      el('div', { class: 'hunt-painel op-servidor' },
        secao('Agora',
          el('div', { class: 'eng-metricas' }, metrica('Contas online', t.contas, 'contas logadas (a mesma conta em duas abas conta uma)'), metrica('Personagens online', t.personagens), metrica('Conexões', t.conexoes, 'abas abertas no jogo, com ou sem login'), metrica('IPs distintos', t.ips)),
          el('div', { class: 'dica' }, `Processo ${e.processo.pid} · Node ${e.processo.node} · no ar há ${duracao(e.agora - e.processo.noDesde)} · ${e.processo.memoriaMb} MB · ${e.processo.supervisionado ? 'supervisionado (Docker)' : 'sem supervisor (node solto)'}.`)),
        secao('Quem está online',
          e.online.length
            ? el('table', {}, el('thead', {}, el('tr', {}, ['Conta', 'Personagem', 'Level', 'IP', 'Onde está', 'Desde'].map((h) => el('th', {}, h)))),
              el('tbody', {}, e.online.map((o) => el('tr', { class: o.personagem ? '' : 'op-sem-char' }, el('td', {}, o.conta ?? el('span', { class: 'dica' }, 'sem login')), el('td', {}, o.personagem ? el('b', {}, o.personagem) : '—'), el('td', {}, o.level ?? '—'), el('td', { class: 'mono' }, o.ip ?? '—'), el('td', {}, o.onde), el('td', { class: 'dica', title: quando(o.desde) }, `há ${duracao(e.agora - o.desde)}`)))))
            : el('div', { class: 'dica' }, 'Ninguém conectado agora.')),
        secao('Reiniciar o servidor',
          e.reinicio
            ? el('div', { class: 'op-linha' }, estadoPill(true, `REINÍCIO EM ANDAMENTO — pedido ${quando(e.reinicio.pedidoEm)}${e.reinicio.quem ? ` por ${e.reinicio.quem}` : ''}`, ''), el('span', { class: 'dica' }, 'O processo sai em instantes; recarregue a Engine depois.'))
            : [el('label', { class: 'campo' }, 'Motivo (opcional — vai no aviso aos jogadores e no registro)', el('input', { type: 'text', maxlength: 200, value: V.motivo, oninput: (ev) => { V.motivo = ev.target.value; } })),
              el('div', { class: 'op-linha' }, el('button', { type: 'button', class: 'perigo', onclick: reiniciar }, 'Reiniciar o servidor'), el('span', { class: 'dica' }, 'Avisa quem está jogando, grava todo mundo (como o Ctrl+C) e sai em 5 segundos; em produção o Docker sobe de novo sozinho. O modo beta e a manutenção voltam ao padrão do boot.'))]),
        secao('Ações desta sessão do servidor', e.registro?.length ? el('table', { class: 'bib-sub' }, el('tbody', {}, e.registro.map((r) => el('tr', {}, el('td', { class: 'dica' }, quando(r.quando)), el('td', {}, r.acao), el('td', {}, r.detalhe ?? ''))))) : el('div', { class: 'dica' }, 'Nenhuma ação nesta sessão do servidor.'))));
  }

  return {
    beta: { desenhar: () => desenharBeta(), abrir: () => desenharBeta(), focarBusca: () => {} },
    config: { desenhar: () => desenharConfig(), abrir: () => desenharConfig(), focarBusca: () => {} },
    servidor: { desenhar: () => desenharServidor(), abrir: () => desenharServidor(), focarBusca: () => {} },
  };
}
