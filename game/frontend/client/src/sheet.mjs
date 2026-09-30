// Ficha de personagem: vitais, skills, progressão, combate e resistências.
// Os ícones são os mesmos PNGs do client (client/assets/ui).
import { outfitCanvas, itemCanvas } from './sprites.mjs';
import { artOrUiIcon } from './hud.mjs';
import { healthColor } from './map.mjs';

const el = (tag, className, text) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
};

/*
 * Uma porcentagem que cabe na tela.
 *
 * A proteção elemental era impressa crua, e proteção é soma de fração: um
 * amuleto de 0,1 mais um imbuement de 0,048 dá `0.148000000000000002` em ponto
 * flutuante, e era isso que aparecia na ficha — vinte e um caracteres num
 * cartão desenhado para quatro.
 *
 * O estrago não parava no número feio. O cartão é uma grade, e um valor de
 * vinte caracteres empurra o rótulo ao lado até sobrar UMA LETRA POR LINHA:
 * "F o g o" escrito de cima para baixo. A ficha parecia quebrada, e "voltava ao
 * normal" só quando o personagem perdia a fração e o número encurtava sozinho.
 *
 * Uma casa decimal, e o `Number` come o zero à toa: 0 vira "0", 0.148 vira
 * "0.1", 15.148 vira "15.1". É a mesma régua do resto da ficha, que já usava
 * `toFixed(1)` em crítico, life leech e mana leech.
 */
const porcento = (valor) => Number((Number(valor) || 0).toFixed(1));

/** "1h 20min", "45min", "3 dias" — o que sobra de um boost comprado. */
function tempoCurto(ms) {
  const minutos = Math.max(0, Math.round(ms / 60000));
  if (minutos >= 1440) return `${Math.floor(minutos / 1440)} dia(s)`;
  if (minutos >= 60) return `${Math.floor(minutos / 60)}h ${minutos % 60}min`;
  return `${minutos}min`;
}

const ELEMENTS = [
  ['Físico', 'physical'],
  ['Fogo', 'fire'],
  ['Gelo', 'ice'],
  ['Terra', 'earth'],
  ['Energia', 'energy'],
  ['Morte', 'death'],
  ['Sagrado', 'holy'],
];

const SKILL_LABEL = {
  melee: 'melee', distance: 'distância', shielding: 'escudo', fishing: 'pesca', magic: 'magic level',
};

/*
 * Os títulos das seções ganham ícone.
 *
 * A ficha é a tela mais cheia de texto do jogo — sete seções, quatro cards,
 * dez linhas de combate, sete de totais — e sem marca nenhuma o olho não achava
 * onde um bloco acabava e o outro começava. São os ícones de 128px, reduzidos
 * para 22: reduzir é onde o navegador acerta sozinho, sem `pixelated`.
 *
 * Quem ainda não tem desenho continua só com o texto — `onerror` tira a imagem
 * e o título fecha o espaço. Nada quebra por faltar arte.
 */
const artesQueFaltam = new Set();

function titulo(texto, arte) {
  const cabeca = el('h3', 'sheet-titulo');
  if (arte && !artesQueFaltam.has(arte)) {
    const img = document.createElement('img');
    img.src = `/client/assets/icons/${arte}.png`;
    img.alt = '';
    // Uma vez por desenho que falta: a ficha é aberta muitas vezes por sessão, e
    // um 404 por abertura esconde o erro que importa no console.
    img.onerror = () => {
      artesQueFaltam.add(arte);
      img.remove();
    };
    cabeca.append(img);
  }
  cabeca.append(document.createTextNode(texto));
  return cabeca;
}

/** Barra segmentada, no espírito da ficha do Tibia. */
function pips(percent) {
  const track = el('div', 'pips');
  for (let i = 0; i < 10; i++) {
    const pip = el('i');
    if (percent * 10 > i) pip.classList.add('on');
    track.append(pip);
  }
  return track;
}

/*
 * O card ganha ícone no rótulo.
 *
 * São vinte e um cards nesta tela, todos com o mesmo desenho: rótulo miúdo em
 * cima, número grande no meio, explicação embaixo. De relance viravam uma
 * parede uniforme de números — achar "chance de crítico" exigia ler os dez.
 * O ícone dá um ponto de referência para o olho voltar.
 */
function statCard(label, value, hint, color, arte) {
  const card = el('div', 'stat-card');

  /*
   * O desenho é filho direto do card, e não do rótulo.
   *
   * Dentro do rótulo ele ficava preso à linha de 9px e sobrava a 15 pixels —
   * arte que nasce em 1024 vira mancha nesse tamanho. Como filho do card ele
   * pode ocupar uma coluna própria e as duas linhas de altura, a 34px, no
   * espaço que a metade de baixo do card já desperdiçava.
   */
  const img = arteDeFicha(arte);
  if (img) {
    card.classList.add('com-arte');
    card.append(img);
  }

  const strong = el('b', null, value);
  if (color) strong.style.color = color;
  card.append(el('span', 'stat-rotulo', label), strong);
  if (hint) card.append(el('em', null, hint));
  return card;
}

/** A imagem do ícone, ou nada quando o desenho ainda não existe. */
function arteDeFicha(arte) {
  if (!arte || artesQueFaltam.has(arte)) return null;
  const img = document.createElement('img');
  img.src = `/client/assets/icons/${arte}.png`;
  img.alt = '';
  // Uma vez por desenho que falta: a ficha é aberta muitas vezes por sessão, e
  // um 404 por abertura esconde o erro que importa no console.
  img.onerror = () => {
    artesQueFaltam.add(arte);
    img.remove();
  };
  return img;
}

