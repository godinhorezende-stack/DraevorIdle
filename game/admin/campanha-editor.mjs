// O EDITOR DE NÍVEIS DA CAMPANHA: o que `gamedata/campanha.json` guarda por fase e por boss de ato — o level original da hunt, o level ALVO nas 3
// dificuldades e a fase travada (`pular`). É dado de BALANCEAMENTO e de PROGRESSÃO: por isso o fluxo é em quatro tempos — editar (só na tela),
// pré-visualizar (diff + impacto, sem gravar), salvar (grava o arquivo, com cópia da versão anterior) e publicar (commit + deploy; o jogo lê o
// arquivo no boot). A estrutura (quais fases, em que ordem, em que ato) NÃO se edita aqui: isso é dos Acts. A escala (expoentes de vida/dano/exp)
// e as faixas das dificuldades aparecem só para leitura. Funções puras; quem fala HTTP é `conteudo-http.mjs`.
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { CATALOGO } from '../systems/dados.mjs';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..', 'gamedata');
/** Onde ler e gravar (os testes apontam para uma pasta temporária). */
export const CAMINHOS = { arquivo: join(RAIZ, 'campanha.json'), versoes: join(RAIZ, 'campanha-versoes') };
export const DIFICULDADES = ['facil', 'medio', 'dificil'];
const AVISO_DE_VIDA = 0.25; // mudança de vida (multiplicador) acima disto vira aviso de balanceamento

const lerArquivo = () => JSON.parse(readFileSync(CAMINHOS.arquivo, 'utf8'));
const todasAsHunts = () => new Set([...(CATALOGO.hunts ?? []), ...(CATALOGO.vips ?? []), ...(CATALOGO.especiais ?? []), ...(CATALOGO.divinas ?? [])].map((h) => h.id));
const bossesDoCatalogo = () => new Set((CATALOGO.bosses ?? []).map((b) => b.id));

/** O que o editor mostra: fases e bosses editáveis; escala e dificuldades só leitura. */
export function ler() {
  const c = lerArquivo();
  return {
    dificuldades: c.dificuldades,
    escala: c.escala,
    fases: c.fases.map((f, i) => ({ indice: i, huntId: f.huntId, nome: f.nome, ato: f.ato, levelOriginal: f.levelOriginal, nivel: { ...f.nivel }, pular: f.pular === true })),
    bosses: Object.entries(c.bosses).map(([ato, b]) => ({ ato: Number(ato), bossId: b.bossId, nome: b.nome, levelOriginal: b.levelOriginal, nivel: { ...b.nivel } })),
    versoes: versoes().length,
  };
}

const inteiro = (v) => Number.isInteger(v) && v >= 1 && v <= 5000;

/** A multiplicação que o jogo aplica aos bichos: (level alvo ÷ level original) ^ expoente (`Campanha.escala`). */
function escalaDe(c, levelOriginal, alvo) {
  const e = c.escala;
  const r = Math.max(1, alvo) / Math.max(1, levelOriginal);
  const f = (exp) => Math.max(e.minimo ?? 0, Math.pow(r, exp));
  return { vida: f(e.vida), dano: f(e.dano), exp: f(e.exp) };
}

/**
 * Aplica o PROPOSTO (`{ fases: [{huntId, levelOriginal, nivel, pular}], bosses: [{ato, levelOriginal, nivel}] }`) sobre o arquivo atual SEM gravar,
 * só nos campos editáveis, e devolve `{ resultado, erros, avisos, mudancas }`. Erros bloqueiam o salvar; avisos pedem atenção (balanceamento e
 * progressão). Nunca cria nem remove fase: o que não existe no arquivo é erro.
 */
