// Editor de conteúdo (/editor/conteudo): fases, encontros e bosses. Ferramenta interna do dono, sem login — as rotas
// de escrita ficam sob `/api/mapas/_conteudo/`, que o nginx de produção só abre por túnel SSH. NENHUMA regra mora
// aqui: toda validação é do servidor (a mesma do jogo, mais "o ponto é andável no mapa?").
import { svg, fundoDoAto, nomeDoTema } from './world-arte.mjs';
import { LARGURA, ALTURA, TIPOS_DE_NO, posicoesDoAto, conexoesDoAto, tracadoDaEstrada, tipoDaFase, atosDaCampanha } from './world-dados.mjs';
import { desenharNo } from './world.mjs';

const BASE = '/api/mapas/_conteudo/';
const S = { opcoes: null, aba: 'geral', auditoria: null, faseId: null, fase: null, encontros: [], validacao: { erros: [], avisos: [] }, bosses: [], bossoId: null, boss: null, bossErros: [], sujo: false };

const $ = (s) => document.querySelector(s);
const msg = (t, tipo = 'aviso') => {
  const m = $('#msg');
  m.textContent = t;
  m.style.color = tipo === 'ok' ? 'var(--ok)' : tipo === 'erro' ? 'var(--erro)' : 'var(--aviso)';
};
function el(tag, props = {}, ...filhos) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(props ?? {})) {
    if (k === 'class') e.className = v;
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else if (v === true) e.setAttribute(k, '');
    else if (v !== false && v != null) e.setAttribute(k, v);
  }
  for (const f of filhos.flat()) if (f != null && f !== false) e.append(f.nodeType ? f : document.createTextNode(String(f)));
  return e;
}
async function api(rota, corpo) {
  const r = await fetch(BASE + rota, corpo === undefined ? undefined : { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(corpo) });
  return r.json();
}
const depois = (fn, ms = 400) => {
  let t;
  return (...a) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...a), ms);
  };
};

// ------------------------------------------------------------------ campos ligados a um objeto

/** Liga um input a `obj[chave]`: número converte; vazio apaga (se opcional). */
function ligar(input, obj, chave, { numero = false, opcional = false, aoMudar } = {}) {
  input.addEventListener('input', () => {
    const v = input.type === 'checkbox' ? input.checked : input.value;
    if (input.type !== 'checkbox' && v === '' && opcional) delete obj[chave];
    else obj[chave] = numero ? Number(v) : v;
    (aoMudar ?? marcarSujo)();
  });
  return input;
}
const marcarSujo = () => {
  S.sujo = true;
  validarEncontros();
};
function campo(rotulo, obj, chave, { tipo = 'text', numero = tipo === 'number', opcional = false, lista = null, aoMudar, dica } = {}) {
  const i = el('input', { type: tipo, value: obj[chave] ?? '', ...(lista ? { list: lista } : {}), ...(tipo === 'number' ? { step: 'any' } : {}) });
  return el('label', { class: 'campo', title: dica ?? '' }, rotulo, ligar(i, obj, chave, { numero, opcional, aoMudar }));
}
function marca(rotulo, obj, chave, aoMudar) {
  const i = el('input', { type: 'checkbox' });
  i.checked = !!obj[chave];
  return el('label', { class: 'marca' }, ligar(i, obj, chave, { aoMudar }), rotulo);
}
function escolha(rotulo, obj, chave, opcoes, { opcional = false, aoMudar } = {}) {
  const s = el('select', {}, opcional ? el('option', { value: '' }, '—') : null, opcoes.map((o) => el('option', { value: o.id ?? o }, o.nome ?? o.id ?? o)));
  s.value = obj[chave] ?? '';
  return el('label', { class: 'campo' }, rotulo, ligar(s, obj, chave, { opcional, aoMudar }));
}
function opcional(titulo, obj, chave, criar, desenhar, aoMudar = marcarSujo) {
  const caixa = el('fieldset', {});
  const cab = el('legend', {});
  const c = el('input', { type: 'checkbox' });
  c.checked = obj[chave] != null;
  cab.append(c, ` ${titulo}`);
  const miolo = el('div', { class: 'linhas' });
  const pintar = () => {
    miolo.replaceChildren();
    if (obj[chave] != null) miolo.append(desenhar(obj[chave]));
  };
  c.addEventListener('change', () => {
    if (c.checked) obj[chave] = criar();
    else delete obj[chave];
    pintar();
    aoMudar();
  });
  pintar();
  caixa.append(cab, miolo);
  return caixa;
}
/** Uma lista de linhas editável: cada item vira uma linha desenhada por `linha(item, remover)`. */
function listaEditavel(titulo, lista, novo, linha) {
  const caixa = el('fieldset', {}, el('legend', {}, titulo));
  const corpo = el('div', { class: 'linhas' });
  const pintar = () => {
    corpo.replaceChildren(
      ...lista.map((item, i) => el('div', { class: 'linha' }, linha(item), el('button', { type: 'button', title: 'Remover', onclick: () => { lista.splice(i, 1); pintar(); marcarSujo(); } }, '✕')))
    );
  };
  caixa.append(corpo, el('button', { type: 'button', onclick: () => { lista.push(novo()); pintar(); marcarSujo(); } }, '+ adicionar'));
  pintar();
  return caixa;
}

// ------------------------------------------------------------------ pedaços reutilizáveis (itens, criaturas, efeitos)

const datalists = () => {
  if ($('#dl-bichos')) return;
  document.body.append(
    el('datalist', { id: 'dl-bichos' }, S.opcoes.bestiario.map((b) => el('option', { value: b.key ?? b.id }, b.name ?? b.nome ?? ''))),
    el('datalist', { id: 'dl-itens' })
  );
};
const buscarItens = depois(async (q) => {
  const r = await api(`itens?q=${encodeURIComponent(q)}`);
  $('#dl-itens').replaceChildren(...(r.itens ?? []).map((i) => el('option', { value: String(i.id) }, i.name)));
}, 250);
/** O id de item com busca por nome: digite o nome e escolha; o campo guarda o número. */
function campoDeItem(obj, chave = 'id') {
  const i = el('input', { type: 'text', list: 'dl-itens', placeholder: 'nome ou id do item', value: obj[chave] ?? '' });
  i.addEventListener('input', () => {
    if (/^\d+$/.test(i.value)) obj[chave] = Number(i.value);
    else buscarItens(i.value);
    marcarSujo();
  });
  return i;
}
function linhaDeDrop(d) {
  return el('div', { class: 'linha' }, campoDeItem(d), ligar(el('input', { type: 'number', step: 'any', placeholder: 'chance %', value: d.chance ?? '' }), d, 'chance', { numero: true }));
}
function editorDeCriaturas(g, { comRaridade = true } = {}) {
  g.criaturas ??= [];
  return el(
    'div',
    { class: 'linhas' },
    listaEditavel('Criaturas', g.criaturas, () => ({ key: '', qtd: 1 }), (c) => [ligar(el('input', { list: 'dl-bichos', placeholder: 'criatura', value: c.key }), c, 'key'), ligar(el('input', { type: 'number', min: 1, max: 5, value: c.qtd ?? 1 }), c, 'qtd', { numero: true })]),
    comRaridade ? escolha('Raridade', g, 'raridade', S.opcoes.raridades?.raridades ?? ['normal', 'modificado', 'raro', 'elite'], { opcional: true }) : null
  );
}
function editorDeEfeitos(lista, negativo) {
  return listaEditavel(negativo ? 'Penalidades' : 'Bônus', lista, () => ({ afixo: S.opcoes.afixosDeAltar[0].id, valor: negativo ? -5 : 5 }), (e) => [
    (() => {
      const s = el('select', {}, S.opcoes.afixosDeAltar.map((a) => el('option', { value: a.id }, `${a.nome} (até ${a.max * 2})`)));
      s.value = e.afixo;
      return ligar(s, e, 'afixo');
    })(),
    ligar(el('input', { type: 'number', step: 'any', value: e.valor }), e, 'valor', { numero: true }),
  ]);
}
function editorDeRecompensa(r) {
  r.drops ??= [];
  return el(
    'div',
    { class: 'linhas' },
    el('div', { class: 'grade' }, campo('Rolagens (quantidade de itens)', r, 'rolagens', { tipo: 'number', opcional: true }), campo('Média de moedas', r, 'moedasMedia', { tipo: 'number', opcional: true }), S.opcoes.tabelas.length ? escolha('Tabela reutilizável', r, 'tabela', S.opcoes.tabelas, { opcional: true }) : null),
    listaEditavel('Drops (chance em %)', r.drops, () => ({ id: '', chance: 10 }), linhaDeDrop),
    opcional('Prêmio da primeira conclusão', r, 'primeiraConclusao', () => ({ gold: 0 }), (p) => el('div', { class: 'grade' }, campo('Ouro', p, 'gold', { tipo: 'number', opcional: true }), campo('Experiência', p, 'exp', { tipo: 'number', opcional: true }))),
    el('div', { class: 'dica' }, 'A primeira conclusão paga uma vez por personagem; as repetições dão só o loot normal. O servidor recusa valor esperado acima do teto de economia.')
  );
}

