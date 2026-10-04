// Editor de conteúdo (/editor/conteudo): fases, encontros e bosses. Ferramenta interna do dono, sem login — as rotas
// de escrita ficam sob `/api/mapas/_conteudo/`, que o nginx de produção só abre por túnel SSH. NENHUMA regra mora
// aqui: toda validação é do servidor (a mesma do jogo, mais "o ponto é andável no mapa?").
import { svg, fundoDoAto, nomeDoTema } from './world-arte.mjs';
import { LARGURA, ALTURA, TIPOS_DE_NO, posicoesDoAto, conexoesDoAto, tracadoDaEstrada, tipoDaFase, atosDaCampanha } from './world-dados.mjs';
import { desenharNo } from './world.mjs';
import { criarEditorDeAtos } from './editor-atos.mjs';
import { criarPainelDeHunts } from './editor-hunts.mjs';
import { criarEditorDeMapas } from './editor-mapas.mjs';
import { criarTelasDeOperacao } from './editor-operacao.mjs';
import { criarEditorDeMobs } from './editor-mobs.mjs';
import { criarEditorDeItens } from './editor-itens.mjs';
import { criarEditorDeSprites } from './editor-sprites-editor.mjs';
import { criarIndicadorDeHotReload } from './editor-hot-reload.mjs';
import { criarTelaDeValidacao } from './editor-validacao.mjs';
import { criarTelaDeProgressao } from './editor-progressao.mjs';
import { criarTelaDeConjuntos } from './editor-conjuntos.mjs';
import { criarTelaDeItemPower } from './editor-item-power.mjs';
import { garantirAcesso } from './editor-acesso.mjs';
import { desenharMenu, lerEstado as lerEstadoDoMenu, gravarEstado as gravarEstadoDoMenu, abrirGrupoDe } from './editor-menu.mjs';
import { criarBiblioteca } from './editor-biblioteca.mjs';
import { criarEditorDeBosses } from './editor-bosses.mjs';
import { el, msg, descartarAlteracoes, cabecalho, botaoCopiar, pedirTexto } from './editor-ui.mjs';

const BASE = '/api/mapas/_conteudo/';
const S = { opcoes: null, aba: 'geral', auditoria: null, faseId: null, fase: null, encontros: [], validacao: { erros: [], avisos: [] }, navegacao: 0 };

// `S.sujo` acende o aviso "Alterações não salvas" da barra superior (o editor de Atos tem o próprio estado: ver `atualizarSujo`).
let sujo = false;
Object.defineProperty(S, 'sujo', { get: () => sujo, set: (v) => { sujo = !!v; atualizarSujo(); } });
function atualizarSujo() {
  const aviso = document.querySelector('#eng-sujo');
  if (!aviso) return;
  let atos = false;
  try {
    atos = S.aba === 'atos' && EDITOR_DE_ATOS.sujo();
  } catch {
    /* o editor de Atos ainda não foi criado (início da página) */
  }
  aviso.hidden = !(sujo || atos);
}

const $ = (s) => document.querySelector(s);
/**
 * Fala com o servidor. Uma LEITURA que volta depois de o usuário já ter trocado de tela é descartada (a promessa
 * nunca resolve): sem isso, a resposta atrasada de uma aba desenhava por cima da aba nova. Gravações sempre resolvem.
 */
