/*
 * ---- A ÁRVORE DE PASSIVAS (etapa 7) ----
 *
 * Uma árvore só para todas as classes: um grafo de ~300 nós em volta dos cinco
 * inícios. A tela é UM canvas (e não um elemento por nó: centenas de nós em
 * DOM pesam), redesenhado só quando algo muda — arrastar, zoom, selecionar,
 * resposta do servidor.
 *
 * O servidor é quem decide (`systems/passivas/`): daqui só sai "alocar este
 * caminho", "o que sairia se eu tirasse isto" e "tira". O caminho mostrado ao
 * clicar num nó longe é o mesmo menor caminho que o servidor aceita, nó por
 * nó, cada um validado lá.
 *
 * Os nós (a árvore em si, ~120 KB) vêm uma vez por sessão
 * (`{t:'passivas', action:'arvore'}`); depois, só a vista do personagem.
 */

const el = (tag, className, text) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
};

let ctx = null;
let tela = null;

export function initPassivas(context) {
  ctx = context;
}

// ---------------------------------------------------------------- os textos

const TAGS = { physical: 'Physical', fire: 'Fire', ice: 'Ice', earth: 'Earth', energy: 'Energy', holy: 'Holy', death: 'Death', melee: 'Melee', ranged: 'Ranged', spell: 'Spell', area: 'Área', projectile: 'Projétil', single: 'Alvo único', chain: 'Cadeia' };
const STATS = { armour: 'Armour', life: 'Life', accuracy: 'Accuracy', evasion: 'Evasion', attackSpeed: 'Attack Speed', castSpeed: 'Cast Speed', moveSpeed: 'Movement Speed', healing: 'Cura' };
// [rótulo, sufixo] — sufixo '%' quando o add é em %.
const ADDS = {
  str: ['STR', ''], dex: ['DEX', ''], int: ['INT', ''],
  crit_chance: ['Critical Chance', '%'], crit_dmg: ['Critical Damage', '%'],
  life_leech: ['Life Leech', '%'], mana_leech: ['Mana Leech', '%'],
  cooldown_recovery: ['Cooldown Recovery', '%'], skill_cost: ['Redução de custo das skills', '%'],
  skill_melee: ['Melee fighting', ''], skill_distance: ['Distance fighting', ''], skill_magic: ['Magic level', ''], skill_shielding: ['Shielding', ''],
  life: ['Vida', ''], mana: ['Mana', ''], energy_shield: ['Energy Shield', ''], es_pct: ['Energy Shield', '%'],
  block: ['Block Chance', '%'], life_regen_pct: ['Regeneração de vida', '%'], mana_regen_pct: ['Regeneração de mana', '%'],
  dmg_vs_boss: ['Dano contra boss', '%'], avoid_damage: ['Chance de evitar dano', '%'], move_speed: ['Movement Speed', '%'],
};
const LEGADO = { absorb: 'Absorção de dano', armorPenetration: 'Penetração de armadura', attackDamage: 'Todo dano causado', flechaAtravessa: 'Chance de a flecha atravessar' };
const TIPOS = { small: 'Pequeno', notable: 'Notável', keystone: 'Keystone', start: 'Início da classe', mastery: 'Maestria' };
const num = (v) => (Math.round(v * 100) / 100).toLocaleString('pt-BR');

/** "+3% Fire Damage", "+5 STR"... — um efeito de nó em texto. */
export function textoDoEfeito(ef) {
  if (ef.tag) return `+${num(ef.dano)}% de dano ${TAGS[ef.tag] ?? ef.tag}`;
  if (ef.stat) return `+${num(ef.pct)}% ${STATS[ef.stat] ?? ef.stat}`;
  if (ef.add) {
    const [rotulo, suf] = ADDS[ef.add] ?? [ef.add, ''];
    return `+${num(ef.valor)}${suf} ${rotulo}`;
  }
  if (ef.legado) return `+${num(ef.valor * 100)}% ${LEGADO[ef.legado] ?? ef.legado}`;
  return '';
}
/** A chave de soma de um efeito (para o "o que a árvore dá") e o valor dela. */
const chaveDoEfeito = (ef) => (ef.tag ? [`tag:${ef.tag}`, ef.dano] : ef.stat ? [`stat:${ef.stat}`, ef.pct] : ef.add ? [`add:${ef.add}`, ef.valor] : ef.legado ? [`legado:${ef.legado}`, ef.valor] : [null, 0]);
const efeitoDaChave = (chave, v) => {
  const [tipo, k] = chave.split(':');
  return tipo === 'tag' ? { tag: k, dano: v } : tipo === 'stat' ? { stat: k, pct: v } : tipo === 'add' ? { add: k, valor: v } : { legado: k, valor: v };
};

/*
 * ---- O TOTAL DA ÁRVORE (pedido do dono, 30/09) ----
 * "na árvore poderia ter a bonificação do total ganhado só com a árvore": a
 * soma dos nós alocados, agrupada, sempre à vista — e, com um nó escolhido, o
 * que ela vira ("Fire +41% → +56%"). É a soma dos efeitos dos próprios nós (a
 * mesma que o servidor faz em `Passivas.efeitos`); o total do personagem
 * (classe + itens + árvore) continua na ficha.
 */
/** Os efeitos de um nó: o da maestria (árvore do PoE) é o da opção escolhida. */
function efeitosDoNo(n) {
  if (n.tipo !== 'mastery') return n.efeitos ?? [];
  const escolhida = vista()?.maestrias?.[n.id];
  return n.opcoes?.find((o) => o.id === escolhida)?.efeitos ?? [];
}

/** Os grupos com um notável entre estes ids (a maestria do grupo abre com ele). */
function gruposComNotavel(a, ids) {
  return new Set([...ids].map((id) => a.porId.get(id)).filter((n) => n?.tipo === 'notable' && n.grupo != null).map((n) => n.grupo));
}

/** As opções de maestria já escolhidas em maestrias do MESMO tipo (o mesmo nome), fora esta. */
function opcoesUsadas(n) {
  const a = arvore();
  const v = vista();
  return new Set(Object.entries(v?.maestrias ?? {}).filter(([id]) => id !== n.id && a.porId.get(id)?.nome === n.nome).map(([, op]) => op));
}

function somaDosNos(a, ids) {
  const soma = new Map();
  const keystones = [];
  for (const id of ids) {
    const n = a.porId.get(id);
    if (!n) continue;
    if (n.tipo === 'keystone') keystones.push(n);
    for (const ef of efeitosDoNo(n)) {
      const [k, val] = chaveDoEfeito(ef);
      if (k) soma.set(k, (soma.get(k) ?? 0) + val);
    }
  }
  return { soma, keystones };
}
const GRUPOS_DO_TOTAL = ['Dano', 'Defesa', 'Velocidade e precisão', 'Atributos', 'Perícias', 'Sustento'];
function grupoDaChave(chave) {
  const [tipo, k] = chave.split(':');
  if (tipo === 'tag') return 'Dano';
  if (tipo === 'stat') return ['armour', 'life', 'evasion'].includes(k) ? 'Defesa' : k === 'healing' ? 'Sustento' : 'Velocidade e precisão';
  if (tipo === 'legado') return k === 'absorb' ? 'Defesa' : 'Dano';
  if (['str', 'dex', 'int'].includes(k)) return 'Atributos';
  if (k.startsWith('skill_') && k !== 'skill_cost') return 'Perícias';
  if (['crit_chance', 'crit_dmg', 'dmg_vs_boss'].includes(k)) return 'Dano';
  if (['life', 'energy_shield', 'es_pct', 'block', 'avoid_damage'].includes(k)) return 'Defesa';
  if (['cooldown_recovery', 'skill_cost', 'move_speed'].includes(k)) return 'Velocidade e precisão';
  return 'Sustento';
}
/** `[rótulo, valor]` de uma chave somada — "Dano Fire", "+41%". */
function rotuloEValor(chave, v) {
  const [tipo, k] = chave.split(':');
  if (tipo === 'tag') return [`Dano ${TAGS[k] ?? k}`, `+${num(v)}%`];
  if (tipo === 'stat') return [STATS[k] ?? k, `+${num(v)}%`];
  if (tipo === 'legado') return [LEGADO[k] ?? k, `+${num(v * 100)}%`];
  const [rotulo, suf] = ADDS[k] ?? [k, ''];
  return [rotulo, `+${num(v)}${suf}`];
}
const semAcento = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