// ------------------------------------------------------------------ cartão de um encontro

const NOVOS = {
  'bau-comum': () => ({ tipo: 'bau-comum', recompensa: { drops: [{ id: 3031, chance: 100 }], moedasMedia: 100 } }),
  'bau-raro': () => ({ tipo: 'bau-raro', recompensa: { drops: [{ id: 3031, chance: 100 }], moedasMedia: 200, rolagens: 2 }, guardioes: { criaturas: [{ key: '', qtd: 2 }] } }),
  'bau-amaldicoado': () => ({ tipo: 'bau-amaldicoado', recompensa: { drops: [{ id: 3031, chance: 100 }], moedasMedia: 200 }, invocacao: { criaturas: [{ key: '', qtd: 3 }] } }),
  altar: () => ({ tipo: 'altar', efeitos: [{ afixo: 'phys_dmg', valor: 5 }], duracaoMs: 60000 }),
  sobrevivencia: () => ({ tipo: 'sobrevivencia', ondas: [{ criaturas: [{ key: '', qtd: 2 }] }, { criaturas: [{ key: '', qtd: 3 }] }], pausaMs: 4000, recompensa: { drops: [{ id: 3031, chance: 100 }], moedasMedia: 100, porOnda: true } }),
  fenda: () => ({ tipo: 'fenda', ondas: [{ criaturas: [{ key: '', qtd: 2 }] }, { criaturas: [{ key: '', qtd: 3 }] }], pausaMs: 3000, limiteMs: 120000, recompensa: { drops: [{ id: 3031, chance: 100 }], moedasMedia: 100, porOnda: true } }),
  aprisionado: () => ({ tipo: 'aprisionado', prisioneiro: { nome: 'Prisioneiro' }, captores: { criaturas: [{ key: '', qtd: 3 }] }, recompensa: { drops: [{ id: 3031, chance: 100 }], moedasMedia: 150 } }),
  invasor: () => ({ tipo: 'invasor', invasores: { criaturas: [{ key: '', qtd: 4 }], raridade: 'raro' }, recompensa: { drops: [{ id: 3031, chance: 100 }], moedasMedia: 150 }, condicao: { tipo: 'monstros-limpos' } }),
  'area-secreta': () => ({ tipo: 'area-secreta', descricao: 'Uma passagem escondida atrás da parede.', ocupantes: { criaturas: [{ key: '', qtd: 4 }], raridade: 'raro' }, recompensa: { drops: [{ id: 3031, chance: 100 }], moedasMedia: 300, rolagens: 2 }, condicao: { tipo: 'monstros-limpos' } }),
  escolta: () => ({ tipo: 'escolta', descricao: 'Um viajante precisa de proteção na travessia.', protegido: { nome: 'Viajante', vida: 100, desgastePorSegundo: 1.5 }, ondas: [{ criaturas: [{ key: '', qtd: 2 }] }, { criaturas: [{ key: '', qtd: 3 }] }], pausaMs: 4000, recompensa: { drops: [{ id: 3031, chance: 100 }], moedasMedia: 200 } }),
  boss: () => ({ tipo: 'boss', bossId: '' }),
  miniboss: () => ({ tipo: 'miniboss', bossId: '', probabilidade: 20 }),
  'boss-secreto': () => ({ tipo: 'boss-secreto', bossId: '', probabilidade: 5 }),
};
const idNovo = (tipo) => {
  let n = 1;
  while (S.encontros.some((e) => e.id === `${tipo}-${n}`)) n++;
  return `${tipo}-${n}`;
};