async function api(rota, corpo) {
  const vez = S.navegacao;
  const r = await fetch(BASE + rota, corpo === undefined ? undefined : { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(corpo) });
  const dados = await r.json();
  if (r.status === 401 && dados?.codigo === 'sem-login') { location.reload(); return new Promise(() => {}); }
  if (corpo === undefined && vez !== S.navegacao) return new Promise(() => {});
  return dados;
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

const EDITOR_DE_ATOS = criarEditorDeAtos({ el, api, raiz: () => $('#raiz'), msg });
const BIBLIOTECA = criarBiblioteca({ api, raiz: () => $('#raiz'), irPara: (aba, id = null, resto = null) => irPara(aba, id, resto), acaoDaFicha: (d) => botaoDeSprite(d), atalhosDeEdicao: (d) => botoesDaFicha(d) });
// A tela Mobs é a Biblioteca presa nos monstros (mesmos cards, mesma ficha), com a rota própria `#mobs/<key>`.
// As telas de ENTIDADE (Mobs, Itens, Outfits, Montarias) são a Biblioteca presa numa categoria — mesmos cards, mesma
// ficha, rota própria (`#mobs/<key>`, `#itens/<id>`…). Somente visualização: esses cadastros vêm do Canary.
const irParaDe = (aba, id = null, resto = null) => irPara(aba, id, resto);
// O botão "Editar sprite" das fichas da Biblioteca: abre o editor universal de sprites no look do monstro, outfit ou montaria.
const lookDaFicha = (d) => (d.desenho?.tipo === 'criatura' ? d.desenho.look : ['outfits', 'montarias'].includes(d.categoria) ? d.look : null);
const botaoDeSprite = (d) => (lookDaFicha(d) != null ? el('button', { type: 'button', class: 'fantasma', onclick: () => irPara('sprites', null, [String(lookDaFicha(d))]) }, 'Editar sprite (quadros e animação)') : null);
/**
 * Os atalhos de EDIÇÃO da ficha da Biblioteca geral (cada categoria leva ao editor que já existe — nenhum editor novo aqui): monstro → Mobs; item → Itens; hunts → Hunts; bosses → Bosses únicos;
 * (o botão de sprite vem de `acaoDaFicha`). Em monstro e item também "criar a partir deste" (duplica como entrada nova de override e abre no editor).
 */
function botoesDaFicha(d) {
  const botoes = [];
  const gravar = () => !document.body.classList.contains('eng-somente-leitura');
  if (d.categoria === 'monstros') botoes.push(el('button', { type: 'button', class: 'primario', onclick: () => irPara('mobs', null, ['editar', d.id]) }, 'Editar este monstro'));
  if (d.categoria === 'itens') botoes.push(el('button', { type: 'button', class: 'primario', onclick: () => irPara('itens', null, ['editar', d.id]) }, 'Editar este item'));
  if (['hunts', 'vips', 'especiais', 'divinas'].includes(d.categoria)) botoes.push(el('button', { type: 'button', class: 'primario', onclick: () => irPara('hunts', null, [d.id]) }, 'Abrir no painel de Hunts'));
  if (d.categoria === 'bosses') botoes.push(el('button', { type: 'button', class: 'primario', onclick: () => irPara('bosses') }, 'Abrir em Bosses únicos'));
  if (d.categoria === 'itens' && gravar()) botoes.push(el('button', { type: 'button', onclick: async () => {
    const nome = await pedirTexto('Criar item novo', { rotulo: `Nome do novo item (cópia de ${d.nome ?? d.id})`, valor: `${d.nome ?? d.id} (novo)`, validar: (v) => (v.trim().length >= 1 && v.length <= 80 ? '' : 'De 1 a 80 caracteres.'), ok: 'Criar' });
    if (nome == null) return;
    const rev = (await api('overrides/itens?limite=1')).revisao;
    const r = await api('overrides/itens', { acao: 'duplicar', base: Number(d.id), nome, aplicar: true, revisao: rev });
    if (r.ok === false) return msg((r.erros ?? ['Não criou.']).join(' '), 'erro');
    msg(`Item #${r.id} criado como cópia de #${d.id}.`, 'ok');
    irPara('itens', null, ['editar', String(r.id)]);
  } }, 'Criar item novo a partir deste'));
  if (d.categoria === 'monstros' && gravar()) botoes.push(el('button', { type: 'button', onclick: async () => {
    const chave = await pedirTexto('Criar mob novo', { rotulo: `Chave do mob novo (cópia de ${d.nome ?? d.id}; minúsculas, números e hífen)`, valor: `${d.id}-novo`, validar: (v) => (/^[a-z0-9][a-z0-9-]{1,59}$/.test(v) ? '' : 'Use 2 a 60 caracteres: minúsculas, números e hífen.'), ok: 'Criar' });
    if (!chave) return;
    const rev = (await api('overrides/monstros?limite=1')).revisao;
    const r = await api('overrides', { acao: 'duplicar', key: d.id, novaKey: chave, novoNome: `${d.nome ?? d.id} (variação)`, revisao: rev });
    if (r.ok === false) return msg((r.erros ?? ['Não criou.']).join(' '), 'erro');
    msg(`Mob "${chave}" criado como cópia de ${d.id}.`, 'ok');
    irPara('mobs', null, ['editar', chave]);
  } }, 'Criar mob novo a partir deste'));
  return botoes.length ? el('div', { class: 'linha' }, botoes) : null;
}
const OPERACAO = criarTelasDeOperacao({ api, raiz: () => $('#raiz'), irPara: (aba) => irPara(aba) });
const MOBS_BIBLIOTECA = criarBiblioteca({ api, raiz: () => $('#raiz'), irPara: irParaDe, acaoDaFicha: (d) => el('div', { class: 'linha' }, el('button', { type: 'button', class: 'primario', onclick: () => irPara('mobs', null, ['editar', d.id]) }, 'Editar este monstro (override)'), botaoDeSprite(d)), categoriaFixa: 'monstros', rota: 'mobs', titulo: 'Mobs', descricao: 'Os monstros do bestiário com o sprite real: atributos, resistências, ataques, loot e onde cada um aparece. O bestiário vem do Canary e não é alterado: para editar, use "Editar mobs" (camada de overrides).' });
const MOBS_EDITOR = criarEditorDeMobs({ api, raiz: () => $('#raiz'), sujo: { marcar: () => (S.sujo = true), limpar: () => (S.sujo = false), esta: () => S.sujo }, podeGravar: () => !document.body.classList.contains('eng-somente-leitura'), aoVoltar: () => irPara('mobs'), irPara: (aba, id = null, resto = []) => irPara(aba, id, resto) });
let modoDosMobs = 'biblioteca';
const MOBS = {
  async desenhar(resto = []) {
    if (resto[0] === 'editar') { modoDosMobs = 'editor'; return MOBS_EDITOR.desenhar(resto[1] ?? null); }
    modoDosMobs = 'biblioteca';
    await MOBS_BIBLIOTECA.desenhar(resto);
    const cab = document.querySelector('#raiz .eng-cabeca');
    if (cab && !cab.querySelector('.mob-editar')) cab.append(el('div', { class: 'eng-acoes' }, el('button', { type: 'button', class: 'mob-editar primario', onclick: () => irPara('mobs', null, ['editar']) }, 'Editar mobs (overrides)')));
  },
  abrir: (cat, id) => (id === 'editar' ? MOBS_EDITOR.desenhar() : MOBS_BIBLIOTECA.abrir(cat, id)),
  focarBusca: () => (modoDosMobs === 'editor' ? MOBS_EDITOR : MOBS_BIBLIOTECA).focarBusca(),
};
const ITENS_BIBLIOTECA = criarBiblioteca({ api, raiz: () => $('#raiz'), irPara: irParaDe, acaoDaFicha: (d) => el('button', { type: 'button', class: 'primario', onclick: () => irPara('itens', null, ['editar', d.id]) }, 'Editar este item (override)'), categoriaFixa: 'itens', rota: 'itens', titulo: 'Itens', descricao: 'O catálogo de itens por slot e tipo: base, o que cada raridade dá à peça, sockets, onde cai e o tooltip real do jogo. O catálogo vem do Canary e não é alterado: para editar, use "Editar itens" (camada de overrides).' });
const ITENS_EDITOR = criarEditorDeItens({ api, raiz: () => $('#raiz'), sujo: { marcar: () => (S.sujo = true), limpar: () => (S.sujo = false), esta: () => S.sujo }, podeGravar: () => !document.body.classList.contains('eng-somente-leitura'), aoVoltar: () => irPara('itens'), irPara: (aba, id = null, resto = []) => irPara(aba, id, resto) });
let modoDosItens = 'biblioteca';
const ITENS = {
  async desenhar(resto = []) {
    if (resto[0] === 'editar') { modoDosItens = 'editor'; return ITENS_EDITOR.desenhar(resto[1] ?? null); }
    modoDosItens = 'biblioteca';
    await ITENS_BIBLIOTECA.desenhar(resto);
    const cab = document.querySelector('#raiz .eng-cabeca');
    if (cab && !cab.querySelector('.itm-editar')) cab.append(el('div', { class: 'eng-acoes' }, el('button', { type: 'button', class: 'itm-editar primario', onclick: () => irPara('itens', null, ['editar']) }, 'Editar itens (overrides)')));
  },
  abrir: (cat, id) => (id === 'editar' ? ITENS_EDITOR.desenhar() : ITENS_BIBLIOTECA.abrir(cat, id)),
  focarBusca: () => (modoDosItens === 'editor' ? ITENS_EDITOR : ITENS_BIBLIOTECA).focarBusca(),
};
// O editor universal de sprites (monstros, outfits e montarias): rota `#sprites` (escolher) e `#sprites/<look>` (editar).
const SPRITES = criarEditorDeSprites({ api, raiz: () => $('#raiz'), sujo: { marcar: () => (S.sujo = true), limpar: () => (S.sujo = false), esta: () => S.sujo }, podeGravar: () => !document.body.classList.contains('eng-somente-leitura'), irPara: (aba, id = null, resto = []) => irPara(aba, id, resto) });
const TELAS_FIXAS = {
  beta: OPERACAO.beta,
  config: OPERACAO.config,
  mapas: criarEditorDeMapas({ api, raiz: () => $('#raiz'), sujo: { marcar: () => (S.sujo = true), limpar: () => (S.sujo = false), esta: () => S.sujo, confirmarDescartar: () => descartarAlteracoes('O mapa aberto tem alterações não salvas') } }),
  hunts: criarPainelDeHunts({ api, raiz: () => $('#raiz'), irPara: irParaDe, sujo: { marcar: () => (S.sujo = true), limpar: () => (S.sujo = false), esta: () => S.sujo }, podeGravar: () => !document.body.classList.contains('eng-somente-leitura') }),
  mobs: MOBS,
  itens: ITENS,
  sprites: SPRITES,
  progressao: criarTelaDeProgressao({ api, raiz: () => $('#raiz'), sujo: { marcar: () => (S.sujo = true), limpar: () => (S.sujo = false), esta: () => S.sujo }, podeGravar: () => !document.body.classList.contains('eng-somente-leitura') }),
  conjuntos: criarTelaDeConjuntos({ api, raiz: () => $('#raiz'), sujo: { marcar: () => (S.sujo = true), limpar: () => (S.sujo = false), esta: () => S.sujo }, podeGravar: () => !document.body.classList.contains('eng-somente-leitura'), irPara: (aba, id = null, resto = []) => irPara(aba, id, resto) }),
  itempower: criarTelaDeItemPower({ api, raiz: () => $('#raiz'), sujo: { marcar: () => (S.sujo = true), limpar: () => (S.sujo = false), esta: () => S.sujo }, podeGravar: () => !document.body.classList.contains('eng-somente-leitura') }),
  validacao: criarTelaDeValidacao({ api, raiz: () => $('#raiz'), podeGravar: () => !document.body.classList.contains('eng-somente-leitura') }),
  outfits: criarBiblioteca({ api, raiz: () => $('#raiz'), irPara: irParaDe, acaoDaFicha: (d) => botaoDeSprite(d), categoriaFixa: 'outfits', rota: 'outfits', titulo: 'Outfits', descricao: 'As aparências de personagem (grátis e da Store): as 4 direções, os addons e a pose montada. Somente visualização.' }),
  montarias: criarBiblioteca({ api, raiz: () => $('#raiz'), irPara: irParaDe, acaoDaFicha: (d) => botaoDeSprite(d), categoriaFixa: 'montarias', rota: 'montarias', titulo: 'Montarias', descricao: 'As montarias com o sprite real, sozinhas e com um personagem montado. Somente visualização.' }),
};
const CATEGORIA_DA_TELA = { beta: 'beta', config: 'config', mapas: 'mapas', hunts: 'hunts', mobs: 'monstros', itens: 'itens', outfits: 'outfits', montarias: 'montarias', sprites: 'sprites' };
const BOSSES = criarEditorDeBosses({ api, raiz: () => $('#raiz'), opcoes: () => S.opcoes, irPara: (aba, id = null) => irPara(aba, id), sujo: { marcar: () => (S.sujo = true), limpar: () => (S.sujo = false), esta: () => S.sujo }, aoMudarCadastro: async () => { S.opcoes = await api('opcoes'); } });

// ------------------------------------------------------------------ abas

// A navegação: SÓ o que tem ferramenta de verdade por trás (nada de aba vazia). `href` = outra página.
const ABAS = [['geral', 'Visão geral'], ['mapa', 'Mapa do mundo'], ['mapas', 'Editor de mapas'], ['hunts', 'Hunts e áreas'], ['atos', 'Acts e campanhas'], ['fase', 'Fases e encontros'], ['mobs', 'Mobs'], ['bosses', 'Bosses únicos'], ['itens', 'Itens'], ['outfits', 'Outfits'], ['montarias', 'Montarias'], ['sprites', 'Editor de sprites'], ['validacao', 'Validação e versão'], ['progressao', 'Progressão e loot'], ['conjuntos', 'Conjuntos'], ['itempower', 'Item Power'], ['biblioteca', 'Biblioteca de conteúdos'], ['beta', 'Testes e beta'], ['config', 'Configurações']];
const NOME_DA_ABA = Object.fromEntries(ABAS);
// O menu: só entra item que tem tela de verdade (grupo sem item não aparece). `modo`: o que a ferramenta faz — sem marca = edição completa;
// 'consulta' = só mostra o cadastro; 'parcial' = edita parte. Atualizado junto com `docs/engine-reorganizacao-plano.md`.
const GRUPOS = [
  { id: 'gerenciamento', titulo: 'Gerenciamento', itens: [{ id: 'geral', nome: 'Visão geral', icone: 'painel', modo: 'consulta', dica: 'resumo e problemas do conteúdo' },
    { id: 'validacao', nome: 'Validação e versão', icone: 'painelDeControle', dica: 'verificações, testes e se a versão pode ser aprovada' }] },
  { id: 'mundo', titulo: 'Mundo e campanha', itens: [
    { id: 'mapa', nome: 'Mapa do mundo', icone: 'mundo' },
    { id: 'mapas', nome: 'Editor de mapas', icone: 'mapa', dica: 'chão, spawns, raridade' },
    { id: 'hunts', nome: 'Hunts e áreas', icone: 'mapa', modo: 'consulta', dica: 'mapa, monstros, dificuldade e drops' },
    { id: 'atos', nome: 'Acts e campanhas', icone: 'atos' },
    { id: 'fase', nome: 'Fases e encontros', icone: 'fase' },
    { id: 'mapas-antigo', nome: 'Editor de mapas (antigo)', icone: 'mapa', href: '/editor', dica: 'a tela antiga, enquanto você valida a nova' }] },
  { id: 'conteudo', titulo: 'Conteúdo do jogo', itens: [
    { id: 'mobs', nome: 'Mobs', icone: 'mobs', modo: 'parcial', dica: 'consulta e edição por override (o original do Canary não muda)' },
    { id: 'bosses', nome: 'Bosses únicos', icone: 'coroa' },
    { id: 'itens', nome: 'Itens', icone: 'espada', modo: 'parcial', dica: 'consulta e edição por override (o catálogo do Canary não muda)' },
    { id: 'outfits', nome: 'Outfits', icone: 'outfit', modo: 'consulta' },
    { id: 'montarias', nome: 'Montarias', icone: 'montaria', modo: 'consulta' },
    { id: 'progressao', nome: 'Progressão e loot', icone: 'engrenagem', modo: 'parcial', dica: 'Atos, tiers das bases e loot por dificuldade (override); simulador' },
    { id: 'itempower', nome: 'Item Power', icone: 'espada', modo: 'parcial', dica: 'poder base dos equipamentos, curva por level e alertas de distribuição (override)' },
    { id: 'conjuntos', nome: 'Conjuntos', icone: 'espada', modo: 'parcial', dica: 'sets de equipamento por classe, Ato e tier (override); referências a itens' },
    { id: 'sprites', nome: 'Editor de sprites', icone: 'outfit', modo: 'parcial', dica: 'monstros, outfits e montarias: quadros, direções e animação por override' }] },
  { id: 'recursos', titulo: 'Recursos', itens: [
    { id: 'biblioteca', nome: 'Biblioteca de conteúdos', icone: 'livros', modo: 'consulta' },
    { id: 'beta', nome: 'Testes e beta', icone: 'frasco', dica: 'interruptor do modo beta' },
    { id: 'config', nome: 'Configurações', icone: 'engrenagem', dica: 'manutenção e Server Save' }] },
];

// O estado do menu (recolhido, grupos fechados) fica no navegador; sem storage o menu funciona igual.
const armazem = (() => { try { return window.localStorage; } catch { return null; } })();
let MENU = lerEstadoDoMenu(armazem);
const gaveta = { aberta: false };
function abrirGaveta(aberta) {
  gaveta.aberta = aberta;
  document.body.classList.toggle('eng-gaveta', aberta);
  document.getElementById('eng-menu-btn')?.setAttribute('aria-expanded', String(aberta));
}
document.getElementById('eng-menu-btn')?.addEventListener('click', () => abrirGaveta(!gaveta.aberta));
document.getElementById('eng-gaveta-fundo')?.addEventListener('click', () => abrirGaveta(false));
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && gaveta.aberta) abrirGaveta(false); });
function desenharAbas() {
  MENU = abrirGrupoDe(MENU, GRUPOS, S.aba);
  desenharMenu({ alvo: $('#abas'), grupos: GRUPOS, ativa: S.aba, irPara: (id) => irPara(id), estado: MENU, fecharGaveta: () => abrirGaveta(false), aoMudar: (novo) => { MENU = novo; gravarEstadoDoMenu(armazem, MENU); desenharAbas(); } });
  $('#eng-local').replaceChildren(NOME_DA_ABA[S.aba] ?? '');
}
/** O endereço guarda a tela (`#fase/troll-cave`, `#bosses`...): recarregar ou mandar o link abre no mesmo lugar. */
const lerEndereco = () => {
  const [aba, ...resto] = location.hash.slice(1).split('/').map((p) => decodeURIComponent(p));
  return NOME_DA_ABA[aba] ? { aba, id: resto[0] || null, resto } : { aba: 'geral', id: null, resto: [] };
};
async function irPara(aba, faseId = null, resto = []) {
  if (S.aba === 'atos' && aba !== 'atos' && EDITOR_DE_ATOS.sujo() && !(await descartarAlteracoes('O ato aberto tem alterações não salvas'))) return desenharAbas();
  if (S.sujo && !(await descartarAlteracoes())) return desenharAbas();
  if (S.aba === 'sprites' && aba !== 'sprites') SPRITES.sair(); // para a animação e libera as folhas de rascunho do renderer
  S.navegacao++;
  S.sujo = false;
  S.aba = aba;
  if (faseId) S.faseId = faseId;
  history.replaceState(null, '', `#${aba}${aba === 'fase' && S.faseId ? `/${S.faseId}` : (aba === 'biblioteca' || TELAS_FIXAS[aba]) && resto?.length ? `/${resto.map(encodeURIComponent).join('/')}` : ''}`);
  desenharAbas();
  msg('');
  $('#raiz').replaceChildren(el('div', { class: 'dica' }, 'Carregando…'));
  if (aba === 'geral') await desenharGeral();
  if (aba === 'fase') await carregarFase(S.faseId ?? S.opcoes.fases[0].huntId);
  if (aba === 'mapa') {
    MW.dados = null;
    await desenharMapaDoMundo();
  }
  if (TELAS_FIXAS[aba]) await TELAS_FIXAS[aba].desenhar(resto ?? []);
  if (aba === 'bosses') await BOSSES.desenhar();
  if (aba === 'biblioteca') await BIBLIOTECA.desenhar(resto ?? []);
  if (aba === 'atos') await EDITOR_DE_ATOS.desenhar();
}

