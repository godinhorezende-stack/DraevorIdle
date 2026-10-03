// As telas de OPERAÇÃO da Engine: "Testes e beta" (modo beta) e "Configurações" (manutenção e Server Save). São controles do SERVIDOR em
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
  const C = { estado: null, mensagem: '' };
  async function desenharConfig() {
    C.estado = await api('operacao');
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
        secao('Ações desta sessão do servidor', e.registro.length ? el('table', { class: 'bib-sub' }, el('tbody', {}, e.registro.map((r) => el('tr', {}, el('td', { class: 'dica' }, quando(r.quando)), el('td', {}, r.acao), el('td', {}, r.detalhe))))) : el('div', { class: 'dica' }, 'Nenhuma ação de operação desde o último boot.')),
        el('div', { class: 'dica' }, 'Protegido hoje só pelo bloqueio de rede (túnel SSH). O login de administrador e o registro permanente de ações entram numa etapa seguinte.')));
  }

  return {
    beta: { desenhar: () => desenharBeta(), abrir: () => desenharBeta(), focarBusca: () => {} },
    config: { desenhar: () => desenharConfig(), abrir: () => desenharConfig(), focarBusca: () => {} },
  };
}