function cartaoDeEncontro(e, i) {
  const d = el('details', { class: 'cartao', open: !e.nome });
  const bossDe = (id) => S.opcoes.bosses.find((b) => b.id === id);
  const sel = () => d.querySelector('summary b');
  d.append(
    el('summary', {}, el('b', {}, `${e.nome || e.id} `, el('span', { class: 'selo' }, e.tipo)), e.obrigatorio ? el('span', { class: 'selo aviso' }, 'obrigatório') : el('span', { class: 'selo' }, 'opcional'), e.ativo === false ? el('span', { class: 'selo erro' }, 'desligado') : null, e.probabilidade != null && e.probabilidade < 100 ? el('span', { class: 'selo' }, `${e.probabilidade}%`) : null)
  );
  const corpo = el('div', { class: 'corpo' });
  const aoMudar = () => marcarSujo();
  const ativoObj = { get ativo() { return e.ativo !== false; }, set ativo(v) { e.ativo = v; } };
  corpo.append(
    el('div', { class: 'grade' }, campo('Id', e, 'id'), campo('Nome', e, 'nome'), escolha('Tipo', e, 'tipo', S.opcoes.tipos.filter((t) => t.disponivel).map((t) => t.id)), campo('Probabilidade (%)', e, 'probabilidade', { tipo: 'number', opcional: true, dica: 'Sorteada UMA vez por instância (semente gravada).' }), campo('Quantidade', e, 'quantidade', { tipo: 'number', opcional: true })),
    el('div', { class: 'grade' }, marca('Ativo', ativoObj, 'ativo', aoMudar), marca('Obrigatório (trava o CLEAR da fase)', e, 'obrigatorio', aoMudar)),
    el('div', { class: 'grade' }, escolha('Condição para ficar disponível', e.condicao ??= { tipo: 'sempre' }, 'tipo', S.opcoes.condicoes), e.condicao.tipo === 'apos-encontro' ? escolha('…depois de', e.condicao, 'encontro', S.encontros.filter((x) => x !== e).map((x) => x.id)) : null),
    el('div', { class: 'grade' }, campo('x', e, 'x', { tipo: 'number', opcional: true }), campo('y', e, 'y', { tipo: 'number', opcional: true }), campo('andar (z)', e, 'z', { tipo: 'number', opcional: true }), campo('Expira em (ms, só opcionais)', e, 'expiraMs', { tipo: 'number', opcional: true }))
  );
  if (['boss', 'miniboss', 'boss-secreto'].includes(e.tipo)) {
    const aceitas = S.opcoes.categoriasDoTipo[e.tipo];
    const lista = S.opcoes.bosses.filter((b) => aceitas.includes(b.categoria));
    corpo.append(escolha(`Boss (categorias: ${aceitas.join(', ')})`, e, 'bossId', lista.map((b) => ({ id: b.id, nome: `${b.nome} [${b.categoria}]` })), { opcional: true }), el('div', { class: 'dica' }, bossDe(e.bossId) ? `Categoria: ${bossDe(e.bossId).categoria}` : 'Cadastre o boss na aba Bosses.'));
  }
  if (e.tipo.startsWith('bau')) {
    e.recompensa ??= { drops: [] };
    corpo.append(
      opcional('Recompensa', e, 'recompensa', () => ({ drops: [] }), editorDeRecompensa),
      opcional('Armadilha', e, 'armadilha', () => ({ chance: 20, elemento: 'fire', min: 10, max: 30 }), (a) => el('div', { class: 'grade' }, campo('Chance (%)', a, 'chance', { tipo: 'number' }), escolha('Elemento', a, 'elemento', S.opcoes.elementos), campo('Dano mín', a, 'min', { tipo: 'number' }), campo('Dano máx', a, 'max', { tipo: 'number' }))),
      opcional('Requisitos (só manual)', e, 'requisitos', () => ({ levelMin: 10 }), (r) => el('div', { class: 'grade' }, campo('Level mínimo', r, 'levelMin', { tipo: 'number', opcional: true }), el('div', { class: 'dica' }, 'Obrigatório não pode ter requisitos.')))
    );
    if (e.tipo === 'bau-raro') corpo.append(opcional('Guardiões (derrotar antes de abrir)', e, 'guardioes', () => ({ criaturas: [{ key: '', qtd: 2 }] }), editorDeCriaturas));
    if (e.tipo === 'bau-amaldicoado') {
      e.invocacao ??= { criaturas: [] };
      corpo.append(opcional('Invocação (sempre)', e, 'invocacao', () => ({ criaturas: [] }), editorDeCriaturas));
    }
    if (e.tipo !== 'bau-amaldicoado') {
      corpo.append(el('div', { class: 'grade' }, campo('Chance de invocação secreta (%)', e, 'chanceDeInvocacao', { tipo: 'number', opcional: true, dica: 'Pede "Invocação" abaixo.' })));
      if (e.chanceDeInvocacao != null) corpo.append(opcional('Invocação (quem aparece)', e, 'invocacao', () => ({ criaturas: [] }), editorDeCriaturas));
    }
  }
  if (e.tipo === 'altar') {
    e.efeitos ??= [];
    corpo.append(
      el('div', { class: 'grade' }, campo('Duração (ms)', e, 'duracaoMs', { tipo: 'number' })),
      editorDeEfeitos(e.efeitos, false),
      opcional('Penalidade', e, 'penalidade', () => ({ efeitos: [] }), (p) => (p.efeitos ??= [], el('div', { class: 'linhas' }, editorDeEfeitos(p.efeitos, true), opcional('Invoca inimigos', p, 'invocacao', () => ({ criaturas: [] }), editorDeCriaturas))))
    );
  }
  if (e.tipo === 'sobrevivencia' || e.tipo === 'fenda' || e.tipo === 'escolta') {
    e.ondas ??= [];
    if (e.tipo === 'escolta') {
      e.protegido ??= { nome: '' };
      corpo.append(el('div', { class: 'grade' }, campo('Protegido (nome)', e.protegido, 'nome'), campo('Vida do protegido', e.protegido, 'vida', { tipo: 'number', opcional: true }), campo('Desgaste por monstro/s', e.protegido, 'desgastePorSegundo', { tipo: 'number', opcional: true, dica: 'Cada emboscador vivo gasta isto por segundo; zerou, a escolta falha.' })));
    }
    e.recompensa ??= { drops: [] };
    corpo.append(
      el('div', { class: 'grade' }, campo('Pausa entre ondas (ms)', e, 'pausaMs', { tipo: 'number', opcional: true }), e.tipo === 'fenda' ? campo('Limite de tempo (ms)', e, 'limiteMs', { tipo: 'number', dica: 'Estourou, a fenda se fecha; ondas já vencidas ficam pagas. Fenda não pode ser obrigatória.' }) : null),
      listaEditavel('Ondas (em ordem; cada uma só nasce quando a anterior cai)', e.ondas, () => ({ criaturas: [{ key: '', qtd: 3 }] }), (o) => editorDeCriaturas(o)),
      opcional('Recompensa', e, 'recompensa', () => ({ drops: [] }), (r) => el('div', { class: 'linhas' }, marca('Pagar a cada onda vencida (proporcional ao desempenho)', r, 'porOnda', marcarSujo), editorDeRecompensa(r)))
    );
  }
  if (e.tipo === 'aprisionado' || e.tipo === 'invasor' || e.tipo === 'area-secreta') {
    const campoGrupo = { aprisionado: 'captores', invasor: 'invasores', 'area-secreta': 'ocupantes' }[e.tipo];
    if (e.tipo === 'aprisionado') {
      e.prisioneiro ??= { nome: '' };
      corpo.append(el('div', { class: 'grade' }, campo('Nome do prisioneiro', e.prisioneiro, 'nome')));
    }
    corpo.append(
      opcional(e.tipo === 'aprisionado' ? 'Captores (derrotar para libertar)' : 'Invasores (chegam sozinhos)', e, campoGrupo, () => ({ criaturas: [{ key: '', qtd: 3 }] }), editorDeCriaturas),
      escolha('Boss (opcional; capitão da cela / líder da invasão)', e, 'bossId', S.opcoes.bosses.map((b) => ({ id: b.id, nome: `${b.nome} [${b.categoria}]` })), { opcional: true }),
      opcional('Recompensa', e, 'recompensa', () => ({ drops: [] }), editorDeRecompensa)
    );
    if (e.tipo !== 'invasor') corpo.append(opcional('Bênção do libertado (temporária)', e, 'bencao', () => ({ efeitos: [], duracaoMs: 60000 }), (b) => (b.efeitos ??= [], el('div', { class: 'linhas' }, campo('Duração (ms)', b, 'duracaoMs', { tipo: 'number' }), editorDeEfeitos(b.efeitos, false)))));
  }
  if (e.tipo === 'area-secreta' || e.tipo === 'escolta') corpo.append(el('div', { class: 'grade' }, campo('Texto da janela de decisão', e, 'descricao', { opcional: true, dica: 'Quem decide é o líder da party (ou o jogador sozinho). Só opcional; recusar descarta.' })));
  corpo.append(el('div', { class: 'linha' }, el('span', { class: 'dica' }, 'O que o jogador vê é decidido na tela WORLD; segredos não aparecem no mapa.'), el('button', { type: 'button', class: 'perigo', onclick: () => { S.encontros.splice(i, 1); desenharFase(); marcarSujo(); } }, 'Remover encontro')));
  d.append(corpo);
  void sel;
  return d;
}

// ------------------------------------------------------------------ abas

const ABAS = [['geral', 'Visão geral'], ['fase', 'Fase e encontros'], ['mapa', 'Mapa do mundo'], ['bosses', 'Bosses'], ['biblioteca', 'Biblioteca']];
function desenharAbas() {
  $('#abas').replaceChildren(...ABAS.map(([id, nome]) => el('button', { class: S.aba === id ? 'ativa' : '', onclick: () => irPara(id) }, nome)));
}
async function irPara(aba, faseId = null) {
  if (S.sujo && !confirm('Há alterações não salvas. Sair mesmo assim?')) return;
  S.sujo = false;
  S.aba = aba;
  if (faseId) S.faseId = faseId;
  desenharAbas();
  msg('');
  if (aba === 'geral') await desenharGeral();
  if (aba === 'fase') await carregarFase(S.faseId ?? S.opcoes.fases[0].huntId);
  if (aba === 'mapa') {
    MW.dados = null;
    await desenharMapaDoMundo();
  }
  if (aba === 'bosses') await desenharBosses();
  if (aba === 'biblioteca') await desenharBiblioteca();
}

