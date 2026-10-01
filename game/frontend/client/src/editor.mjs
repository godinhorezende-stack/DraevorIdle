// Editor de mapas (/editor). Ferramenta interna do dono, sem login — o
// servidor local já é dele. Desenho ESQUEMÁTICO por cor (não a sprite real):
// verificar a aparência de verdade é entrar na hunt pelo cliente de sempre
// depois de salvar — este canvas só decide onde anda/bloqueia/nasce bicho.
const TAMANHO_CELULA = 16;

let largura = 40;
let altura = 30;
let blocked = [];
let stacks = [];
let spawns = []; // { key, name, x, y, raridade?, modificadores?, orig? } — `orig` = o spawn como veio do arquivo (raio, quantidade...)
// A raridade e os modificadores (dados do servidor, `gamedata/mobs/`). Valem para
// o PRÓXIMO spawn marcado, ou para o spawn selecionado na lista.
let raridades = [];
let modificadores = [];
let tipoDoSpawn = {};
const proximo = { raridade: 'normal', modificadores: [] };
let selecionado = -1;

let ferramenta = 'pincel';
let indicePisoAtivo = 40;
let bichoAtivo = null;
let paleta = [];
let bestiario = [];

const canvas = document.getElementById('grade');
const ctx = canvas.getContext('2d');
const aviso = document.getElementById('aviso');

function mostrarAviso(texto, ehErro = false) {
  aviso.textContent = texto;
  aviso.style.color = ehErro ? '#e0645a' : '#f0a851';
  if (texto) setTimeout(() => { if (aviso.textContent === texto) aviso.textContent = ''; }, 4000);
}

/** Uma cor estável por índice de paleta — só pra distinguir tipos de piso no esquema, não é a sprite real. */
function corDoIndice(indice) {
  const matiz = (indice * 47) % 360;
  return `hsl(${matiz}, 35%, 32%)`;
}

function novoMapa(w, h) {
  largura = w;
  altura = h;
  const n = w * h;
  // Nasce tudo BLOQUEADO — o dono pinta o andável, igual cavar uma sala na rocha.
  blocked = new Array(n).fill(1);
  stacks = new Array(n).fill(null).map(() => [indicePisoAtivo]);
  spawns = [];
  selecionado = -1;
  ajustarCanvas();
  desenhar();
  atualizarListaSpawns();
}

function ajustarCanvas() {
  canvas.width = largura * TAMANHO_CELULA;
  canvas.height = altura * TAMANHO_CELULA;
}

function desenhar() {
  for (let y = 0; y < altura; y++) {
    for (let x = 0; x < largura; x++) {
      const i = y * largura + x;
      const px = x * TAMANHO_CELULA;
      const py = y * TAMANHO_CELULA;
      if (blocked[i]) {
        ctx.fillStyle = '#1a1d24';
      } else {
        const idx = stacks[i]?.[0] ?? indicePisoAtivo;
        ctx.fillStyle = corDoIndice(idx);
      }
      ctx.fillRect(px, py, TAMANHO_CELULA, TAMANHO_CELULA);
    }
  }
  ctx.strokeStyle = 'rgba(255,255,255,0.05)';
  for (let x = 0; x <= largura; x++) {
    ctx.beginPath();
    ctx.moveTo(x * TAMANHO_CELULA, 0);
    ctx.lineTo(x * TAMANHO_CELULA, altura * TAMANHO_CELULA);
    ctx.stroke();
  }
  for (let y = 0; y <= altura; y++) {
    ctx.beginPath();
    ctx.moveTo(0, y * TAMANHO_CELULA);
    ctx.lineTo(largura * TAMANHO_CELULA, y * TAMANHO_CELULA);
    ctx.stroke();
  }
  spawns.forEach((s, i) => {
    // A bolinha na cor da raridade (a mesma do nome do mob no jogo); um aro branco = tem modificador.
    const cx = s.x * TAMANHO_CELULA + TAMANHO_CELULA / 2;
    const cy = s.y * TAMANHO_CELULA + TAMANHO_CELULA / 2;
    ctx.fillStyle = corDaRaridade(s.raridade) ?? '#e0645a';
    ctx.beginPath();
    ctx.arc(cx, cy, TAMANHO_CELULA * 0.35, 0, 7);
    ctx.fill();
    if (s.modificadores?.length || i === selecionado) {
      ctx.strokeStyle = i === selecionado ? '#4a9eff' : '#ffffff';
      ctx.lineWidth = i === selecionado ? 2 : 1;
      ctx.beginPath();
      ctx.arc(cx, cy, TAMANHO_CELULA * 0.45, 0, 7);
      ctx.stroke();
    }
  });
}

