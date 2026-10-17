// LOTE 63 — as RAMIFICADORAS, o passo 2 (o servidor): os NÓS que a joia cria (`passivas/ramificadoras.montar`), como o Path of Building
// (`PassiveSpec:BuildSubgraph`, os ids do PoE): os encaixes, os notáveis (na ordem do PoB, com as regras da Média) e as pequenas nos índices do
// molde; a posição pelo centro do grupo do proxy, a órbita do tamanho e o deslocamento do proxy (os encaixes caem EXATAMENTE nos encaixes
// internos da árvore); o anel (aberto na Pequena) e a entrada no encaixe; a joia menor no encaixe interno; os efeitos das pequenas (o
// encantamento + os "também concedem", × o "Efeito aumentado", truncado como no PoB) e dos notáveis; e o relatório conta as linhas dos nós.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';

process.env.ITENS_POE = '1';
const Catalogo = await import('../systems/itens-poe/catalogo.mjs');
const SEM = (!existsSync(Catalogo.ARQUIVO) || !Catalogo.ligado()) && 'só no modo PoE, com o catálogo do PoE';
const P = await import('../systems/passivas/arvore.mjs');
const N = await import('../systems/passivas/ramificadoras.mjs');
await (await import('../systems/itens-poe/iniciar.mjs')).iniciarJogoDoPoe();

const D = () => Catalogo.catalogo().ramificadoras;
const enc = (tamanho, i = 0) => D().tamanhos[tamanho].encantamentos[i];
/** Uma peça montada à mão: o tamanho, o encantamento, quantos nós e encaixes, os notáveis (chaves) e os mods a mais (`{ modelo, valores }`). */
function joia(tamanho, { e = enc(tamanho), nos, encaixes = 0, notaveis = [], mods = [] }) {
  const notavel = (n) => ({ id: D().mods.find((m) => m.notavel === n).id, notavel: n, modelo: `{0} das Habilidades Passivas Adicionadas é ${D().notaveis[n].nome}`, valores: [1] });
  return {
    base: `Jewels/${tamanho}_Cluster_Jewel`, raridade: 'raro', ramificadora: { tamanho, encantamento: e.id, tag: e.tag },
    implicitos: [{ modelo: 'Adiciona {0} Habilidades Passivas', valores: [nos] }, ...(encaixes ? [{ modelo: '{0} das Habilidades Passivas adicionadas são Encaixes de Joia', valores: [encaixes] }] : [])],
    prefixos: notaveis.map(notavel), sufixos: mods,
  };
}
const montar = (encaixe, poe, joiaNoEncaixe) => N.montar({ dados: D(), arvore: P.arvore(), encaixe: P.arvore().porId.get(encaixe), poe, joiaNoEncaixe });
const porIndice = (r) => Object.fromEntries(r.nos.filter((n) => n.ramificadora.encaixe === r.encaixe).map((n) => [n.ramificadora.indice, n]));

test('a GRANDE no encaixe 2491: os ids do PoE, os encaixes nos encaixes internos da árvore, o anel fechado e a entrada no encaixe', { skip: SEM }, () => {
  const ordem = Object.entries(D().notaveis).filter(([, n]) => n.ordem != null).sort((a, b) => a[1].ordem - b[1].ordem);
  const [a, b] = [ordem[40][0], ordem[10][0]];
  const r = montar('2491', joia('Large', { nos: 8, encaixes: 2, notaveis: [a, b] }));
  assert.equal(r.nos.length, 8);
  assert.equal(r.entrada, String(0x10000 + (3 << 6) + (2 << 4) + 0), 'o id: 0x10000 + o índice do encaixe Grande × 64 + o tamanho × 16 + o índice do nó');
  const x = porIndice(r);
  // os encaixes (o molde da Grande: 4 e 8) são os encaixes internos 10532 e 46519 — na posição deles na árvore
  assert.equal(x[4].id, '10532');
  assert.equal(x[8].id, '46519');
  for (const n of [x[4], x[8]]) {
    const t = P.arvore().porId.get(n.id);
    assert.ok(Math.abs(n.x - t.x) <= 1 && Math.abs(n.y - t.y) <= 1, `${n.id}: (${n.x}, ${n.y}) × árvore (${t.x}, ${t.y})`);
  }
  // os notáveis nos índices livres do molde (6, 10…), na ORDEM do PoB: o de ordem menor primeiro
  assert.equal(x[6].tipo, 'notable');
  assert.equal(x[6].nome, D().notaveis[b].nome);
  assert.equal(x[10].nome, D().notaveis[a].nome);
  // o anel: cada nó liga ao vizinho de índice; o último volta ao primeiro; a entrada liga ao encaixe
  assert.ok(x[0].conexoes.includes('2491'));
  assert.ok(x[0].conexoes.includes(x[10].id), 'o anel fecha na Grande');
  assert.equal(r.nos.filter((n) => n.tipo === 'small' && !n.encaixeInterno).length, 4);
  // a Grande com 1 encaixe: o índice 6 (o encaixe interno 23756, no meio)
  const um = porIndice(montar('2491', joia('Large', { nos: 8, encaixes: 1 })));
  assert.equal(um[6].id, '23756');
  const t = P.arvore().porId.get('23756');
  assert.ok(Math.abs(um[6].x - t.x) <= 1 && Math.abs(um[6].y - t.y) <= 1);
});