// ---- Visão geral
async function desenharGeral() {
  const a = (S.auditoria = await api('auditoria'));
  const t = a.totais;
  const raiz = $('#raiz');
  raiz.replaceChildren(
    el('h2', {}, 'Resumo'),
    el('div', {}, el('span', { class: 'selo' }, `${t.fases} fases`), el('span', { class: 'selo boss' }, `${t.comBoss} com boss`), el('span', { class: 'selo' }, `${t.comEncontros} com encontros`), el('span', { class: `selo ${t.erros ? 'erro' : 'ok'}` }, `${t.erros} erros`), el('span', { class: `selo ${t.avisos ? 'aviso' : 'ok'}` }, `${t.avisos} avisos`)),
    a.problemas.length ? el('ul', { class: 'problemas' }, a.problemas.map((p) => el('li', { class: p.nivel }, `[${p.onde}] ${p.mensagem}`))) : el('p', { class: 'dica' }, 'Nenhum problema de configuração.'),
    el('h2', {}, 'Fases'),
    el('table', {}, el('thead', {}, el('tr', {}, ['Ato', 'Fase', 'Nível (fácil)', 'Encontros', 'Bosses', 'Obrigatórios', 'Problemas'].map((h) => el('th', {}, h)))), el('tbody', {}, a.fases.map((f) => {
      const b = f.resumo.bosses;
      return el('tr', { class: 'clicavel', onclick: () => irPara('fase', f.huntId) },
        el('td', {}, f.ato), el('td', {}, `${f.indice + 1}. ${f.nome}`, f.pular ? el('span', { class: 'selo erro' }, 'travada') : null), el('td', {}, f.nivel?.facil ?? ''),
        el('td', {}, f.resumo.total ? `${f.resumo.ativos} ativos` + (f.resumo.desligados ? ` · ${f.resumo.desligados} desligados` : '') : '—'),
        el('td', {}, Object.entries(b).filter(([, n]) => n).map(([c, n]) => el('span', { class: 'selo boss' }, `${n} ${c}`))),
        el('td', {}, f.resumo.obrigatorios || '—'),
        el('td', {}, f.erros ? el('span', { class: 'selo erro' }, `${f.erros} erro(s)`) : null, f.avisos ? el('span', { class: 'selo aviso' }, `${f.avisos} aviso(s)`) : null));
    })))
  );
}

// ---- Fase e encontros
async function carregarFase(id) {
  const f = await api(`fase/${id}`);
  if (f.ok === false) return msg(f.erros?.[0] ?? 'Fase não encontrada.', 'erro');
  S.faseId = id;
  S.fase = f;
  S.encontros = JSON.parse(JSON.stringify(f.encontros));
  S.validacao = f.validacao;
  S.sujo = false;
  desenharFase();
}
const validarEncontros = depois(async () => {
  if (S.aba !== 'fase' || !S.faseId) return;
  S.validacao = await api(`fase/${S.faseId}/validar`, { encontros: S.encontros });
  const caixa = $('#validacao');
  if (caixa) caixa.replaceWith(blocoDeValidacao());
  const salvar = $('#salvarEncontros');
  if (salvar) salvar.disabled = !!S.validacao.erros?.length;
});
const textoDaEconomia = () => {
  const ec = S.validacao.economia ?? S.fase?.economia;
  if (!ec || !ec.valorDosEncontros) return null;
  return el('li', { class: 'dica' }, `Impacto econômico: os encontros somam ~${ec.valorDosEncontros.toLocaleString('pt-BR')} de ouro por instância — ${Math.round(ec.fracao * 100)}% do valor de limpar a fase (~${ec.valorDaFase.toLocaleString('pt-BR')}).`);
};
const blocoDeValidacao = () =>
  el('ul', { class: 'problemas', id: 'validacao' }, textoDaEconomia(), (S.validacao.erros ?? []).map((m) => el('li', { class: 'erro' }, m)), (S.validacao.avisos ?? []).map((m) => el('li', { class: 'aviso' }, m)), !(S.validacao.erros?.length || S.validacao.avisos?.length) ? el('li', { class: 'dica' }, 'Sem erros nem avisos.') : null);

function desenharFase() {
  const { fase } = S.fase;
  const meta = (S.meta = JSON.parse(JSON.stringify(S.fase.meta ?? {})));
  meta.conexoes ??= [];
  datalists();
  const seletor = el('select', { onchange: (ev) => irPara('fase', ev.target.value) }, S.opcoes.fases.map((f) => el('option', { value: f.huntId }, `Ato ${f.ato} — ${f.nome}`)));
  seletor.value = S.faseId;
  const novo = el('select', {}, S.opcoes.tipos.filter((t) => t.disponivel).map((t) => el('option', { value: t.id }, `${t.id} (${t.idle})`)));
  $('#raiz').replaceChildren(
    el('div', { class: 'linha' }, el('label', { class: 'campo' }, 'Fase', seletor), el('span', { class: 'dica' }, `Mapa ${S.fase.mapa.largura}×${S.fase.mapa.altura} · nível fácil/médio/difícil: ${Object.values(fase.nivel).join(' / ')}`)),
    el('h2', {}, 'Dados da fase (o que a tela WORLD mostra)'),
    el('div', { class: 'cartao' }, el('div', { class: 'corpo' },
      el('label', { class: 'campo' }, 'Descrição', (() => { const t = el('textarea', {}, meta.descricao ?? ''); return ligar(t, meta, 'descricao', { opcional: true, aoMudar: () => (S.sujo = true) }); })()),
      el('div', { class: 'grade' }, campo('Ambiente / tipo', meta, 'ambiente', { opcional: true, aoMudar: () => (S.sujo = true) }), campo('Level mínimo (requisito)', (meta.requisitos ??= {}), 'levelMin', { tipo: 'number', opcional: true, aoMudar: () => (S.sujo = true) })),
      el('details', {}, el('summary', {}, `Conexões (para onde esta fase leva) — ${meta.conexoes.length} marcada(s)`), el('div', { class: 'grade' }, S.opcoes.fases.filter((f) => f.huntId !== S.faseId).map((f) => {
        const c = el('input', { type: 'checkbox' });
        c.checked = meta.conexoes.includes(f.huntId);
        c.addEventListener('change', () => { meta.conexoes = c.checked ? [...meta.conexoes, f.huntId] : meta.conexoes.filter((x) => x !== f.huntId); S.sujo = true; });
        return el('label', { class: 'marca' }, c, f.nome);
      })), S.fase.conexoesDeEntrada.length ? el('div', { class: 'dica' }, `Entradas: ${S.fase.conexoesDeEntrada.join(', ')}`) : null),
      el('div', { class: 'linha' }, el('span', { class: 'dica' }, `Condição de conclusão: ${S.fase.condicaoDeConclusao.join(' → ')}`), el('button', { class: 'primario', onclick: salvarMeta }, 'Salvar dados da fase')))),
    el('h2', {}, `Encontros (${S.encontros.length})`),
    blocoDeValidacao(),
    ...S.encontros.map(cartaoDeEncontro),
    el('div', { class: 'linha' }, novo, el('button', { onclick: () => { const t = novo.value; S.encontros.push({ id: idNovo(t), nome: '', ...NOVOS[t]?.() ?? { tipo: t } }); desenharFase(); marcarSujo(); } }, '+ novo encontro')),
    el('div', { class: 'linha' }, el('span', { class: 'dica' }, 'Probabilidade e obrigatoriedade seguem as regras do jogo: o servidor valida tudo ao salvar.'), el('button', { id: 'salvarEncontros', class: 'primario', disabled: !!S.validacao.erros?.length, onclick: salvarEncontros }, 'Salvar encontros'))
  );
}
async function salvarMeta() {
  const r = await api(`fase/${S.faseId}/meta`, S.meta);
  if (r.ok) {
    S.sujo = false;
    msg('Dados da fase salvos.', 'ok');
  } else msg((r.erros ?? ['Erro ao salvar'])[0], 'erro');
}
async function salvarEncontros() {
  const r = await api(`fase/${S.faseId}/encontros`, { encontros: S.encontros });
  if (r.ok) {
    S.sujo = false;
    msg(r.reiniciar ?? 'Encontros salvos.', 'ok');
    await carregarFase(S.faseId);
  } else {
    S.validacao = { erros: r.erros ?? [], avisos: r.avisos ?? [] };
    $('#validacao')?.replaceWith(blocoDeValidacao());
    msg('Não salvou: corrija os erros.', 'erro');
  }
}