// ---- Visão geral
async function desenharGeral() {
  const a = (S.auditoria = await api('auditoria'));
  const t = a.totais;
  const raiz = $('#raiz');
  const metrica = (rotulo, valor, classe = '') => el('div', { class: `eng-metrica ${classe}` }, el('span', {}, rotulo), el('b', {}, valor));
  raiz.replaceChildren(
    cabecalho('Visão geral', 'A campanha inteira de uma vez: fases, encontros, bosses e tudo o que a validação do servidor encontrou.'),
    el('div', { class: 'eng-metricas' }, metrica('Fases', t.fases), metrica('Com encontros', t.comEncontros), metrica('Com boss', t.comBoss), metrica('Erros', t.erros, t.erros ? 'erro' : 'ok'), metrica('Avisos', t.avisos, t.avisos ? 'aviso' : 'ok')),
    el('h2', {}, 'Problemas'),
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
    cabecalho(fase.nome, `Ato ${fase.ato} · ${fase.huntId}`, botaoCopiar(fase.huntId)),
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

// ------------------------------------------------------------------ início

window.addEventListener('beforeunload', (e) => {
  if (S.sujo || (S.aba === 'atos' && EDITOR_DE_ATOS.sujo())) e.preventDefault();
});
// O editor de Atos guarda o próprio "sujo": o aviso da barra é conferido depois de cada edição.
for (const ev of ['input', 'change', 'click', 'pointerup']) document.addEventListener(ev, () => setTimeout(atualizarSujo, 0));
// O servidor decide quem entra: em produção, sem sessão de administrador a página leva a /editor/login (nenhum dado é entregue).
await garantirAcesso();
S.opcoes = await api('opcoes');
// O indicador de Hot Reload (barra do topo); em produção ele não aparece.
criarIndicadorDeHotReload({ base: BASE, alvo: document.getElementById('eng-hot') });
{
  const { aba, id, resto } = lerEndereco();
  S.aba = null;
  await irPara(aba, aba === 'fase' && S.opcoes.fases.some((f) => f.huntId === id) ? id : null, resto);
}
// Link colado na barra (ou voltar do navegador) com outro `#`: vai para a tela pedida, com o mesmo aviso de alterações.
window.addEventListener('hashchange', () => {
  const { aba, id, resto } = lerEndereco();
  if (aba === 'biblioteca' && S.aba === 'biblioteca') return resto.length === 2 && BIBLIOTECA.abrir(resto[0], resto[1]);
  if (TELAS_FIXAS[aba] && S.aba === aba) return resto.length === 1 && TELAS_FIXAS[aba].abrir(CATEGORIA_DA_TELA[aba], resto[0]);
  if (aba !== S.aba || (aba === 'fase' && id && id !== S.faseId)) irPara(aba, aba === 'fase' && S.opcoes.fases.some((f) => f.huntId === id) ? id : null, resto);
});
// Atalhos: Ctrl+K (ou ⌘K) busca em todos os cadastros; "/" vai para a busca da Biblioteca.
document.addEventListener('keydown', (e) => {
  const digitando = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName ?? '') || document.activeElement?.isContentEditable;
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
    e.preventDefault();
    BIBLIOTECA.buscaGlobal();
  } else if (e.key === '/' && !digitando && (S.aba === 'biblioteca' || TELAS_FIXAS[S.aba]) && !document.querySelector('dialog[open]')) {
    e.preventDefault();
    (TELAS_FIXAS[S.aba] ?? BIBLIOTECA).focarBusca();
  }
});


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
    cam.replaceChildren(fundoDoAto(MW.ato, nomeDoTema(MW.ato, meta.tema), pontos, meta.fundo));
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

  // ---- IMAGEM DE FUNDO do Ato: carrega, valida no servidor, mostra a prévia e SALVA na hora (arquivo em gamedata/mapa-mundo + referência no Ato) ----
  const blocoDoFundo = (() => {
    const caixa = el('div', { class: 'ip-painel', id: 'mw-fundo' });
    let rascunho = null;
    const dis = () => document.body.classList.contains('eng-somente-leitura');
    const pintarBloco = () => {
      const f = meta.fundo; const v = rascunho?.validacao;
      caixa.replaceChildren(...[
        el('h4', {}, `Imagem de fundo do Ato ${MW.ato}`),
        el('div', { class: 'dica' }, 'Carrega uma imagem (PNG, JPG ou WEBP, até 3 MB, 200–4096 px por lado; ideal na proporção 1000×640) como fundo do mapa mundo DESTE Ato. Ela cobre a tela e substitui o fundo desenhado. Salvar grava o arquivo em gamedata/mapa-mundo e vale no jogo depois do commit + deploy (e de reiniciar o servidor local).'),
        el('div', { class: 'linha' },
          f ? el('div', {}, el('b', {}, 'Salva'), el('div', {}, el('img', { src: `/gamedata/mapa-mundo/${f.arquivo}`, style: 'max-width:240px;max-height:154px;border:1px solid #444' })), el('div', { class: 'dica' }, `${f.arquivo} · ${f.w ?? '?'}×${f.h ?? '?'}px · ${Math.round((f.bytes ?? 0) / 1000)} KB`)) : el('div', { class: 'dica' }, 'Sem imagem: este Ato usa o fundo desenhado do tema.'),
          rascunho ? el('div', {}, el('b', {}, 'Nova (não salva)'), el('div', {}, el('img', { src: rascunho.dataUrl, style: 'max-width:240px;max-height:154px;border:1px solid #444' }))) : null),
        el('div', { class: 'linha' },
          el('input', { type: 'file', accept: 'image/png,image/jpeg,image/webp', disabled: dis(), onchange: async (e) => { const a = e.target.files?.[0]; if (!a) return; const dataUrl = await new Promise((ok, no) => { const r = new FileReader(); r.onload = () => ok(r.result); r.onerror = () => no(new Error('Não consegui ler o arquivo.')); r.readAsDataURL(a); }); rascunho = { dataUrl, validacao: await api('mapa/fundo/validar', { imagem: dataUrl }) }; pintarBloco(); } }),
          el('button', { type: 'button', class: 'primario', disabled: dis() || !v?.ok, onclick: async () => {
            const r = await api('mapa/fundo', { acao: 'salvar', ato: MW.ato, imagem: rascunho.dataUrl });
            if (r.ok === false) return msg((r.erros ?? ['Não salvou.']).join(' '), 'erro');
            meta.fundo = r.fundo; MW.original = JSON.stringify(corpoDoMapa()); rascunho = null; msg(`Imagem de fundo do Ato ${MW.ato} salva.`, 'ok'); pintarMapa(); pintarBloco();
          } }, 'Salvar imagem neste Ato'),
          el('button', { type: 'button', disabled: !rascunho, onclick: () => { rascunho = null; pintarBloco(); } }, 'Descartar'),
          el('button', { type: 'button', class: 'perigo', disabled: dis() || !f, onclick: async () => {
            const r = await api('mapa/fundo', { acao: 'remover', ato: MW.ato });
            if (r.ok === false) return msg((r.erros ?? ['Não removeu.']).join(' '), 'erro');
            delete meta.fundo; MW.original = JSON.stringify(corpoDoMapa()); msg('Imagem removida: o Ato volta ao fundo desenhado.', 'ok'); pintarMapa(); pintarBloco();
          } }, 'Remover imagem')),
        v ? (v.erros?.length ? el('ul', { class: 'problemas' }, v.erros.map((m) => el('li', { class: 'erro' }, `✖ ${m}`))) : el('div', { class: 'selo ok' }, `Imagem válida: ${v.tipo.toUpperCase()} ${v.w}×${v.h}px, ${Math.round(v.bytes / 1000)} KB`)) : null,
        v?.avisos?.length ? el('ul', { class: 'problemas' }, v.avisos.map((m) => el('li', { class: 'aviso' }, `⚠ ${m}`))) : null,
      ].filter(Boolean));
    };
    pintarBloco();
    return caixa;
  })();

  $('#raiz').replaceChildren(
    cabecalho('Mapa do mundo', 'A tela WORLD do jogo: posição dos nós, tipos, conexões e os dados de cada Ato.'),
    el('div', { class: 'linha' }, el('label', { class: 'campo' }, 'Ato', seletor), el('label', { class: 'campo' }, 'Pré-visualizar estados', previa, legendaPrevia)),
    form,
    blocoDoFundo,
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
