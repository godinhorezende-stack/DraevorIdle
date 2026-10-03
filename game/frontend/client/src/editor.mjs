// Editor de mapas (/editor). Ferramenta interna do dono, sem login — o
// servidor local já é dele.
//
// O mapa é desenhado com as SPRITES DE VERDADE (o atlas e a paleta do próprio
// arquivo, a mesma conta de `map.mjs::desenharCamada`), andar por andar, e as
// criaturas com o desenho do jogo (`sprites.mjs`). Dois tipos de mapa:
//
//   - mapa NOVO (ou um feito aqui): chão da cidade, um andar — pincel e parede
//     pintam a grade, e o Salvar grava o arquivo inteiro;
//   - mapa REAL (o capturado: atlas próprio e/ou vários andares): o chão fica
//     como está, o editor só mexe nos SPAWNS (o servidor recusa gravar a grade
//     por cima — ver `admin/mapas.mjs::salvar`).
//
// Os spawns ficam no formato do mapa (`systems/mapa/spawns.mjs`): `{ id, x, y,
// z, raio, quantidade, tipo, criaturas, raridade?, modificadores? }`.
import { loadSpriteData, drawCreature, outfitCanvas } from './sprites.mjs';

const TILE = 32;

let opcoes = null;
let bestiario = [];
let porKey = new Map();
let raridades = [];
let modificadores = [];
let tipoDoSpawn = {};

let mapaId = null; // id do arquivo aberto (null = novo, ainda não salvo)
let mapa = null; // { width, height, atlas, cell, palette, levels, z, floors, blocked, stacks }
let real = false;
let andar = 7;
let escala = 1;
let spawns = [];
let selecionado = -1;
const proximo = { raridade: 'normal', modificadores: [], raio: 0, quantidade: 1 };

let ferramenta = 'spawn';
let indicePisoAtivo = 40;
let bichoAtivo = null;
let casaSobOMouse = null;

const fundo = document.getElementById('fundo');
const marcas = document.getElementById('marcas');
const ctxFundo = fundo.getContext('2d');
const ctxMarcas = marcas.getContext('2d');
const aviso = document.getElementById('aviso');
const $ = (id) => document.getElementById(id);

function mostrarAviso(texto, ehErro = false) {
  aviso.textContent = texto;
  aviso.style.color = ehErro ? '#e0645a' : '#f0a851';
  if (texto) setTimeout(() => { if (aviso.textContent === texto) aviso.textContent = ''; }, 5000);
}

// ---- As imagens (o atlas do mapa) ----

const atlases = new Map();
/** O atlas `/gamedata/sprites/<nome>.png` (redesenha o fundo quando chega). */
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

// ---- A grade do andar ----

/** `{ stacks, blocked }` do andar `z` (o andar principal usa os campos de cima). */
function grade(z = andar) {
  const f = mapa.floors?.[z] ?? {};
  if (z === mapa.z) return { stacks: f.stacks ?? mapa.stacks, blocked: f.blocked ?? mapa.blocked };
  return { stacks: f.stacks ?? [], blocked: f.blocked ?? [] };
}
const zDoSpawn = (s) => (Number.isInteger(s.z) ? s.z : mapa.z);
const keyDoSpawn = (s) => s.criaturas?.[0]?.key ?? s.key;
const nomeDe = (key) => porKey.get(key)?.name ?? key;

/** Uma pilha de sprites na casa (x, y), na escala, como o jogo desenha. */
function desenharPilha(ctx, img, pilha, x, y) {
  const cell = mapa.cell ?? 64;
  let altura = 0;
  for (const index of pilha) {
    const e = mapa.palette[index];
    if (!e) continue;
    const [ax, ay] = e.cells?.[0] ?? [e.ax, e.ay];
    const px = x * TILE - (e.w - TILE) - (e.dx ?? 0) - altura;
    const py = y * TILE - (e.h - TILE) - (e.dy ?? 0) - altura;
    ctx.drawImage(img, ax + (cell - e.w), ay + (cell - e.h), e.w, e.h, px * escala, py * escala, e.w * escala, e.h * escala);
    if (e.el) altura = Math.min(24, altura + e.el);
  }
}

function ajustarCanvas() {
  const w = Math.round(mapa.width * TILE * escala);
  const h = Math.round(mapa.height * TILE * escala);
  for (const c of [fundo, marcas]) {
    c.width = w;
    c.height = h;
  }
  $('camadas').style.width = `${w}px`;
  $('camadas').style.height = `${h}px`;
}