export function propor(proposto) {
  const atual = lerArquivo();
  const novo = structuredClone(atual);
  const erros = [];
  const avisos = [];
  const mudancas = [];
  const hunts = todasAsHunts();
  const bosses = bossesDoCatalogo();

  const porHunt = new Map(novo.fases.map((f) => [f.huntId, f]));
  for (const p of proposto?.fases ?? []) {
    const f = porHunt.get(p.huntId);
    const onde = `fase ${p.huntId}`;
    if (!f) { erros.push(`${onde}: não é uma fase da campanha (a estrutura da campanha se edita em Acts).`); continue; }
    if (p.levelOriginal !== undefined) {
      if (!inteiro(p.levelOriginal)) erros.push(`${onde}: level original precisa ser um inteiro de 1 a 5000.`);
      else f.levelOriginal = p.levelOriginal;
    }
    for (const d of DIFICULDADES) {
      if (p.nivel?.[d] === undefined) continue;
      if (!inteiro(p.nivel[d])) erros.push(`${onde}: level alvo (${d}) precisa ser um inteiro de 1 a 5000.`);
      else f.nivel[d] = p.nivel[d];
    }
    if (p.pular !== undefined) {
      if (typeof p.pular !== 'boolean') erros.push(`${onde}: "travada" precisa ser verdadeiro ou falso.`);
      else if (p.pular) f.pular = true;
      else delete f.pular;
    }
  }
  const bossPorAto = (ato) => novo.bosses[String(ato)];
  for (const p of proposto?.bosses ?? []) {
    const b = bossPorAto(p.ato);
    const onde = `boss do Ato ${p.ato}`;
    if (!b) { erros.push(`${onde}: não existe na campanha.`); continue; }
    if (p.levelOriginal !== undefined) { if (!inteiro(p.levelOriginal)) erros.push(`${onde}: level original inválido.`); else b.levelOriginal = p.levelOriginal; }
    for (const d of DIFICULDADES) {
      if (p.nivel?.[d] === undefined) continue;
      if (!inteiro(p.nivel[d])) erros.push(`${onde}: level alvo (${d}) inválido.`); else b.nivel[d] = p.nivel[d];
    }
  }

  // ---- integridade do resultado
  for (const f of novo.fases) {
    const onde = `fase ${f.huntId}`;
    if (!hunts.has(f.huntId)) erros.push(`${onde}: a hunt não existe no cadastro.`);
    if (!(f.nivel.facil <= f.nivel.medio && f.nivel.medio <= f.nivel.dificil)) erros.push(`${onde}: os levels alvo precisam crescer do Normal ao Cruel ao Merciless (${f.nivel.facil} / ${f.nivel.medio} / ${f.nivel.dificil}).`);
    for (const d of DIFICULDADES) {
      const [min, max] = novo.dificuldades[d].faixa;
      if (f.nivel[d] < min || f.nivel[d] > max) avisos.push(`${onde}: o level alvo ${f.nivel[d]} no ${novo.dificuldades[d].nome} está fora da faixa da dificuldade (${min}–${max}).`);
    }
  }
  for (const [ato, b] of Object.entries(novo.bosses)) {
    if (!bosses.has(b.bossId)) erros.push(`boss do Ato ${ato}: "${b.bossId}" não existe no cadastro.`);
    if (!(b.nivel.facil <= b.nivel.medio && b.nivel.medio <= b.nivel.dificil)) erros.push(`boss do Ato ${ato}: os levels alvo precisam crescer entre as dificuldades.`);
  }
  // A "escada" do ato: o level alvo não deveria cair de uma fase para a seguinte (ignora fases travadas).
  for (const d of DIFICULDADES) {
    for (const ato of new Set(novo.fases.map((f) => f.ato))) {
      const doAto = novo.fases.filter((f) => f.ato === ato && !f.pular);
      for (let i = 1; i < doAto.length; i++) if (doAto[i].nivel[d] < doAto[i - 1].nivel[d]) avisos.push(`Ato ${ato}, ${novo.dificuldades[d].nome}: ${doAto[i].nome} (${doAto[i].nivel[d]}) tem level alvo MENOR que ${doAto[i - 1].nome} (${doAto[i - 1].nivel[d]}) — a escada do ato desce.`);
    }
  }

  // ---- o que mudou e o impacto
  const iguais = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  atual.fases.forEach((fa, i) => {
    const fb = novo.fases[i];
    if (iguais(fa, fb)) return;
    const impacto = Object.fromEntries(DIFICULDADES.map((d) => {
      const antes = escalaDe(atual, fa.levelOriginal, fa.nivel[d]);
      const depois = escalaDe(novo, fb.levelOriginal, fb.nivel[d]);
      return [d, { vida: { antes: Number(antes.vida.toFixed(3)), depois: Number(depois.vida.toFixed(3)), variacaoPct: Math.round((depois.vida / antes.vida - 1) * 100) }, dano: { antes: Number(antes.dano.toFixed(3)), depois: Number(depois.dano.toFixed(3)), variacaoPct: Math.round((depois.dano / antes.dano - 1) * 100) }, exp: { antes: Number(antes.exp.toFixed(3)), depois: Number(depois.exp.toFixed(3)), variacaoPct: Math.round((depois.exp / antes.exp - 1) * 100) } }];
    }));
    mudancas.push({ tipo: 'fase', huntId: fa.huntId, nome: fa.nome, antes: { levelOriginal: fa.levelOriginal, nivel: fa.nivel, pular: fa.pular === true }, depois: { levelOriginal: fb.levelOriginal, nivel: fb.nivel, pular: fb.pular === true }, impacto });
    for (const d of DIFICULDADES) if (Math.abs(impacto[d].vida.variacaoPct) >= AVISO_DE_VIDA * 100) avisos.push(`BALANCEAMENTO — ${fa.nome} no ${novo.dificuldades[d].nome}: a vida dos bichos muda ${impacto[d].vida.variacaoPct > 0 ? '+' : ''}${impacto[d].vida.variacaoPct}% (o dano ${impacto[d].dano.variacaoPct > 0 ? '+' : ''}${impacto[d].dano.variacaoPct}%, a exp ${impacto[d].exp.variacaoPct > 0 ? '+' : ''}${impacto[d].exp.variacaoPct}%).`);
    if (!!fa.pular !== !!fb.pular) avisos.push(`PROGRESSÃO — ${fa.nome}: ${fb.pular ? 'fica TRAVADA (ninguém entra e ela conta como completa sozinha: a cadeia do ato passa por cima dela)' : 'é DESTRAVADA (passa a exigir limpeza para liberar a seguinte)'} — quem já progrediu é afetado.`);
  });
  for (const [ato, ba] of Object.entries(atual.bosses)) {
    const bb = novo.bosses[ato];
    if (iguais(ba, bb)) continue;
    mudancas.push({ tipo: 'boss', ato: Number(ato), nome: ba.nome, antes: { levelOriginal: ba.levelOriginal, nivel: ba.nivel }, depois: { levelOriginal: bb.levelOriginal, nivel: bb.nivel } });
    avisos.push(`BALANCEAMENTO — boss do Ato ${ato} (${ba.nome}): os levels alvo mudam (afeta vida, dano e exp do boss e o item level do loot dele).`);
  }
  return { resultado: novo, erros, avisos, mudancas, semMudancas: mudancas.length === 0 };
}

