// Editor de mapas (/editor). Ferramenta interna do dono, sem login — o
// servidor local já é dele. Desenho ESQUEMÁTICO por cor (não a sprite real):
// verificar a aparência de verdade é entrar na hunt pelo cliente de sempre
// depois de salvar — este canvas só decide onde anda/bloqueia/nasce bicho.
const TAMANHO_CELULA = 16;

let largura = 40;
let altura = 30;
let blocked = [];
let stacks = [];
let spawns = []; // { key, name, x, y }

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
  for (const s of spawns) {
    ctx.fillStyle = '#e0645a';
    ctx.beginPath();
    ctx.arc(s.x * TAMANHO_CELULA + TAMANHO_CELULA / 2, s.y * TAMANHO_CELULA + TAMANHO_CELULA / 2, TAMANHO_CELULA * 0.35, 0, 7);
    ctx.fill();
  }
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
    spawns.push({ key: bichoAtivo.key, name: bichoAtivo.name, x, y });
    atualizarListaSpawns();
  } else if (ferramenta === 'apagarSpawn') {
    spawns = spawns.filter((s) => !(s.x === x && s.y === y));
    atualizarListaSpawns();
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
    linha.className = 'item-spawn';
    const rotulo = document.createElement('span');
    rotulo.textContent = `${s.name} (${s.x},${s.y})`;
    linha.append(rotulo);
    const botao = document.createElement('button');
    botao.textContent = '✕';
    botao.onclick = () => {
      spawns.splice(i, 1);
      atualizarListaSpawns();
      desenhar();
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
    body: JSON.stringify({ id, width: largura, height: altura, blocked, stacks, posicoes: spawns }),
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
  spawns = mapa.posicoes ?? [];
  document.getElementById('mapaId').value = id;
  document.getElementById('mapaW').value = largura;
  document.getElementById('mapaH').value = altura;
  ajustarCanvas();
  desenhar();
  atualizarListaSpawns();
  mostrarAviso(`Carregado "${id}".`);
};

async function iniciar() {
  const opcoes = await fetch('/api/mapas/opcoes').then((r) => r.json());
  bestiario = opcoes.bestiario;
  paleta = opcoes.paleta;
  indicePisoAtivo = paleta[0] ?? 40;
  montarPaleta();
  montarListaBichos();
  await carregarListaMapas();
  novoMapa(largura, altura);
}
iniciar();