function desenharFundo() {
  if (!mapa) return;
  const img = atlas(mapa.atlas);
  ctxFundo.imageSmoothingEnabled = false;
  ctxFundo.fillStyle = '#07080b';
  ctxFundo.fillRect(0, 0, fundo.width, fundo.height);
  if (!img) return;
  const { stacks } = grade();
  for (let y = 0; y < mapa.height; y++) {
    for (let x = 0; x < mapa.width; x++) {
      const pilha = stacks[y * mapa.width + x];
      if (pilha?.length) desenharPilha(ctxFundo, img, pilha, x, y);
    }
  }
  desenharMarcas();
}

/** Repinta só uma casa (o pincel do mapa novo). */
function repintarCasa(x, y) {
  const img = atlas(mapa.atlas);
  const t = TILE * escala;
  ctxFundo.fillStyle = '#07080b';
  ctxFundo.fillRect(x * t, y * t, t, t);
  const pilha = grade().stacks[y * mapa.width + x];
  if (img && pilha?.length) desenharPilha(ctxFundo, img, pilha, x, y);
}

const corDaRaridade = (id) => (id && id !== 'normal' ? raridades.find((r) => r.id === id)?.cor : null) ?? null;

let faltouSprite = null;
function desenharMarcas() {
  if (!mapa) return;
  const t = TILE * escala;
  ctxMarcas.clearRect(0, 0, marcas.width, marcas.height);
  ctxMarcas.imageSmoothingEnabled = false;
  const { stacks, blocked } = grade();
  // O bloqueado em vermelho; casa sem chão nenhum, escura.
  // (No mapa novo sempre: é o que o pincel está cavando.)
  if ($('verBloqueio').checked || !real) {
    for (let y = 0; y < mapa.height; y++) {
      for (let x = 0; x < mapa.width; x++) {
        const i = y * mapa.width + x;
        if (!stacks[i]?.length) continue;
        if (blocked[i]) {
          ctxMarcas.fillStyle = 'rgba(224, 70, 60, 0.35)';
          ctxMarcas.fillRect(x * t, y * t, t, t);
        }
      }
    }
  }
  if (!real && t >= 8) {
    ctxMarcas.strokeStyle = 'rgba(255,255,255,0.05)';
    ctxMarcas.lineWidth = 1;
    ctxMarcas.beginPath();
    for (let x = 0; x <= mapa.width; x++) { ctxMarcas.moveTo(x * t + 0.5, 0); ctxMarcas.lineTo(x * t + 0.5, mapa.height * t); }
    for (let y = 0; y <= mapa.height; y++) { ctxMarcas.moveTo(0, y * t + 0.5); ctxMarcas.lineTo(mapa.width * t, y * t + 0.5); }
    ctxMarcas.stroke();
  }
  let incompleto = false;
  spawns.forEach((s, i) => {
    if (zDoSpawn(s) !== andar) return;
    const cor = corDaRaridade(s.raridade) ?? '#ffffff';
    const sel = i === selecionado;
    // A área onde os bichos nascem (raio).
    if ($('verRaio').checked || sel) {
      const r = s.raio ?? 0;
      ctxMarcas.strokeStyle = sel ? '#4a9eff' : `${cor}66`;
      ctxMarcas.setLineDash(sel ? [] : [4, 3]);
      ctxMarcas.lineWidth = sel ? 2 : 1;
      ctxMarcas.strokeRect((s.x - r) * t + 0.5, (s.y - r) * t + 0.5, (2 * r + 1) * t - 1, (2 * r + 1) * t - 1);
      ctxMarcas.setLineDash([]);
    }
    // A criatura com a sprite do jogo.
    const b = porKey.get(keyDoSpawn(s));
    if (b?.look) {
      ctxMarcas.save();
      ctxMarcas.scale(escala, escala);
      if (!drawCreature(ctxMarcas, { look: b.look, colors: b.colors, dir: 2, frame: 0, walking: false, mount: 0, addons: b.colors?.addons ?? 0 }, s.x * TILE, s.y * TILE)) incompleto = true;
      ctxMarcas.restore();
    }
    // O anel da raridade e o "×N" da quantidade.
    ctxMarcas.strokeStyle = sel ? '#4a9eff' : cor;
    ctxMarcas.lineWidth = sel ? 3 : 2;
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
  if (casaSobOMouse) {
    ctxMarcas.strokeStyle = 'rgba(255,255,255,0.8)';
    ctxMarcas.lineWidth = 1;
    ctxMarcas.strokeRect(casaSobOMouse.x * t + 0.5, casaSobOMouse.y * t + 0.5, t - 1, t - 1);
  }
  // Folha de outfit ainda chegando: tenta de novo daqui a pouco.
  clearTimeout(faltouSprite);
  if (incompleto) faltouSprite = setTimeout(desenharMarcas, 300);
}

// ---- Mouse no mapa ----

function casaDoEvento(evento) {
  const rect = marcas.getBoundingClientRect();
  const t = TILE * escala;
  const x = Math.floor((evento.clientX - rect.left) / t);
  const y = Math.floor((evento.clientY - rect.top) / t);
  if (x < 0 || y < 0 || x >= mapa.width || y >= mapa.height) return null;
  return { x, y };
}

const spawnNa = (x, y) => spawns.findIndex((s) => s.x === x && s.y === y && zDoSpawn(s) === andar);

function aplicarFerramenta(x, y, primeiro) {
  const i = y * mapa.width + x;
  const { stacks, blocked } = grade();
  if (ferramenta === 'pincel' || ferramenta === 'parede') {
    if (real) return primeiro && mostrarAviso('Mapa real: o chão não é editado aqui — só os spawns.', true);
    blocked[i] = ferramenta === 'parede' ? 1 : 0;
    stacks[i] = [indicePisoAtivo];
    repintarCasa(x, y);
    desenharMarcas();
  } else if (ferramenta === 'spawn' && primeiro) {
    const ja = spawnNa(x, y);
    if (ja >= 0) return selecionar(ja === selecionado ? -1 : ja);
    if (!bichoAtivo) return mostrarAviso('Escolha uma criatura na lista primeiro.', true);
    if (!stacks[i]?.length || blocked[i]) return mostrarAviso('O spawn precisa ficar numa casa andável deste andar.', true);
    spawns.push({
      id: novoId(), x, y, z: andar, raio: proximo.raio, quantidade: proximo.quantidade, tipo: 'normal',
      criaturas: [{ key: bichoAtivo.key, peso: 1 }], ...comRaridade(proximo),
    });
    atualizarListaSpawns();
    desenharMarcas();
  } else if (ferramenta === 'apagarSpawn' && primeiro) {
    const ja = spawnNa(x, y);
    if (ja < 0) return;
    spawns.splice(ja, 1);
    selecionar(-1);
  }
}

function novoId() {
  const usados = new Set(spawns.map((s) => s.id));
  let n = spawns.length + 1;
  while (usados.has(`s${n}`)) n++;
  return `s${n}`;
}

let arrastando = false;
marcas.addEventListener('mousedown', (e) => {
  if (!mapa) return;
  arrastando = true;
  const c = casaDoEvento(e);
  if (c) aplicarFerramenta(c.x, c.y, true);
});
marcas.addEventListener('mousemove', (e) => {
  if (!mapa) return;
  const c = casaDoEvento(e);
  const mudou = c?.x !== casaSobOMouse?.x || c?.y !== casaSobOMouse?.y;
  casaSobOMouse = c;
  if (c) {
    const i = c.y * mapa.width + c.x;
    const { stacks, blocked } = grade();
    const ja = spawnNa(c.x, c.y);
    const s = ja >= 0 ? spawns[ja] : null;
    $('status').textContent = `x ${c.x}, y ${c.y}, andar ${andar} · ${!stacks[i]?.length ? 'vazio' : blocked[i] ? 'bloqueado' : 'andável'}${s ? ` · spawn ${s.id}: ${nomeDe(keyDoSpawn(s))}` : ''}`;
  }
  if (arrastando && c && (ferramenta === 'pincel' || ferramenta === 'parede')) aplicarFerramenta(c.x, c.y, false);
  else if (mudou) desenharMarcas();
});
marcas.addEventListener('mouseleave', () => {
  casaSobOMouse = null;
  desenharMarcas();
});
window.addEventListener('mouseup', () => (arrastando = false));

const AJUDA = {
  spawn: 'Clique numa casa andável para marcar um spawn com a criatura escolhida; clique num spawn para editá-lo.',
  apagarSpawn: 'Clique num spawn para apagá-lo.',
  pincel: 'Arraste para pintar chão andável com o piso escolhido (só em mapa novo).',
  parede: 'Arraste para bloquear casas (só em mapa novo).',
};
function selecionarFerramenta(nome) {
  ferramenta = nome;
  const ids = { pincel: 'ferPincel', parede: 'ferParede', spawn: 'ferSpawn', apagarSpawn: 'ferApagarSpawn' };
  for (const [k, id] of Object.entries(ids)) $(id).classList.toggle('ativo', k === nome);
  $('ajudaFerramenta').textContent = AJUDA[nome];
}
$('ferPincel').onclick = () => selecionarFerramenta('pincel');
$('ferParede').onclick = () => selecionarFerramenta('parede');
$('ferSpawn').onclick = () => selecionarFerramenta('spawn');
$('ferApagarSpawn').onclick = () => selecionarFerramenta('apagarSpawn');

// ---- O piso (os índices da paleta da cidade, com a sprite de verdade) ----

function montarPaleta() {
  const caixa = $('paletaPiso');
  caixa.innerHTML = '';
  const cidade = opcoes?.cidade;
  const img = cidade && atlas(cidade.atlas);
  for (const indice of opcoes?.paleta ?? []) {
    const linha = document.createElement('button');
    linha.className = 'swatch' + (indice === indicePisoAtivo ? ' ativo' : '');
    linha.disabled = real;
    const c = document.createElement('canvas');
    c.width = c.height = 32;
    const e = cidade?.palette[indice];
    if (img && e) {
      const [ax, ay] = e.cells?.[0] ?? [e.ax, e.ay];
      c.getContext('2d').drawImage(img, ax + (cidade.cell - e.w), ay + (cidade.cell - e.h), e.w, e.h, 32 - e.w, 32 - e.h, e.w, e.h);
    }
    linha.append(c, document.createTextNode(` índice ${indice}`));
    linha.onclick = () => {
      indicePisoAtivo = indice;
      if (ferramenta !== 'parede') selecionarFerramenta('pincel');
      montarPaleta();
    };
    caixa.append(linha);
  }
}

// ---- As criaturas (com a sprite; as do mapa/hunt aberto primeiro) ----

function montarListaBichos() {
  const lista = $('listaBichos');
  lista.innerHTML = '';
  const filtro = $('filtroBicho').value.trim().toLowerCase();
  const casa = (b) => !filtro || b.name.toLowerCase().includes(filtro) || b.key.includes(filtro);
  const daqui = new Set([...(opcoes?.criaturasPorHunt?.[mapaId] ?? []), ...spawns.map(keyDoSpawn)]);
  const grupos = [
    ['Deste mapa / hunt', bestiario.filter((b) => daqui.has(b.key) && casa(b))],
    [filtro ? 'Bestiário' : 'Bestiário (busque pelo nome)', filtro ? bestiario.filter((b) => !daqui.has(b.key) && casa(b)).slice(0, 60) : []],
  ];
  for (const [titulo, bichos] of grupos) {
    if (!bichos.length && titulo.startsWith('Deste')) continue;
    const g = document.createElement('div');
    g.className = 'grupo-bichos';
    g.textContent = titulo;
    lista.append(g);
    for (const b of bichos) {
      const linha = document.createElement('div');
      linha.className = 'bicho' + (bichoAtivo?.key === b.key ? ' ativo' : '');
      linha.append(outfitCanvas(b.look, b.colors, 32));
      const texto = document.createElement('span');
      texto.textContent = b.name;
      const info = document.createElement('small');
      info.textContent = `hp ${b.hp}${b.classe ? ` · ${b.classe}` : ''}`;
      if (b.boss) {
        const chefe = document.createElement('span');
        chefe.className = 'chefe';
        chefe.textContent = ' · boss';
        info.append(chefe);
      }
      texto.append(info);
      linha.append(texto);
      linha.onclick = () => {
        bichoAtivo = b;
        // Com um spawn selecionado, trocar a criatura troca a dele.
        if (selecionado >= 0) {
          spawns[selecionado].criaturas = [{ key: b.key, peso: 1 }];
          atualizarListaSpawns();
          desenharMarcas();
        } else selecionarFerramenta('spawn');
        montarListaBichos();
      };
      lista.append(linha);
    }
  }
}
$('filtroBicho').oninput = () => montarListaBichos();

// ---- O spawn selecionado (ou o próximo a marcar): raio, quantidade, raridade, modificadores ----

const tetoDe = (id) => raridades.find((r) => r.id === id)?.maxModificadores ?? 0;
/** Os campos de raridade de um spawn: nada quando é normal sem modificador (o arquivo não cresce à toa). */
function comRaridade(o) {
  const mods = (o.modificadores ?? []).slice();
  // Normal com modificador vira "Modificado" no jogo (`Raridade.doSpawn`); aqui já mostra assim.
  const raridade = (o.raridade ?? 'normal') === 'normal' && mods.length ? 'modificado' : o.raridade ?? 'normal';
  return raridade === 'normal' ? {} : { raridade, ...(mods.length ? { modificadores: mods } : {}) };
}
const alvoDaEdicao = () => (selecionado >= 0 ? spawns[selecionado] : proximo);

function selecionar(i) {
  selecionado = i;
  const caixa = $('editandoSpawn');
  caixa.innerHTML = '';
  if (i >= 0) {
    const s = spawns[i];
    caixa.append(document.createTextNode(`Editando ${s.id}: ${nomeDe(keyDoSpawn(s))} (${s.x},${s.y})`));
    const pronto = document.createElement('button');
    pronto.textContent = 'Pronto';
    pronto.onclick = () => selecionar(-1);
    caixa.append(pronto);
  } else caixa.textContent = 'Valem para o próximo spawn marcado';
  montarEdicao();
  atualizarListaSpawns();
  desenharMarcas();
}

/** Grava a raridade/modificadores no alvo (o spawn: com a regra do "normal + mod = modificado"). */
function aplicarRaridade(raridade, mods) {
  const alvo = alvoDaEdicao();
  const teto = tetoDe(raridade === 'normal' && mods.length ? 'modificado' : raridade);
  const editado = { raridade, modificadores: mods.slice(0, teto || 0) };
  if (alvo === proximo) Object.assign(proximo, editado);
  else {
    delete alvo.raridade;
    delete alvo.modificadores;
    Object.assign(alvo, comRaridade(editado));
    // Voltou a normal um spawn cujo `tipo` antigo dá raridade (elite...): diz "normal" com todas as letras.
    if (!alvo.raridade && (tipoDoSpawn[alvo.tipo] ?? 'normal') !== 'normal') alvo.raridade = 'normal';
  }
  montarEdicao();
  atualizarListaSpawns();
  desenharMarcas();
}

const raridadeDe = (s) => s.raridade ?? tipoDoSpawn[s.tipo] ?? 'normal';

/*
 * ---- Os atributos CALCULADOS do monstro do spawn (etapa 5, dono 02/10) ----
 * O servidor monta (`GET /api/mapas/atributos-do-mob`): vida, dano, precisão, evasão, armadura, bloqueio e resistências, cada um com a ORIGEM das
 * parcelas, mais os ataques e os erros e avisos das regras de combinação dos modificadores. O editor só mostra — nenhuma conta aqui.
 */
let pedidoDoPainel = 0;
const textoDaOrigem = (o) => `${o.fonte}${o.valor != null ? `: ${o.valor}` : ''}${o.fator != null ? ` ×${String(o.fator).replace('.', ',')}` : ''}${o.pct != null ? ` ${o.pct > 0 ? '+' : ''}${o.pct}%` : ''}${o.raridade && o.raridade !== 'normal' ? ` (${o.raridade} ×${String(o.fatorDaRaridade).replace('.', ',')})` : ''}`;

async function montarPainelDeAtributos(alvo, raridade, mods) {
  let painel = $('atributosDoMob');
  if (!painel) {
    painel = document.createElement('div');
    painel.id = 'atributosDoMob';
    painel.className = 'atributos-do-mob';
    $('listaMods').parentElement.append(painel);
  }
  if (alvo === proximo) {
    painel.textContent = 'Selecione um spawn para ver os atributos calculados do monstro.';
    return;
  }
  const meu = ++pedidoDoPainel;
  const nivel = Number(painel.dataset.nivel || 100);
  const q = new URLSearchParams({ key: keyDoSpawn(alvo), level: String(nivel), raridade, mods: mods.join(',') });
  const d = await fetch(`/api/mapas/atributos-do-mob?${q}`).then((r) => r.json()).catch(() => null);
  if (meu !== pedidoDoPainel) return;
  painel.innerHTML = '';
  if (!d?.ok) {
    painel.textContent = d?.erro ?? 'Não consegui calcular os atributos.';
    return;
  }
  const titulo = document.createElement('h3');
  titulo.textContent = `Atributos calculados — ${d.nome} (Lv ${d.level})`;
  const campoNivel = document.createElement('input');
  campoNivel.type = 'number';
  campoNivel.min = '1';
  campoNivel.max = '2000';
  campoNivel.value = String(nivel);
  campoNivel.title = 'Level da fase para o cálculo';
  campoNivel.onchange = () => { painel.dataset.nivel = campoNivel.value; montarPainelDeAtributos(alvo, raridade, mods); };
  titulo.append(' · level ', campoNivel);
  painel.append(titulo);
  for (const e of d.erros ?? []) painel.append(Object.assign(document.createElement('p'), { className: 'erro', textContent: `Erro: ${e}` }));
  for (const a of d.avisos ?? []) painel.append(Object.assign(document.createElement('p'), { className: 'aviso', textContent: `Aviso: ${a}` }));
  const linhas = [['Vida', d.atributos.vida], ['Dano (multiplicador)', d.atributos.dano], ['Precisão', d.atributos.precisao], ['Evasão', d.atributos.evasao], ['Armadura', d.atributos.armadura]];
  for (const [nome, a] of linhas) {
    const bloco = document.createElement('details');
    const resumo = document.createElement('summary');
    resumo.textContent = `${nome}: ${Math.round(a.valor * 100) / 100}`;
    bloco.append(resumo);
    for (const o of a.origens) bloco.append(Object.assign(document.createElement('div'), { className: 'origem', textContent: textoDaOrigem(o) }));
    painel.append(bloco);
  }
  const extras = [];
  if (d.atributos.bloqueio) extras.push(`Bloqueio: ${Math.round(d.atributos.bloqueio * 100)}%`);
  if (d.atributos.reducaoDeDano) extras.push(`Redução de dano: ${Math.round(d.atributos.reducaoDeDano * 100)}%`);
  extras.push(`Velocidade de ataque: ×${String(d.atributos.velocidadeDeAtaque).replace('.', ',')}`);
  const res = Object.entries(d.atributos.resistencias ?? {}).filter(([, v]) => v).map(([k, v]) => `${k} ${v}%`);
  if (res.length) extras.push(`Resistências do bestiário: ${res.join(', ')}`);
  painel.append(Object.assign(document.createElement('p'), { textContent: extras.join(' · ') }));
  for (const at of d.ataques ?? []) painel.append(Object.assign(document.createElement('div'), { className: 'origem', textContent: `${at.tipo === 'melee' ? 'Corpo a corpo' : 'Magia'} (${at.elemento}): ${at.min}–${at.max}, a cada ${(at.intervalo / 1000).toFixed(1).replace('.', ',')} s, ${at.chance}% de chance` }));
}

function montarEdicao() {
  const alvo = alvoDaEdicao();
  const raridade = alvo === proximo ? proximo.raridade : raridadeDe(alvo);
  const mods = alvo.modificadores ?? [];
  $('raio').value = alvo.raio ?? 0;
  $('quantidade').value = alvo.quantidade ?? 1;
  const select = $('raridade');
  select.innerHTML = '';
  for (const r of raridades) {
    const opt = document.createElement('option');
    opt.value = r.id;
    opt.textContent = `${r.nome}${r.maxModificadores ? ` (até ${r.maxModificadores} modificadores)` : ''}`;
    opt.style.color = r.cor;
    select.append(opt);
  }
  select.value = raridade;
  select.style.color = corDaRaridade(raridade) ?? '';
  select.onchange = () => aplicarRaridade(select.value, mods);
  const teto = tetoDe(raridade === 'normal' ? 'modificado' : raridade);
  $('contagemMods').textContent = `(${mods.length}/${teto})`;
  const lista = $('listaMods');
  lista.innerHTML = '';
  for (const m of modificadores) {
    const marcado = mods.includes(m.id);
    // As regras do modificador (raridades permitidas e incompatibilidades, vindas do servidor): quem não pode entrar fica travado, com o motivo.
    const raridadeEfetiva = raridade === 'normal' && mods.length ? 'modificado' : raridade;
    const fora = m.raridades && !m.raridades.includes(raridadeEfetiva);
    const incompativel = mods.some((id) => m.incompativeis?.includes(id) || modificadores.find((x) => x.id === id)?.incompativeis?.includes(m.id));
    const travado = !marcado && (mods.length >= teto || fora || incompativel);
    const rotulo = document.createElement('label');
    rotulo.className = 'mod-opcao' + (travado ? ' travado' : '');
    if (!marcado && fora) rotulo.title = `Só entra em: ${m.raridades.map((r) => raridades.find((x) => x.id === r)?.nome ?? r).join(', ')}`;
    else if (!marcado && incompativel) rotulo.title = 'Não combina com um modificador já escolhido';
    const caixa = document.createElement('input');
    caixa.type = 'checkbox';
    caixa.checked = marcado;
    caixa.disabled = travado;
    caixa.onchange = () => aplicarRaridade(raridade, caixa.checked ? [...mods, m.id] : mods.filter((id) => id !== m.id));
    const texto = document.createElement('span');
    texto.textContent = m.nome;
    const descricao = document.createElement('small');
    descricao.textContent = m.descricao;
    texto.append(descricao);
    rotulo.append(caixa, texto);
    lista.append(rotulo);
  }
  montarPainelDeAtributos(alvo, raridade, mods);
}
$('raio').onchange = () => {
  alvoDaEdicao().raio = Math.max(0, Math.min(10, Math.round(Number($('raio').value) || 0)));
  desenharMarcas();
};
$('quantidade').onchange = () => {
  alvoDaEdicao().quantidade = Math.max(1, Math.min(20, Math.round(Number($('quantidade').value) || 1)));
  atualizarListaSpawns();
  desenharMarcas();
};

function atualizarListaSpawns() {
  const lista = $('listaSpawns');
  lista.innerHTML = '';
  let n = 0;
  spawns.forEach((s, i) => {
    if (zDoSpawn(s) !== andar) return;
    n++;
    const linha = document.createElement('div');
    linha.className = 'item-spawn' + (i === selecionado ? ' selecionado' : '');
    const rotulo = document.createElement('span');
    rotulo.textContent = `${s.id} · ${nomeDe(keyDoSpawn(s))}${(s.quantidade ?? 1) > 1 ? ` ×${s.quantidade}` : ''} (${s.x},${s.y})`;
    rotulo.style.color = corDaRaridade(raridadeDe(s)) ?? '';
    if (s.modificadores?.length) {
      const mods = document.createElement('span');
      mods.className = 'mods-do-spawn';
      mods.textContent = s.modificadores.map((id) => modificadores.find((m) => m.id === id)?.nome ?? id).join(' · ');
      rotulo.append(mods);
    }
    linha.append(rotulo);
    linha.onclick = () => {
      selecionar(i === selecionado ? -1 : i);
      if (selecionado >= 0) centralizar(s.x, s.y);
    };
    const botao = document.createElement('button');
    botao.textContent = '✕';
    botao.title = 'Apagar este spawn';
    botao.onclick = (e) => {
      e.stopPropagation();
      spawns.splice(i, 1);
      selecionar(-1);
    };
    linha.append(botao);
    lista.append(linha);
  });
  $('contagemSpawns').textContent = `${n}${spawns.length !== n ? ` de ${spawns.length} no mapa` : ''}`;
  if (mapa) montarAndares();
}

function centralizar(x, y) {
  const wrap = $('canvasWrap');
  const t = TILE * escala;
  wrap.scrollTo({ left: x * t - wrap.clientWidth / 2, top: y * t - wrap.clientHeight / 2, behavior: 'smooth' });
}

// ---- Andar e zoom ----

function montarAndares() {
  const select = $('andar');
  select.innerHTML = '';
  for (const z of mapa.levels ?? [mapa.z]) {
    const opt = document.createElement('option');
    opt.value = z;
    const qtos = spawns.filter((s) => zDoSpawn(s) === z).length;
    opt.textContent = `${z}${z === mapa.z ? ' (entrada)' : ''} — ${qtos} spawns`;
    select.append(opt);
  }
  select.value = andar;
}
$('andar').onchange = () => {
  andar = Number($('andar').value);
  selecionar(-1);
  desenharFundo();
};
$('zoom').onchange = () => {
  escala = Number($('zoom').value);
  ajustarCanvas();
  desenharFundo();
};
$('verBloqueio').onchange = () => desenharMarcas();
$('verRaio').onchange = () => desenharMarcas();

/** Abre um mapa (objeto já carregado) no editor. */
function abrir(novo, id, ehReal) {
  mapa = novo;
  mapaId = id;
  real = ehReal;
  andar = mapa.z ?? 7;
  spawns = Array.isArray(mapa.spawns)
    ? structuredClone(mapa.spawns)
    : (mapa.posicoes ?? []).map((p, i) => ({ id: `s${i + 1}`, x: p.x, y: p.y, z: andar, raio: 0, quantidade: 1, tipo: 'normal', criaturas: [{ key: p.key, peso: 1 }] }));
  selecionado = -1;
  $('selo').textContent = real ? 'Mapa real — só os spawns são editados (o chão fica como está)' : id ? 'Mapa do editor — chão e spawns' : 'Mapa novo';
  $('selo').classList.toggle('real', real);
  for (const id2 of ['ferPincel', 'ferParede']) $(id2).disabled = real;
  if (real && (ferramenta === 'pincel' || ferramenta === 'parede')) selecionarFerramenta('spawn');
  // Mapa grande abre menor, para caber na tela.
  escala = mapa.width * mapa.height > 20000 ? 0.5 : 1;
  $('zoom').value = String(escala);
  montarAndares();
  ajustarCanvas();
  desenharFundo();
  montarPaleta();
  montarListaBichos();
  selecionar(-1);
  const primeiro = spawns.find((s) => zDoSpawn(s) === andar);
  if (primeiro) centralizar(primeiro.x, primeiro.y);
}

function novoMapa(w, h) {
  const cidade = opcoes.cidade;
  const n = w * h;
  // Nasce tudo BLOQUEADO e sem chão — o dono pinta o andável, igual cavar uma sala na rocha.
  const stacks = new Array(n).fill(null).map(() => [indicePisoAtivo]);
  const blocked = new Array(n).fill(1);
  abrir({ width: w, height: h, atlas: cidade.atlas, cell: cidade.cell, palette: cidade.palette, levels: [7], z: 7, floors: { 7: { stacks, blocked } }, stacks, blocked, spawns: [] }, null, false);
  $('mapaId').value = '';
}

$('btNovo').onclick = () => novoMapa(Number($('mapaW').value), Number($('mapaH').value));

$('btSalvar').onclick = async () => {
  const id = $('mapaId').value.trim();
  if (!id) return mostrarAviso('Escreva um id (ex.: minha-caverna).', true);
  // Mapa real: só os spawns (o servidor também garante isso).
  const corpo = real
    ? { id, soSpawns: true, spawns }
    : { id, width: mapa.width, height: mapa.height, blocked: grade(7).blocked, stacks: grade(7).stacks, spawns };
  if (real && id !== mapaId) return mostrarAviso('Mapa real: salve com o mesmo id que foi aberto.', true);
  const resposta = await fetch('/api/mapas', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(corpo) }).then((r) => r.json());
  if (!resposta.ok) return mostrarAviso(resposta.erro, true);
  mapaId = id;
  mostrarAviso(real ? `Spawns de "${id}" salvos (${spawns.length}).` : `Salvo — já dá pra jogar com startHunt "${id}".`);
  carregarListaMapas(id);
};

async function carregarListaMapas(manter = null) {
  const { ids } = await fetch('/api/mapas').then((r) => r.json());
  const select = $('listaMapas');
  select.innerHTML = '';
  for (const id of ids) {
    const opt = document.createElement('option');
    opt.value = id;
    opt.textContent = id;
    select.append(opt);
  }
  if (manter) select.value = manter;
}

$('btCarregar').onclick = async () => {
  const id = $('listaMapas').value;
  if (!id) return;
  mostrarAviso(`Abrindo "${id}"...`);
  const m = await fetch(`/api/mapas/${id}`).then((r) => r.json());
  if (!m || m.ok === false) return mostrarAviso('Não achei esse mapa.', true);
  const ehReal = m.atlas !== opcoes.cidade.atlas || (m.levels?.length ?? 1) > 1;
  $('mapaId').value = id;
  $('mapaW').value = m.width;
  $('mapaH').value = m.height;
  abrir(m, id, ehReal);
  mostrarAviso(`Carregado "${id}" — ${spawns.length} spawns em ${(m.levels ?? [m.z]).length} andar(es).`);
};

async function iniciar() {
  const [dados] = await Promise.all([fetch('/api/mapas/opcoes').then((r) => r.json()), loadSpriteData()]);
  opcoes = dados;
  bestiario = [...opcoes.bestiario].sort((a, b) => a.name.localeCompare(b.name));
  porKey = new Map(bestiario.map((b) => [b.key, b]));
  raridades = opcoes.raridades ?? [];
  modificadores = opcoes.modificadores ?? [];
  tipoDoSpawn = opcoes.tipoDoSpawn ?? {};
  indicePisoAtivo = opcoes.paleta[0] ?? 40;
  selecionarFerramenta('spawn');
  await carregarListaMapas();
  novoMapa(Number($('mapaW').value), Number($('mapaH').value));
  // `/editor?mapa=<id>` (o painel de hunts do /editor/conteudo): já abre esse mapa.
  const pedido = new URLSearchParams(location.search).get('mapa');
  if (pedido && [...$('listaMapas').options].some((o) => o.value === pedido)) {
    $('listaMapas').value = pedido;
    $('btCarregar').click();
  }
}
iniciar();