// ------------------------------------------------------------------ versões (cópia só de acréscimo ANTES de cada gravação)

export function versoes() {
  if (!existsSync(CAMINHOS.versoes)) return [];
  return readdirSync(CAMINHOS.versoes).filter((n) => /^\d+\.json$/.test(n)).map((n) => Number(n.slice(0, -5))).sort((a, b) => b - a);
}
const lerVersao = (n) => (existsSync(join(CAMINHOS.versoes, `${n}.json`)) ? JSON.parse(readFileSync(join(CAMINHOS.versoes, `${n}.json`), 'utf8')) : null);

/** Grava o proposto. Recusa com erros; guarda a versão anterior; preserva todo o resto do arquivo (notas, escala, dificuldades). */
export function salvar(proposto) {
  const r = propor(proposto);
  if (r.erros.length) return { ok: false, erros: r.erros };
  if (r.semMudancas) return { ok: true, semMudancas: true, avisos: [] };
  mkdirSync(CAMINHOS.versoes, { recursive: true });
  const proxima = (versoes()[0] ?? 0) + 1;
  writeFileSync(join(CAMINHOS.versoes, `${proxima}.json`), readFileSync(CAMINHOS.arquivo, 'utf8'), { flag: 'wx' });
  writeFileSync(CAMINHOS.arquivo, `${JSON.stringify(r.resultado, null, 1)}\n`);
  return { ok: true, versaoAnterior: proxima, avisos: r.avisos, mudancas: r.mudancas, comoPublicar: 'O arquivo gamedata/campanha.json foi gravado neste servidor. O jogo só lê a campanha no boot: faça commit e publique pelo deploy (reinício controlado). Nada muda no jogo antes disso.' };
}

/** Restaura uma versão anterior (grava o conteúdo dela como a atual, guardando a atual antes). */
export function restaurar(n) {
  const v = lerVersao(Number(n));
  if (!v) return { ok: false, erros: ['Versão não encontrada.'] };
  mkdirSync(CAMINHOS.versoes, { recursive: true });
  const proxima = (versoes()[0] ?? 0) + 1;
  writeFileSync(join(CAMINHOS.versoes, `${proxima}.json`), readFileSync(CAMINHOS.arquivo, 'utf8'), { flag: 'wx' });
  writeFileSync(CAMINHOS.arquivo, `${JSON.stringify(v, null, 1)}\n`);
  return { ok: true, versaoAnterior: proxima };
}

/** Onde a fase é usada (para a tela dizer o que a mudança toca): ato legado, atos do editor que a usam e encontros. */
export function usosDaFase(huntId) {
  const c = lerArquivo();
  const f = c.fases.find((x) => x.huntId === huntId);
  return f ? { ato: f.ato, posicaoNoAto: c.fases.filter((x) => x.ato === f.ato).findIndex((x) => x.huntId === huntId) + 1, totalNoAto: c.fases.filter((x) => x.ato === f.ato).length } : null;
}
