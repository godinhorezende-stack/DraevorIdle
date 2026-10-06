// Baixa uma pasta PÚBLICA do Google Drive ("qualquer pessoa com o link") para a referência local, com as subpastas — a coleção que o dono
// junta no Drive (ex.: poe-gemas-poedb, 06/10). Só o acesso público de sempre: a listagem `embeddedfolderview` e o download de cada
// arquivo; pausa entre os pedidos; arquivo que já existe com o mesmo tamanho é pulado (rodar de novo só completa). Pastas de cache
// (`.cache`) ficam de fora.
// Uso: node tools/baixar-drive-publico.mjs <id-da-pasta> <destino>
//   ex.: node tools/baixar-drive-publico.mjs 16fCkMzgcvBt_vyurBzo9mst99KcXbAnV /home/deploy/referencias-poe/poe-gemas-poedb
import { mkdirSync, writeFileSync, existsSync, statSync } from 'node:fs';
import { join } from 'node:path';

const [, , RAIZ_ID, DESTINO] = process.argv;
if (!RAIZ_ID || !DESTINO) throw new Error('uso: node tools/baixar-drive-publico.mjs <id-da-pasta> <destino>');
const AGENTE = 'Mozilla/5.0 (DraevorIdle referencia local)';
const PAUSA_MS = 350;
const IGNORAR = new Set(['.cache']);
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));
const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', '#39': "'" };
const texto = (s) => s.replace(/&(amp|lt|gt|quot|#39);/g, (_, e) => ENT[e]);

/** As entradas de uma pasta pública: `[{ id, nome, pasta }]`. */
async function listar(id) {
  const html = await (await fetch(`https://drive.google.com/embeddedfolderview?id=${id}`, { headers: { 'user-agent': AGENTE } })).text();
  const saida = [];
  for (const m of html.matchAll(/<div class="flip-entry" id="entry-([^"]+)"[\s\S]*?<a href="([^"]+)"[\s\S]*?flip-entry-title">([^<]+)</g)) {
    saida.push({ id: m[1], nome: texto(m[3]), pasta: /\/folders\//.test(m[2]) });
  }
  return saida;
}

async function baixar(id, arquivo) {
  for (let t = 1; ; t++) {
    const r = await fetch(`https://drive.usercontent.google.com/download?id=${id}&export=download&confirm=t`, { headers: { 'user-agent': AGENTE } });
    if (r.ok) {
      const corpo = Buffer.from(await r.arrayBuffer());
      writeFileSync(arquivo, corpo);
      return corpo.length;
    }
    if (t >= 3) throw new Error(`${r.status}`);
    await esperar(PAUSA_MS * 6 * t);
  }
}

let arquivos = 0;
let pulados = 0;
const erros = [];
async function pasta(id, destino) {
  mkdirSync(destino, { recursive: true });
  await esperar(PAUSA_MS);
  for (const e of await listar(id)) {
    if (IGNORAR.has(e.nome)) continue;
    const alvo = join(destino, e.nome);
    if (e.pasta) {
      await pasta(e.id, alvo);
      continue;
    }
    if (existsSync(alvo) && statSync(alvo).size > 0) {
      pulados++;
      continue;
    }
    try {
      await esperar(PAUSA_MS);
      await baixar(e.id, alvo);
      arquivos++;
      if (arquivos % 50 === 0) console.log(`${arquivos} arquivos...`);
    } catch (err) {
      erros.push(`${alvo}: ${err.message}`);
    }
  }
}

await pasta(RAIZ_ID, DESTINO);
console.log(`baixados ${arquivos}, já existiam ${pulados}${erros.length ? `, com erro ${erros.length}:\n${erros.slice(0, 20).join('\n')}` : ''}`);
