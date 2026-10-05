// A aba MAPAS do /editor/conteudo: o editor de mapas (`/editor`) na casca da Engine, com TODAS as funções dele (F1–F37 em
// docs/editor-de-mapas-auditoria.md) mais o que a auditoria apontou como lacuna — desfazer/refazer, validação ao vivo dos spawns, aviso de
// alterações não salvas e a distribuição de raridade à vista. As regras (grade, raridade, modificadores, limites) estão em
// `editor-mapas-logica.mjs` (puras, testadas); o servidor continua sendo a verdade (`admin/mapas.mjs`, `systems/mapa/spawns.mjs`).
// Fala com as MESMAS rotas do `/editor` (`/api/mapas*`); o `/editor` antigo segue funcionando até esta aba cobrir tudo.
import { el, cabecalho, msg } from './editor-ui.mjs';
import { loadSpriteData, drawCreature, outfitCanvas } from './sprites.mjs';
import * as L from './editor-mapas-logica.mjs';

const { TILE } = L;
const PISOS_PADRAO = 40;
const AJUDA = {
  spawn: 'Clique numa casa andável para marcar um spawn com a criatura escolhida; clique num spawn para editá-lo.',
  apagarSpawn: 'Clique num spawn para apagá-lo.',
  pincel: 'Arraste para pintar chão andável com o piso escolhido (só em mapa novo).',
  parede: 'Arraste para bloquear casas (só em mapa novo).',
};
const NOME_DA_FERRAMENTA = { spawn: 'Spawn (marcar / selecionar)', apagarSpawn: 'Apagar spawn', pincel: 'Pincel (andável)', parede: 'Parede (bloqueado)' };