// ---- Bosses
const MODELOS = {
  'área telegrafada': { tipo: 'area-telegrafada', nome: 'Pancada no chão', elemento: 'physical', min: 100, max: 200, raio: 2, avisoMs: 1500, intervaloMs: 8000, chance: 100 },
  invocar: { tipo: 'invocar', criaturas: [{ key: 'troll', qtd: 2 }], maxVivos: 4, intervaloMs: 15000, chance: 100 },
  escudo: { tipo: 'escudo', pctVida: 10, duracaoMs: 8000, vulnerabilidade: { pct: 30, ms: 5000 }, intervaloMs: 30000, chance: 100 },
  magia: { tipo: 'magia', nome: 'Raio', elemento: 'energy', min: 50, max: 90, forma: 'feixe', comprimento: 6, intervaloMs: 5000, chance: 100 },
};
const bossVazio = () => ({ id: '', nome: '', categoria: 'miniboss', base: '', descricao: '', lore: '', atributos: { vidaMult: 5 }, melee: { min: 10, max: 30, intervaloMs: 2000 }, comportamentos: [], fases: [], recompensas: { loot: [], primeiraVitoria: null } });
const validarBoss = depois(async () => {
  const r = await api('bosses/validar', S.boss);
  S.bossErros = r.erros ?? [];
  S.bossValidado = true;
  $('#bossErros')?.replaceWith(blocoDeErrosDoBoss());
  const s = $('#salvarBoss');
  if (s) s.disabled = !!S.bossErros.length;
});
const blocoDeErrosDoBoss = () => el('ul', { class: 'problemas', id: 'bossErros' }, S.bossErros.map((m) => el('li', { class: 'erro' }, m)), S.bossErros.length ? null : el('li', { class: 'dica' }, S.bossValidado ? 'Cadastro válido.' : 'Validando…'));
const sujoBoss = () => {
  S.sujo = true;
  validarBoss();
};

async function desenharBosses() {
  S.bosses = (await api('bosses')).bosses;
  datalists();
  const lateral = el('div', { class: 'lista-lateral' }, S.bosses.map((b) => el('div', { class: b.id === S.bossoId ? 'ativo' : '', onclick: () => escolherBoss(b.id) }, el('b', {}, b.nome), ' ', el('span', { class: 'selo boss' }, b.categoria), b.usos.length ? el('span', { class: 'selo' }, `${b.usos.length} uso(s)`) : el('span', { class: 'selo aviso' }, 'sem uso'))), el('div', { onclick: () => { S.bossoId = null; S.boss = bossVazio(); desenharBosses(); } }, '+ novo boss'));
  $('#raiz').replaceChildren(el('div', { class: 'duas' }, lateral, el('div', { id: 'formBoss' })));
  if (!S.boss) S.boss = S.bossoId ? JSON.parse(JSON.stringify(S.bosses.find((b) => b.id === S.bossoId))) : null;
  if (S.boss) desenharFormDoBoss();
  else $('#formBoss').append(el('p', { class: 'dica' }, 'Escolha um boss à esquerda ou crie um novo. Um boss único tem fases por % de vida e comportamentos (magia, área telegrafada, invocação, escudo); quando e com que chance ele aparece é do ENCONTRO.'));
}
function escolherBoss(id) {
  S.bossoId = id;
  S.boss = JSON.parse(JSON.stringify(S.bosses.find((b) => b.id === id)));
  delete S.boss.usos;
  desenharBosses();
}
function areaJson(rotulo, obj, chave, modelos) {
  const t = el('textarea', { rows: 6, spellcheck: 'false' }, JSON.stringify(obj[chave], null, 2));
  const erro = el('div', { class: 'dica' });
  t.addEventListener('input', () => {
    try {
      obj[chave] = JSON.parse(t.value);
      erro.textContent = '';
      sujoBoss();
    } catch (e) {
      erro.textContent = `JSON inválido: ${e.message}`;
    }
  });
  return el('fieldset', {}, el('legend', {}, rotulo), t, erro, modelos ? el('div', { class: 'linha' }, ...Object.entries(modelos).map(([nome, m]) => el('button', { type: 'button', onclick: () => { obj[chave] = [...(obj[chave] ?? []), JSON.parse(JSON.stringify(m))]; t.value = JSON.stringify(obj[chave], null, 2); sujoBoss(); } }, `+ ${nome}`))) : null);
}
function desenharFormDoBoss() {
  const b = S.boss;
  S.bossValidado = false;
  S.bossErros = [];
  b.atributos ??= {};
  b.recompensas ??= { loot: [], primeiraVitoria: null };
  b.recompensas.loot ??= [];
  const usos = S.bosses.find((x) => x.id === S.bossoId)?.usos ?? [];
  $('#formBoss').replaceChildren(
    el('h2', {}, S.bossoId ? `Boss: ${b.nome}` : 'Novo boss'),
    el('div', { class: 'cartao' }, el('div', { class: 'corpo' },
      el('div', { class: 'grade' }, campo('Id (minúsculas e hífen)', b, 'id', { aoMudar: sujoBoss }), campo('Nome', b, 'nome', { aoMudar: sujoBoss }), escolha('Categoria', b, 'categoria', S.opcoes.categoriasDeBoss, { aoMudar: sujoBoss }), campo('Criatura-base (desenho e loot)', b, 'base', { lista: 'dl-bichos', aoMudar: sujoBoss }), campo('Nível recomendado', b, 'nivel', { tipo: 'number', opcional: true, aoMudar: sujoBoss })),
      el('label', { class: 'campo' }, 'Descrição', ligar(el('textarea', { rows: 2 }, b.descricao ?? ''), b, 'descricao', { aoMudar: sujoBoss })),
      el('label', { class: 'campo' }, 'Lore', ligar(el('textarea', { rows: 3 }, b.lore ?? ''), b, 'lore', { aoMudar: sujoBoss })),
      el('fieldset', {}, el('legend', {}, 'Atributos (vida absoluta OU multiplicador da base)'), el('div', { class: 'grade' }, campo('Vida (absoluta)', b.atributos, 'vida', { tipo: 'number', opcional: true, aoMudar: sujoBoss }), campo('Vida × base', b.atributos, 'vidaMult', { tipo: 'number', opcional: true, aoMudar: sujoBoss }), campo('Dano ×', b.atributos, 'danoMult', { tipo: 'number', opcional: true, aoMudar: sujoBoss }), campo('Armadura', b.atributos, 'armadura', { tipo: 'number', opcional: true, aoMudar: sujoBoss }), campo('XP ×', b.atributos, 'expMult', { tipo: 'number', opcional: true, aoMudar: sujoBoss }))),
      opcional('Corpo a corpo (sem isto o boss não bate de perto)', b, 'melee', () => ({ min: 10, max: 30, intervaloMs: 2000 }), (m) => el('div', { class: 'grade' }, campo('Mín', m, 'min', { tipo: 'number', aoMudar: sujoBoss }), campo('Máx', m, 'max', { tipo: 'number', aoMudar: sujoBoss }), campo('Intervalo (ms)', m, 'intervaloMs', { tipo: 'number', aoMudar: sujoBoss })), sujoBoss),
      el('div', { class: 'grade' }, marca('Usa também as magias da criatura-base', b, 'usaPoderesDoBase', sujoBoss), marca('Vai na escala da fase (vida/dano/XP)', Object.assign(b, { usaEscalaDaFase: b.usaEscalaDaFase !== false }), 'usaEscalaDaFase', sujoBoss)),
      areaJson('Comportamentos (sempre ativos)', b, 'comportamentos', MODELOS),
      areaJson('Fases de combate (vida cruzando "ate" %: do maior para o menor)', b, 'fases', { 'fase com escudo e fala': { nome: 'Enfurecido', ate: 50, mods: { danoMult: 1.3 }, aoEntrar: { fala: 'Chega!', escudo: { pctVida: 10, duracaoMs: 8000, vulnerabilidade: { pct: 30, ms: 5000 } } }, comportamentos: [] } }),
      el('fieldset', {}, el('legend', {}, 'Recompensas'), listaEditavel('Loot do boss (chance em %; substitui o da criatura-base)', b.recompensas.loot, () => ({ id: '', chance: 10 }), linhaDeDrop), opcional('Prêmio da primeira vitória', b.recompensas, 'primeiraVitoria', () => ({ gold: 0 }), (p) => el('div', { class: 'grade' }, campo('Ouro', p, 'gold', { tipo: 'number', opcional: true, aoMudar: sujoBoss }), campo('Experiência', p, 'exp', { tipo: 'number', opcional: true, aoMudar: sujoBoss })), sujoBoss)),
      blocoDeErrosDoBoss(),
      el('div', { class: 'linha' }, usos.length ? el('span', { class: 'dica' }, `Usado em: ${usos.map((u) => `${u.huntId}/${u.encontro}`).join(', ')}`) : el('span', { class: 'dica' }, 'Quando e com que chance aparece: configure no encontro (aba Fase).'), S.bossoId ? el('button', { class: 'perigo', onclick: excluirBoss }, 'Excluir') : null, el('button', { id: 'salvarBoss', class: 'primario', disabled: true, onclick: salvarBoss }, 'Salvar boss')))
    )
  );
  validarBoss();
}
async function salvarBoss() {
  const r = await api('bosses', S.boss);
  if (r.ok) {
    S.sujo = false;
    S.bossoId = S.boss.id;
    S.boss = null;
    msg('Boss salvo (vale na hora neste servidor).', 'ok');
    await desenharBosses();
  } else {
    S.bossErros = r.erros ?? [];
    $('#bossErros')?.replaceWith(blocoDeErrosDoBoss());
    msg('Não salvou: corrija os erros.', 'erro');
  }
}
async function excluirBoss() {
  if (!confirm(`Excluir o boss "${S.boss.nome}"?`)) return;
  const r = await api('bosses', { excluir: S.bossoId });
  if (r.ok) {
    S.bossoId = null;
    S.boss = null;
    S.sujo = false;
    msg('Boss excluído.', 'ok');
    await desenharBosses();
  } else msg((r.erros ?? ['Não excluiu'])[0], 'erro');
}