/** Rótulo com o ícone na mesma linha — é assim nas linhas de bônus, que são baixas. */
function rotulo(texto, arte) {
  const linha = el('span', 'stat-rotulo');
  const img = arteDeFicha(arte);
  if (img) linha.append(img);
  linha.append(document.createTextNode(texto));
  return linha;
}

function bar(label, value, max, className, text) {
  const row = el('div', 'sheet-bar');
  const track = el('div', `track ${className}`);
  const fill = el('i');
  const percent = Math.max(0, Math.min(100, (value / max) * 100));
  fill.style.width = `${percent}%`;
  // A vida muda de cor aqui também, nos mesmos degraus do client.
  if (className === 'hp') fill.style.background = healthColor(percent);
  track.append(fill);
  row.append(el('span', null, label), track, el('b', null, text));
  return row;
}

const formatTime = (ms) => {
  const total = Math.max(0, Math.floor(ms / 1000));
  return [Math.floor(total / 3600), Math.floor((total % 3600) / 60), total % 60]
    .map((part) => String(part).padStart(2, '0'))
    .join(':');
};

/** "min – max" quando a faixa tem largura; o valor só quando não tem (peça sem faixa, ou sem nada vestido). */
function faixa(min, max, media, formatar = (v) => v) {
  if (min == null || max == null || min === max) return formatar(media);
  return `${formatar(min)} – ${formatar(max)}`;
}

/** Uma grade de cards. */
function grade(...cards) {
  const g = el('div', 'stat-grid');
  g.append(...cards);
  return g;
}

/*
 * Uma seção da ficha que RECOLHE (no celular a ficha é longa). Aberta ou
 * fechada fica lembrado neste aparelho; sem armazenamento, abre sempre.
 */
function secao(body, id, texto, arte, conteudo) {
  const d = el('details', 'sheet-secao');
  d.dataset.secao = id;
  let aberta = true;
  try {
    aberta = localStorage.getItem(`ficha-secao:${id}`) !== '0';
  } catch {
    // sem armazenamento: aberta
  }
  d.open = aberta;
  const cabeca = el('summary');
  cabeca.append(titulo(texto, arte));
  d.append(cabeca, ...conteudo);
  d.addEventListener('toggle', () => {
    try {
      localStorage.setItem(`ficha-secao:${id}`, d.open ? '1' : '0');
    } catch {
      // sem armazenamento: não lembra
    }
  });
  body.append(d);
}

/** As 7 resistências (a proteção da ficha, em %). */
function protecaoElemental(derived) {
  const elements = el('div', 'element-grid');
  for (const [name, key] of ELEMENTS) {
    const value = derived.protection?.[key] ?? 0;
    const chip = el('div', 'element');
    const total = el('b', null, `${porcento(value)}%`);
    if (value) total.style.color = 'var(--accent)';
    chip.append(artOrUiIcon(`el-${key}`, name), el('span', null, name), total);
    elements.append(chip);
  }
  return elements;
}

/*
 * ---- Ataque elemental ----
 * O dono: "no balance da ficha por que não aparece ataque elemental? igual
 * fica a proteção elemental". O "Dano de <elemento> %" dos atributos e da
 * árvore (`derived.danoDoElemento`, a mesma ficha que o combate usa): +X% nas
 * magias/runas/wand daquele elemento e, no golpe da arma, X% dele saindo
 * naquele elemento. "arma" marca o elemento da própria arma/wand, e o
 * imbuement de dano elemental aparece no elemento dele.
 */
/*
 * ---- De onde vem cada número ----
 * O dono: "mostrar a origem do bônus — Fire Damage: Base 100%, Equipment +25%,
 * Specialization +15%, Total 140%". As parcelas vêm prontas do servidor
 * (`derived.origens`, as MESMAS que a conta soma); aqui só o texto do balão.
 */
function textoDaOrigem(derived, chave, total, sufixo = '%') {
  const partes = derived.origens?.[chave];
  if (!partes?.length) return null;
  const linhas = partes.map((p) => `${p.fonte}: ${p.valor > 0 ? '+' : ''}${porcento(p.valor)}${p.pct ? '%' : sufixo}`);
  return `De onde vem:\n${linhas.join('\n')}\nTotal: ${total}`;
}
function comOrigem(card, derived, chave, total, sufixo = '%') {
  const texto = textoDaOrigem(derived, chave, total, sufixo);
  if (texto) card.title = texto;
  return card;
}

const NOME_DA_TAG = {
  physical: 'físico', fire: 'de fogo', ice: 'de gelo', earth: 'de terra', energy: 'de energia', death: 'de morte', holy: 'sagrado',
  melee: 'corpo a corpo', ranged: 'à distância', spell: 'de magias e runas',
};
const NOME_DO_STAT = {
  armour: 'Armour', life: 'Life máxima', accuracy: 'Accuracy', evasion: 'Evasion', attackSpeed: 'Attack Speed',
  castSpeed: 'Cast Speed', moveSpeed: 'Movement Speed', healing: 'de cura',
};
/** "+15% de dano de fogo" — o texto de um efeito de especialização. */
const textoDoEfeito = (ef) =>
  ef.tag ? `+${ef.dano}% de dano ${NOME_DA_TAG[ef.tag] ?? ef.tag}` : ef.stat === 'healing' ? `+${ef.pct}% de cura` : `+${ef.pct}% ${NOME_DO_STAT[ef.stat] ?? ef.stat}`;