// ------------------------------------------------------------ a árvore local

/** A árvore que veio do servidor, com o mapa por id e as arestas (uma vez). */
function preparar(a) {
  const porId = new Map(a.nos.map((n) => [n.id, n]));
  const arestas = [];
  for (const n of a.nos) for (const c of n.conexoes) if (n.id < c) arestas.push([n, porId.get(c)]);
  for (const n of a.nos) n.busca = semAcento(`${n.nome} ${n.nomeEn ?? ''} ${n.descricao ?? ''} ${(n.textos ?? n.efeitos.map(textoDoEfeito)).join(' ')} ${n.tags.join(' ')}`);
  return { ...a, porId, arestas };
}

const arvore = () => ctx.state.passivasArvore ?? null;
const vista = () => ctx.state.passivas ?? ctx.state.character?.passivas ?? null;
const meus = () => new Set(vista()?.alocados ?? []);

/** O menor caminho de nós não alocados até `id` — o mesmo que o servidor aceita. */
function caminhoAte(id) {
  const a = arvore();
  const mine = meus();
  if (!a?.porId.has(id)) return null;
  if (mine.has(id)) return [];
  const veioDe = new Map();
  const fila = [...mine];
  for (const x of fila) veioDe.set(x, null);
  for (let i = 0; i < fila.length; i++) {
    for (const c of a.porId.get(fila[i])?.conexoes ?? []) {
      if (veioDe.has(c) || a.porId.get(c)?.tipo === 'start') continue;
      veioDe.set(c, fila[i]);
      if (c === id) {
        const caminho = [];
        for (let x = c; x && !mine.has(x); x = veioDe.get(x)) caminho.unshift(x);
        return caminho;
      }
      fila.push(c);
    }
  }
  return null;
}

/**
 * Os nós alocados que FICAM sem `id` — tirando também os que perderiam o caminho
 * até o início (a mesma regra do servidor: `Passivas.ilhadosSemEles`).
 */
function ficamSem(id) {
  const a = arvore();
  const v = vista();
  const resto = new Set((v?.alocados ?? []).filter((x) => x !== id));
  const inicios = [v?.inicio, v?.inicioAscendencia].filter(Boolean);
  const ligados = new Set(inicios);
  const fila = [...inicios];
  while (fila.length) {
    for (const c of a.porId.get(fila.pop())?.conexoes ?? []) {
      if (resto.has(c) && !ligados.has(c)) {
        ligados.add(c);
        fila.push(c);
      }
    }
  }
  // A maestria fica enquanto houver um notável ligado no grupo dela.
  const grupos = gruposComNotavel(a, ligados);
  return [...resto].filter((x) => ligados.has(x) || (a.porId.get(x)?.tipo === 'mastery' && grupos.has(a.porId.get(x).grupo)));
}

/**
 * Árvore do PoE: os nós de ASCENDÊNCIA que aparecem — só os da escolhida; antes da escolha, os das 3 ascendências da classe (para ver o
 * que cada uma dá). Nó que não é de ascendência aparece sempre.
 */
function visivelNaArvore(n) {
  if (!n.ascendencia) return true;
  const v = vista();
  return v?.ascendencia ? n.ascendencia === v.ascendencia : (v?.ascendencias ?? []).some((a) => a.slug === n.ascendencia);
}

/** O estado de um nó para a tela: alocado | disponivel | caminho | bloqueado. */
function estadoDoNo(n) {
  const mine = meus();
  if (mine.has(n.id)) return 'alocado';
  if (n.tipo === 'start') return 'bloqueado';
  // A maestria abre com um notável alocado no grupo dela.
  if (n.tipo === 'mastery') return gruposComNotavel(arvore(), mine).has(n.grupo) ? 'disponivel' : 'bloqueado';
  return n.conexoes.some((c) => mine.has(c)) ? 'disponivel' : 'bloqueado';
}

// ------------------------------------------------------------------- abrir

export function openPassivas() {
  ctx.send({ t: 'passivas', action: arvore() ? 'ver' : 'arvore' });
  ctx.openModal('Árvore de Passivas', (body) => montar(body), () => {
    tela?.destruir();
    tela = null;
  }, 'passivas');
}

/** Resposta do servidor (`{t:'passivas'}`), chamada pelo main. */
export function aoReceberPassivas(msg) {
  if (msg.arvore) ctx.state.passivasArvore = preparar(msg.arvore);
  if (msg.view) {
    ctx.state.passivas = msg.view;
    if (ctx.state.character) ctx.state.character.passivas = msg.view;
  }
  if (tela) {
    if (msg.plano) tela.plano = msg.plano;
    tela.atualizar();
  }
}

// ------------------------------------------------------------------ a tela

/*
 * ---- O VISUAL (versão 2, 01/10 — o estilo do Path of Exile, com arte PRÓPRIA) ----
 * O dono pediu a árvore "igual à do Path of Exile". A arte deles é deles: aqui
 * tudo é desenhado no canvas — fundo escuro com textura, a região de cada classe
 * tingida pela cor do atributo (STR vermelho, DEX verde, INT azul), as rodas com
 * ligações em ARCO, e uma moldura por tipo: atributo (pedra colorida), pequeno
 * (aro de bronze), notável (moldura dourada dupla), keystone (coroa de pontas),
 * início (medalhão com a letra da classe).
 */