// ------------------------------------------------------------------ início

window.addEventListener('beforeunload', (e) => {
  if (S.sujo) e.preventDefault();
});
S.opcoes = await api('opcoes');
desenharAbas();
await desenharGeral();


// ---- Mapa do mundo (a tela WORLD): posição dos nós, tipos, conexões, dados dos Atos e pré-visualização dos estados
const copia = (x) => JSON.parse(JSON.stringify(x));
const arredonda = (n) => Math.round(n / 5) * 5;
const MW = { dados: null, ato: 1, sel: null, previa: 0, original: '', validacao: null, arrastando: null };

const estadoDaPrevia = (indiceNoAto, total) => (indiceNoAto < MW.previa ? 'completa' : indiceNoAto === MW.previa ? 'aberta' : 'fechada');

/** As fases do Ato no formato da tela (`completa`/`liberada` vêm da pré-visualização), para reaproveitar as mesmas contas do jogo. */
function fasesDoAtoParaTela() {
  const doAto = MW.dados.fases.filter((f) => f.ato === MW.ato);
  return doAto.map((f, i) => ({ ...f, completa: i < MW.previa, liberada: i <= MW.previa }));
}
const mundoDoEditor = () => Object.fromEntries(MW.dados.fases.map((f) => [f.huntId, { mapa: f.mapa ?? undefined, conexoes: f.conexoes, tipo: f.tipo ?? undefined, bossPrincipal: f.deduzido.bossPrincipal, obrigatorios: f.deduzido.obrigatorios }]));

