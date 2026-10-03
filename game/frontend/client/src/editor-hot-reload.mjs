// O INDICADOR DE HOT RELOAD da Engine (barra do topo): mostra se o jogo local acompanha o que você salva — Ativo, Recarregando, Atualizado, Erro ou
// Reinicialização necessária — e abre o painel com o histórico recente e a recarga manual de cada recurso. Só consulta o servidor (`hot-reload`) a cada
// poucos segundos; em produção (Hot Reload desligado) o indicador nem aparece.
import { el, msg } from './editor-ui.mjs';

const ROTULO = { ativo: 'Ativo', pendente: 'Aguardando', recarregando: 'Recarregando', atualizado: 'Atualizado', erro: 'Erro', reinicio: 'Reiniciar', desativado: 'Desligado' };
const COR = { ativo: 'ok', pendente: 'aviso', recarregando: 'aviso', atualizado: 'ok', erro: 'erro', reinicio: 'aviso', desativado: 'mudo' };
const RESULTADO = { ok: 'Atualizado', erro: 'Erro', reinicio: 'Reiniciar', 'sem-mudanca': 'Sem mudança' };
const hora = (t) => new Date(t).toTimeString().slice(0, 8);

export function criarIndicadorDeHotReload({ base, alvo, intervaloMs = 2500 }) {
  // Próprio `fetch` (e não o `api` das telas): aquele descarta a resposta de quem ficou para trás numa navegação, e o indicador consulta de tempos em tempos.
  const api = async (rota, corpo) => (await fetch(base + rota, corpo === undefined ? undefined : { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(corpo) })).json();
  let est = null;
  let aberto = false;
  let ultimaRevisao = -1;
  let ultimoEstado = null;
  const botao = el('button', { type: 'button', class: 'eng-hot-botao', hidden: true, title: 'Hot Reload: o jogo local acompanha o que você salva' });
  const painel = el('div', { class: 'eng-hot-painel', hidden: true, role: 'dialog', 'aria-label': 'Hot Reload' });
  botao.addEventListener('click', () => { aberto = !aberto; painel.hidden = !aberto; desenhar(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && aberto) { aberto = false; painel.hidden = true; } });
  alvo.append(botao, painel);

  async function recarregar(tipo) {
    try {
      const r = await api('hot-reload/recarregar', { tipo });
      msg(r.ok === false ? (r.erros ?? [r.erro]).join(' ') : `${tipo}: recarregado.`, r.ok === false ? 'erro' : 'ok');
    } catch (e) { msg(`Não consegui recarregar: ${e.message}`, 'erro'); }
    await consultar();
  }

  function desenhar() {
    if (!est) return;
    const oculto = est.ativo === false && /produção/.test(est.motivoInativo ?? '');
    botao.hidden = oculto;
    if (oculto) { painel.hidden = true; return; }
    botao.className = `eng-hot-botao ${COR[est.estado] ?? 'mudo'}`;
    botao.replaceChildren(el('span', { class: 'eng-hot-ponto' }), `Hot Reload: ${ROTULO[est.estado] ?? est.estado}`);
    if (!aberto) return;
    painel.replaceChildren(
      el('div', { class: 'eng-hot-topo' }, el('b', {}, `Hot Reload — ${ROTULO[est.estado] ?? est.estado}`), el('button', { type: 'button', class: 'fantasma', onclick: () => { aberto = false; painel.hidden = true; } }, '✕')),
      el('p', { class: `eng-hot-msg ${COR[est.estado] ?? ''}` }, est.mensagem),
      !est.ativo ? el('p', { class: 'dica' }, `Desligado: ${est.motivoInativo}`) : null,
      est.reinicio?.length ? el('div', { class: 'bib-alerta' }, el('b', {}, 'Exige reiniciar o servidor:'), el('ul', {}, est.reinicio.map((r) => el('li', {}, `${r.rotulo} — ${r.motivo}`)))) : null,
      est.erros?.length ? el('div', { class: 'bib-alerta' }, el('b', {}, 'Erros (segue a última versão válida):'), el('ul', {}, est.erros.map((r) => el('li', {}, `${r.rotulo}: ${r.mensagem}`)))) : null,
      est.ativo ? el('div', { class: 'eng-hot-acoes' }, el('span', { class: 'dica' }, 'Recarregar agora:'), est.recarregaveis.map((r) => el('button', { type: 'button', onclick: () => recarregar(r.tipo) }, r.rotulo))) : null,
      el('table', { class: 'eng-hot-tabela' }, el('thead', {}, el('tr', {}, ['Hora', 'Recurso', 'Resultado', 'Detalhe'].map((h) => el('th', {}, h)))),
        el('tbody', {}, est.historico.length ? est.historico.map((h) => el('tr', { class: h.resultado }, el('td', {}, hora(h.quando)), el('td', {}, `${h.tipo}${h.ids?.length ? ` · ${h.ids.slice(0, 3).join(', ')}${h.ids.length > 3 ? '…' : ''}` : ''}`), el('td', {}, RESULTADO[h.resultado] ?? h.resultado), el('td', {}, h.mensagem))) : [el('tr', {}, el('td', { colspan: 4, class: 'dica' }, 'Nada recarregado ainda: salve algo na Engine.'))])),
      el('p', { class: 'dica' }, 'Salvar na Engine atualiza o jogo local (monstros, itens, sprites, acts e níveis da campanha) sem reiniciar o servidor. Hunts, mapas, habilidades e gemas ainda exigem reinício.'));
  }

  async function consultar() {
    try {
      est = await api('hot-reload');
      if (est.revisao !== ultimaRevisao && ultimaRevisao !== -1 && est.historico[0]) msg(`Hot Reload: ${est.historico[0].tipo} — ${est.historico[0].resultado === 'ok' ? est.historico[0].mensagem : est.historico[0].mensagem}`, est.historico[0].resultado === 'erro' ? 'erro' : 'ok');
      else if (est.estado === 'erro' && ultimoEstado !== 'erro') msg(`Hot Reload: ${est.mensagem}`, 'erro');
      ultimaRevisao = est.revisao;
      ultimoEstado = est.estado;
      desenhar();
    } catch { /* sem servidor ou sem login: tenta de novo no próximo ciclo */ }
  }
  consultar();
  const t = setInterval(() => { if (!document.hidden) consultar(); }, intervaloMs);
  return { consultar, parar: () => clearInterval(t) };
}