export function criarEditorDeMapas({ api, raiz, sujo }) {
  const M = {
    opcoes: null, bestiario: [], porKey: new Map(), raridades: [], modificadores: [], tipoDoSpawn: {},
    ids: [], id: null, mapa: null, real: false, andar: 7, escala: 1, spawns: [], sel: -1,
    proximo: { raridade: 'normal', modificadores: [], raio: 0, quantidade: 1 },
    ferramenta: 'spawn', piso: PISOS_PADRAO, bicho: null, hover: null, verBloqueio: false, verRaio: true, filtro: '',
    errosDaValidacao: [], pedidoValidar: 0, pedidoAtributos: 0, nivelCalculo: 100, aviso: null, arrastando: false, historicoAberto: false,
  };
  const atlases = new Map();
  let fundo; let marcas; let ctxFundo; let ctxMarcas; let faltouSprite = null; let esperandoValidar = null; let pronto = false;

  const H = L.criarHistorico({
    foto: () => ({ spawns: M.spawns, grade: M.mapa ? { stacks: L.gradeDe(M.mapa, M.mapa.z).stacks, blocked: L.gradeDe(M.mapa, M.mapa.z).blocked } : null }),
    restaurar: (f) => {
      M.spawns = f.spawns;
      if (f.grade && M.mapa) {
        const g = L.gradeDe(M.mapa, M.mapa.z);
        g.stacks.splice(0, g.stacks.length, ...f.grade.stacks);
        g.blocked.splice(0, g.blocked.length, ...f.grade.blocked);
      }
      M.sel = -1;
      depoisDeEditar({ semHistorico: true });
      desenharFundo();
    },
  });

  // ------------------------------------------------------------------ utilidades
  const nomeDe = (key) => M.porKey.get(key)?.name ?? key;
  const corDaRaridade = (id) => (id && id !== 'normal' ? M.raridades.find((r) => r.id === id)?.cor : null) ?? null;
  const raridadeDe = (s) => s.raridade ?? M.tipoDoSpawn[s.tipo] ?? 'normal';
  const alvoDaEdicao = () => (M.sel >= 0 ? M.spawns[M.sel] : M.proximo);
  const dizer = (t, erro = false) => msg(t, erro ? 'erro' : 'ok');
  const $m = (id) => document.getElementById(`mp-${id}`);

  /** Toda edição passa por aqui: marca "sujo", agenda a validação ao vivo e repinta as listas. `registrar` já foi chamado ANTES de mudar. */
  function depoisDeEditar({ semHistorico = false } = {}) {
    if (!semHistorico) sujo?.marcar();
    else sujo?.marcar();
    atualizarListaDeSpawns();
    atualizarBarraDoHistorico();
    desenharMarcas();
    clearTimeout(esperandoValidar);
    esperandoValidar = setTimeout(validarAoVivo, 300);
  }
  async function validarAoVivo() {
    if (!M.mapa) return;
    const meu = ++M.pedidoValidar;
    // Mapa sem spawn ainda: o servidor só exige 1 para SALVAR; durante a edição isso não é erro.
    if (!M.spawns.length) { M.errosDaValidacao = []; const c = $m('validacao'); if (c) c.replaceChildren(el('div', { class: 'dica' }, 'Marque ao menos um spawn para poder salvar.')); return; }
    const r = await api('mapas/validar', { spawns: M.spawns, width: M.mapa.width, height: M.mapa.height }).catch(() => null);
    if (meu !== M.pedidoValidar) return;
    M.errosDaValidacao = r?.erros ?? [];
    atualizarListaDeSpawns();
    const caixa = $m('validacao');
    if (caixa) caixa.replaceChildren(...painelDaValidacao());
  }
  const errosDoSpawn = (id) => M.errosDaValidacao.filter((e) => e.startsWith(`spawn ${id}:`));

  // ------------------------------------------------------------------ imagens e grade (F10)
  function atlas(nome) {
    let a = atlases.get(nome);
    if (!a) {
      a = new Image();
      a.onload = () => { desenharFundo(); montarPaleta(); };
      a.src = `/gamedata/sprites/${nome}.png`;
      atlases.set(nome, a);
    }
    return a.complete && a.naturalWidth ? a : null;
  }
  const grade = (z = M.andar) => L.gradeDe(M.mapa, z);

  function desenharPilha(ctx, img, pilha, x, y) {
    const cell = M.mapa.cell ?? 64;
    let altura = 0;
    for (const index of pilha) {
      const e = M.mapa.palette[index];
      if (!e) continue;
      const [ax, ay] = e.cells?.[0] ?? [e.ax, e.ay];
      const px = x * TILE - (e.w - TILE) - (e.dx ?? 0) - altura;
      const py = y * TILE - (e.h - TILE) - (e.dy ?? 0) - altura;
      ctx.drawImage(img, ax + (cell - e.w), ay + (cell - e.h), e.w, e.h, px * M.escala, py * M.escala, e.w * M.escala, e.h * M.escala);
      if (e.el) altura = Math.min(24, altura + e.el);
    }
  }
  function ajustarCanvas() {
    const w = Math.round(M.mapa.width * TILE * M.escala);
    const h = Math.round(M.mapa.height * TILE * M.escala);
    for (const c of [fundo, marcas]) { c.width = w; c.height = h; }
    const camadas = $m('camadas');
    camadas.style.width = `${w}px`;
    camadas.style.height = `${h}px`;
  }
  function desenharFundo() {
    if (!M.mapa || !fundo) return;
    const img = atlas(M.mapa.atlas);
    ctxFundo.imageSmoothingEnabled = false;
    ctxFundo.fillStyle = '#07080b';
    ctxFundo.fillRect(0, 0, fundo.width, fundo.height);
    if (img) {
      const { stacks } = grade();
      for (let y = 0; y < M.mapa.height; y++) for (let x = 0; x < M.mapa.width; x++) {
        const pilha = stacks[y * M.mapa.width + x];
        if (pilha?.length) desenharPilha(ctxFundo, img, pilha, x, y);
      }
    }
    desenharMarcas();
  }
  function repintarCasa(x, y) {
    const img = atlas(M.mapa.atlas);
    const t = TILE * M.escala;
    ctxFundo.fillStyle = '#07080b';
    ctxFundo.fillRect(x * t, y * t, t, t);
    const pilha = grade().stacks[y * M.mapa.width + x];
    if (img && pilha?.length) desenharPilha(ctxFundo, img, pilha, x, y);
  }
  function desenharMarcas() {
    if (!M.mapa || !marcas) return;
    const t = TILE * M.escala;
    ctxMarcas.clearRect(0, 0, marcas.width, marcas.height);
    ctxMarcas.imageSmoothingEnabled = false;
    const { stacks, blocked } = grade();
    if (M.verBloqueio || !M.real) {
      for (let y = 0; y < M.mapa.height; y++) for (let x = 0; x < M.mapa.width; x++) {
        const i = y * M.mapa.width + x;
        if (stacks[i]?.length && blocked[i]) { ctxMarcas.fillStyle = 'rgba(224, 70, 60, 0.35)'; ctxMarcas.fillRect(x * t, y * t, t, t); }
      }
    }
    if (!M.real && t >= 8) {
      ctxMarcas.strokeStyle = 'rgba(255,255,255,0.05)';
      ctxMarcas.lineWidth = 1;
      ctxMarcas.beginPath();
      for (let x = 0; x <= M.mapa.width; x++) { ctxMarcas.moveTo(x * t + 0.5, 0); ctxMarcas.lineTo(x * t + 0.5, M.mapa.height * t); }
      for (let y = 0; y <= M.mapa.height; y++) { ctxMarcas.moveTo(0, y * t + 0.5); ctxMarcas.lineTo(M.mapa.width * t, y * t + 0.5); }
      ctxMarcas.stroke();
    }
    let incompleto = false;
    M.spawns.forEach((s, i) => {
      if (L.zDoSpawn(s, M.mapa) !== M.andar) return;
      const cor = corDaRaridade(s.raridade) ?? '#ffffff';
      const sel = i === M.sel;
      const erro = errosDoSpawn(s.id).length > 0;
      if (M.verRaio || sel) {
        const r = s.raio ?? 0;
        ctxMarcas.strokeStyle = sel ? '#4a9eff' : `${cor}66`;
        ctxMarcas.setLineDash(sel ? [] : [4, 3]);
        ctxMarcas.lineWidth = sel ? 2 : 1;
        ctxMarcas.strokeRect((s.x - r) * t + 0.5, (s.y - r) * t + 0.5, (2 * r + 1) * t - 1, (2 * r + 1) * t - 1);
        ctxMarcas.setLineDash([]);
      }
      const b = M.porKey.get(L.keyDoSpawn(s));
      if (b?.look) {
        ctxMarcas.save();
        ctxMarcas.scale(M.escala, M.escala);
        if (!drawCreature(ctxMarcas, { look: b.look, colors: b.colors, dir: 2, frame: 0, walking: false, mount: 0, addons: b.colors?.addons ?? 0 }, s.x * TILE, s.y * TILE)) incompleto = true;
        ctxMarcas.restore();
      }
      ctxMarcas.strokeStyle = erro ? '#ef6f63' : sel ? '#4a9eff' : cor;
      ctxMarcas.lineWidth = sel || erro ? 3 : 2;
      ctxMarcas.beginPath();
      ctxMarcas.ellipse((s.x + 0.5) * t, (s.y + 0.85) * t, t * 0.42, t * 0.16, 0, 0, Math.PI * 2);
      ctxMarcas.stroke();
      if ((s.quantidade ?? 1) > 1 && t >= 12) {
        ctxMarcas.font = `bold ${Math.max(9, Math.round(t * 0.32))}px system-ui`;
        ctxMarcas.fillStyle = '#000';
        ctxMarcas.fillText(`×${s.quantidade}`, s.x * t + t * 0.62 + 1, s.y * t + t * 0.32 + 1);
        ctxMarcas.fillStyle = '#ffd98a';
        ctxMarcas.fillText(`×${s.quantidade}`, s.x * t + t * 0.62, s.y * t + t * 0.32);
      }
    });
    if (M.hover) {
      ctxMarcas.strokeStyle = 'rgba(255,255,255,0.8)';
      ctxMarcas.lineWidth = 1;
      ctxMarcas.strokeRect(M.hover.x * t + 0.5, M.hover.y * t + 0.5, t - 1, t - 1);
    }
    clearTimeout(faltouSprite);
    if (incompleto) faltouSprite = setTimeout(desenharMarcas, 300);
  }

  // ------------------------------------------------------------------ mouse (F17, F19–F22)
  const casaDoEvento = (e) => {
    const r = marcas.getBoundingClientRect();
    return L.casaDoPonteiro(e.clientX - r.left, e.clientY - r.top, M.escala, M.mapa.width, M.mapa.height);
  };
  const spawnNa = (x, y) => M.spawns.findIndex((s) => s.x === x && s.y === y && L.zDoSpawn(s, M.mapa) === M.andar);

  function aplicarFerramenta(x, y, primeiro) {
    if (M.ferramenta === 'pincel' || M.ferramenta === 'parede') {
      if (M.real) return primeiro && dizer('Mapa real: o chão não é editado aqui — só os spawns.', true);
      if (primeiro) H.registrar();
      if (L.pintarCasa(M.mapa, M.andar, x, y, M.ferramenta, M.piso, M.real)) { repintarCasa(x, y); depoisDeEditar(); }
    } else if (M.ferramenta === 'spawn' && primeiro) {
      const ja = spawnNa(x, y);
      if (ja >= 0) return selecionar(ja === M.sel ? -1 : ja);
      const motivo = L.motivoParaNaoMarcar(M.mapa, M.andar, x, y, M.bicho);
      if (motivo) return dizer(motivo, true);
      H.registrar();
      M.spawns.push(L.novoSpawn({ id: L.novoId(M.spawns), x, y, z: M.andar, proximo: M.proximo, bicho: M.bicho }));
      depoisDeEditar();
    } else if (M.ferramenta === 'apagarSpawn' && primeiro) {
      const ja = spawnNa(x, y);
      if (ja < 0) return;
      H.registrar();
      M.spawns.splice(ja, 1);
      M.sel = -1;
      selecionar(-1);
      depoisDeEditar();
    }
  }

  // ------------------------------------------------------------------ painéis
  function selecionarFerramenta(nome) {
    M.ferramenta = nome;
    document.querySelectorAll('.mp-ferramenta').forEach((b) => b.classList.toggle('ativa', b.dataset.f === nome));
    const aj = $m('ajuda');
    if (aj) aj.textContent = AJUDA[nome];
  }

  function montarPaleta() {
    const caixa = $m('paleta');
    if (!caixa) return;
    const cidade = M.opcoes?.cidade;
    const img = cidade && atlas(cidade.atlas);
    caixa.replaceChildren(...(M.opcoes?.paleta ?? []).map((indice) => {
      const c = el('canvas', { width: 32, height: 32 });
      const e = cidade?.palette[indice];
      if (img && e) {
        const [ax, ay] = e.cells?.[0] ?? [e.ax, e.ay];
        c.getContext('2d').drawImage(img, ax + (cidade.cell - e.w), ay + (cidade.cell - e.h), e.w, e.h, 32 - e.w, 32 - e.h, e.w, e.h);
      }
      return el('button', { type: 'button', class: `mp-piso${indice === M.piso ? ' ativa' : ''}`, disabled: M.real, onclick: () => { M.piso = indice; if (M.ferramenta !== 'parede') selecionarFerramenta('pincel'); montarPaleta(); } }, c, ` índice ${indice}`);
    }));
  }

  function montarListaDeBichos() {
    const lista = $m('bichos');
    if (!lista) return;
    const daqui = new Set([...(M.opcoes?.criaturasPorHunt?.[M.id] ?? []), ...M.spawns.map(L.keyDoSpawn)]);
    const grupos = L.gruposDeBichos(M.bestiario, { filtro: M.filtro, daqui });
    lista.replaceChildren(...grupos.flatMap(({ titulo, bichos }) => {
      if (!bichos.length && titulo.startsWith('Deste')) return [];
      return [el('div', { class: 'mp-grupo' }, titulo), ...bichos.map((b) => el('div', { class: `mp-bicho${M.bicho?.key === b.key ? ' ativa' : ''}`, onclick: () => escolherBicho(b) },
        outfitCanvas(b.look, b.colors, 32), el('span', {}, b.name, el('small', {}, `hp ${b.hp}${b.classe ? ` · ${b.classe}` : ''}`, b.boss ? el('span', { class: 'mp-chefe' }, ' · boss') : null))))];
    }));
  }
  function escolherBicho(b) {
    M.bicho = b;
    if (M.sel >= 0) {
      H.registrar();
      M.spawns[M.sel].criaturas = [{ key: b.key, peso: 1 }];
      depoisDeEditar();
    } else selecionarFerramenta('spawn');
    montarListaDeBichos();
  }

  function selecionar(i) {
    M.sel = i;
    montarEdicao();
    atualizarListaDeSpawns();
    desenharMarcas();
  }

  function aplicarNoAlvo(raridade, mods) {
    H.registrar();
    L.aplicarRaridade(alvoDaEdicao(), alvoDaEdicao() === M.proximo, raridade, mods, M);
    montarEdicao();
    depoisDeEditar();
  }

  function montarEdicao() {
    const caixa = $m('edicao');
    if (!caixa) return;
    const alvo = alvoDaEdicao();
    const ehProximo = alvo === M.proximo;
    const raridade = ehProximo ? M.proximo.raridade : raridadeDe(alvo);
    const mods = alvo.modificadores ?? [];
    const teto = L.tetoDe(M.raridades, raridade === 'normal' ? 'modificado' : raridade);
    const campoNumero = (rotulo, valor, min, max, aoMudar) => el('label', { class: 'campo' }, rotulo, el('input', { type: 'number', min, max, value: valor, onchange: (e) => aoMudar(e.target.value) }));
    caixa.replaceChildren(
      el('div', { class: 'mp-editando' }, M.sel >= 0 ? [`Editando ${alvo.id}: ${nomeDe(L.keyDoSpawn(alvo))} (${alvo.x},${alvo.y})`, el('button', { type: 'button', onclick: () => selecionar(-1) }, 'Pronto')] : 'Valem para o próximo spawn marcado'),
      el('div', { class: 'mp-duas' },
        campoNumero('Raio', alvo.raio ?? 0, 0, 10, (v) => { H.registrar(); alvo.raio = L.limitarRaio(v); depoisDeEditar(); }),
        campoNumero('Quantidade', alvo.quantidade ?? 1, 1, 20, (v) => { H.registrar(); alvo.quantidade = L.limitarQuantidade(v); depoisDeEditar(); })),
      el('label', { class: 'campo' }, 'Raridade', el('select', { style: `color:${corDaRaridade(raridade) ?? ''}`, onchange: (e) => aplicarNoAlvo(e.target.value, mods) }, M.raridades.map((r) => el('option', { value: r.id, selected: r.id === raridade, style: `color:${r.cor}` }, `${r.nome}${r.maxModificadores ? ` (até ${r.maxModificadores} modificadores)` : ''}`)))),
      el('h4', {}, 'Modificadores ', el('span', { class: 'dica' }, `(${mods.length}/${teto})`)),
      el('div', { class: 'mp-mods' }, M.modificadores.map((m) => {
        const st = L.estadoDoModificador(m, mods, raridade, M);
        return el('label', { class: `mp-mod${st.travado ? ' travado' : ''}`, title: st.motivo ?? '' }, el('input', { type: 'checkbox', checked: st.marcado, disabled: st.travado, onchange: (e) => aplicarNoAlvo(raridade, e.target.checked ? [...mods, m.id] : mods.filter((id) => id !== m.id)) }), el('span', {}, m.nome, el('small', {}, m.descricao)));
      })),
      el('div', { class: 'mp-atributos', id: 'mp-atributos' }, 'Selecione um spawn para ver os atributos calculados do monstro.'));
    montarAtributos(alvo, raridade, mods);
  }

  const textoDaOrigem = (o) => `${o.fonte}${o.valor != null ? `: ${o.valor}` : ''}${o.fator != null ? ` ×${String(o.fator).replace('.', ',')}` : ''}${o.pct != null ? ` ${o.pct > 0 ? '+' : ''}${o.pct}%` : ''}`;
  /** F30: os atributos CALCULADOS pelo servidor (a tela só mostra). Resposta fora de ordem é descartada. */
  async function montarAtributos(alvo, raridade, mods) {
    const painel = document.getElementById('mp-atributos');
    if (!painel || alvo === M.proximo) return;
    const meu = ++M.pedidoAtributos;
    const q = new URLSearchParams({ key: L.keyDoSpawn(alvo), level: String(M.nivelCalculo), raridade, mods: mods.join(',') });
    const d = await fetch(`/api/mapas/atributos-do-mob?${q}`).then((r) => r.json()).catch(() => null);
    if (meu !== M.pedidoAtributos) return;
    if (!d?.ok) return painel.replaceChildren(d?.erro ?? 'Não consegui calcular os atributos.');
    const nivel = el('input', { type: 'number', min: 1, max: 2000, value: M.nivelCalculo, title: 'Level da fase para o cálculo', onchange: (e) => { M.nivelCalculo = Number(e.target.value) || 100; montarAtributos(alvo, raridade, mods); } });
    const linhas = [['Vida', d.atributos.vida], ['Dano (multiplicador)', d.atributos.dano], ['Precisão', d.atributos.precisao], ['Evasão', d.atributos.evasao], ['Armadura', d.atributos.armadura]];
    const extras = [];
    if (d.atributos.bloqueio) extras.push(`Bloqueio: ${Math.round(d.atributos.bloqueio * 100)}%`);
    if (d.atributos.reducaoDeDano) extras.push(`Redução de dano: ${Math.round(d.atributos.reducaoDeDano * 100)}%`);
    extras.push(`Velocidade de ataque: ×${String(d.atributos.velocidadeDeAtaque).replace('.', ',')}`);
    const res = Object.entries(d.atributos.resistencias ?? {}).filter(([, v]) => v).map(([k, v]) => `${k} ${v}%`);
    if (res.length) extras.push(`Resistências do bestiário: ${res.join(', ')}`);
    painel.replaceChildren(
      el('h4', {}, `Atributos calculados — ${d.nome} (Lv ${d.level}) · level `, nivel),
      ...(d.erros ?? []).map((e) => el('p', { class: 'mp-erro' }, `Erro: ${e}`)),
      ...(d.avisos ?? []).map((a) => el('p', { class: 'mp-aviso' }, `Aviso: ${a}`)),
      ...linhas.map(([nome, a]) => el('details', {}, el('summary', {}, `${nome}: ${Math.round(a.valor * 100) / 100}`), a.origens.map((o) => el('div', { class: 'mp-origem' }, textoDaOrigem(o))))),
      el('p', {}, extras.join(' · ')),
      ...(d.ataques ?? []).map((at) => el('div', { class: 'mp-origem' }, `${at.tipo === 'melee' ? 'Corpo a corpo' : 'Magia'} (${at.elemento}): ${at.min}–${at.max}, a cada ${(at.intervalo / 1000).toFixed(1).replace('.', ',')} s`)));
  }

  function atualizarListaDeSpawns() {
    const lista = $m('spawns');
    if (!lista || !M.mapa) return;
    let n = 0;
    const itens = [];
    M.spawns.forEach((s, i) => {
      if (L.zDoSpawn(s, M.mapa) !== M.andar) return;
      n++;
      const erros = errosDoSpawn(s.id);
      itens.push(el('div', { class: `mp-spawn${i === M.sel ? ' selecionado' : ''}${erros.length ? ' com-erro' : ''}`, title: erros.join('\n'), onclick: () => { selecionar(i === M.sel ? -1 : i); if (M.sel >= 0) centralizar(s.x, s.y); } },
        el('span', { style: `color:${corDaRaridade(raridadeDe(s)) ?? ''}` }, `${s.id} · ${nomeDe(L.keyDoSpawn(s))}${(s.quantidade ?? 1) > 1 ? ` ×${s.quantidade}` : ''} (${s.x},${s.y})`, s.modificadores?.length ? el('span', { class: 'mp-mods-do-spawn' }, s.modificadores.map((id) => M.modificadores.find((m) => m.id === id)?.nome ?? id).join(' · ')) : null, erros.length ? el('span', { class: 'mp-erro' }, erros[0]) : null),
        el('button', { type: 'button', title: 'Apagar este spawn', onclick: (e) => { e.stopPropagation(); H.registrar(); M.spawns.splice(i, 1); M.sel = -1; selecionar(-1); depoisDeEditar(); } }, '✕')));
    });
    lista.replaceChildren(...itens);
    const cont = $m('contagem');
    if (cont) cont.textContent = `${n}${M.spawns.length !== n ? ` de ${M.spawns.length} no mapa` : ''}`;
    montarAndares();
    const dist = $m('distribuicao');
    if (dist) dist.replaceChildren(...painelDaDistribuicao());
  }

  const COR_DA_FAIXA = { normal: '#9aa4bd', modificado: '#5aa9ff', raro: '#f2d04a', elite: '#ff9d3c', unico: '#c58bff', boss: '#ff5b4f' };
  function painelDaDistribuicao() {
    const d = L.distribuicaoDeRaridade(M.spawns, raridadeDe);
    if (!d.total) return [el('div', { class: 'dica' }, 'Sem spawns.')];
    return [el('div', { class: 'mp-faixa' }, Object.entries(d.porRaridade).map(([r, n]) => el('i', { style: `flex:${n};background:${corDaRaridade(r) ?? COR_DA_FAIXA[r] ?? '#9aa4bd'}`, title: `${r}: ${n}` }))),
      el('div', { class: 'dica' }, Object.entries(d.porRaridade).map(([r, n]) => `${M.raridades.find((x) => x.id === r)?.nome ?? r} ${n}`).join(' · ') + ` — ${d.total} bichos`)];
  }
  const painelDaValidacao = () => (M.errosDaValidacao.length ? [el('ul', { class: 'problemas' }, M.errosDaValidacao.slice(0, 20).map((e) => el('li', { class: 'erro' }, `✖ ${e}`)))] : [el('div', { class: 'selo ok' }, 'Spawns válidos')]);

  function montarAndares() {
    const sel = $m('andar');
    if (!sel || !M.mapa) return;
    sel.replaceChildren(...L.spawnsPorAndar(M.spawns, M.mapa).map((a) => el('option', { value: a.z, selected: a.z === M.andar }, `${a.z}${a.entrada ? ' (entrada)' : ''} — ${a.spawns} spawns`)));
  }
  function centralizar(x, y) {
    const wrap = $m('wrap');
    const t = TILE * M.escala;
    wrap.scrollTo({ left: x * t - wrap.clientWidth / 2, top: y * t - wrap.clientHeight / 2, behavior: 'smooth' });
  }
  function atualizarBarraDoHistorico() {
    const e = H.estado();
    const d = $m('desfazer');
    const r = $m('refazer');
    if (d) d.disabled = !e.podeDesfazer;
    if (r) r.disabled = !e.podeRefazer;
  }

  // ------------------------------------------------------------------ abrir / novo / salvar (F1–F9)
  function abrir(novo, id) {
    M.mapa = novo;
    M.id = id;
    M.real = L.ehMapaReal(novo, M.opcoes.cidade);
    M.andar = novo.z ?? 7;
    M.spawns = L.spawnsDoMapaAberto(novo);
    M.sel = -1;
    M.errosDaValidacao = [];
    M.escala = novo.width * novo.height > 20000 ? 0.5 : 1;
    H.limpar();
    sujo?.limpar();
    if (M.real && (M.ferramenta === 'pincel' || M.ferramenta === 'parede')) M.ferramenta = 'spawn';
    pintarTudo();
    const primeiro = M.spawns.find((s) => L.zDoSpawn(s, novo) === M.andar);
    if (primeiro) centralizar(primeiro.x, primeiro.y);
    validarAoVivo();
  }
  function criarNovo() {
    const w = Number($m('w').value);
    const h = Number($m('h').value);
    if (!L.tamanhoValido(w, h)) return dizer(`Largura e altura entre ${L.LIMITES.lado[0]} e ${L.LIMITES.lado[1]}.`, true);
    abrir(L.novoMapa(w, h, M.opcoes.cidade, M.piso), null);
    $m('id').value = '';
  }
  async function salvar() {
    const id = $m('id').value.trim();
    const r = L.corpoDeSalvar({ id, mapa: M.mapa, spawns: M.spawns, real: M.real, idAberto: M.id });
    if (r.erro) return dizer(r.erro, true);
    const resposta = await fetch('/api/mapas', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(r.corpo) }).then((x) => x.json()).catch(() => ({ ok: false, erro: 'Sem resposta do servidor.' }));
    if (!resposta.ok) return dizer(resposta.erro, true);
    M.id = id;
    sujo?.limpar();
    dizer(L.mensagemDeSalvo(id, M.real, M.spawns.length));
    await carregarLista(id);
    pintarTudo();
  }
  async function carregarLista(manter = null) {
    M.ids = (await fetch('/api/mapas').then((r) => r.json())).ids;
    const sel = $m('lista');
    if (sel) {
      sel.replaceChildren(...M.ids.map((id) => el('option', { value: id }, id)));
      if (manter) sel.value = manter;
    }
  }
  async function abrirPeloId(id) {
    if (!id) return;
    if (sujo?.esta() && !(await sujo.confirmarDescartar())) return;
    dizer(`Abrindo "${id}"…`);
    const m = await fetch(`/api/mapas/${id}`).then((r) => r.json());
    if (!m || m.ok === false) return dizer('Não achei esse mapa.', true);
    abrir(m, id);
    $m('id').value = id;
    $m('w').value = m.width;
    $m('h').value = m.height;
    dizer(`Carregado "${id}" — ${M.spawns.length} spawns em ${(m.levels ?? [m.z]).length} andar(es).`);
  }

  // ------------------------------------------------------------------ tela
  function pintarTudo() {
    if (!pronto || !M.mapa || !fundo) return;
    ajustarCanvas();
    desenharFundo();
    montarPaleta();
    montarListaDeBichos();
    selecionarFerramenta(M.ferramenta);
    $m('selo').textContent = M.real ? 'Mapa real — só os spawns são editados (o chão fica como está)' : M.id ? 'Mapa do editor — chão e spawns' : 'Mapa novo';
    $m('selo').classList.toggle('real', M.real);
    document.querySelectorAll('.mp-ferramenta[data-f=pincel], .mp-ferramenta[data-f=parede]').forEach((b) => { b.disabled = M.real; });
    $m('zoom').value = String(M.escala);
    montarEdicao();
    atualizarListaDeSpawns();
    atualizarBarraDoHistorico();
  }

  function esqueleto() {
    const campo = (rot, id, props = {}) => el('label', { class: 'campo mp-curto' }, rot, el('input', { id: `mp-${id}`, ...props }));
    fundo = el('canvas', { id: 'mp-fundo' });
    marcas = el('canvas', { id: 'mp-marcas' });
    ctxFundo = fundo.getContext('2d');
    ctxMarcas = marcas.getContext('2d');
    marcas.addEventListener('mousedown', (e) => {
      if (!M.mapa) return;
      M.arrastando = true;
      const c = casaDoEvento(e);
      if (c) aplicarFerramenta(c.x, c.y, true);
    });
    marcas.addEventListener('mousemove', (e) => {
      if (!M.mapa) return;
      const c = casaDoEvento(e);
      const mudou = c?.x !== M.hover?.x || c?.y !== M.hover?.y;
      M.hover = c;
      if (c) $m('status').textContent = L.textoDaCasa(M.mapa, M.andar, c, M.spawns, nomeDe);
      if (M.arrastando && c && (M.ferramenta === 'pincel' || M.ferramenta === 'parede')) aplicarFerramenta(c.x, c.y, false);
      else if (mudou) desenharMarcas();
    });
    marcas.addEventListener('mouseleave', () => { M.hover = null; desenharMarcas(); });
    window.addEventListener('mouseup', () => { M.arrastando = false; });
    return el('div', { class: 'mp-tela' },
      cabecalho('Mapas', 'O editor de mapas na Engine: chão (mapa do editor), spawns, raridade e modificadores, com desfazer, validação ao vivo e a distribuição de raridade. O /editor antigo continua disponível.',
        el('button', { type: 'button', id: 'mp-desfazer', disabled: true, onclick: desfazer }, '↶ Desfazer'), el('button', { type: 'button', id: 'mp-refazer', disabled: true, onclick: refazer }, '↷ Refazer'), el('button', { type: 'button', class: 'primario', onclick: salvar }, 'Salvar')),
      el('div', { class: 'mp-barra' },
        campo('Id', 'id', { placeholder: 'minha-caverna' }), campo('Largura', 'w', { type: 'number', value: 40, min: 5, max: 300 }), campo('Altura', 'h', { type: 'number', value: 30, min: 5, max: 300 }),
        el('button', { type: 'button', onclick: criarNovo }, 'Novo mapa'),
        el('label', { class: 'campo mp-curto' }, 'Carregar', el('select', { id: 'mp-lista' })), el('button', { type: 'button', onclick: () => abrirPeloId($m('lista').value) }, 'Abrir'),
        el('span', { id: 'mp-selo', class: 'selo' }, 'Mapa novo')),
      el('div', { class: 'mp-barra' },
        el('label', { class: 'campo mp-curto' }, 'Andar', el('select', { id: 'mp-andar', onchange: (e) => { M.andar = Number(e.target.value); selecionar(-1); desenharFundo(); } })),
        el('label', { class: 'campo mp-curto' }, 'Zoom', el('select', { id: 'mp-zoom', onchange: (e) => { M.escala = Number(e.target.value); ajustarCanvas(); desenharFundo(); } }, [['0.25', '25%'], ['0.5', '50%'], ['0.75', '75%'], ['1', '100%'], ['1.5', '150%']].map(([v, n]) => el('option', { value: v }, n)))),
        el('label', { class: 'marca' }, el('input', { type: 'checkbox', onchange: (e) => { M.verBloqueio = e.target.checked; desenharMarcas(); } }), 'Mostrar bloqueado'),
        el('label', { class: 'marca' }, el('input', { type: 'checkbox', checked: true, onchange: (e) => { M.verRaio = e.target.checked; desenharMarcas(); } }), 'Mostrar raio dos spawns'),
        el('span', { id: 'mp-status', class: 'dica' })),
      el('div', { class: 'mp-corpo' },
        el('aside', { class: 'mp-esq' }, el('h4', {}, 'Ferramenta'), L.FERRAMENTAS.map((f) => el('button', { type: 'button', class: 'mp-ferramenta', 'data-f': f, onclick: () => selecionarFerramenta(f) }, NOME_DA_FERRAMENTA[f])), el('div', { id: 'mp-ajuda', class: 'dica' }), el('h4', {}, 'Piso (sprites reais)'), el('div', { id: 'mp-paleta' })),
        el('div', { id: 'mp-wrap', class: 'mp-wrap' }, el('div', { id: 'mp-camadas', class: 'mp-camadas' }, fundo, marcas)),
        el('aside', { class: 'mp-dir' },
          el('h4', {}, 'Criatura do próximo spawn'), el('input', { type: 'search', placeholder: 'buscar no bestiário…', oninput: (e) => { M.filtro = e.target.value; montarListaDeBichos(); } }), el('div', { id: 'mp-bichos', class: 'mp-bichos' }),
          el('div', { id: 'mp-edicao', class: 'mp-edicao' }),
          el('h4', {}, 'Validação ao vivo'), el('div', { id: 'mp-validacao' }, ...painelDaValidacao()),
          el('h4', {}, 'Distribuição de raridade'), el('div', { id: 'mp-distribuicao' }),
          el('h4', {}, 'Spawns neste andar (', el('span', { id: 'mp-contagem' }, '0'), ')'), el('div', { id: 'mp-spawns', class: 'mp-spawns' }))));
  }
  function desfazer() { if (H.desfazer()) atualizarBarraDoHistorico(); }
  function refazer() { if (H.refazer()) atualizarBarraDoHistorico(); }

  // Ctrl+Z / Ctrl+Y só enquanto a aba Mapas está aberta e fora de campos de texto.
  document.addEventListener('keydown', (e) => {
    if (!document.getElementById('mp-marcas')) return;
    if (/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName ?? '')) return;
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !e.shiftKey) { e.preventDefault(); desfazer(); }
    else if ((e.ctrlKey || e.metaKey) && (e.key.toLowerCase() === 'y' || (e.key.toLowerCase() === 'z' && e.shiftKey))) { e.preventDefault(); refazer(); }
  });

  async function desenhar(resto = []) {
    const [dados] = await Promise.all([fetch('/api/mapas/opcoes').then((r) => r.json()), loadSpriteData()]);
    M.opcoes = dados;
    M.bestiario = [...dados.bestiario].sort((a, b) => a.name.localeCompare(b.name));
    M.porKey = new Map(M.bestiario.map((b) => [b.key, b]));
    M.raridades = dados.raridades ?? [];
    M.modificadores = dados.modificadores ?? [];
    M.tipoDoSpawn = dados.tipoDoSpawn ?? {};
    M.piso = dados.paleta[0] ?? PISOS_PADRAO;
    raiz().replaceChildren(esqueleto());
    pronto = true;
    await carregarLista();
    const pedido = resto?.[0];
    if (pedido && M.ids.includes(pedido)) { $m('lista').value = pedido; await abrirPeloId(pedido); } else criarNovo();
  }

  return { desenhar, abrir: (_cat, id) => abrirPeloId(id), focarBusca: () => document.querySelector('.mp-dir input[type=search]')?.focus(), _estado: M };
}