function celulaDoEvento(evento) {
  const rect = canvas.getBoundingClientRect();
  const x = Math.floor((evento.clientX - rect.left) / TAMANHO_CELULA);
  const y = Math.floor((evento.clientY - rect.top) / TAMANHO_CELULA);
  if (x < 0 || y < 0 || x >= largura || y >= altura) return null;
  return { x, y };
}

function aplicarFerramenta(x, y) {
  const i = y * largura + x;
  if (ferramenta === 'pincel') {
    blocked[i] = 0;
    stacks[i] = [indicePisoAtivo];
  } else if (ferramenta === 'parede') {
    blocked[i] = 1;
    stacks[i] = [indicePisoAtivo];
  } else if (ferramenta === 'spawn') {
    if (!bichoAtivo) return mostrarAviso('Escolha um bicho na lista primeiro.', true);
    if (blocked[i]) return mostrarAviso('Spawn precisa ficar numa casa andável.', true);
    spawns.push({ key: bichoAtivo.key, name: bichoAtivo.name, x, y, ...comRaridade(proximo) });
    atualizarListaSpawns();
  } else if (ferramenta === 'apagarSpawn') {
    spawns = spawns.filter((s) => !(s.x === x && s.y === y));
    selecionar(-1);
  }
  desenhar();
}

let arrastando = false;
canvas.addEventListener('mousedown', (e) => {
  arrastando = true;
  const c = celulaDoEvento(e);
  if (c) aplicarFerramenta(c.x, c.y);
});
canvas.addEventListener('mousemove', (e) => {
  if (!arrastando || ferramenta === 'spawn' || ferramenta === 'apagarSpawn') return;
  const c = celulaDoEvento(e);
  if (c) aplicarFerramenta(c.x, c.y);
});
window.addEventListener('mouseup', () => (arrastando = false));

function selecionarFerramenta(nome) {
  ferramenta = nome;
  for (const el of document.querySelectorAll('#ferramentas .swatch')) el.classList.remove('ativo');
  document.getElementById(
    nome === 'pincel' ? 'ferPincel' : nome === 'parede' ? 'ferParede' : nome === 'spawn' ? 'ferSpawn' : 'ferApagarSpawn'
  ).classList.add('ativo');
}
document.getElementById('ferPincel').onclick = () => selecionarFerramenta('pincel');
document.getElementById('ferParede').onclick = () => selecionarFerramenta('parede');
document.getElementById('ferSpawn').onclick = () => selecionarFerramenta('spawn');
document.getElementById('ferApagarSpawn').onclick = () => selecionarFerramenta('apagarSpawn');

function montarPaleta() {
  const caixa = document.getElementById('paletaPiso');
  caixa.innerHTML = '';
  for (const indice of paleta) {
    const linha = document.createElement('div');
    linha.className = 'swatch' + (indice === indicePisoAtivo ? ' ativo' : '');
    const bolinha = document.createElement('span');
    bolinha.className = 'cor';
    bolinha.style.background = corDoIndice(indice);
    linha.append(bolinha, document.createTextNode(` índice ${indice}`));
    linha.onclick = () => {
      indicePisoAtivo = indice;
      montarPaleta();
    };
    caixa.append(linha);
  }
}

function atualizarListaSpawns() {
  document.getElementById('contagemSpawns').textContent = spawns.length;
  const lista = document.getElementById('listaSpawns');
  lista.innerHTML = '';
  spawns.forEach((s, i) => {
    const linha = document.createElement('div');
    linha.className = 'item-spawn' + (i === selecionado ? ' selecionado' : '');
    const rotulo = document.createElement('span');
    rotulo.textContent = `${s.name} (${s.x},${s.y})`;
    rotulo.style.color = corDaRaridade(s.raridade) ?? '';
    rotulo.title = 'Clique para editar a raridade e os modificadores deste spawn';
    if (s.modificadores?.length) {
      const mods = document.createElement('span');
      mods.className = 'mods-do-spawn';
      mods.textContent = s.modificadores.map((id) => modificadores.find((m) => m.id === id)?.nome ?? id).join(' · ');
      rotulo.append(mods);
    }
    linha.append(rotulo);
    linha.onclick = () => selecionar(i === selecionado ? -1 : i);
    const botao = document.createElement('button');
    botao.textContent = '✕';
    botao.onclick = (e) => {
      e.stopPropagation();
      spawns.splice(i, 1);
      selecionar(-1);
    };
    linha.append(botao);
    lista.append(linha);
  });
}