function ataqueElemental(derived) {
  const ataques = el('div', 'element-grid');
  const daArma = derived.element?.type === 'poison' ? 'earth' : derived.element?.type;
  const doImbuement = derived.imbuElemental;
  for (const [name, key] of ELEMENTS) {
    // O dano do elemento (itens, árvore, STR no físico) + a afinidade da classe nele.
    const value = (derived.danoDoElemento?.[key] ?? 0) + (derived.afinidades?.[key] ?? 0);
    const chip = el('div', 'element');
    const total = el('b', null, `${value > 0 ? '+' : ''}${porcento(value)}%`);
    if (value) total.style.color = 'var(--accent)';
    chip.append(artOrUiIcon(`el-${key}`, name), el('span', null, name), total);
    const notas = [];
    if (daArma === key) notas.push('arma');
    if (doImbuement?.tipo === key) notas.push(`imbuement ${porcento(doImbuement.pct)}%`);
    if (notas.length) chip.append(el('em', 'element-nota', notas.join(' · ')));
    const uso =
      key === 'physical'
        ? `Dano físico: +${porcento(value)}% no golpe da arma e nas skills físicas.`
        : `Dano de ${name.toLowerCase()}: +${porcento(value)}% nas skills e na wand de ${name.toLowerCase()}.`;
    chip.title = [uso, textoDaOrigem(derived, `dano.${key}`, `+${porcento(value)}%`)].filter(Boolean).join('\n\n');
    ataques.append(chip);
  }
  // E por TIPO: corpo a corpo, à distância e magias/runas (a afinidade da classe; o INT nas magias).
  for (const [name, key, icone, valor] of [
    ['Melee', 'melee', 'sk-melee', derived.afinidades?.melee ?? 0],
    ['Ranged', 'ranged', 'sk-distance', derived.afinidades?.ranged ?? 0],
    ['Spell', 'spell', 'sk-magic', (derived.afinidades?.spell ?? 0) + (derived.danoDeMagia ?? 0)],
  ]) {
    const chip = el('div', 'element');
    const total = el('b', null, `${valor > 0 ? '+' : ''}${porcento(valor)}%`);
    if (valor) total.style.color = 'var(--accent)';
    chip.append(artOrUiIcon(icone, name), el('span', null, name), total);
    chip.title = textoDaOrigem(derived, `dano.${key}`, `+${porcento(valor)}%`) ?? `Nenhum bônus de dano ${NOME_DA_TAG[key]} ainda.`;
    ataques.append(chip);
  }
  return ataques;
}

