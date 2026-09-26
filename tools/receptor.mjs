// Receptor local das capturas: o capturador (rodando na aba do jogo) manda o
// JSON por POST e ele grava em api-mapeada/. Uso: node tools/receptor.mjs api-mapeada
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
const OUT = process.argv[2];
http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*'); res.setHeader('Access-Control-Allow-Headers', '*');
  res.setHeader('Access-Control-Allow-Private-Network', 'true');
  if (req.method !== 'POST') {
    // GET /script: devolve o capturador, para o console só precisar de um `eval(await fetch(...))`.
    if (req.url.startsWith('/script')) {
      const f = path.basename(new URL(req.url, 'http://x').searchParams.get('f') || 'capturar-servidor.js');
      return res.end(fs.readFileSync(new URL('./' + f, import.meta.url)));
    }
    return res.end('ok');
  }
  const nome = path.basename(new URL(req.url, 'http://x').searchParams.get('nome') || 'captura.json');
  const chunks = []; req.on('data', (c) => chunks.push(c));
  req.on('end', () => { const b = Buffer.concat(chunks); fs.writeFileSync(path.join(OUT, nome), b); console.log('salvo', nome, b.length); res.end('salvo'); });
}).listen(8765, () => console.log('receptor em 8765'));