function montarListaBichos(filtro = '') {
  const select = document.getElementById('bicho');
  select.innerHTML = '';
  const alvo = filtro.trim().toLowerCase();
  for (const b of bestiario) {
    if (alvo && !b.name.toLowerCase().includes(alvo) && !b.key.includes(alvo)) continue;
    const opt = document.createElement('option');
    opt.value = b.key;
    opt.textContent = `${b.name} (hp ${b.hp})`;
    select.append(opt);
  }
}
document.getElementById('filtroBicho').oninput = (e) => montarListaBichos(e.target.value);
document.getElementById('bicho').onchange = (e) => {
  bichoAtivo = bestiario.find((b) => b.key === e.target.value) ?? null;
};

document.getElementById('btNovo').onclick = () => {
  const w = Number(document.getElementById('mapaW').value);
  const h = Number(document.getElementById('mapaH').value);
  novoMapa(w, h);
};

document.getElementById('btSalvar').onclick = async () => {
  const id = document.getElementById('mapaId').value.trim();
  if (!id) return mostrarAviso('Escreva um id (ex.: minha-caverna).', true);
  const resposta = await fetch('/api/mapas', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ id, width: largura, height: altura, blocked, stacks, spawns: spawnsParaSalvar() }),
  }).then((r) => r.json());
  if (!resposta.ok) return mostrarAviso(resposta.erro, true);
  mostrarAviso(`Salvo — já dá pra jogar com startHunt "${id}".`);
  carregarListaMapas();
};

async function carregarListaMapas() {
  const { ids } = await fetch('/api/mapas').then((r) => r.json());
  const select = document.getElementById('listaMapas');
  select.innerHTML = '';
  for (const id of ids) {
    const opt = document.createElement('option');
    opt.value = id;
    opt.textContent = id;
    select.append(opt);
  }
}

document.getElementById('btCarregar').onclick = async () => {
  const id = document.getElementById('listaMapas').value;
  if (!id) return;
  const mapa = await fetch(`/api/mapas/${id}`).then((r) => r.json());
  if (!mapa || mapa.ok === false) return mostrarAviso('Não achei esse mapa.', true);
  largura = mapa.width;
  altura = mapa.height;
  blocked = mapa.blocked;
  stacks = mapa.stacks;
  spawns = spawnsDoArquivo(mapa);
  selecionado = -1;
  document.getElementById('mapaId').value = id;
  document.getElementById('mapaW').value = largura;
  document.getElementById('mapaH').value = altura;
  ajustarCanvas();
  desenhar();
  atualizarListaSpawns();
  mostrarAviso(`Carregado "${id}".`);
};

// ---- Raridade e modificadores do spawn (fase 3 dos mobs) ----

const corDaRaridade = (id) => (id && id !== 'normal' ? raridades.find((r) => r.id === id)?.cor : null) ?? null;
const tetoDe = (id) => raridades.find((r) => r.id === id)?.maxModificadores ?? 0;
/** O que um spawn leva da edição: nada quando é normal sem modificador (o arquivo não cresce à toa). */
function comRaridade(o) {
  const mods = o.modificadores.slice();
  // Normal com modificador vira "Modificado" no jogo (`Raridade.doSpawn`); aqui já mostra assim.
  const raridade = o.raridade === 'normal' && mods.length ? 'modificado' : o.raridade;
  return raridade === 'normal' ? {} : { raridade, ...(mods.length ? { modificadores: mods } : {}) };
}
/** O alvo da edição: o spawn selecionado na lista, ou o próximo a marcar. */
const alvoDaEdicao = () => (selecionado >= 0 ? spawns[selecionado] : proximo);

function selecionar(i) {
  selecionado = i;
  const s = alvoDaEdicao();
  if (s && i >= 0) {
    s.raridade ??= 'normal';
    s.modificadores ??= [];
  }
  const aviso = document.getElementById('editandoSpawn');
  aviso.innerHTML = '';
  if (i >= 0) {
    aviso.append(document.createTextNode(`Editando ${spawns[i].name} (${spawns[i].x},${spawns[i].y})`));
    const pronto = document.createElement('button');
    pronto.textContent = 'Pronto';
    pronto.onclick = () => selecionar(-1);
    aviso.append(pronto);
  } else aviso.textContent = 'Valem para o próximo spawn marcado';
  montarRaridade();
  atualizarListaSpawns();
  desenhar();
}

