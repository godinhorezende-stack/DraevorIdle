// A tela "Validação e versão" da Engine: roda as verificações centralizadas e os testes pertinentes (no servidor local, em processos à parte), mostra o resultado
// como Aprovado / Aviso / Bloqueante por módulo, os arquivos alterados e se a versão está em condições de ser aprovada. Só apresenta: toda regra mora em
// `admin/validacao.mjs` e nas verificações. Atualiza sozinha enquanto algo está rodando.
import { el, cabecalho, msg, confirmar } from './editor-ui.mjs';

const ROTULO = { aprovado: 'Aprovado', aviso: 'Aviso', bloqueante: 'Erro bloqueante' };
const NOME_DO_MODULO = { monstros: 'Monstros', itens: 'Itens', sprites: 'Sprites', atos: 'Acts', campanha: 'Campanha', encontros: 'Encontros e bosses', hunts: 'Hunts e mapas', geral: 'Geral', codigo: 'Código do jogo', 'outros-dados': 'Outros dados', 'docs-e-testes': 'Docs e testes' };
const hora = (t) => new Date(t).toLocaleTimeString('pt-BR');
const seg = (ms) => (ms >= 1000 ? `${(ms / 1000).toFixed(1)} s` : `${ms} ms`);

export function criarTelaDeValidacao({ api, raiz, podeGravar = () => true }) {
  const E = { est: null, soProblemas: false, completa: false, aberto: new Set(), timer: null, desenhando: false, alt: { arquivos: [], ocultos: 0 }, versoes: [], historico: [], selecionados: null, titulo: '', diffs: new Map(), abertoDiff: new Set(), aprovando: false, versaoAberta: new Set(), detalhes: new Map(), consultas: new Map(), consultando: null };

  async function carregar() {
    E.est = await api('validacao');
    E.alt = await api('alteracoes');
    E.versoes = (await api('versoes')).versoes ?? [];
    E.historico = (await api('auditoria?tipo=gravacao&limite=25')).eventos ?? [];
    const caminhos = E.alt.arquivos.map((a) => a.caminho);
    // A seleção começa com tudo marcado; depois só acompanha o que deixou de existir (o que o dono desmarcou continua desmarcado).
    if (E.selecionados === null) E.selecionados = new Set(caminhos);
    else { const conhecidos = new Set(E.conhecidos ?? []); for (const c of caminhos) if (!conhecidos.has(c)) E.selecionados.add(c); for (const c of [...E.selecionados]) if (!caminhos.includes(c)) E.selecionados.delete(c); }
    E.conhecidos = caminhos;
    // As versões abertas mostram a conferência de AGORA (cópia íntegra? o que foi editado depois?).
    for (const id of E.versaoAberta) E.detalhes.set(id, await api(`versoes/${encodeURIComponent(id)}`));
  }
  const podeAprovar = () => !!E.est?.aptaParaAprovar && E.selecionados.size > 0 && E.titulo.trim().length >= 3 && !E.aprovando && podeGravar();
  async function verDiferenca(caminho) {
    if (E.abertoDiff.has(caminho)) { E.abertoDiff.delete(caminho); return pintar(); }
    E.abertoDiff.add(caminho);
    E.diffs.set(caminho, await api(`alteracoes/diff?caminho=${encodeURIComponent(caminho)}`));
    pintar();
  }
  async function aprovar() {
    const escolhidos = [...E.selecionados];
    const fora = E.alt.arquivos.length - escolhidos.length;
    const ok = await confirmar('Aprovar e gerar a versão?', `${escolhidos.length} arquivo(s) serão CONGELADOS nesta versão ("${E.titulo.trim()}"). Editar depois não muda o que foi aprovado.${fora ? ` ${fora} arquivo(s) alterado(s) ficam de fora.` : ''} Nada é enviado ao Git: isso é a próxima etapa.`, { ok: 'Aprovar e gerar versão' });
    if (!ok) return;
    E.aprovando = true;
    try {
      const r = await api('versoes/aprovar', { caminhos: escolhidos, titulo: E.titulo.trim() });
      if (r.ok === false) msg((r.erros ?? ['Não aprovou.']).join(' '), 'erro');
      else { msg(`Versão ${r.versao.id} gerada e congelada.`, 'ok'); E.titulo = ''; E.versaoAberta.add(r.versao.id); }
    } catch (e) { msg(`Não aprovou: ${e.message}`, 'erro'); } finally { E.aprovando = false; }
    await atualizar();
  }
  async function descartarVersao(id) {
    if (!(await confirmar(`Descartar a versão ${id}?`, 'Ela deixa de poder ser enviada ao Git (o registro e o changelog ficam no histórico). As alterações no disco não são tocadas.', { ok: 'Descartar versão', perigo: true }))) return;
    const r = await api('versoes/descartar', { id });
    if (r.ok === false) msg((r.erros ?? ['Não descartou.']).join(' '), 'erro'); else msg(`Versão ${id} descartada.`, 'ok');
    await atualizar();
  }
  async function enviarVersao(v) {
    const d = E.detalhes.get(v.id) ?? await api(`versoes/${encodeURIComponent(v.id)}`);
    const texto = `Cria a branch versao/${v.id} com UM commit dos ${d.arquivos.length} arquivo(s) congelados (base ${d.base?.branch ?? '?'}@${d.base?.head ?? '?'}) e a envia ao remoto "origin". Não faz merge, não força o envio e não publica nada. Seu diretório de trabalho e seu índice não são tocados.`;
    if (!(await confirmar('Enviar a versão ao Git?', texto, { ok: 'Criar branch e enviar' }))) return;
    E.enviando = v.id;
    pintar();
    try {
      const r = await api('versoes/enviar', { id: v.id });
      if (r.ok === false) msg((r.erros ?? ['Não enviou.']).join(' '), 'erro');
      else msg(`Versão ${v.id} enviada: branch ${r.branch} (${r.commit.slice(0, 8)}). Faça o merge manualmente no repositório.`, 'ok');
    } catch (e) { msg(`Não enviou: ${e.message}`, 'erro'); } finally { E.enviando = null; }
    await atualizar();
  }
  async function consultarVersao(v) {
    E.consultando = v.id;
    pintar();
    try {
      const r = await api('versoes/consultar', { id: v.id });
      if (r.ok === false) msg((r.erros ?? ['Não consultou.']).join(' '), 'erro');
      else { E.consultas.set(v.id, r); msg(r.situacao === 'integrada' ? `Versão ${v.id} está na principal${r.apta ? ' e apta para publicação' : ''}.` : `Versão ${v.id}: ainda não está na principal.`, r.situacao === 'integrada' ? 'ok' : 'aviso'); }
    } catch (e) { msg(`Não consultou: ${e.message}`, 'erro'); } finally { E.consultando = null; }
    await atualizar();
  }
  async function abrirVersao(id) {
    if (E.versaoAberta.has(id)) E.versaoAberta.delete(id);
    else { E.versaoAberta.add(id); E.detalhes.set(id, await api(`versoes/${encodeURIComponent(id)}`)); }
    pintar();
  }
  async function executar(escopo) {
    const r = await api('validacao/executar', { escopo, completa: E.completa });
    if (r.ok === false) msg((r.erros ?? [r.erro]).join(' '), 'erro');
    await atualizar();
  }
  async function atualizar() {
    await carregar();
    pintar();
    clearTimeout(E.timer);
    if (E.est.rodando && raiz().querySelector('.val-tela')) E.timer = setTimeout(atualizar, 1500);
  }

  const chip = (status, texto = null) => el('span', { class: `val-chip ${status}` }, texto ?? ROTULO[status] ?? status);

  function bloco() {
    const e = E.est;
    const geral = e.rapida ? e.rapida.geral : null;
    const rodando = e.rodando ? `Executando ${{ rapida: 'as validações', testes: 'os testes', tudo: 'validações e testes' }[e.rodando]}… ${e.rodando !== 'rapida' && e.linhas ? `(${e.linhas} linhas de saída)` : ''}` : null;
    return el('section', { class: 'val-resumo' },
      el('div', { class: 'val-geral' }, geral ? chip(geral) : chip('aviso', 'Sem validação'), e.rapida?.desatualizada ? el('span', { class: 'dica' }, 'desatualizada: o conteúdo mudou depois') : null,
        e.rapida ? el('span', { class: 'dica' }, `${hora(e.rapida.quando)} · ${seg(e.rapida.ms)} · ${e.rapida.resumo.aprovado} aprovada(s), ${e.rapida.resumo.aviso} com aviso, ${e.rapida.resumo.bloqueante} bloqueante(s)`) : null),
      el('div', { class: 'val-acoes' },
        el('button', { type: 'button', class: 'primario', disabled: !!e.rodando, onclick: () => executar('rapida') }, 'Executar validações'),
        el('button', { type: 'button', disabled: !!e.rodando, onclick: () => executar('testes') }, 'Executar testes pertinentes'),
        el('button', { type: 'button', disabled: !!e.rodando, onclick: () => executar('tudo') }, 'Validações + testes'),
        el('label', { class: 'val-rot' }, el('input', { type: 'checkbox', checked: E.completa, onchange: (ev) => { E.completa = ev.target.checked; } }), 'suíte completa (demora vários minutos)')),
      rodando ? el('div', { class: 'val-andamento' }, el('span', { class: 'val-roda' }), rodando) : null,
      e.erro ? el('div', { class: 'bib-alerta' }, `O validador falhou: ${e.erro}`) : null);
  }

  function linhaDoArquivo(i) {
    const caixa = el('input', { type: 'checkbox', checked: E.selecionados.has(i.caminho), onchange: (ev) => { if (ev.target.checked) E.selecionados.add(i.caminho); else E.selecionados.delete(i.caminho); atualizarAprovar(); } });
    const nome = el('label', {}, caixa, el('span', { class: `val-est ${i.estado}` }, i.estado), ` ${i.caminho.replace(/^game\//, '')}`);
    const ver = el('button', { type: 'button', class: 'fantasma', onclick: () => verDiferenca(i.caminho) }, E.abertoDiff.has(i.caminho) ? 'ocultar' : 'ver diferenças');
    return el('li', {}, nome, ver, E.abertoDiff.has(i.caminho) ? diferenca(i.caminho) : null);
  }
  function grupoDoModulo(m, itens) {
    const todos = () => itens.every((i) => E.selecionados.has(i.caminho));
    const alternar = (ev) => { ev.preventDefault(); const v = !todos(); for (const i of itens) { if (v) E.selecionados.add(i.caminho); else E.selecionados.delete(i.caminho); } pintar(); };
    const titulo = el('summary', {}, `${NOME_DO_MODULO[m] ?? m} `, el('small', {}, `${itens.length} arquivo(s)`), el('button', { type: 'button', class: 'fantasma', onclick: alternar }, 'marcar/desmarcar todos'));
    return el('details', { class: 'val-mod', open: itens.length <= 6 || itens.some((i) => E.abertoDiff.has(i.caminho)) }, titulo, el('ul', {}, itens.map(linhaDoArquivo)));
  }
  function alteracoes() {
    const a = E.alt.arquivos;
    const porModulo = Map.groupBy(a, (x) => x.modulo);
    const dicaDoRepo = !E.est.repo.repo
      ? el('div', { class: 'dica' }, 'Não encontrei um repositório Git aqui.')
      : el('div', { class: 'dica' }, `Branch ${E.est.repo.branch} · ${E.est.repo.head} · marque o que entra na versão; o resto fica de fora.${E.alt.ocultos ? ` (${E.alt.ocultos} arquivo(s) de dados/segredos nunca entram.)` : ''}`);
    const corpo = a.length ? el('div', { class: 'val-modulos' }, [...porModulo].map(([m, itens]) => grupoDoModulo(m, itens))) : el('div', { class: 'dica' }, 'Nenhuma alteração: o conteúdo é igual ao do último commit.');
    return el('section', { class: 'val-sec' }, el('h3', {}, `Alterações no repositório (${a.length})`), dicaDoRepo, corpo);
  }
  function diferenca(caminho) {
    const d = E.diffs.get(caminho);
    if (!d) return el('div', { class: 'dica' }, 'Carregando…');
    if (d.ok === false) return el('div', { class: 'bib-alerta' }, (d.erros ?? []).join(' '));
    if (d.tipo === 'json') return d.mudancas.length ? el('table', { class: 'val-diff' }, el('thead', {}, el('tr', {}, ['Campo', 'Original', 'Atual'].map((h) => el('th', {}, h)))), el('tbody', {}, d.mudancas.map((m) => el('tr', { class: m.tipo }, el('td', {}, m.caminho || '(arquivo)'), el('td', {}, m.tipo === 'novo' ? '—' : JSON.stringify(m.antes)), el('td', {}, m.tipo === 'removido' ? '—' : JSON.stringify(m.depois))))), d.total > d.mudancas.length ? el('caption', {}, `mostrando ${d.mudancas.length} de ${d.total}`) : null) : el('div', { class: 'dica' }, 'Sem diferença de conteúdo (só formatação).');
    if (d.tipo === 'binario') return el('div', { class: 'dica' }, `Imagem: ${d.antes ? `${d.antes.bytes} bytes (${d.antes.sha256})` : 'não existia'} → ${d.depois ? `${d.depois.bytes} bytes (${d.depois.sha256})` : 'apagada'}`);
    return el('pre', { class: 'val-pre' }, d.texto || '(sem diferença de texto)');
  }

  function atualizarAprovar() { const b = raiz().querySelector('#val-aprovar'); if (b) b.disabled = !podeAprovar(); }

  function aprovacao() {
    const e = E.est;
    const bloqueio = !podeGravar() ? 'Somente leitura neste servidor (produção): aprovar versões é do ambiente local.' : null;
    return el('section', { class: `val-sec val-aprovacao ${e.aptaParaAprovar ? 'apta' : 'nao'}` },
      el('h3', {}, 'Aprovar e gerar versão'),
      e.aptaParaAprovar ? el('div', {}, chip('aprovado', 'Pronta'), ' Validações sem erro bloqueante e testes aprovados para o estado atual do repositório.') : el('div', {}, chip('bloqueante', 'Ainda não'), el('ul', {}, e.motivos.map((m) => el('li', {}, m)))),
      bloqueio ? el('div', { class: 'bib-alerta' }, bloqueio) : null,
      el('div', { class: 'val-acoes' },
        el('input', { id: 'val-titulo', type: 'text', placeholder: 'título da versão (ex.: Troll mais forte + sprite novo)', maxlength: 120, value: E.titulo, style: 'flex:1;min-width:260px', oninput: (ev) => { E.titulo = ev.target.value; atualizarAprovar(); } }),
        el('button', { id: 'val-aprovar', type: 'button', class: 'primario', disabled: !podeAprovar(), onclick: aprovar }, 'Aprovar e gerar versão')),
      el('div', { class: 'dica' }, `${E.selecionados.size} de ${E.alt.arquivos.length} arquivo(s) marcados. Aprovar congela uma cópia deles e gera o changelog; nada é enviado ao Git nem publicado.`));
  }

  function versoes() {
    return el('section', { class: 'val-sec' },
      el('h3', {}, `Versões aprovadas (${E.versoes.length})`),
      E.versoes.length ? el('div', { class: 'val-lista' }, E.versoes.map((v) => {
        const d = E.detalhes.get(v.id);
        const aberta = E.versaoAberta.has(v.id);
        return el('details', { class: 'val-item aprovado', open: aberta },
          el('summary', { onclick: (ev) => { ev.preventDefault(); abrirVersao(v.id); } }, chip(v.status === 'enviada' || v.status === 'integrada' ? 'aprovado' : v.status === 'descartada' ? 'bloqueante' : 'aviso', v.status), el('b', {}, v.id), el('span', {}, v.titulo), el('small', {}, `${new Date(v.criadaEm).toLocaleString('pt-BR')} · ${v.arquivos} arquivo(s) · ${v.modulos.map((m) => NOME_DO_MODULO[m] ?? m).join(', ')}`)),
          d ? el('div', { class: 'val-versao' },
            el('div', { class: 'dica' }, `Base ${d.base?.branch ?? '?'}@${d.base?.head ?? '?'} · aprovada por ${d.por ?? '—'} · ${d.integra ? 'cópia congelada íntegra' : 'CÓPIA CONGELADA COM PROBLEMA'}`),
            d.problemasDeIntegridade?.length ? el('ul', { class: 'val-achados' }, d.problemasDeIntegridade.map((p) => el('li', { class: 'erro' }, `${p.caminho}: ${p.problema}`))) : null,
            d.editadosDepois?.length ? el('div', { class: 'bib-alerta' }, el('b', {}, 'Editados depois da aprovação (não estão na versão):'), el('ul', {}, d.editadosDepois.map((p) => el('li', {}, p.caminho)))) : null,
            el('pre', { class: 'val-pre' }, d.changelog),
            blocoGit(v, d),
            ['aprovada', 'commit-local'].includes(d.status) ? el('button', { type: 'button', class: 'perigo', disabled: !podeGravar() || E.enviando === v.id, onclick: () => descartarVersao(v.id) }, 'Descartar versão') : null) : null);
      })) : el('div', { class: 'dica' }, 'Nenhuma versão aprovada ainda.'));
  }

  function blocoGit(v, d) {
    const g = d.git;
    if (d.status === 'descartada') return null;
    if (d.status === 'enviada' || d.status === 'integrada') {
      const c = E.consultas.get(v.id);
      const integrada = d.status === 'integrada';
      const botao = el('button', { type: 'button', disabled: E.consultando === v.id, onclick: () => consultarVersao(v) }, E.consultando === v.id ? 'Consultando…' : 'Consultar status no remoto');
      const situacao = integrada
        ? el('div', {}, chip('aprovado', 'Integrada à principal'), el('div', { class: 'dica' }, `${d.integracao?.modo === 'conteudo' ? 'Por conteúdo (squash/rebase)' : 'Merge'} · commit ${d.integracao?.commit?.slice(0, 8) ?? ''} · verificada em ${d.integracao?.verificadaEm ? new Date(d.integracao.verificadaEm).toLocaleString('pt-BR') : '—'}`),
          c ? el('div', {}, c.apta ? chip('aprovado', 'Apta para publicação') : chip('bloqueante', 'Não apta'), el('div', { class: 'dica' }, `Ponta da principal: ${c.principal.commit.slice(0, 8)}. ${c.paraPublicar?.observacao ?? ''}`), (c.avisos ?? []).map((a) => el('div', { class: 'dica' }, a)), (c.motivos ?? []).map((a) => el('div', { class: 'bib-alerta' }, a))) : el('div', { class: 'dica' }, 'Consulte o remoto para confirmar que ela continua na principal e está apta para publicação.'))
        : el('div', {}, chip('aviso', 'Ainda não está na principal'), el('div', { class: 'dica' }, c?.motivos?.[0] ?? 'Faça o merge no repositório (o PR) e consulte o status.'));
      return el('div', { class: 'val-git ok' }, el('b', {}, 'Enviada ao Git'), el('div', { class: 'dica' }, `Branch ${g.branch} · commit ${g.commit?.slice(0, 8)} · ${g.remoto ?? ''} · ${g.enviadoEm ? new Date(g.enviadoEm).toLocaleString('pt-BR') : ''}`),
        el('div', { class: 'dica' }, 'O merge é manual, no repositório. O deploy para produção é a próxima etapa do plano e não é acionado daqui.'),
        g.link ? el('a', { href: g.link, target: '_blank', rel: 'noopener', class: 'val-link' }, 'Abrir comparação (PR)') : null, situacao, botao);
    }
    const tentando = E.enviando === v.id;
    return el('div', { class: `val-git ${g?.erroDeEnvio ? 'erro' : ''}` },
      g?.erroDeEnvio ? el('div', { class: 'bib-alerta' }, el('b', {}, 'O envio falhou — a versão está guardada (commit local):'), ` ${g.erroDeEnvio}`) : null,
      g?.commit ? el('div', { class: 'dica' }, `Commit local ${g.commit.slice(0, 8)} em ${g.branch}`) : null,
      el('button', { type: 'button', class: 'primario', disabled: !podeGravar() || tentando, onclick: () => enviarVersao(v) }, tentando ? 'Enviando…' : g?.commit ? 'Tentar enviar de novo' : 'Criar branch e enviar ao Git'));
  }

  function historico() {
    return el('section', { class: 'val-sec' },
      el('h3', {}, 'Histórico de alterações'),
      E.historico.length ? el('table', { class: 'val-diff' }, el('thead', {}, el('tr', {}, ['Quando', 'Quem', 'Rota', 'Resultado'].map((h) => el('th', {}, h)))), el('tbody', {}, E.historico.map((h) => el('tr', { class: h.ok ? '' : 'removido' }, el('td', {}, new Date(h.quando).toLocaleString('pt-BR')), el('td', {}, h.quem ?? '—'), el('td', {}, h.rota ?? '—'), el('td', {}, h.ok ? 'gravou' : 'falhou'))))) : el('div', { class: 'dica' }, 'Nenhuma gravação registrada ainda.'));
  }

  function verificacoes() {
    const r = E.est.rapida;
    if (!r) return el('section', { class: 'val-sec' }, el('h3', {}, 'Verificações'), el('div', { class: 'dica' }, 'Ainda não executadas: clique em "Executar validações".'));
    const lista = r.verificacoes.filter((v) => !E.soProblemas || v.status !== 'aprovado');
    return el('section', { class: 'val-sec' },
      el('div', { class: 'val-sec-topo' }, el('h3', {}, 'Verificações'), el('label', { class: 'val-rot' }, el('input', { type: 'checkbox', checked: E.soProblemas, onchange: (ev) => { E.soProblemas = ev.target.checked; pintar(); } }), 'só com problema')),
      el('div', { class: 'val-lista' }, lista.map((v) => {
        const erros = v.achados.filter((a) => a.nivel === 'erro');
        const avisos = v.achados.filter((a) => a.nivel === 'aviso');
        return el('details', { class: `val-item ${v.status}`, open: E.aberto.has(v.id) || v.status === 'bloqueante', ontoggle: (ev) => { if (ev.target.open) E.aberto.add(v.id); else E.aberto.delete(v.id); } },
          el('summary', {}, chip(v.status), el('b', {}, v.titulo), el('span', { class: 'selo' }, NOME_DO_MODULO[v.modulo] ?? v.modulo), el('small', {}, `${v.detalhe ?? ''}${v.detalhe ? ' · ' : ''}${seg(v.ms)}`)),
          v.achados.length ? el('ul', { class: 'val-achados' }, [...erros, ...avisos].slice(0, 200).map((a) => el('li', { class: a.nivel }, el('b', {}, a.nivel === 'erro' ? 'Erro' : 'Aviso'), ` ${a.onde ? `[${a.onde}] ` : ''}${a.mensagem}`)), v.achados.length > 200 ? el('li', {}, `… e mais ${v.achados.length - 200}`) : null) : el('div', { class: 'dica val-ok' }, 'Sem achados.'));
      })));
  }

  function testes() {
    const t = E.est.testes;
    return el('section', { class: 'val-sec' },
      el('h3', {}, 'Testes pertinentes'),
      !t ? el('div', { class: 'dica' }, 'Ainda não executados: eles rodam só os testes dos módulos que você alterou (ou a suíte completa, se o código mudou).') : el('div', {},
        el('div', { class: 'val-geral' }, chip(t.ok ? 'aprovado' : 'bloqueante', t.ok ? 'Passaram' : 'Falharam'), el('span', { class: 'dica' }, `${hora(t.quando)} · ${seg(t.ms)} · ${t.passaram} passaram, ${t.falharam} falharam de ${t.total} · ${t.completa ? 'suíte completa' : `${t.arquivos.length} arquivo(s) de teste`}`), t.desatualizado ? el('span', { class: 'dica' }, 'desatualizados: o repositório mudou depois') : null),
        t.falhas.length ? el('ul', { class: 'val-achados' }, t.falhas.map((f) => el('li', { class: 'erro' }, el('b', {}, 'Falhou'), ` ${f}`))) : null,
        el('details', {}, el('summary', {}, 'Arquivos de teste executados'), el('ul', {}, t.arquivos.map((a) => el('li', {}, a))))));
  }

  function pintar() {
    if (!E.est || !raiz().querySelector('.val-tela') && !E.desenhando) return;
    raiz().replaceChildren(
      cabecalho('Validação e versão', 'Verificações centralizadas do conteúdo (integridade, referências, compatibilidade, carga do jogo) e os testes pertinentes. Aprovado, aviso ou erro bloqueante — erro bloqueante impede aprovar uma versão.'),
      el('div', { class: 'val-tela' }, bloco(), alteracoes(), verificacoes(), testes(), aprovacao(), versoes(), historico()));
    E.desenhando = false;
  }

  async function desenhar() {
    E.desenhando = true;
    await carregar();
    pintar();
    if (E.est.rodando) E.timer = setTimeout(atualizar, 1500);
  }
  return { desenhar, abrir: () => desenhar(), focarBusca: () => {}, parar: () => clearTimeout(E.timer) };
}