export function renderSheet(body, { state, send, closeModal }) {
  const character = state.character;
  const derived = character.derived;
  const vocation = state.catalog.vocations.find((v) => v.id === character.vocation);
  /*
   * ---- Depois da promocao o nome e' o novo ----
   *
   * A promocao nao troca `character.vocation`: ela liga `character.promoted` e
   * o paladino continua sendo `paladin` para toda a conta de dano e de magia.
   * Quem sabe o nome de exibicao e' o servidor, em `derived.vocationName` — e o
   * card do canto ja usava isso. A ficha nao: ela procurava so' pelo id e
   * mostrava "Paladin" para quem tinha pagado os 20 mil de Royal Paladin.
   */
  const nomeDaVocacao = character.derived?.vocationName ?? vocation?.name ?? 'Sem vocação';

  // ---------- cabeçalho ----------
  const header = el('div', 'sheet-header');
  const portrait = el('div', 'sheet-portrait');
  portrait.append(
    outfitCanvas(character.outfit.type, character.outfit, 84),
    el('b', null, character.name),
    el('span', null, `${nomeDaVocacao} · level ${character.level}`)
  );

  const bars = el('div', 'sheet-bars');
  bars.append(
    bar('Vida', character.hp, derived.maxHp, 'hp', `${character.hp} / ${derived.maxHp}`),
    bar('Mana', character.mana, derived.maxMana, 'mana', `${character.mana} / ${derived.maxMana}`),
    // Energy Shield: só quem tem (peças de mago, adds) — absorve antes da vida.
    ...(derived.energyShield > 0 ? [bar('Energy Shield', character.es ?? derived.energyShield, derived.energyShield, 'es', `${character.es ?? derived.energyShield} / ${derived.energyShield}`)] : []),
    bar('Experiência', character.progress.percent * 100, 100, 'exp', `${(character.progress.percent * 100).toFixed(1)}%`),
    bar('Stamina', character.stamina, character.maxStamina, 'stamina', `${Math.floor(character.stamina / 60)}h${String(Math.floor(character.stamina % 60)).padStart(2, '0')}`)
  );

  header.append(portrait, bars);
  body.append(header);


  // ---------- skills e progressão ----------
  const columns = el('div', 'sheet');

  const left = el('div');
  left.append(titulo('Skills', 'ficha-skills'));
  const skills = el('div', 'skill-table');
  const addSkill = (key, value, percent) => {
    const row = el('div', 'skill-row');
    const bonus = derived.skillBonus?.[key] ?? 0;
    const total = el('b', null, bonus ? `${value}+${bonus}` : String(value));
    if (bonus) total.style.color = 'var(--accent)';
    row.append(
      artOrUiIcon(`sk-${key}`, key),
      el('span', null, SKILL_LABEL[key] ?? key),
      total,
      pips(percent),
      el('em', null, `${Math.round(percent * 100)}%`)
    );
    skills.append(row);
  };
  for (const skill of state.catalog.skills) addSkill(skill, character.skills[skill].value, character.skills[skill].percent);
  addSkill('magic', character.magic.value, character.magic.percent);
  left.append(skills);

  const right = el('div');
  right.append(titulo('Progressão e bônus', 'ficha-progresso'));

  const progression = el('div', 'progress-block');
  progression.append(el('b', null, `Faltam ${character.progress.toNext.toLocaleString('pt-BR')} de experiência`));
  const expTrack = el('div', 'track exp');
  const expFill = el('i');
  expFill.style.width = `${character.progress.percent * 100}%`;
  expTrack.append(expFill);
  progression.append(expTrack);

  const seen = Object.keys(character.bestiary).length;
  const total = Object.keys(state.catalog.bestiary).length;
  progression.append(el('b', null, `${seen} de ${total} criaturas no bestiary`));
  const bestiaryTrack = el('div', 'track accent');
  const bestiaryFill = el('i');
  bestiaryFill.style.width = `${(seen / total) * 100}%`;
  bestiaryTrack.append(bestiaryFill);
  progression.append(bestiaryTrack);
  right.append(progression);

  right.append(titulo('Bônus de experiência', 'ficha-exp'));
  const bonuses = el('div', 'rows');
  const addRow = (label, value, muted, arte) => {
    const row = el('div');
    const strong = el('b', null, value);
    if (muted) strong.style.color = 'var(--muted)';
    row.append(rotulo(label, arte), strong);
    bonuses.append(row);
  };

  /*
   * A prey de experiência vale SÓ na criatura escolhida.
   *
   * O servidor confere `slot.key !== monsterKey` antes de somar qualquer coisa
   * (`preyBonus`, em prey.mjs): 40% numa Spider é 40% em spiders e zero no
   * resto da hunt. Esta linha mostrava "+40%" solto e entrava inteira no bônus
   * total, o que fazia parecer um bônus geral de experiência — e não é.
   *
   * Agora ela diz em quem vale, e o total avisa que a parte da prey tem dono.
   */
  const slotsExp = (character.prey ?? []).filter((slot) => slot.bonus === 'exp' && slot.left > 0);
  const nomeDaPresa = (slot) => state.catalog.bestiary?.[slot.key]?.name ?? slot.key;

  /*
   * Cada prey tem o SEU bônus, contra a SUA criatura.
   *
   * Antes as três eram somadas numa linha só: três preys de 40% viravam
   * "+40+40+40 = +120%", e esse 120 ainda entrava no bônus total. O servidor
   * nunca somou nada disso — `preyBonus` compara `slot.key` com a criatura que
   * morreu e devolve o percentual de UM slot. Uma linha por prey, e nenhuma
   * delas no total.
   */
  /*
   * ---- Os boosts de experiência SOMAM entre si ----
   *
   * Havia uma linha só, "XP Boost +50%", escrita à mão de quando a loja era a
   * única fonte. Hoje são três — o XP Boost e as duas Exp Potions — e elas se
   * somam, cada uma com o próprio relógio. Uma linha por fonte é a única forma
   * de a ficha dizer quanto e por quanto tempo.
   *
   * A lista vem do servidor (`efeitos.exp.fontes`), que é quem soma na hora de
   * pagar a experiência.
   */
  const NOME_DO_BOOST = {
    loja: 'XP Boost da loja',
    'pocao-50': 'Exp Potion 50%',
    'pocao-75': 'Exp Potion 75%',
    // Ver `boostDeExp`: ele chega como fonte, igual às outras três.
    'buff-power': 'Buff Power Exp',
  };
  const boosts = (character.efeitos?.exp?.fontes ?? []).map((fonte) => ({
    nome: NOME_DO_BOOST[fonte.fonte] ?? 'XP Boost',
    percent: fonte.percent,
    resta: fonte.restante,
  }));
  if ((character.premium ?? 0) > 0) boosts.push({ nome: 'Premium', percent: 10, resta: character.premium });
  const percentComprado = boosts.reduce((soma, b) => soma + b.percent, 0);
  const skins = derived.skinsDoSummon ?? null;
  const percentDasSkins = skins?.exp ?? 0;

  addRow('Bônus de level', `+${derived.expBonus}%`, false, 'ficha-level');
  /*
   * As skins do familiar, na mesma lista dos boosts.
   *
   * Elas somam com o resto (ver `experienciaPessoal`, no servidor), então entram
   * na conta do "Bônus total" logo abaixo — por isso `percentDasSkins` existe e
   * não é um número solto no meio da lista.
   */
  if (skins?.exp) {
    addRow(
      'Skins do summon',
      `+${skins.exp.toLocaleString('pt-BR')}% · ${skins.tenho} skin(s)` +
        (skins.daVestida?.tipo === 'exp' ? ` + ${skins.nomeDaVestida} vestida` : ''),
      false,
      'ficha-exp',
    );
  }
  for (const boost of boosts) addRow(boost.nome, `+${boost.percent}% · ${tempoCurto(boost.resta)}`, false, 'ficha-exp');
  /*
   * ---- A stamina MULTIPLICA, e a faixa verde é de quem tem premium ----
   *
   * A linha dizia só "normal" acima de 14 horas, e escondia o degrau de cima: o
   * servidor paga 1,5x acima de 39 horas para conta premium
   * (`Player.getFinalBonusStamina`). Quem estava com 41 horas e premium ganhava
   * 50% a mais e via a ficha dizer "normal" — daí a impressão de que o premium
   * dá mais do que os 10% que ele anuncia. Dá: os 10% são dele, e o 1,5x é da
   * stamina, que só chega nessa faixa com premium.
   *
   * Ela fica FORA do "Bônus total" de propósito: é um multiplicador, e somá-la
   * a uma lista de porcentagens que se somam daria um número que o servidor
   * nunca usa.
   */
  const temPremium = (character.premium ?? 0) > 0;
  const fatorStamina = character.stamina > 39 * 60 && temPremium ? 1.5 : character.stamina > 14 * 60 ? 1 : 0.5;
  addRow(
    'Stamina',
    fatorStamina === 1.5
      ? '×1,5 — acima de 39h com premium'
      : fatorStamina === 1
        ? '×1 — experiência integral'
        : character.stamina > 0
          ? '×0,5 — 14h ou menos'
          : '×0,5 — esgotada',
    fatorStamina < 1,
    'ficha-stamina'
  );

  const totalRow = el('div', 'total');
  totalRow.append(
    rotulo('Bônus total', 'ficha-bonus-total'),
    el('b', null, `+${(derived.expBonus + percentComprado + percentDasSkins).toLocaleString('pt-BR')}%`)
  );
  bonuses.append(totalRow);
  bonuses.append(
    el(
      'p',
      'sheet-nota',
      fatorStamina === 1
        ? 'Vale em qualquer criatura.'
        : `Vale em qualquer criatura, e a stamina multiplica o resultado por ${String(fatorStamina).replace('.', ',')}.`
    )
  );
  /*
   * ---- O que as skins pagam ALÉM da experiência ----
   *
   * "isso seja bem explicado (...) e na ficha".
   *
   * A lista acima é de experiência, e é onde a linha das skins entra na conta. Mas
   * elas pagam três coisas, e as outras duas não teriam lugar nenhum na ficha: o
   * loot e o dano da que está vestida. Uma frase abaixo do bloco diz as três, e o
   * detalhe de quem paga o quê fica na prateleira Extras, onde se compra.
   */
  if (skins?.tenho) {
    const pedacos = [`+${skins.loot.toLocaleString('pt-BR')}% de loot`];
    if (skins.dano) pedacos.push(`+${skins.dano.toLocaleString('pt-BR')}% de dano`);
    bonuses.append(
      el(
        'p',
        'sheet-nota',
        `Suas ${skins.tenho} skin(s) de summon também dão ${pedacos.join(' e ')}. ` +
          'Cada uma vale +0,5% de experiência e +0,5% de loot só por ter; a vestida soma o bônus dela.',
      )
    );
  }

  // A prey vem depois do total, e fora dele: são bônus com dono.
  if (slotsExp.length) {
    bonuses.append(el('div', 'sheet-sub', 'Prey — só contra a criatura escolhida'));
    for (const slot of slotsExp) addRow(nomeDaPresa(slot), `+${slot.percent}%`, false, 'prey');
  } else {
    addRow('Prey de experiência', '—', true, 'prey');
  }
  right.append(bonuses);

  columns.append(left, right);
  body.append(columns);

  /*
   * ---- A ficha em SEIS seções: Atributos, Recursos, Ofensivo, Defensivo, Resistências, Utilidade ----
   *
   * A reestruturação de itens (29/09): "somente estatísticas que realmente
   * existem" — os números vêm todos de `derived`, que é o `Ficha.combate` do
   * servidor (a MESMA conta do combate, do balão e da comparação). O que é
   * opcional (Cast Speed, dano contra boss, Gold Find...) só aparece quando o
   * personagem tem. Cada seção recolhe (lembra aberta/fechada neste aparelho).
   */
  const pct = (v) => `${v > 0 ? '+' : ''}${porcento(v)}%`;
  const soSeTem = (valor, card) => (valor ? [card()] : []);
  const at = derived.atributos ?? { str: 0, dex: 0, int: 0, daVocacao: { str: 0, dex: 0, int: 0 } };
  const ef = derived.efeitosDosAtributos ?? {};
  const origem = (k) => {
    const itens = at[k] - (at.daVocacao?.[k] ?? 0);
    return `${at.daVocacao?.[k] ?? 0} da vocação${itens ? ` + ${itens} dos itens` : ''}`;
  };
  const chances = derived.chancesNoLevel ?? {};

  /*
   * ---- A CLASSE e as especializações naturais ----
   * "Classe ≠ restrição; classe = especialização natural" (o dono). Qualquer
   * classe usa qualquer skill e equipamento (com os requisitos de atributo); as
   * especializações dão afinidade quando a skill/golpe tem a tag delas.
   */
  const classe = derived.classe;
  if (classe?.especializacoes?.length) {
    secao(body, 'classe', `Classe: ${classe.nome}`, 'ficha-skills', [
      el('p', 'sheet-nota', 'Especializações naturais — bônus quando você usa aquele tipo de dano, arma ou mecânica. Não bloqueiam nada: qualquer classe usa qualquer skill e equipamento.'),
      grade(...classe.especializacoes.map((e) => {
        const card = statCard(e.nome, (e.efeitos ?? []).map(textoDoEfeito).join(' · '), null, null, 'ficha-skills');
        card.classList.add('especializacao');
        return card;
      })),
    ]);
  }

  secao(body, 'atributos', 'Atributos', 'ficha-skills', [
    grade(
      statCard('STR', at.str, `${origem('str')} · +${Math.round(ef.vida ?? 0)} vida, ${pct(ef.danoFisicoPct ?? 0)} dano físico`, null, 'ficha-dano'),
      statCard('DEX', at.dex, `${origem('dex')} · +${Math.round(ef.precisao ?? 0)} accuracy, +${Math.round(ef.evasao ?? 0)} evasion, ${pct(ef.velocidadeDeAtaquePct ?? 0)} vel. de ataque`, null, 'ficha-alcance'),
      statCard('INT', at.int, `${origem('int')} · +${Math.round(ef.mana ?? 0)} mana, ${pct(ef.danoMagicoPct ?? 0)} dano mágico`, null, 'ficha-regen-mana'),
    ),
  ]);

  secao(body, 'recursos', 'Recursos', 'ficha-regen-vida', [
    grade(
      statCard('Vida', derived.maxHp.toLocaleString('pt-BR'), null, null, 'ficha-regen-vida'),
      statCard('Mana', derived.maxMana.toLocaleString('pt-BR'), null, null, 'ficha-regen-mana'),
      ...soSeTem(derived.energyShield, () => statCard('Energy Shield', `${(character.es ?? derived.energyShield).toLocaleString('pt-BR')} / ${derived.energyShield.toLocaleString('pt-BR')}`, 'absorve o dano antes da vida · recarrega sozinho', null, 'ficha-armadura')),
      /*
       * ---- Regeneração: a NATURAL mais a das PEÇAS ----
       *
       * São duas contas diferentes e a ficha mostrava só a primeira. A natural é
       * uma fração da vida máxima (e a promoção a multiplica); a das peças é um
       * número fixo por segundo que vem do `healthgain` do items.xml — é o que o
       * Draevor Ring, o Amuleto e a Backpack anunciam como "regenera mana e vida
       * 30", e o que fazia o jogador olhar a ficha e achar que não estava valendo.
       *
       * O número grande é o total, porque é o que ele sente; a linha de baixo
       * separa as parcelas, porque é o que explica de onde veio.
       */
      statCard(
        'Regeneração de vida',
        `+${(derived.maxHp * 0.004 * (derived.regen?.hp ?? 1) + (derived.regenFlat?.hp ?? 0)).toFixed(1)}/s`,
        derived.regenFlat?.hp
          ? `${(derived.maxHp * 0.004 * (derived.regen?.hp ?? 1)).toFixed(1)} natural + ${derived.regenFlat.hp.toFixed(1)} do equipamento`
          : null,
        null,
        'ficha-regen-vida'
      ),
      statCard(
        'Regeneração de mana',
        `+${(derived.maxMana * 0.006 * (derived.regen?.mana ?? 1) + (derived.regenFlat?.mana ?? 0)).toFixed(1)}/s`,
        derived.regenFlat?.mana
          ? `${(derived.maxMana * 0.006 * (derived.regen?.mana ?? 1)).toFixed(1)} natural + ${derived.regenFlat.mana.toFixed(1)} do equipamento`
          : null,
        null,
        'ficha-regen-mana'
      ),
    ),
  ]);

  secao(body, 'ofensivo', 'Ofensivo', 'ficha-combate', [
    grade(
      // Dano e crítico são FAIXAS: a das peças (sorteada no drop), e cada golpe sorteia dentro dela.
      statCard('Dano', `${derived.damage.min} – ${derived.damage.max}`, `por ataque de ${SKILL_LABEL[derived.skillName] ?? derived.skillName}`, null, 'ficha-dano'),
      statCard('Chance de crítico', `${(derived.critChance * 100).toFixed(1)}%`, `+${Math.round((derived.critMultiplier - 1) * 100)}% de dano`, null, 'ficha-critico'),
      // O intervalo entre golpes que a caçada usa de verdade (base 2 s, encurtado pela velocidade de ataque e pelo "Tempo entre golpes").
      comOrigem(statCard(
        'Velocidade de ataque',
        `${(derived.intervaloDoGolpeMs / 1000).toFixed(2).replace('.', ',')} s`,
        `${(1000 / derived.intervaloDoGolpeMs).toFixed(2).replace('.', ',')} golpes por segundo${derived.velocidadeDeAtaque ? ` · ${pct(derived.velocidadeDeAtaque)}` : ''}`,
        null,
        'ficha-dano'
      ), derived, 'velocidadeDeAtaque', pct(derived.velocidadeDeAtaque ?? 0)),
      comOrigem(statCard('Accuracy', (derived.accuracy ?? 0).toLocaleString('pt-BR'), chances.acerto != null ? `${Math.round(chances.acerto * 100)}% de acerto num bicho do seu level` : null, null, 'ficha-alcance'), derived, 'accuracy', (derived.accuracy ?? 0).toLocaleString('pt-BR'), ''),
      ...soSeTem(derived.danoDeMagia, () => statCard('Dano mágico', pct(derived.danoDeMagia), 'magias, runas e wand', null, 'ficha-dano-elemental')),
      ...soSeTem(derived.castSpeed, () => comOrigem(statCard('Cast Speed', pct(derived.castSpeed), 'intervalo entre magias mais curto', null, 'ficha-velocidade'), derived, 'castSpeed', pct(derived.castSpeed))),
      ...soSeTem(derived.recuperacaoDeRecarga, () => statCard('Cooldown Recovery', pct(derived.recuperacaoDeRecarga), 'recarga das magias mais rápida', null, 'ficha-velocidade')),
      ...soSeTem(derived.custoDeMana < 0, () => statCard('Custo de magias', `${porcento(derived.custoDeMana * 100)}%`, 'mana gasta por magia', null, 'ficha-regen-mana')),
      statCard('Life leech', `${(derived.lifeLeech * 100).toFixed(1)}%`, 'do dano causado', null, 'ficha-life-leech'),
      statCard('Mana leech', `${(derived.manaLeech * 100).toFixed(1)}%`, 'do dano causado', null, 'ficha-mana-leech'),
      ...soSeTem(derived.danoContra?.monstros, () => statCard('Dano contra criaturas', pct(derived.danoContra.monstros), null, null, 'ficha-kills')),
      ...soSeTem(derived.danoContra?.boss, () => statCard('Dano contra boss', pct(derived.danoContra.boss), null, null, 'ficha-kills')),
      ...soSeTem(derived.danoContra?.elite, () => statCard('Dano contra elite', pct(derived.danoContra.elite), null, null, 'ficha-kills')),
      statCard('Alcance', derived.attackRange > 1 ? `${derived.attackRange} sqm` : 'corpo a corpo', null, null, 'ficha-alcance'),
      /*
       * O elemental da ARMA é uma FATIA do golpe, e não um golpe à parte: o
       * ataque do item já vem repartido e a rolagem sai do total.
       */
      ...(derived.elementFactor > 0 && derived.element
        ? [statCard('Dano elemental da arma', `${Math.round(derived.elementFactor * 100)}%`, `do golpe sai como ${derived.element.type}`, null, 'ficha-dano-elemental')]
        : []),
    ),
    el('div', 'sheet-sub', 'Dano por tipo'),
    ataqueElemental(derived),
  ]);

  secao(body, 'defensivo', 'Defensivo', 'ficha-armadura', [
    grade(
      comOrigem(statCard('Armour', (derived.armor ?? 0).toLocaleString('pt-BR'), 'corta o golpe físico', null, 'ficha-armadura'), derived, 'armour', (derived.armor ?? 0).toLocaleString('pt-BR'), ''),
      comOrigem(statCard('Evasion', (derived.evasion ?? 0).toLocaleString('pt-BR'), chances.esquiva != null ? `${Math.round(chances.esquiva * 100)}% de esquiva do golpe de um bicho do seu level` : null, null, 'ficha-bloqueio'), derived, 'evasion', (derived.evasion ?? 0).toLocaleString('pt-BR'), ''),
      statCard('Bloqueio', faixa(derived.blockChanceMin, derived.blockChanceMax, derived.blockChance, (v) => `${(v * 100).toFixed(0)}%`), 'apara o golpe (escudo e arma)', null, 'ficha-bloqueio'),
      ...soSeTem(derived.danoRecebidoDasGemas > 0, () => statCard('Redução de dano', `${porcento(derived.danoRecebidoDasGemas * 100)}%`, 'de todo dano recebido', null, 'ficha-armadura')),
      ...soSeTem(derived.evitarDano, () => statCard('Evitar dano', `${porcento(derived.evitarDano * 100)}%`, 'chance de ignorar um golpe ou magia', null, 'ficha-bloqueio')),
      ...soSeTem(derived.esquiva, () => statCard('Esquiva das gemas', `${porcento(derived.esquiva * 100)}%`, 'o golpe ou a magia não pega', null, 'ficha-bloqueio')),
    ),
  ]);

  secao(body, 'resistencias', 'Resistências', 'ficha-elemental', [protecaoElemental(derived)]);

  secao(body, 'utilidade', 'Utilidade', 'ficha-velocidade', [
    grade(
      /*
       * ---- A velocidade, COM a corrida que estiver ligada ----
       *
       * A base é a do Tibia: 220, +2 por nível, mais o que o equipamento e a
       * montaria somam. O que faltava era a magia: `utani hur` e companhia somam
       * num `derived` que vive dentro do tique da caçada e morre lá, então a
       * ficha — que recebe outro, calculado do zero — mostrava sempre o número
       * parado. O dono reparou: "não está mostrando a velocidade a mais na ficha".
       *
       * A conta é a mesma do servidor (`velocidade * mult + fixo`, a fórmula da
       * `CONDITION_HASTE` da base dele), refeita aqui com os números que o buff
       * traz. Sem corrida ligada, `corrida` é nulo e o card fica como era.
       */
      (() => {
        const corrida = (state.hunt?.buffs ?? []).find((buff) => buff.tipo === 'speed' && buff.mult);
        const comCorrida = corrida ? Math.round(derived.speed * corrida.mult + (corrida.fixo ?? 0)) : derived.speed;
        const passos = `${(1000 / (100000 / Math.max(30, comCorrida))).toFixed(2)} passos por segundo`;
        const card = statCard(
          'Velocidade',
          comCorrida,
          corrida ? `${passos} · ${derived.speed} + ${corrida.nome}` : passos,
          null,
          'ficha-velocidade'
        );
        if (corrida) card.classList.add('com-buff');
        return card;
      })(),
      statCard('Capacidade', `${Math.max(0, derived.capacity - character.weight).toFixed(0)} oz`, `de ${derived.capacity} oz`, null, 'ficha-capacidade'),
      ...soSeTem(derived.goldFind, () => statCard('Gold Find', pct(derived.goldFind), 'mais moedas por drop', null, 'ficha-ouro')),
      ...soSeTem(derived.lootRate, () => statCard('Loot Rate', pct(derived.lootRate), 'mais chance de cada drop', null, 'ficha-ouro')),
      ...soSeTem(derived.experiencia, () => statCard('Experiência dos itens', pct(derived.experiencia), null, null, 'ficha-exp')),
      // O prêmio de colecionar: outfits completos e montarias viram crítico.
      statCard(
        'Coleção',
        `+${(((derived.collection?.critChance ?? 0) * 100).toFixed(1)).replace('.', ',')}%`,
        `${derived.collection?.pieces ?? 0} peças × 0,3% de crítico`,
        null,
        'ficha-colecao'
      ),
    ),
  ]);

  /*
   * ---- O que o BUFF POWER está somando agora ----
   *
   * "os outros têm que mostrar na ficha do personagem, bem certinho."
   *
   * Os números dos cards acima JÁ vêm com o buff dentro — ele entra em
   * `deriveStats`, nos mesmos acumuladores do equipamento. O que faltava era
   * dizer DE ONDE veio: quem liga o Buff Power e olha a ficha vê o crítico
   * subir de 60% para 75% sem nada explicando, e quando a hora acabar vai ver
   * cair de novo achando que perdeu uma peça.
   *
   * Uma linha por bônus, com o relógio no fim: é o mesmo desenho das fontes de
   * experiência logo acima, e pela mesma razão — um total sozinho não deixa
   * ninguém saber o que está por acabar.
   *
   * A seção só existe quando há buff ligado. Uma seção vazia permanente na
   * ficha seria propaganda, e não informação.
   */
  const buffsLigados = (character.efeitos?.buffPower ?? []).filter((linha) => linha.restante > 0);
  if (buffsLigados.length) {
    body.append(titulo('Buff Power', 'ficha-buff'));
    const grade = el('div', 'stat-grid');
    for (const buff of buffsLigados) {
      /*
       * Montado à mão e não por `statCard`: aquele desenha um ÍCONE de arquivo
       * (`/client/assets/icons/<nome>.png`), e o que identifica um Buff Power é
       * a SPRITE DO ITEM — a mesma que a pessoa vê na mochila e na loja. Sem
       * ela, três cards de texto com nomes parecidos ("Buff Power", "Buff Power
       * Exp", "Buff Power Loot") são três linhas que se leem duas vezes.
       */
      const card = el('div', 'stat-card com-arte ficha-buff-card');
      const arte = itemCanvas(buff.item, 32);
      if (arte) card.append(arte);
      card.append(el('span', 'stat-rotulo', buff.nome));
      card.append(el('b', null, tempoCurto(buff.restante)));
      card.append(el('em', null, buff.resumo));
      grade.append(card);
    }
    body.append(grade);
  }


  // ---------- imbuements ativos ----------
  const imbued = Object.entries(character.imbuements ?? {}).flatMap(([slot, list]) =>
    (list ?? []).map((entry) => ({ slot, ...entry }))
  );
  if (imbued.length) {
    body.append(titulo('Imbuements ativos', 'imbuements'));
    const rows = el('div', 'rows');
    for (const entry of imbued) {
      const row = el('div');
      const left = Math.ceil(entry.left / 60000);
      row.append(
        el('span', null, `${entry.name} (${entry.slot})`),
        el('b', null, entry.paused ? 'pausado' : left >= 60 ? `${Math.floor(left / 60)}h${String(left % 60).padStart(2, '0')}` : `${left} min`)
      );
      rows.append(row);
    }
    body.append(rows);
  }

  // ---------- totais ----------
  body.append(titulo('Totais', 'ficha-totais'));
  const totals = el('div', 'stat-grid');
  totals.append(
    statCard('Monstros mortos', character.totals.kills.toLocaleString('pt-BR'), null, null, 'ficha-kills'),
    statCard('Ouro acumulado', character.totals.gold.toLocaleString('pt-BR'), null, null, 'ficha-ouro'),
    statCard('No banco', (character.bank ?? 0).toLocaleString('pt-BR'), null, null, 'banco'),
    statCard('Mortes', character.totals.deaths, null, null, 'ficha-mortes'),
    statCard('Tempo caçando', formatTime(character.totals.time * 1000), null, null, 'ficha-tempo'),
    statCard('Blessings', `${(character.blessings ?? []).length} / 7`, 'reduzem a perda ao morrer', null, 'blessings'),
    statCard('Tarefas concluídas', character.quests?.done ?? 0, null, null, 'quests')
  );
  body.append(totals);

  // ---------- vocação ----------
  if (character.vocation === 'none') {
    body.append(el('h3', null, character.level >= 8 ? 'Escolha sua vocação' : 'Vocação disponível no level 8'));
    const grid = el('div', 'vocation-grid');
    for (const entry of state.catalog.vocations.filter((v) => v.id !== 'none')) {
      const button = el('button');
      button.disabled = character.level < 8;
      button.append(el('strong', null, entry.name), el('div', 'lv', `+${entry.hp} hp · +${entry.mana} mana`));
      button.onclick = () => {
        send({ t: 'vocation', id: entry.id });
        closeModal();
      };
      grid.append(button);
    }
    body.append(grid);
  }
}