/** Grava a edição no alvo (spawn da lista: limpa os campos se voltou a normal). */
function aplicarEdicao(raridade, mods) {
  const alvo = alvoDaEdicao();
  const teto = tetoDe(raridade === 'normal' && mods.length ? 'modificado' : raridade);
  alvo.raridade = raridade;
  alvo.modificadores = mods.slice(0, teto || 0);
  if (alvo !== proximo) {
    const limpo = comRaridade(alvo);
    delete alvo.raridade;
    delete alvo.modificadores;
    Object.assign(alvo, limpo);
    alvo.raridade ??= 'normal';
    alvo.modificadores ??= [];
  }
  montarRaridade();
  atualizarListaSpawns();
  desenhar();
}

function montarRaridade() {
  const alvo = alvoDaEdicao();
  const raridade = alvo.raridade ?? 'normal';
  const mods = alvo.modificadores ?? [];
  const select = document.getElementById('raridade');
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
  select.onchange = () => aplicarEdicao(select.value, mods);
  // Normal + modificador = "Modificado" (o teto dele).
  const teto = tetoDe(raridade === 'normal' ? 'modificado' : raridade);
  document.getElementById('contagemMods').textContent = `(${mods.length}/${teto})`;
  const lista = document.getElementById('listaMods');
  lista.innerHTML = '';
  for (const m of modificadores) {
    const marcado = mods.includes(m.id);
    const travado = !marcado && mods.length >= teto;
    const rotulo = document.createElement('label');
    rotulo.className = 'mod-opcao' + (travado ? ' travado' : '');
    const caixa = document.createElement('input');
    caixa.type = 'checkbox';
    caixa.checked = marcado;
    caixa.disabled = travado;
    caixa.onchange = () => aplicarEdicao(raridade, caixa.checked ? [...mods, m.id] : mods.filter((id) => id !== m.id));
    const texto = document.createElement('span');
    texto.textContent = m.nome;
    const descricao = document.createElement('small');
    descricao.textContent = m.descricao;
    texto.append(descricao);
    rotulo.append(caixa, texto);
    lista.append(rotulo);
  }
}

/** Os spawns do arquivo (`spawns`, ou `posicoes` do editor antigo) como linhas do editor. */
function spawnsDoArquivo(mapa) {
  const nomeDe = (key) => bestiario.find((b) => b.key === key)?.name ?? key;
  if (Array.isArray(mapa.spawns)) {
    return mapa.spawns.map((s) => {
      const key = s.criaturas?.[0]?.key ?? s.key;
      const raridade = s.raridade ?? tipoDoSpawn[s.tipo] ?? 'normal';
      return { key, name: nomeDe(key), x: s.x, y: s.y, orig: s, ...(raridade !== 'normal' ? { raridade } : {}), ...(s.modificadores?.length ? { modificadores: s.modificadores } : {}) };
    });
  }
  return (mapa.posicoes ?? []).map((p) => ({ ...p, name: p.name ?? nomeDe(p.key) }));
}

/** As linhas do editor no formato `spawns` do mapa (o que veio do arquivo — raio, quantidade, criaturas — é mantido). */
function spawnsParaSalvar() {
  return spawns.map((s, i) => {
    const { raridade: _r, modificadores: _m, ...orig } = s.orig ?? {};
    const mudouOBicho = s.orig && (s.orig.criaturas?.[0]?.key ?? s.orig.key) !== s.key;
    return {
      ...orig,
      id: orig.id ?? `s${i + 1}`,
      x: s.x,
      y: s.y,
      raio: orig.raio ?? 0,
      quantidade: orig.quantidade ?? 1,
      criaturas: !mudouOBicho && orig.criaturas?.length ? orig.criaturas : [{ key: s.key, peso: 1 }],
      // Voltou a normal um spawn cujo `tipo` antigo dá raridade (elite...): diz "normal" com todas as letras.
      ...((tipoDoSpawn[orig.tipo] ?? 'normal') !== 'normal' ? { raridade: 'normal' } : {}),
      ...comRaridade({ raridade: s.raridade ?? 'normal', modificadores: s.modificadores ?? [] }),
    };
  });
}

async function iniciar() {
  const opcoes = await fetch('/api/mapas/opcoes').then((r) => r.json());
  bestiario = opcoes.bestiario;
  paleta = opcoes.paleta;
  raridades = opcoes.raridades ?? [];
  modificadores = opcoes.modificadores ?? [];
  tipoDoSpawn = opcoes.tipoDoSpawn ?? {};
  montarRaridade();
  indicePisoAtivo = paleta[0] ?? 40;
  montarPaleta();
  montarListaBichos();
  await carregarListaMapas();
  novoMapa(largura, altura);
  selecionar(-1);
}
iniciar();