async function desenharMapaDoMundo() {
  if (!MW.dados) {
    MW.dados = await api('mapa');
    MW.original = JSON.stringify(corpoDoMapa());
  }
  const atos = [...new Set(MW.dados.fases.map((f) => f.ato))];
  if (!atos.includes(MW.ato)) MW.ato = atos[0] ?? 1;
  const meta = (MW.dados.atos[MW.ato] ??= {});
  const doAto = MW.dados.fases.filter((f) => f.ato === MW.ato);
  MW.sel ??= doAto[0]?.huntId ?? null;

  const aoMudarAto = () => {
    S.sujo = true;
    validarMapaDoMundo();
  };
  const seletor = el('select', { onchange: (ev) => { MW.ato = Number(ev.target.value); MW.sel = null; MW.previa = 0; desenharMapaDoMundo(); } }, atos.map((a) => el('option', { value: a }, `Ato ${a}${MW.dados.atos[a]?.nome ? ` — ${MW.dados.atos[a].nome}` : ''}`)));
  seletor.value = MW.ato;
  const previa = el('input', { type: 'range', min: 0, max: doAto.length, value: MW.previa, oninput: (ev) => { MW.previa = Number(ev.target.value); legendaPrevia.textContent = textoDaPrevia(); pintarMapa(); } });
  const textoDaPrevia = () => (MW.previa === 0 ? 'nada concluído (só a 1ª fase aberta)' : MW.previa >= doAto.length ? 'tudo concluído (boss aberto)' : `${MW.previa} fase(s) concluída(s)`);
  const legendaPrevia = el('span', { class: 'dica' }, textoDaPrevia());

  const palco = el('div', { class: 'w2-palco', style: 'max-width:900px' });
  const viewport = el('div', { class: 'w2-viewport', style: 'height:auto;aspect-ratio:1000/640;cursor:default;touch-action:none' });
  const mapaSvg = svg('svg', { class: 'w2-svg', viewBox: `0 0 ${LARGURA} ${ALTURA}`, preserveAspectRatio: 'xMidYMid meet' });
  const cam = svg('g', {});
  mapaSvg.append(cam);
  viewport.append(mapaSvg);
  palco.append(viewport);

  const lateral = el('div', { id: 'mw-lateral', class: 'linhas' });

  function pintarMapa() {
    const fases = fasesDoAtoParaTela();
    const bossReal = { ato: MW.ato, liberado: MW.previa >= fases.length, vencido: false };
    const mundo = mundoDoEditor();
    const pos = posicoesDoAto(fases, true, mundo, MW.ato, meta.bossMapa ?? null);
    const pontos = [...pos.pontos, pos.boss];
    cam.replaceChildren(fundoDoAto(MW.ato, nomeDoTema(MW.ato, meta.tema), pontos));
    const ids = [...fases.map((f) => f.huntId), `boss:${MW.ato}`];
    const posDe = (id) => pontos[ids.indexOf(id)];
    const estradas = svg('g', { class: 'w2-estradas' });
    for (const c of conexoesDoAto(fases, bossReal, mundo)) {
      const d = tracadoDaEstrada(posDe(c.de), posDe(c.para), c.tipo);
      estradas.append(svg('path', { d, class: 'w2-leito' }), svg('path', { d, class: `w2-estrada ${c.estado} ${c.tipo}` }));
    }
    cam.append(estradas);
    const nos = svg('g', {});
    fases.forEach((f, i) => {
      const g = desenharNo({ id: f.huntId, tipo: tipoDaFase(mundo[f.huntId]), estado: f.completa ? 'completa' : f.liberada ? 'aberta' : 'fechada', numero: f.indice + 1, nome: f.nome, p: pos.pontos[i], escolhido: MW.sel === f.huntId });
      // posição à mão: um aro tracejado menor no canto diz "esta foi posicionada"
      if (f.mapa) g.append(svg('circle', { cx: -18, cy: -18, r: 4, fill: '#7fd3c0', stroke: '#0e0d10', 'stroke-width': 1 }));
      nos.append(g);
    });
    nos.append(desenharNo({ id: `boss:${MW.ato}`, tipo: 'boss', estado: bossReal.liberado ? 'aberta' : 'fechada', numero: 0, nome: 'Boss do Ato', p: pos.boss, boss: true, escolhido: MW.sel === `boss:${MW.ato}` }));
    cam.append(nos);
  }

  // arrastar um nó: a posição vira "à mão" (arredondada de 5 em 5)
  const aoPonto = (ev) => {
    const m = mapaSvg.getScreenCTM();
    const p = new DOMPoint(ev.clientX, ev.clientY).matrixTransform(m.inverse());
    return { x: Math.max(30, Math.min(LARGURA - 30, arredonda(p.x))), y: Math.max(30, Math.min(ALTURA - 30, arredonda(p.y))) };
  };
  mapaSvg.addEventListener('pointerdown', (ev) => {
    const no = ev.target.closest?.('.w-no');
    if (!no) return;
    const id = no.dataset.id;
    MW.sel = id;
    MW.arrastando = { id, moveu: false };
    mapaSvg.setPointerCapture(ev.pointerId);
    desenharLateral();
    pintarMapa();
  });
  mapaSvg.addEventListener('pointermove', (ev) => {
    const a = MW.arrastando;
    if (!a) return;
    a.moveu = true;
    const p = aoPonto(ev);
    if (a.id.startsWith('boss:')) meta.bossMapa = p;
    else MW.dados.fases.find((f) => f.huntId === a.id).mapa = p;
    pintarMapa();
  });
  mapaSvg.addEventListener('pointerup', () => {
    if (MW.arrastando?.moveu) {
      aoMudarAto();
      desenharLateral();
    }
    MW.arrastando = null;
  });

  function desenharLateral() {
    lateral.replaceChildren();
    const sel = MW.sel;
    if (!sel) return lateral.append(el('p', { class: 'dica' }, 'Clique num nó do mapa para editar.'));
    if (sel.startsWith('boss:')) {
      return lateral.append(el('b', {}, 'Boss do Ato'), el('p', { class: 'dica' }, meta.bossMapa ? `Posição à mão: ${meta.bossMapa.x}, ${meta.bossMapa.y}` : 'Posição automática (fim do caminho).'), el('button', { type: 'button', onclick: () => { delete meta.bossMapa; aoMudarAto(); pintarMapa(); desenharLateral(); } }, 'Voltar ao automático'));
    }
    const f = MW.dados.fases.find((x) => x.huntId === sel);
    const posicao = f.mapa ?? { x: '', y: '' };
    const tipoDeduzido = tipoDaFase({ bossPrincipal: f.deduzido.bossPrincipal, obrigatorios: f.deduzido.obrigatorios });
    const tipos = el('select', { onchange: (ev) => { f.tipo = ev.target.value || null; aoMudarAto(); pintarMapa(); } }, el('option', { value: '' }, `automático (${TIPOS_DE_NO[tipoDeduzido]})`), (S.opcoes.tiposDeNo ?? []).filter((t) => t !== 'comum').map((t) => el('option', { value: t }, TIPOS_DE_NO[t] ?? t)));
    tipos.value = f.tipo ?? '';
    const coord = (eixo) => el('input', { type: 'number', step: 5, value: posicao[eixo], onchange: (ev) => { f.mapa = { ...(f.mapa ?? { x: 500, y: 320 }), [eixo]: Number(ev.target.value) }; aoMudarAto(); pintarMapa(); } });
    const outras = MW.dados.fases.filter((x) => x.ato === MW.ato && x.huntId !== f.huntId);
    lateral.append(
      el('b', {}, f.nome),
      el('div', { class: 'dica' }, f.exige.length ? `Exige: ${f.exige.join(', ')} (edite na aba Fase).` : 'Requisitos: só a cadeia do Ato (edite extras na aba Fase).'),
      el('label', { class: 'campo' }, 'Tipo do nó', tipos),
      el('div', { class: 'grade' }, el('label', { class: 'campo' }, 'x', coord('x')), el('label', { class: 'campo' }, 'y', coord('y'))),
      el('button', { type: 'button', onclick: () => { f.mapa = null; aoMudarAto(); pintarMapa(); desenharLateral(); } }, 'Posição automática'),
      el('details', {}, el('summary', {}, `Conexões extras (${f.conexoes.length})`), el('div', { class: 'linhas' }, outras.map((o) => {
        const c = el('input', { type: 'checkbox' });
        c.checked = f.conexoes.includes(o.huntId);
        c.addEventListener('change', () => { f.conexoes = c.checked ? [...f.conexoes, o.huntId] : f.conexoes.filter((x) => x !== o.huntId); aoMudarAto(); pintarMapa(); });
        return el('label', { class: 'marca' }, c, o.nome);
      })))
    );
  }

  const gerarPosicoes = () => {
    const fases = fasesDoAtoParaTela();
    const pos = posicoesDoAto(fases, true, {}, MW.ato);
    fases.forEach((f, i) => { MW.dados.fases.find((x) => x.huntId === f.huntId).mapa = { x: pos.pontos[i].x, y: pos.pontos[i].y }; });
    meta.bossMapa = { x: pos.boss.x, y: pos.boss.y };
    aoMudarAto();
    pintarMapa();
    desenharLateral();
  };
  const limparPosicoes = () => {
    for (const f of doAto) f.mapa = null;
    delete meta.bossMapa;
    aoMudarAto();
    pintarMapa();
    desenharLateral();
  };

  const form = el('div', { class: 'grade' },
    el('label', { class: 'campo' }, 'Nome do Ato', ligar(el('input', { value: meta.nome ?? '' }), meta, 'nome', { opcional: true, aoMudar: aoMudarAto })),
    el('label', { class: 'campo' }, 'Parte da campanha', ligar(el('input', { value: meta.parte ?? '', placeholder: 'Parte I' }), meta, 'parte', { opcional: true, aoMudar: aoMudarAto })),
    (() => {
      const t = el('select', {}, el('option', { value: '' }, '— padrão do Ato —'), (S.opcoes.temasDeMapa ?? []).map((x) => el('option', { value: x }, x)));
      t.value = meta.tema ?? '';
      return el('label', { class: 'campo' }, 'Tema do mapa', ligar(t, meta, 'tema', { opcional: true, aoMudar: () => { aoMudarAto(); pintarMapa(); } }));
    })(),
    el('label', { class: 'campo' }, 'Descrição do Ato', ligar(el('input', { value: meta.descricao ?? '' }), meta, 'descricao', { opcional: true, aoMudar: aoMudarAto }))
  );

  $('#raiz').replaceChildren(
    el('div', { class: 'linha' }, el('label', { class: 'campo' }, 'Ato', seletor), el('label', { class: 'campo' }, 'Pré-visualizar estados', previa, legendaPrevia)),
    form,
    el('div', { class: 'linha' }, el('button', { type: 'button', onclick: gerarPosicoes }, 'Gerar posições do caminho automático'), el('button', { type: 'button', onclick: limparPosicoes }, 'Limpar posições do Ato'), el('button', { type: 'button', class: 'primario', id: 'salvarMapa', onclick: salvarMapaDoMundo }, 'Salvar mapa')),
    el('div', { id: 'mw-validacao' }),
    el('div', { class: 'duas', style: 'grid-template-columns:1fr 300px' }, palco, lateral),
    el('p', { class: 'dica' }, 'Arraste os nós para posicioná-los (de 5 em 5). Sem posição à mão, a tela desenha o caminho sozinha. O ponto verde marca o nó posicionado à mão. As conexões extras só valem dentro do Ato.')
  );
  pintarMapa();
  desenharLateral();
  validarMapaDoMundo();
}

