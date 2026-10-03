// Um arquivo JSON do dono com HISTÓRICO só de acréscimo: antes de cada gravação a versão anterior vai para `<pasta de versões>/<n>.json`. Compartilhado
// pelos editores de overrides e de regras (a mesma garantia: nada é perdido, restaurar é uma gravação nova). Funções simples; os caminhos entram por
// parâmetro (os testes apontam para uma pasta temporária).
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';

export function criarArquivoVersionado({ caminhos, valorPadrao = () => ({}), serializar = (v) => `${JSON.stringify(v, null, 2)}\n` }) {
  const versoes = () => (existsSync(caminhos.versoes) ? readdirSync(caminhos.versoes).filter((n) => /^\d+\.json$/.test(n)).map((n) => Number(n.slice(0, -5))).sort((a, b) => b - a) : []);
  const ler = () => (existsSync(caminhos.arquivo) ? JSON.parse(readFileSync(caminhos.arquivo, 'utf8')) : valorPadrao());
  function gravar(valor) {
    mkdirSync(dirname(caminhos.arquivo), { recursive: true });
    if (existsSync(caminhos.arquivo)) {
      mkdirSync(caminhos.versoes, { recursive: true });
      writeFileSync(join(caminhos.versoes, `${(versoes()[0] ?? 0) + 1}.json`), readFileSync(caminhos.arquivo, 'utf8'), { flag: 'wx' });
    }
    writeFileSync(caminhos.arquivo, serializar(valor));
  }
  function restaurar(n) {
    const arq = join(caminhos.versoes, `${Number(n)}.json`);
    if (!Number.isInteger(Number(n)) || !existsSync(arq)) return { ok: false, erros: ['Versão não encontrada.'] };
    gravar(JSON.parse(readFileSync(arq, 'utf8')));
    return { ok: true };
  }
  return { ler, gravar, versoes, restaurar };
}
