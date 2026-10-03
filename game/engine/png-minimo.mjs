// LEITOR E ESCRITOR DE PNG mínimos (sem dependências), para o servidor validar e guardar as folhas de sprites que o editor envia. Lê PNG de 8 bits sem
// entrelaçamento (cores 0, 2, 3, 4 e 6, com tRNS); escreve sempre RGBA 8 bits. Qualquer outra coisa é recusada com uma mensagem que diz o que fazer.
import { inflateSync, deflateSync } from 'node:zlib';

const ASSINATURA = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const CANAIS = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 };

const TABELA_CRC = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
const crc32 = (buf) => {
  let c = 0xffffffff;
  for (const b of buf) c = TABELA_CRC[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};

/** Lê o cabeçalho sem decodificar os pixels: `{ w, h, profundidade, tipoCor, entrelacado }` ou lança com a mensagem do problema. */
export function cabecalhoDoPng(buf) {
  if (!Buffer.isBuffer(buf) || buf.length < 33 || !buf.subarray(0, 8).equals(ASSINATURA)) throw new Error('O arquivo não é um PNG (assinatura inválida).');
  if (buf.toString('latin1', 12, 16) !== 'IHDR') throw new Error('PNG sem cabeçalho IHDR.');
  return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20), profundidade: buf[24], tipoCor: buf[25], entrelacado: buf[28] === 1 };
}

/** Decodifica para `{ w, h, data: Uint8ClampedArray(RGBA) }`. */
export function decodificarPng(buf) {
  const { w, h, profundidade, tipoCor, entrelacado } = cabecalhoDoPng(buf);
  if (!w || !h) throw new Error('PNG com dimensão zero.');
  if (profundidade !== 8) throw new Error(`PNG de ${profundidade} bits por canal: o editor trabalha com 8 bits. Reexporte como PNG 8 bits (RGBA).`);
  if (entrelacado) throw new Error('PNG entrelaçado (interlaced) não é aceito: reexporte sem entrelaçamento.');
  const canais = CANAIS[tipoCor];
  if (!canais) throw new Error(`Tipo de cor PNG ${tipoCor} não suportado.`);
  const idat = [];
  let paleta = null;
  let trns = null;
  for (let p = 8; p + 12 <= buf.length;) {
    const len = buf.readUInt32BE(p);
    const tipo = buf.toString('latin1', p + 4, p + 8);
    const dados = buf.subarray(p + 8, p + 8 + len);
    if (tipo === 'IDAT') idat.push(dados);
    else if (tipo === 'PLTE') paleta = dados;
    else if (tipo === 'tRNS') trns = dados;
    else if (tipo === 'IEND') break;
    p += 12 + len;
  }
  if (!idat.length) throw new Error('PNG sem dados de imagem.');
  let bruto;
  try { bruto = inflateSync(Buffer.concat(idat)); } catch { throw new Error('PNG corrompido (os dados não descomprimem).'); }
  const linha = w * canais;
  if (bruto.length < (linha + 1) * h) throw new Error('PNG corrompido (dados incompletos).');
  const px = Buffer.alloc(linha * h);
  for (let y = 0; y < h; y++) {
    const filtro = bruto[y * (linha + 1)];
    const src = y * (linha + 1) + 1;
    const dst = y * linha;
    for (let x = 0; x < linha; x++) {
      const a = x >= canais ? px[dst + x - canais] : 0;
      const b = y ? px[dst - linha + x] : 0;
      const c = x >= canais && y ? px[dst - linha + x - canais] : 0;
      let v = bruto[src + x];
      if (filtro === 1) v += a;
      else if (filtro === 2) v += b;
      else if (filtro === 3) v += (a + b) >> 1;
      else if (filtro === 4) { const pp = a + b - c; const pa = Math.abs(pp - a); const pb = Math.abs(pp - b); const pc = Math.abs(pp - c); v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c; }
      else if (filtro !== 0) throw new Error('PNG com filtro desconhecido.');
      px[dst + x] = v & 255;
    }
  }
  const out = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    let r; let g; let b; let a = 255;
    if (tipoCor === 6) { [r, g, b, a] = [px[i * 4], px[i * 4 + 1], px[i * 4 + 2], px[i * 4 + 3]]; }
    else if (tipoCor === 2) { [r, g, b] = [px[i * 3], px[i * 3 + 1], px[i * 3 + 2]]; }
    else if (tipoCor === 0) { r = g = b = px[i]; }
    else if (tipoCor === 4) { r = g = b = px[i * 2]; a = px[i * 2 + 1]; }
    else { const k = px[i]; if (!paleta || k * 3 + 2 >= paleta.length) throw new Error('PNG com índice de paleta inválido.'); [r, g, b] = [paleta[k * 3], paleta[k * 3 + 1], paleta[k * 3 + 2]]; a = trns && k < trns.length ? trns[k] : 255; }
    out[i * 4] = r; out[i * 4 + 1] = g; out[i * 4 + 2] = b; out[i * 4 + 3] = a;
  }
  return { w, h, data: out };
}

const bloco = (tipo, dados) => {
  const t = Buffer.from(tipo, 'latin1');
  const len = Buffer.alloc(4); len.writeUInt32BE(dados.length);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(Buffer.concat([t, dados])));
  return Buffer.concat([len, t, dados, crc]);
};

/** Codifica um bitmap RGBA em PNG (8 bits, RGBA, sem entrelaçamento). */
export function codificarPng({ w, h, data }) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 6;
  const bruto = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) {
    bruto[y * (w * 4 + 1)] = 0;
    Buffer.from(data.buffer, data.byteOffset + y * w * 4, w * 4).copy(bruto, y * (w * 4 + 1) + 1);
  }
  return Buffer.concat([ASSINATURA, bloco('IHDR', ihdr), bloco('IDAT', deflateSync(bruto)), bloco('IEND', Buffer.alloc(0))]);
}