test('a MÉDIA de 4 nós com 2 notáveis (as regras do PoB) e a PEQUENA (o anel aberto); a joia maior que o encaixe não monta', { skip: SEM }, () => {
  const nomes = Object.keys(D().notaveis).slice(0, 2);
  const media = porIndice(montar('2491', joia('Medium', { nos: 4, encaixes: 1, notaveis: nomes })));
  // o molde da Média: encaixe no 6; com 4 nós os notáveis vão para 3 e 9; a pequena no 0
  assert.deepEqual(Object.keys(media).map(Number).sort((a, b) => a - b), [0, 3, 6, 9]);
  assert.equal(media[6].encaixeInterno, true);
  assert.equal(media[3].tipo, 'notable');
  assert.equal(media[9].tipo, 'notable');
  const r = montar('2491', joia('Small', { nos: 3 }));
  assert.equal(r.nos.length, 3);
  const x = porIndice(r);
  assert.ok(!x[0].conexoes.includes(r.nos[r.nos.length - 1].id), 'a Pequena não fecha o anel');
  // a Grande não cabe num encaixe Médio (o encaixe interno 10532)
  assert.equal(montar('10532', joia('Large', { nos: 8, encaixes: 2 })), null);
});

test('a joia MENOR no encaixe interno: monta a partir dele, com o id seguindo o da Grande', { skip: SEM }, () => {
  const grande = joia('Large', { nos: 8, encaixes: 2 });
  const media = joia('Medium', { nos: 5, encaixes: 1 });
  const r = montar('2491', grande, (id) => (id === '10532' ? { poe: media } : null));
  const dentro = r.nos.filter((n) => n.ramificadora.encaixe === '10532');
  assert.equal(dentro.length, 5);
  const entrada = dentro.find((n) => n.ramificadora.indice === 0);
  assert.equal(entrada.id, String(0x10000 + (3 << 6) + (0 << 9) + (1 << 4)), 'o id da Média no encaixe interno 0 da Grande do encaixe 3');
  assert.ok(entrada.conexoes.includes('10532'));
  assert.ok(r.nos.find((n) => n.id === '10532').conexoes.includes(entrada.id));
  assert.equal(new Set(r.nos.map((n) => n.id)).size, r.nos.length, 'nenhum id repetido');
});

test('os EFEITOS: a pequena concede o encantamento e os "também concedem" × o "Efeito aumentado" (truncado como no PoB); o notável, os dele', { skip: SEM }, () => {
  assert.equal(N.comEfeito('Dano de Raio aumentado em 12%', 35), 'Dano de Raio aumentado em 16%');
  assert.equal(N.comEfeito('+4% de Resistência a Caos', 25), '+5% de Resistência a Caos');
  assert.equal(N.comEfeito('Regenera 0.2% de Vida por Segundo', 35), 'Regenera 0.2% de Vida por Segundo');
  const raio = D().tamanhos.Large.encantamentos.find((e) => e.tag === 'affliction_lightning_damage');
  const p = joia('Large', { e: raio, nos: 8, encaixes: 2, mods: [
    { id: 'x', modelo: 'Habilidades Passivas adicionadas também concedem: +{0}% de Resistência a Caos', valores: [4] },
    { id: 'y', modelo: 'Pequenas Habilidades Passivas adicionadas possuem Efeito aumentado em {0}%', valores: [25] },
  ] });
  const pequena = montar('2491', p).nos.find((n) => n.tipo === 'small' && !n.encaixeInterno);
  assert.deepEqual(pequena.textos, ['Dano de Raio aumentado em 15%', '+5% de Resistência a Caos']);
  assert.ok(pequena.efeitos.some((e) => e.add === 'energy_dmg' && e.valor === 15), JSON.stringify(pequena.efeitos));
  assert.ok(pequena.efeitos.some((e) => e.add === 'chaos_res' && e.valor === 5));
  assert.equal(pequena.nome, raio.nome);
  const [chave, n] = Object.entries(D().notaveis).find(([, x]) => x.linhas.length === 1);
  const no = montar('2491', joia('Large', { nos: 8, encaixes: 2, notaveis: [chave] })).nos.find((x) => x.tipo === 'notable');
  assert.deepEqual(no.textos.slice(0, 1), n.linhas);
});

test('o RELATÓRIO conta as linhas dos nós das Ramificadoras (o encantamento, os "também concedem", os notáveis)', { skip: SEM }, async () => {
  const { linhasDasRamificadoras } = await import('../tools/relatorio-arvore-poe.mjs');
  const { grupos, sem } = await linhasDasRamificadoras(Catalogo.catalogo());
  assert.ok(grupos.encantamento.total >= 50 && grupos.tambem.total >= 150 && grupos.notavel.total >= 600, JSON.stringify(grupos));
  assert.equal(sem.length, grupos.encantamento.sem + grupos.tambem.sem + grupos.notavel.sem);
});