const CORES = {
  fundo: '#090c11', aresta: '#3a3326', arestaViva: '#e2b350', arestaPerto: '#6b5f44', caminho: '#6fc8b4',
  bronze: '#7a6844', bronzeEscuro: '#3d3220', ouro: '#e8c46a', ouroVivo: '#ffe08a', disponivel: '#7fd3c0',
  busca: '#6fd7ff', selecionado: '#ffffff', texto: '#d8ccb0', keystone: '#d0843e', keystoneVivo: '#ffb860', noFundo: '#12141a',
};
const COR_DO_ATRIBUTO = { str: '#c8402f', dex: '#2fa35d', int: '#3474dc' };
// As 7 classes do PoE (a árvore do PoE, sistema de itens do PoE): a cor pelo atributo principal; as híbridas pelo primeiro.
const COR_DA_CLASSE = { knight: 'str', paladin: 'dex', monk: 'dex', sorcerer: 'int', druid: 'int', Marauder: 'str', Duelist: 'str', Templar: 'str', Ranger: 'dex', Shadow: 'dex', Witch: 'int', Scion: null };
const LETRA_DA_CLASSE = { knight: 'K', paladin: 'P', sorcerer: 'S', druid: 'D', monk: 'M', Marauder: 'M', Duelist: 'D', Templar: 'T', Ranger: 'R', Shadow: 'S', Witch: 'B', Scion: 'H' };
// A marca da tradução de cada linha de um nó da árvore do PoE (as mesmas do balão das peças do PoE).
const MARCA_DO_ESTADO = { equivalente: ['✓', 'tem efeito no Draevor'], aproximado: ['≈', 'tem efeito no Draevor (com diferença)'], novo: ['◆', 'atributo novo do PoE, com efeito'], registrado: ['○', 'registrado, ainda sem efeito'] };
// A cor do emblema por cluster (o "ícone" do nó): o elemento/tema dele.
const COR_DO_CLUSTER = {
  fire: '#ff7a3c', ice: '#7fd0ff', earth: '#7fc05a', energy: '#b58cff', holy: '#ffe07a', death: '#9c7ab8', physical: '#c9b8a0',
  melee: '#e0795c', ranged: '#a5d46a', spell: '#6fa8ff', life: '#ff6f7d', armour: '#b0b8c0', evasion: '#8fe0c0', energy_shield: '#7ab8ff',
  critical: '#ff9f5a', attack_speed: '#f0c060', cast_speed: '#80c8ff', mana: '#4f8fd0', healing: '#7fe0a0', mobility: '#c0f080', accuracy: '#e8d880',
};
/** A textura do fundo: um ladrilho de "pedra" com pontos e veios, feito uma vez. */
let texturaDoFundo = null;
function textura(g) {
  if (texturaDoFundo) return texturaDoFundo;
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const t = c.getContext('2d');
  t.fillStyle = CORES.fundo;
  t.fillRect(0, 0, 256, 256);
  let semente = 7;
  const rnd = () => ((semente = (semente * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 900; i++) {
    t.fillStyle = `rgba(${120 + rnd() * 60},${110 + rnd() * 50},${90 + rnd() * 40},${0.02 + rnd() * 0.05})`;
    t.fillRect(rnd() * 256, rnd() * 256, 1 + rnd() * 2, 1 + rnd() * 2);
  }
  t.strokeStyle = 'rgba(140,120,90,0.05)';
  for (let i = 0; i < 14; i++) {
    t.beginPath();
    t.moveTo(rnd() * 256, rnd() * 256);
    t.quadraticCurveTo(rnd() * 256, rnd() * 256, rnd() * 256, rnd() * 256);
    t.stroke();
  }
  texturaDoFundo = g.createPattern(c, 'repeat');
  return texturaDoFundo;
}

function montar(body) {
  const raiz = el('div', 'pas');
  const barra = el('div', 'pas-barra');
  const pontos = el('div', 'pas-pontos');
  const busca = document.createElement('input');
  busca.type = 'search';
  busca.placeholder = 'Buscar nó (ex.: fire, life, keystone)';
  busca.className = 'pas-busca';
  const achados = el('span', 'pas-achados');
  const zoomMenos = el('button', 'ghost step', '−');
  const zoomMais = el('button', 'ghost step', '+');
  const centro = el('button', 'ghost', 'Meu início');
  const respecTudo = el('button', 'ghost danger', 'Respec completo');
  zoomMenos.title = 'Afastar';
  zoomMais.title = 'Aproximar';
  // A ascendência (árvore do PoE): os pontos dela, a escolha no primeiro ponto e o atalho até ela.
  const ascendencia = el('div', 'pas-asc');
  barra.append(pontos, busca, achados, zoomMenos, zoomMais, centro, respecTudo, ascendencia);
  const corpo = el('div', 'pas-corpo');
  const mapa = el('div', 'pas-mapa');
  const canvas = document.createElement('canvas');
  const balao = el('div', 'pas-balao');
  balao.hidden = true;
  const carregando = el('div', 'pas-carregando', 'Carregando a árvore…');
  // O selo "N Pontos Restantes" no topo do mapa (como no Path of Exile).
  const selo = el('div', 'pas-selo');
  mapa.append(canvas, balao, carregando, selo);
  const info = el('aside', 'pas-info');
  corpo.append(mapa, info);
  raiz.append(barra, corpo, el('p', 'pas-dica', 'Arraste para mover · roda do mouse ou pinça para zoom · clique num nó para ver · dois cliques (ou o botão) aloca o caminho até ele.'));
  body.append(raiz);

  const g = canvas.getContext('2d');
  const cam = { x: 0, y: 0, zoom: 0.26, centrado: false };
  let selecionado = null;
  let sobre = null;
  let termo = '';
  let achadosLista = [];
  let achadoAtual = -1;
  let sujo = true;
  let quadro = 0;
  let largura = 0;
  let altura = 0;

  const t = {
    plano: null,
    atualizar() {
      if (!arvore()) return;
      carregando.hidden = true;
      if (!cam.centrado) centrar();
      desenharBarra();
      desenharInfo();
      pedir();
    },
    destruir() {
      cancelAnimationFrame(quadro);
      observador.disconnect();
    },
  };
  tela = t;

  // ---- câmera ----
  const paraTela = (n) => ({ x: (n.x - cam.x) * cam.zoom + largura / 2, y: (n.y - cam.y) * cam.zoom + altura / 2 });
  const paraMundo = (px, py) => ({ x: (px - largura / 2) / cam.zoom + cam.x, y: (py - altura / 2) / cam.zoom + cam.y });
  // A árvore do PoE é ~5× maior que a do Draevor: dá para afastar bem mais.
  const limitarZoom = (z) => Math.max(arvore()?.poe ? 0.025 : 0.12, Math.min(2.2, z));
  function centrar() {
    const inicio = arvore()?.porId.get(vista()?.inicio);
    if (!inicio) return;
    if (arvore().poe) {
      // Árvore do PoE: o início da classe no centro, com a vizinhança dele à vista.
      cam.x = inicio.x;
      cam.y = inicio.y;
      cam.zoom = largura < 500 ? 0.12 : 0.16;
      cam.centrado = true;
      return;
    }
    // A região da classe: um pouco para FORA do início, onde ficam os clusters dela.
    cam.x = inicio.x * 1.7;
    cam.y = inicio.y * 1.7;
    cam.zoom = largura < 500 ? 0.2 : 0.26;
    cam.centrado = true;
  }
  function zoomEm(fator, px = largura / 2, py = altura / 2) {
    const antes = paraMundo(px, py);
    cam.zoom = limitarZoom(cam.zoom * fator);
    const depois = paraMundo(px, py);
    cam.x += antes.x - depois.x;
    cam.y += antes.y - depois.y;
    pedir();
  }
  function irPara(n) {
    cam.x = n.x;
    cam.y = n.y;
    cam.zoom = Math.max(cam.zoom, 0.8);
    pedir();
  }

  // ---- desenho ----
  function pedir() {
    sujo = true;
    cancelAnimationFrame(quadro);
    quadro = requestAnimationFrame(desenhar);
  }
  /*
   * ---- Os ÍCONES das passivas de ascendência (dono, 07/10) ----
   * A arte do PoE de cada nó de ascendência (e o emblema da ascendência no nó inicial) vem de `/api/jogo/poe/icone/ascendencia/`.
   * Carrega uma vez por caminho; quando a imagem chega, redesenha. Enquanto não chegou, o nó sai com o emblema de sempre.
   */
  const imagens = new Map();
  function imagemDoNo(caminho) {
    let img = imagens.get(caminho);
    if (!img) {
      img = new Image();
      img.onload = pedir;
      img.src = `/api/jogo/poe/icone/ascendencia/${caminho.split('/').map(encodeURIComponent).join('/')}`;
      imagens.set(caminho, img);
    }
    return img.complete && img.naturalWidth ? img : null;
  }
  /** Desenha a imagem inteira dentro do círculo de raio `rr` (mantendo a proporção), recortada por ele. */
  function imagemNoDisco(img, p, rr, alpha = 1) {
    const k = Math.min((rr * 2) / img.naturalWidth, (rr * 2) / img.naturalHeight);
    const w = img.naturalWidth * k;
    const h = img.naturalHeight * k;
    g.save();
    forma(p, rr);
    g.clip();
    g.globalAlpha = alpha;
    g.drawImage(img, p.x - w / 2, p.y - h / 2, w, h);
    g.restore();
  }
  const escala = () => Math.max(0.5, Math.min(1.6, cam.zoom * 1.8));
  const raio = (n) => (n.atributo ? 6.5 : { small: 10, notable: 17, keystone: 25, start: 38, mastery: 15 }[n.tipo] ?? 10) * escala();
  const forma = (p, r) => {
    g.beginPath();
    g.arc(p.x, p.y, r, 0, Math.PI * 2);
  };
  const aro = (p, r, cor, lw) => {
    forma(p, r);
    g.strokeStyle = cor;
    g.lineWidth = lw;
    g.stroke();
  };

  /** Um nó, com a moldura do tipo dele. `estado`: alocado | disponivel | bloqueado; `noCaminho`: no caminho até o escolhido. */
  function desenharNo(n, p, r, estado, noCaminho) {
    const vivo = estado === 'alocado';
    const perto = estado === 'disponivel' || noCaminho;
    const apagado = !vivo && !perto;
    if (n.atributo) {
      // A pedra do atributo: a cor dele (o híbrido, meio a meio).
      const atrs = n.atributo.split('+');
      atrs.forEach((a, i) => {
        g.beginPath();
        if (atrs.length === 1) g.arc(p.x, p.y, r, 0, Math.PI * 2);
        else {
          g.moveTo(p.x, p.y);
          g.arc(p.x, p.y, r, Math.PI / 2 + i * Math.PI, Math.PI / 2 + (i + 1) * Math.PI);
          g.closePath();
        }
        g.fillStyle = COR_DO_ATRIBUTO[a] ?? '#888';
        g.globalAlpha = vivo ? 1 : apagado ? 0.4 : 0.75;
        g.fill();
        g.globalAlpha = 1;
      });
      aro(p, r, vivo ? CORES.ouroVivo : perto ? CORES.disponivel : CORES.bronze, vivo ? 2 : 1.4);
      return;
    }
    if (n.tipo === 'start') {
      const minha = n.classe && vista()?.inicio === n.id;
      const corClasse = COR_DO_ATRIBUTO[COR_DA_CLASSE[n.classe]] ?? '#888';
      g.save();
      g.globalAlpha = minha ? 1 : 0.55;
      if (minha) {
        g.shadowColor = CORES.ouro;
        g.shadowBlur = 22;
      }
      const grad = g.createRadialGradient(p.x, p.y - r * 0.3, r * 0.1, p.x, p.y, r);
      grad.addColorStop(0, '#3a2d18');
      grad.addColorStop(1, '#120d07');
      forma(p, r);
      g.fillStyle = grad;
      g.fill();
      g.shadowBlur = 0;
      aro(p, r, minha ? CORES.ouroVivo : CORES.bronze, 3.2);
      aro(p, r * 0.82, corClasse, 2);
      aro(p, r * 0.66, CORES.bronzeEscuro, 1.4);
      // O início de uma ascendência leva o emblema dela (a arte do PoE); o da classe, a letra.
      const emblema = n.icone ? imagemDoNo(n.icone) : null;
      if (emblema) imagemNoDisco(emblema, p, r * 0.6, minha ? 1 : 0.8);
      else {
        g.fillStyle = minha ? CORES.ouroVivo : '#bfae86';
        g.font = `700 ${Math.round(r * 0.8)}px Cinzel, Georgia, serif`;
        g.textAlign = 'center';
        g.textBaseline = 'middle';
        g.fillText(LETRA_DA_CLASSE[n.classe] ?? '?', p.x, p.y + 1);
        g.textBaseline = 'alphabetic';
      }
      g.restore();
      return;
    }
    // A maestria (árvore do PoE) tem a própria cor: violeta.
    const corEmblema = n.tipo === 'mastery' ? '#9a7fd1' : COR_DO_CLUSTER[n.cluster] ?? '#aab4b8';
    if (n.tipo === 'keystone') {
      // A coroa: 12 pontas em volta.
      g.save();
      if (vivo) {
        g.shadowColor = CORES.keystoneVivo;
        g.shadowBlur = 20;
      }
      g.beginPath();
      for (let i = 0; i < 24; i++) {
        const ang = (i * Math.PI) / 12;
        const rr = i % 2 ? r * 1.0 : r * 1.18;
        g.lineTo(p.x + Math.cos(ang) * rr, p.y + Math.sin(ang) * rr);
      }
      g.closePath();
      g.fillStyle = vivo ? '#5a3418' : '#24170e';
      g.fill();
      g.restore();
      forma(p, r * 0.92);
      g.fillStyle = '#1b1220';
      g.fill();
      aro(p, r * 0.92, vivo ? CORES.keystoneVivo : perto ? CORES.disponivel : CORES.keystone, 2.6);
      aro(p, r * 0.7, CORES.bronzeEscuro, 1.4);
    } else {
      // Pequeno: aro de bronze; notável: moldura dourada dupla (e brilho quando alocado).
      const notavel = n.tipo === 'notable';
      g.save();
      if (vivo && notavel) {
        g.shadowColor = CORES.ouro;
        g.shadowBlur = 14;
      }
      forma(p, r);
      g.fillStyle = CORES.noFundo;
      g.fill();
      g.restore();
      aro(p, r, vivo ? CORES.ouroVivo : perto ? CORES.disponivel : notavel ? '#a88a4c' : n.tipo === 'mastery' ? '#6f5c99' : CORES.bronze, notavel || n.tipo === 'mastery' ? 3 : 2);
      if (notavel) aro(p, r * 0.78, vivo ? '#8a6a30' : CORES.bronzeEscuro, 1.4);
    }
    // A passiva de ascendência: a arte do PoE dentro da moldura, no lugar do emblema colorido.
    const arte = n.icone ? imagemDoNo(n.icone) : null;
    if (arte) return void imagemNoDisco(arte, p, r * (n.tipo === 'notable' ? 0.74 : 0.8), vivo ? 1 : apagado ? 0.45 : 0.85);
    // O emblema: a cor do tema, com um miolo mais claro.
    const re = r * (n.tipo === 'small' ? 0.48 : 0.5);
    const grad = g.createRadialGradient(p.x - re * 0.3, p.y - re * 0.3, re * 0.1, p.x, p.y, re);
    grad.addColorStop(0, '#ffffff');
    grad.addColorStop(0.25, corEmblema);
    grad.addColorStop(1, '#00000099');
    forma(p, re);
    g.fillStyle = grad;
    g.globalAlpha = vivo ? 1 : apagado ? 0.35 : 0.8;
    g.fill();
    g.globalAlpha = 1;
  }

  function desenhar() {
    if (!sujo) return;
    sujo = false;
    const a = arvore();
    const dpr = window.devicePixelRatio || 1;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    // O fundo: a textura presa ao mundo (anda com a câmera).
    g.save();
    g.fillStyle = textura(g);
    const ox = ((-cam.x * cam.zoom) % 256) - 256;
    const oy = ((-cam.y * cam.zoom) % 256) - 256;
    g.translate(ox, oy);
    g.fillRect(-ox, -oy, largura, altura);
    g.restore();
    if (!a) return;
    const mine = meus();
    const caminho = new Set(selecionado && !mine.has(selecionado.id) ? caminhoAte(selecionado.id) ?? [] : []);
    const visivel = (p, folga) => p.x > -folga && p.y > -folga && p.x < largura + folga && p.y < altura + folga;

    // A região de cada classe, tingida pela cor do atributo dela.
    for (const n of a.nos.filter((x) => x.tipo === 'start' && !x.ascendencia)) {
      const p = paraTela(n);
      const r = 1500 * cam.zoom;
      const cor = COR_DO_ATRIBUTO[COR_DA_CLASSE[n.classe]] ?? '#888888';
      const grad = g.createRadialGradient(p.x, p.y, 0, p.x, p.y, r);
      grad.addColorStop(0, `${cor}22`);
      grad.addColorStop(1, `${cor}00`);
      g.fillStyle = grad;
      g.fillRect(p.x - r, p.y - r, r * 2, r * 2);
    }

    // Os nomes dos clusters, grandes e fracos, quando se vê a árvore de longe.
    if (cam.zoom < 0.6) {
      g.font = `600 ${Math.round(12 + 10 * (0.6 - cam.zoom))}px Cinzel, Georgia, serif`;
      g.textAlign = 'center';
      g.fillStyle = 'rgba(216,204,176,0.30)';
      for (const c of a.clusters) {
        const p = paraTela(c);
        if (visivel(p, 80)) g.fillText(c.nome.toUpperCase(), p.x, p.y - (c.raio + 60) * cam.zoom);
      }
    }

    // As ligações: em ARCO na mesma órbita (as rodas e o anel), reta no resto.
    g.lineCap = 'round';
    const lw = Math.max(1.2, 2.4 * escala());
    for (const [x, y] of a.arestas) {
      if (!visivelNaArvore(x) || !visivelNaArvore(y)) continue;
      const px = paraTela(x);
      const py = paraTela(y);
      if (!visivel(px, 60) && !visivel(py, 60)) continue;
      const vx = mine.has(x.id);
      const vy = mine.has(y.id);
      g.save();
      if (vx && vy) {
        g.strokeStyle = CORES.arestaViva;
        g.lineWidth = lw * 1.5;
        g.shadowColor = CORES.ouro;
        g.shadowBlur = 8;
      } else if ((caminho.has(x.id) || vx) && (caminho.has(y.id) || vy) && (caminho.has(x.id) || caminho.has(y.id))) {
        g.strokeStyle = CORES.caminho;
        g.lineWidth = lw * 1.3;
      } else if (vx || vy) {
        g.strokeStyle = CORES.arestaPerto;
        g.lineWidth = lw;
      } else {
        g.strokeStyle = CORES.aresta;
        g.lineWidth = lw;
      }
      g.beginPath();
      const o = x.orbita;
      if (o && y.orbita && o.x === y.orbita.x && o.y === y.orbita.y && o.r === y.orbita.r) {
        const c = paraTela(o);
        const a1 = Math.atan2(x.y - o.y, x.x - o.x);
        let d = Math.atan2(y.y - o.y, y.x - o.x) - a1;
        while (d > Math.PI) d -= Math.PI * 2;
        while (d < -Math.PI) d += Math.PI * 2;
        g.arc(c.x, c.y, o.r * cam.zoom, a1, a1 + d, d < 0);
      } else {
        g.moveTo(px.x, px.y);
        g.lineTo(py.x, py.y);
      }
      g.stroke();
      g.restore();
    }

    // Os nós.
    const achadosSet = new Set(achadosLista.map((n) => n.id));
    for (const n of a.nos) {
      if (!visivelNaArvore(n)) continue;
      const p = paraTela(n);
      if (!visivel(p, 60)) continue;
      const r = raio(n);
      const estado = estadoDoNo(n);
      desenharNo(n, p, r, estado, caminho.has(n.id));
      if (achadosSet.has(n.id)) aro(p, r + 6, CORES.busca, 2);
      if (selecionado?.id === n.id || sobre?.id === n.id) aro(p, r + 4, CORES.selecionado, selecionado?.id === n.id ? 2.4 : 1.2);
      // O nome dos notáveis, keystones e inícios de perto.
      if ((n.tipo === 'notable' || n.tipo === 'keystone') && cam.zoom >= 0.5) {
        g.font = `${n.tipo === 'keystone' ? 700 : 600} ${n.tipo === 'keystone' ? 12 : 11}px Cinzel, Georgia, serif`;
        g.textAlign = 'center';
        g.lineWidth = 3;
        g.strokeStyle = 'rgba(0,0,0,0.8)';
        const y = p.y + r * (n.tipo === 'keystone' ? 1.25 : 1) + 13;
        g.strokeText(n.nome, p.x, y);
        g.fillStyle = estado === 'alocado' ? CORES.ouroVivo : n.tipo === 'keystone' ? '#f0b070' : CORES.texto;
        g.fillText(n.nome, p.x, y);
      }
      if (n.tipo === 'start' && cam.zoom >= 0.18) {
        g.font = `600 12px Cinzel, Georgia, serif`;
        g.textAlign = 'center';
        g.lineWidth = 3;
        g.strokeStyle = 'rgba(0,0,0,0.85)';
        g.strokeText(n.nome, p.x, p.y + r + 16);
        g.fillStyle = vista()?.inicio === n.id ? CORES.ouroVivo : '#bfae86';
        g.fillText(n.nome, p.x, p.y + r + 16);
      }
    }
  }

  function tamanho() {
    const r = mapa.getBoundingClientRect();
    largura = Math.max(10, r.width);
    altura = Math.max(10, r.height);
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(largura * dpr);
    canvas.height = Math.round(altura * dpr);
    canvas.style.width = `${largura}px`;
    canvas.style.height = `${altura}px`;
    pedir();
  }
  const observador = new ResizeObserver(tamanho);
  observador.observe(mapa);

  // ---- ponteiro: arrastar, pinça, clique, dois cliques, roda ----
  const toques = new Map();
  let arrasto = null;
  let pinca = null;
  const noEm = (px, py) => {
    const a = arvore();
    if (!a) return null;
    let melhor = null;
    for (const n of a.nos) {
      if (!visivelNaArvore(n)) continue;
      const p = paraTela(n);
      const d = Math.hypot(p.x - px, p.y - py);
      if (d <= raio(n) + 6 && (!melhor || d < melhor.d)) melhor = { n, d };
    }
    return melhor?.n ?? null;
  };
  const local = (e) => {
    const r = canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };
  canvas.addEventListener('pointerdown', (e) => {
    canvas.setPointerCapture(e.pointerId);
    toques.set(e.pointerId, local(e));
    if (toques.size === 1) arrasto = { ...local(e), cx: cam.x, cy: cam.y, moveu: false };
    if (toques.size === 2) {
      const [p1, p2] = [...toques.values()];
      pinca = { d: Math.hypot(p1.x - p2.x, p1.y - p2.y), zoom: cam.zoom };
      arrasto = null;
    }
  });
  canvas.addEventListener('pointermove', (e) => {
    const p = local(e);
    if (toques.has(e.pointerId)) toques.set(e.pointerId, p);
    if (pinca && toques.size === 2) {
      const [p1, p2] = [...toques.values()];
      const d = Math.hypot(p1.x - p2.x, p1.y - p2.y);
      const alvo = limitarZoom((pinca.zoom * d) / Math.max(1, pinca.d));
      zoomEm(alvo / cam.zoom, (p1.x + p2.x) / 2, (p1.y + p2.y) / 2);
      return;
    }
    if (arrasto) {
      const dx = p.x - arrasto.x;
      const dy = p.y - arrasto.y;
      if (Math.hypot(dx, dy) > 5) arrasto.moveu = true;
      if (arrasto.moveu) {
        cam.x = arrasto.cx - dx / cam.zoom;
        cam.y = arrasto.cy - dy / cam.zoom;
        balao.hidden = true;
        pedir();
      }
      return;
    }
    if (e.pointerType === 'mouse') {
      const n = noEm(p.x, p.y);
      if (n?.id !== sobre?.id) {
        sobre = n;
        pedir();
      }
      mostrarBalao(n, p);
    }
  });
  const soltar = (e) => {
    const p = local(e);
    toques.delete(e.pointerId);
    if (toques.size < 2) pinca = null;
    if (arrasto && !arrasto.moveu && toques.size === 0) {
      selecionado = noEm(p.x, p.y);
      t.plano = null;
      desenharInfo();
      pedir();
    }
    if (toques.size === 0) arrasto = null;
  };
  canvas.addEventListener('pointerup', soltar);
  canvas.addEventListener('pointercancel', soltar);
  canvas.addEventListener('pointerleave', () => {
    balao.hidden = true;
    if (sobre) {
      sobre = null;
      pedir();
    }
  });
  canvas.addEventListener('dblclick', (e) => {
    const p = local(e);
    const n = noEm(p.x, p.y);
    if (n && estadoDoNo(n) !== 'alocado') alocarAte(n);
  });
  canvas.addEventListener(
    'wheel',
    (e) => {
      e.preventDefault();
      const p = local(e);
      zoomEm(e.deltaY < 0 ? 1.15 : 1 / 1.15, p.x, p.y);
    },
    { passive: false }
  );
  zoomMais.onclick = () => zoomEm(1.3);
  zoomMenos.onclick = () => zoomEm(1 / 1.3);
  centro.onclick = () => {
    const inicio = arvore()?.porId.get(vista()?.inicio);
    if (inicio) irPara(inicio);
  };

  // ---- busca ----
  busca.oninput = () => {
    termo = semAcento(busca.value.trim());
    achadosLista = termo.length >= 2 ? (arvore()?.nos ?? []).filter((n) => n.busca.includes(termo)) : [];
    achadoAtual = -1;
    achados.textContent = termo.length >= 2 ? `${achadosLista.length} nó${achadosLista.length === 1 ? '' : 's'}` : '';
    pedir();
  };
  busca.onkeydown = (e) => {
    if (e.key !== 'Enter' || !achadosLista.length) return;
    e.preventDefault();
    achadoAtual = (achadoAtual + 1) % achadosLista.length;
    selecionado = achadosLista[achadoAtual];
    irPara(selecionado);
    desenharInfo();
  };

  // ---- balão (mouse) ----
  function mostrarBalao(n, p) {
    if (!n) {
      balao.hidden = true;
      return;
    }
    balao.textContent = '';
    balao.append(...fichaDoNo(n, { curta: true }));
    balao.hidden = false;
    const bx = Math.min(largura - 290, p.x + 18);
    const by = Math.min(altura - balao.offsetHeight - 8, p.y + 16);
    balao.style.left = `${Math.max(4, bx)}px`;
    balao.style.top = `${Math.max(4, by)}px`;
  }

  /** O que um nó é: nome, tipo, descrição, efeitos, custo, requisitos, estado. */
  /*
   * ---- O BALÃO no estilo do Path of Exile ----
   * Cabeçalho com o nome (a cor diz o tipo: pequeno claro, notável dourado,
   * keystone âmbar), os bônus em azul, a regra do keystone, o texto de sabor em
   * itálico e o rodapé com custo, requisito e estado. O mesmo no balão do mouse
   * e no painel da direita.
   */
  function fichaDoNo(n, { curta = false } = {}) {
    const tipoVisual = n.atributo ? 'atributo' : n.tipo;
    const caixa = el('div', `poe-tip tipo-${tipoVisual}`);
    const cab = el('div', 'poe-cab');
    cab.append(el('span', 'poe-nome', n.nome));
    caixa.append(cab);
    const corpo = el('div', 'poe-corpo');
    corpo.append(el('div', 'poe-tipo', n.atributo ? 'Atributo' : (TIPOS[n.tipo] ?? n.tipo)));
    const sep = () => el('div', 'poe-sep');
    if (n.tipo === 'mastery') {
      // Maestria (árvore do PoE): as opções, a escolhida em destaque.
      corpo.append(sep());
      const escolhida = vista()?.maestrias?.[n.id];
      const stats = el('div', 'poe-stats');
      stats.append(el('div', 'poe-nota-arvore', escolhida ? 'Opção escolhida:' : 'Escolha 1 efeito ao alocar (abre com um notável do grupo):'));
      for (const o of n.opcoes ?? []) {
        if (escolhida && o.id !== escolhida) continue;
        o.textos.forEach((t, i) => {
          const est = o.estados?.[i];
          const linha = el('div', est === 'nota' ? 'poe-nota-arvore' : null);
          const marca = MARCA_DO_ESTADO[est];
          if (marca) {
            const m = el('em', `poe-tr ${est}`, marca[0]);
            m.title = marca[1];
            linha.append(m, ' ');
          }
          linha.append(t);
          stats.append(linha);
        });
      }
      corpo.append(stats);
    } else if (n.textos?.length) {
      // Nó da árvore do PoE: os textos como no PoE, cada linha com a marca da tradução; o texto explicativo (nota) em itálico.
      corpo.append(sep());
      const stats = el('div', 'poe-stats');
      n.textos.forEach((t, i) => {
        const estadoDaLinha = n.estados?.[i];
        const linha = el('div', estadoDaLinha === 'nota' ? 'poe-nota-arvore' : null);
        const marca = MARCA_DO_ESTADO[estadoDaLinha];
        if (marca) {
          const m = el('em', `poe-tr ${estadoDaLinha}`, marca[0]);
          m.title = marca[1];
          linha.append(m, ' ');
        }
        linha.append(t);
        stats.append(linha);
      });
      corpo.append(stats);
    } else if (n.efeitos.length) {
      corpo.append(sep());
      const stats = el('div', 'poe-stats');
      for (const ef of n.efeitos) stats.append(el('div', null, textoDoEfeito(ef)));
      corpo.append(stats);
    }
    if (n.descricao) {
      corpo.append(sep());
      corpo.append(el('div', 'poe-stats poe-regra', n.descricao));
    }
    if (n.flavor) {
      corpo.append(sep());
      corpo.append(el('div', 'poe-flavor', n.flavor));
    }
    const estado = estadoDoNo(n);
    const lv = ctx.state.character?.level ?? 1;
    const linhas = [];
    if (n.tipo !== 'start') linhas.push(`Custo: ${n.custo} ponto${n.custo === 1 ? '' : 's'}${n.ascendencia ? ' de ascendência' : ''}`);
    if (n.ascendencia) linhas.push(`Ascendência: ${arvore()?.ascendencias?.[n.ascendencia]?.nome ?? n.ascendencia}`);
    if (n.levelMinimo) linhas.push(`Requer level ${n.levelMinimo}${lv < n.levelMinimo ? ' (você não tem)' : ''}`);
    let rotuloEstado = { alocado: 'Alocado', disponivel: 'Disponível', bloqueado: n.tipo === 'start' ? 'Início de outra classe' : 'Bloqueado — sem ligação com um nó seu' }[estado];
    if (estado === 'bloqueado' && n.tipo !== 'start') {
      const c = caminhoAte(n.id);
      if (c?.length) {
        linhas.push(`Caminho: ${c.length} nós · ${c.reduce((s2, id) => s2 + (arvore().porId.get(id)?.custo ?? 0), 0)} pontos`);
        rotuloEstado = 'Longe — aloque o caminho até ele';
      }
    }
    linhas.push(`Estado: ${rotuloEstado}`);
    corpo.append(sep());
    const rod = el('div', `poe-rodape estado-${estado}`);
    for (const l of linhas) rod.append(el('div', null, l));
    if (curta && n.tipo !== 'start' && estado !== 'alocado') rod.append(el('div', 'poe-dica', 'dois cliques para alocar'));
    corpo.append(rod);
    caixa.append(corpo);
    return [caixa];
  }


  // ---- pontos na barra ----
  function desenharBarra() {
    const v = vista();
    const p = v?.pontos ?? { livres: 0, total: 0, usados: 0 };
    pontos.textContent = '';
    pontos.append(el('b', p.livres ? 'tem' : null, String(p.livres)), el('span', null, ` livre${p.livres === 1 ? '' : 's'} · ${p.usados}/${p.total} usados`));
    selo.textContent = `${p.livres} ${p.livres === 1 ? 'Ponto Restante' : 'Pontos Restantes'}`;
    selo.classList.toggle('vazio', !p.livres);
    respecTudo.textContent = v?.respecsGratis ? `Respec completo (${v.respecsGratis} grátis)` : 'Respec completo';
    respecTudo.disabled = !v?.podeTirar || (v?.alocados?.length ?? 0) <= 1;
    respecTudo.title = v?.podeTirar ? '' : 'Só fora da caçada';
    desenharAscendencia(v);
  }
  function desenharAscendencia(v) {
    ascendencia.textContent = '';
    ascendencia.hidden = !v?.pontosAscendencia;
    if (!v?.pontosAscendencia) return;
    const pa = v.pontosAscendencia;
    const nomes = arvore()?.ascendencias ?? {};
    if (v.ascendencia) {
      const ir = el('button', 'ghost', `${nomes[v.ascendencia]?.nome ?? v.ascendencia} · ${pa.livres} livre${pa.livres === 1 ? '' : 's'} (${pa.usados}/${pa.total})`);
      ir.title = 'Pontos de ascendência: 2 por boss de fim de ato vencido. Clique para ir até a sua ascendência.';
      ir.onclick = () => {
        const n = arvore()?.porId.get(v.inicioAscendencia);
        if (n) irPara(n);
      };
      ascendencia.append(ir);
      return;
    }
    if (pa.total < 1) {
      ascendencia.append(el('span', 'pas-asc-nota', 'Ascendência: vença um boss de fim de ato'));
      return;
    }
    // O primeiro ponto chegou: a escolha (decisão do dono — no primeiro ponto, uma vez).
    ascendencia.append(el('span', 'pas-asc-nota', 'Escolha sua ascendência:'));
    for (const a of v.ascendencias ?? []) {
      const b = el('button', 'ghost', a.nome);
      b.title = `${nomes[a.slug]?.flavour ?? ''} — passe o mouse nos nós dela na borda da árvore para ver o que dá.`;
      b.onclick = () => ctx.send({ t: 'passivas', action: 'ascender', ascendencia: a.slug });
      ascendencia.append(b);
    }
  }
  respecTudo.onclick = () => {
    selecionado = null;
    t.plano = null;
    ctx.send({ t: 'passivas', action: 'planoRespec', tudo: true });
    desenharInfo();
  };

  // ---- painel da direita ----
  function alocarAte(n) {
    // A maestria não tem caminho: abre a escolha da opção no painel.
    if (n.tipo === 'mastery') {
      selecionado = n;
      desenharInfo();
      pedir();
      return;
    }
    const caminho = caminhoAte(n.id);
    if (!caminho?.length) return;
    ctx.send({ t: 'passivas', action: 'alocar', ids: caminho });
  }

  /**
   * O quadro "Total da árvore": os bônus somados, por grupo. `depois` (ids): a
   * lista com a mudança em vista — cada linha mostra "agora → depois", e a que
   * nasce ou some também. `rotuloDoDepois` diz que mudança é essa.
   */
  function quadroDoTotal(depois = null, rotuloDoDepois = '') {
    const a = arvore();
    const v = vista();
    const agora = somaDosNos(a, v.alocados);
    const futuro = depois ? somaDosNos(a, depois) : null;
    const caixa = el('div', 'pas-total');
    const cab = el('div', 'pas-total-cab');
    // Os inícios (o da classe e o da ascendência) não contam como nós.
    const nosAlocados = v.alocados.filter((id) => a.porId.get(id)?.tipo !== 'start').length;
    cab.append(el('b', null, 'Total da árvore'), el('span', null, `${nosAlocados} nós · ${v.pontos?.usados ?? 0} pontos`));
    caixa.append(cab);
    if (futuro) caixa.append(el('em', 'pas-total-previa', rotuloDoDepois));
    const chaves = [...new Set([...agora.soma.keys(), ...(futuro?.soma.keys() ?? [])])];
    if (!chaves.length && !agora.keystones.length && !futuro?.keystones.length) {
      caixa.append(el('p', 'pas-vazio', 'Nenhum nó alocado ainda. Clique num nó ligado ao seu início (a estrela) para começar.'));
      return caixa;
    }
    for (const grupo of GRUPOS_DO_TOTAL) {
      const doGrupo = chaves.filter((k) => grupoDaChave(k) === grupo);
      if (!doGrupo.length) continue;
      const bloco = el('div', 'pas-total-grupo');
      bloco.append(el('h4', null, grupo));
      for (const k of doGrupo) {
        const antes = agora.soma.get(k) ?? 0;
        const [rotulo, valorAgora] = rotuloEValor(k, antes);
        const linha = el('div', 'pas-total-linha');
        linha.append(el('span', null, rotulo), el('b', antes ? null : 'zero', antes ? valorAgora : '—'));
        if (futuro) {
          const depoisV = futuro.soma.get(k) ?? 0;
          if (Math.abs(depoisV - antes) > 1e-9) {
            linha.classList.add(depoisV > antes ? 'sobe' : 'cai');
            linha.append(el('i', null, `→ ${depoisV ? rotuloEValor(k, depoisV)[1] : '—'}`));
          }
        }
        bloco.append(linha);
      }
      caixa.append(bloco);
    }
    const nomes = new Set(agora.keystones.map((k) => k.id));
    const todosKeystones = [...agora.keystones, ...(futuro?.keystones ?? []).filter((k) => !nomes.has(k.id))];
    if (todosKeystones.length) {
      const bloco = el('div', 'pas-total-grupo');
      bloco.append(el('h4', null, 'Keystones'));
      const noFuturo = new Set((futuro?.keystones ?? []).map((k) => k.id));
      for (const k of todosKeystones) {
        const d = el('div', 'pas-keystone');
        if (futuro && !nomes.has(k.id)) d.classList.add('sobe');
        if (futuro && nomes.has(k.id) && !noFuturo.has(k.id)) d.classList.add('cai');
        d.append(el('b', null, k.nome), el('p', null, k.descricao ?? ''));
        bloco.append(d);
      }
      caixa.append(bloco);
    }
    return caixa;
  }

  function desenharInfo() {
    info.textContent = '';
    const v = vista();
    const a = arvore();
    if (!a || !v) return;
    // A confirmação de um respec (resposta do `planoRespec`).
    if (t.plano) {
      const caixa = el('div', 'pas-confirma');
      const n = t.plano.tirar.length;
      caixa.append(el('b', null, `Tirar ${n} nó${n === 1 ? '' : 's'}?`));
      const nomes = t.plano.tirar.slice(0, 8).map((id) => a.porId.get(id)?.nome ?? id);
      caixa.append(el('p', null, nomes.join(', ') + (n > 8 ? ` e mais ${n - 8}` : '')));
      caixa.append(el('p', 'pas-preco', t.plano.gratis ? 'Grátis (respec da migração).' : `Custa ${t.plano.preco.toLocaleString('pt-BR')} de ouro (bolso + banco).`));
      const sim = el('button', 'danger', 'Confirmar');
      const nao = el('button', 'ghost', 'Cancelar');
      sim.onclick = () => {
        const pedido = t.plano.tirar.length === (v.alocados.length - 1) && !selecionado ? { tudo: true } : { ids: t.plano.tirar, junto: true };
        ctx.send({ t: 'passivas', action: 'respec', ...pedido });
        t.plano = null;
        selecionado = null;
        desenharInfo();
      };
      nao.onclick = () => {
        t.plano = null;
        desenharInfo();
      };
      const linha = el('div', 'pas-botoes');
      linha.append(sim, nao);
      caixa.append(linha);
      info.append(caixa);
      const sai = new Set(t.plano.tirar);
      info.append(quadroDoTotal(v.alocados.filter((id) => !sai.has(id)), `Sem ${n === 1 ? 'esse nó' : `esses ${n} nós`}:`));
      return;
    }
    if (selecionado) {
      const n = selecionado;
      info.append(...fichaDoNo(n));
      const estado = estadoDoNo(n);
      const linha = el('div', 'pas-botoes');
      if (estado === 'alocado' && n.tipo !== 'start') {
        const tirar = el('button', 'ghost danger', `Tirar (${(v.precoPorNo ?? 0).toLocaleString('pt-BR')} de ouro por nó)`);
        tirar.disabled = !v.podeTirar;
        if (!v.podeTirar) tirar.title = 'Só fora da caçada';
        tirar.onclick = () => ctx.send({ t: 'passivas', action: 'planoRespec', ids: [n.id], junto: true });
        linha.append(tirar);
      } else if (n.tipo === 'mastery') {
        // A escolha da maestria: um botão por opção (a já escolhida noutra maestria do mesmo tipo não pode).
        const usadas = opcoesUsadas(n);
        const aberta = estado === 'disponivel';
        if (!aberta) linha.append(el('p', 'pas-aviso', 'Aloque um notável do grupo desta maestria para abri-la.'));
        else if ((v.pontos?.livres ?? 0) < n.custo) linha.append(el('p', 'pas-aviso', 'Falta 1 ponto.'));
        for (const o of n.opcoes ?? []) {
          const b = el('button', 'ghost pas-opcao', o.textos.filter((_, i) => o.estados?.[i] !== 'nota').join(' / '));
          b.disabled = !aberta || usadas.has(o.id) || (v.pontos?.livres ?? 0) < n.custo;
          if (usadas.has(o.id)) b.title = 'Já escolhida em outra maestria deste tipo';
          b.onclick = () => ctx.send({ t: 'passivas', action: 'alocar', id: n.id, opcao: o.id });
          linha.append(b);
        }
      } else if (n.tipo !== 'start') {
        const caminho = caminhoAte(n.id) ?? [];
        const custo = caminho.reduce((s, id) => s + (a.porId.get(id)?.custo ?? 0), 0);
        const lv = ctx.state.character?.level ?? 1;
        const falta = caminho.map((id) => a.porId.get(id)).find((x) => (x?.levelMinimo ?? 0) > lv);
        const botao = el('button', 'primary', caminho.length > 1 ? `Alocar caminho (${caminho.length} nós · ${custo} pontos)` : `Alocar (${custo} ponto${custo === 1 ? '' : 's'})`);
        botao.disabled = !caminho.length || custo > (v.pontos?.livres ?? 0) || !!falta;
        if (custo > (v.pontos?.livres ?? 0)) linha.append(el('p', 'pas-aviso', `Faltam ${custo - (v.pontos?.livres ?? 0)} pontos.`));
        if (falta) linha.append(el('p', 'pas-aviso', `${falta.nome} pede level ${falta.levelMinimo}.`));
        botao.onclick = () => alocarAte(n);
        linha.prepend(botao);
      }
      info.append(linha);
      if (estado === 'alocado' && n.tipo !== 'start') {
        const ficam = ficamSem(n.id);
        const junto = v.alocados.length - 1 - ficam.length;
        info.append(quadroDoTotal(ficam, junto > 0 ? `Sem este nó e os ${junto} que dependem dele:` : 'Sem este nó:'));
      } else if (n.tipo !== 'start') {
        const caminho = caminhoAte(n.id) ?? [];
        info.append(caminho.length ? quadroDoTotal([...v.alocados, ...caminho], caminho.length > 1 ? `Com o caminho (${caminho.length} nós):` : 'Com este nó:') : quadroDoTotal());
      } else info.append(quadroDoTotal());
      return;
    }
    // Nada selecionado: o total do que a árvore está dando.
    info.append(quadroDoTotal());
  }

  // A árvore já veio antes (outra abertura nesta sessão): desenha já.
  requestAnimationFrame(() => {
    tamanho();
    t.atualizar();
  });
}

/** O balão do botão "Árvore" na barra: pontos parados e o resumo. */
export function resumoDasPassivasParaBalao() {
  const v = ctx?.state?.character?.passivas;
  if (!v) return null;
  const caixa = el('div', 'tip-arvore');
  if (v.pontos?.livres) caixa.append(el('b', null, `${v.pontos.livres} ponto${v.pontos.livres === 1 ? '' : 's'} à espera`));
  caixa.append(el('div', null, `${Math.max(0, (v.alocados?.length ?? 1) - 1)} nós alocados · ${v.pontos?.usados ?? 0}/${v.pontos?.total ?? 0} pontos`));
  if (v.respecsGratis) caixa.append(el('div', null, `${v.respecsGratis} respec completo grátis`));
  return caixa;
}
