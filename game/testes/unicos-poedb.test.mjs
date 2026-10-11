// OS ÚNICOS DO JOGO × POEDB (dono, 11/10: "extraia todas as abas de poedb.tw/pt/Unique_item, verifique se tem no jogo, os atributos
// implícitos e únicos e se o sorteio funciona"). Os dados do poedb estão no repositório (gamedata/itens-poe/poedb-unicos.json, de
// tools/auditar-unicos-poedb.mjs); aqui: todo único do poedb que está no jogo tem as MESMAS linhas (implícitas e explícitas, com as faixas),
// e o sorteio de cada um cai dentro das faixas. O relatório completo é docs/auditoria-unicos-poedb.md.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as Catalogo from '../systems/itens-poe/catalogo.mjs';
import { gerarPeca } from '../systems/itens-poe/gerar.mjs';
import { canonico, interna, lembrete, marcador } from '../systems/itens-poe/comparar-unicos.mjs';
import { soNoOficial } from './apoio-migracao.mjs';

const SKIP = { skip: soNoOficial('os únicos são do PoE') };
const POEDB = JSON.parse(readFileSync(new URL('../gamedata/itens-poe/poedb-unicos.json', import.meta.url), 'utf8'));

function doJogo() {
  const mapa = new Map();
  for (const [id, c] of Object.entries(Catalogo.catalogo().classes)) for (const u of c.unicos ?? []) if (!mapa.has(u.slug)) mapa.set(u.slug, { u, classe: id, bases: c.bases });
  return mapa;
}

test('todo único do poedb que está no jogo tem as mesmas linhas, com as mesmas faixas (fora os de fora da comparação)', SKIP, () => {
  const jogo = doJogo();
  const fora = new Set(POEDB.foraDaComparacao.unicos);
  const classesFora = new Set(POEDB.foraDaComparacao.classes);
  const erros = [];
  let conferidos = 0;
  for (const [slug, p] of Object.entries(POEDB.unicos)) {
    const j = jogo.get(slug);
    if (!j || fora.has(slug) || classesFora.has(j.classe)) continue;
    conferidos++;
    const sobra = j.u.modificadores.filter((m) => !lembrete(m.texto) && !interna(m.texto) && !marcador(m.texto));
    for (const l of p.linhas) {
      const i = sobra.findIndex((m) => canonico(m.texto) === canonico(l.texto));
      if (i >= 0) {
        if (sobra[i].tipo !== l.tipo) erros.push(`${slug}: "${l.texto}" é ${l.tipo} no poedb e ${sobra[i].tipo} no jogo`);
        sobra.splice(i, 1);
      } else if (!lembrete(l.texto)) erros.push(`${slug}: falta "${l.texto}"`);
    }
    for (const m of sobra) erros.push(`${slug}: a mais "${m.texto}"`);
  }
  assert.ok(conferidos > 1000, `únicos conferidos: ${conferidos}`);
  assert.deepEqual(erros.slice(0, 20), [], `${erros.length} diferenças`);
});

test('o sorteio de cada único cai dentro das faixas, com todas as linhas', SKIP, () => {
  const cat = Catalogo.catalogo();
  let semente = 11;
  const rng = () => ((semente = (semente * 1664525 + 1013904223) >>> 0) / 4294967296);
  let n = 0;
  for (const { u, classe, bases } of doJogo().values()) {
    const base = bases.find((b) => b.nome === u.base);
    if (!base || classe === 'Maps') continue;
    // (Dono, 11/10 — a premissa mudou com a regra do PoE: a linha de implícito que a regra do único TROCA — a Força da Corda da Servidão, o
    // "[One to three…]" do Nebulis — sai da peça e vira implícito sorteado; e o valor conferido na faixa é o de ANTES da magnitude dos
    // implícitos do único, `valoresSemMagnitude` — a Réplica: Nebulis mostra 64–88% no "Dano Elemental 40%".)
    const s = u.implicitosSorteados;
    const cadastro = u.modificadores.filter((m) => !(s && m.tipo === 'implicit' && m.modelo === s.substitui));
    for (let k = 0; k < 8; k++) {
      const g = gerarPeca({ catalogo: cat, regras: Catalogo.REGRAS, base: base.id, raridade: 'unico', ilvl: 84, rng, unico: u.slug });
      assert.ok(!g.erro, `${u.slug}: ${g.erro}`);
      assert.equal(g.modificadores.length, cadastro.length, u.slug);
      g.modificadores.forEach((m, i) =>
        (cadastro[i].faixas ?? []).forEach((f, x) => {
          const v = (m.valoresSemMagnitude ?? m.valores)[x];
          assert.ok(v >= Math.min(...f) && v <= Math.max(...f), `${u.slug}: ${m.texto}`);
        })
      );
    }
    n++;
  }
  assert.ok(n > 1100, `únicos sorteados: ${n}`);
});

test('os corrigidos pelo poedb: a versão atual (Remorso de Lioneye 40%, Emblema do Precursor em português) e a Réplica: Ensinamentos de Maata', SKIP, () => {
  const jogo = doJogo();
  const lioneye = jogo.get('Lioneyes_Remorse').u;
  assert.ok(lioneye.modificadores.some((m) => m.texto === 'Recuperação de Atordoamentos e Bloqueios aumentada em 40%'));
  const precursor = jogo.get('Precursors_Emblem').u;
  assert.ok(precursor.modificadores.every((m) => !/[а-я]/i.test(m.texto)), 'sem texto em russo');
  assert.ok(precursor.modificadores.some((m) => m.texto === '+20 de Inteligência'));
  const maata = jogo.get('Replica_Maatas_Teaching');
  assert.equal(maata?.u.base, 'Cetro Karui');
  for (const slug of ['The_Unblinking_Eye', 'Unholy_Accomplice']) assert.ok(jogo.get(slug).u.base && jogo.get(slug).u.modificadores.length > 3, `${slug} tem base e linhas`);
});