/** O que vai para o servidor: o mapa, o tipo e as conexões de cada fase + os dados dos Atos. */
function corpoDoMapa() {
  return { atos: MW.dados.atos, fases: Object.fromEntries(MW.dados.fases.map((f) => [f.huntId, { mapa: f.mapa, tipo: f.tipo, conexoes: f.conexoes }])) };
}
const validarMapaDoMundo = depois(async () => {
  if (S.aba !== 'mapa' || !MW.dados) return;
  const r = await api('mapa/validar', corpoDoMapa());
  MW.validacao = r;
  const caixa = $('#mw-validacao');
  if (caixa) caixa.replaceChildren(el('ul', { class: 'problemas' }, (r.erros ?? []).map((m) => el('li', { class: 'erro' }, m)), (r.avisos ?? []).map((a) => el('li', { class: 'aviso' }, `${a.onde}: ${a.mensagem}`)), !(r.erros?.length || r.avisos?.length) ? el('li', { class: 'dica' }, 'Sem erros nem avisos.') : null));
  const salvar = $('#salvarMapa');
  if (salvar) salvar.disabled = !!r.erros?.length;
});
async function salvarMapaDoMundo() {
  const r = await api('mapa', corpoDoMapa());
  if (r.ok) {
    S.sujo = false;
    MW.dados = null;
    msg('Mapa salvo. O jogo lê na próxima vez que a campanha for pedida.', 'ok');
    await desenharMapaDoMundo();
  } else msg((r.erros ?? ['Erro ao salvar'])[0], 'erro');
}
void atosDaCampanha;

// ------------------------------------------------------------------ biblioteca (somente leitura)

const BIB = { categorias: [], categoria: 'hunts', q: '', tipo: '', nivelMin: '', nivelMax: '', ordem: 'nome', lista: null, detalhe: null };
const NAO = 'não cadastrado';
const fmt = (v) => (v === null || v === undefined ? NAO : typeof v === 'object' ? JSON.stringify(v) : String(v));

async function desenharBiblioteca() {
  if (!BIB.categorias.length) BIB.categorias = (await api('biblioteca')).categorias;
  await buscarBiblioteca();
}
async function buscarBiblioteca() {
  const p = new URLSearchParams({ categoria: BIB.categoria, q: BIB.q, tipo: BIB.tipo, nivelMin: BIB.nivelMin, nivelMax: BIB.nivelMax, ordem: BIB.ordem, limite: 100 });
  BIB.lista = await api(`biblioteca/lista?${p}`);
  pintarBiblioteca();
}
async function abrirDetalhe(id) {
  BIB.detalhe = await api(`biblioteca/detalhe?${new URLSearchParams({ categoria: BIB.categoria, id })}`);
  pintarBiblioteca();
}
function blocoDoDetalhe(d) {
  const linhas = [];
  for (const [k, v] of Object.entries(d)) {
    if (['id', 'nome', 'categoria'].includes(k)) continue;
    const filho = v && typeof v === 'object' && !Array.isArray(v)
      ? el('table', { class: 'bib-sub' }, Object.entries(v).map(([k2, v2]) => el('tr', {}, el('th', {}, k2), el('td', { class: v2 == null ? 'dica' : '' }, fmt(v2)))))
      : el('span', { class: v == null || (Array.isArray(v) && !v.length) ? 'dica' : '' }, Array.isArray(v) ? (v.length ? JSON.stringify(v) : NAO) : fmt(v));
    linhas.push(el('div', { class: 'bib-campo' }, el('b', {}, k), filho));
  }
  return linhas;
}
function pintarBiblioteca() {
  const L = BIB.lista;
  const campoTexto = (rot, chave, tipo = 'text') => el('label', { class: 'campo' }, rot, el('input', { type: tipo, value: BIB[chave], onchange: (e) => { BIB[chave] = e.target.value; buscarBiblioteca(); } }));
  const filtros = el('div', { class: 'grade' },
    el('label', { class: 'campo' }, 'Categoria', el('select', { onchange: (e) => { BIB.categoria = e.target.value; BIB.tipo = ''; BIB.detalhe = null; buscarBiblioteca(); } }, BIB.categorias.map((c) => el('option', { value: c.id, selected: c.id === BIB.categoria }, `${c.nome} (${c.total})`)))),
    campoTexto('Buscar por nome ou ID', 'q'),
    el('label', { class: 'campo' }, 'Tipo', el('select', { onchange: (e) => { BIB.tipo = e.target.value; buscarBiblioteca(); } }, el('option', { value: '' }, 'todos'), (L?.tipos ?? []).map((t) => el('option', { value: t, selected: t === BIB.tipo }, t)))),
    campoTexto('Nível mínimo', 'nivelMin', 'number'),
    campoTexto('Nível máximo', 'nivelMax', 'number'),
    el('label', { class: 'campo' }, 'Ordem', el('select', { onchange: (e) => { BIB.ordem = e.target.value; buscarBiblioteca(); } }, [['nome', 'alfabética'], ['nivel', 'por nível'], ['id', 'por ID']].map(([v, n]) => el('option', { value: v, selected: v === BIB.ordem }, n)))));
  const tabela = el('table', {}, el('thead', {}, el('tr', {}, ['ID', 'Nome', 'Tipo', 'Nível'].map((h) => el('th', {}, h)))),
    el('tbody', {}, (L?.itens ?? []).map((i) => el('tr', { class: BIB.detalhe?.id === i.id ? 'ativa' : '', style: 'cursor:pointer', onclick: () => abrirDetalhe(i.id) }, el('td', {}, i.id), el('td', {}, i.nome ?? NAO), el('td', {}, i.tipo ?? NAO), el('td', {}, i.nivel ?? '—')))));
  const d = BIB.detalhe;
  $('#raiz').replaceChildren(
    el('div', { class: 'dica' }, 'Somente leitura: mostra os cadastros reais do jogo. O que o cadastro não traz aparece como "não cadastrado".'),
    filtros,
    el('div', { class: 'dica' }, L?.ok === false ? L.erros.join(' ') : `${L?.total ?? 0} resultado(s)${(L?.total ?? 0) > 100 ? ' — mostrando os 100 primeiros; refine a busca' : ''}.`),
    el('div', { class: 'bib-duas' }, el('div', { class: 'bib-lista' }, tabela), el('div', { class: 'bib-detalhe' }, d?.id ? [el('h3', {}, `${d.nome ?? d.id} `, el('span', { class: 'dica' }, `(${d.id})`)), ...blocoDoDetalhe(d)] : el('div', { class: 'dica' }, 'Selecione um conteúdo para ver o detalhe.'))));
}
