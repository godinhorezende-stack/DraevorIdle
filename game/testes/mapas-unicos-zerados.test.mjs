// (08/11 — o dono: "sim" a zerar as 67 linhas sem efeito dos mapas únicos) Cada mecânica nova dos 26 mapas únicos, entrando de verdade pelo
// Dispositivo: o nível da área, os habitantes e os solos, os Mortos Inquietos, as Relíquias sem monstros, as ondas do Julgamento do Covarde, a
// Síntese do Córtex, os Braços de Doryani, os Grão-Mestres e as cartas de adivinhação (a troca na Zuma e o Baralho Empilhado).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import * as Catalogo from '../systems/itens-poe/catalogo.mjs';

const SEM = (!existsSync(Catalogo.ARQUIVO) || !Catalogo.ligado()) && 'só no jogo oficial (PoE)';
const { personagemDeTeste } = await import('./apoio.mjs');
const Cacadas = await import('../systems/cacadas.mjs');
const Dispositivo = await import('../systems/mapas-dispositivo.mjs');
const Mapas = await import('../systems/itens-poe/mapas.mjs');
const Jogo = await import('../systems/itens-poe/jogo.mjs');
const Bolsa = await import('../systems/bolsa.mjs');
const Instancia = await import('../systems/hunt/instancia.mjs');
const Encontros = await import('../systems/encontros/estado.mjs');
const V = await import('../systems/itens-poe/mapas-validacao.mjs');
const Cartas = await import('../systems/itens-poe/cartas.mjs');
const Moedas = await import('../systems/itens-poe/moedas.mjs');
const GemasDeSkill = await import('../systems/skills/gemas.mjs');
const Doryani = await import('../systems/itens-poe/doryani.mjs');
const SinteseMapas = await import('../systems/itens-poe/sintese-mapas.mjs');
const { gerarPeca } = await import('../systems/itens-poe/gerar.mjs');

function personagem() {
  const e = personagemDeTeste({ vocacao: 'knight', level: 90 });
  e.equipment = { ...(e.equipment ?? {}), weapon: Jogo.pecaDoJogo(gerarPeca({ catalogo: Catalogo.catalogo(), regras: Catalogo.REGRAS, base: 'Two_Hand_Axes/Vaal_Axe', raridade: 'normal', ilvl: 64, rng: () => 0.5 })) };
  e.hp = e.maxHp = 1e9;
  for (const d of Object.keys(e.campanha)) e.campanha[d].bosses = Array.from({ length: 10 }, (_, i) => i + 1);
  Bolsa.garantir(e);
  return e;
}
const unico = (slug, tier = 10) => Jogo.pecaDoJogo(gerarPeca({ catalogo: Catalogo.catalogo(), regras: Catalogo.REGRAS, base: Mapas.baseDoTier(tier), raridade: 'unico', ilvl: Mapas.nivelDoTier(tier), rng: Math.random, unico: slug }));
function abrir(slug, tier = 10) {
  const e = personagem();
  const p = unico(slug, tier);
  e.inventory.push(p);
  const m = Dispositivo.mapasCarregados(e).find((x) => x.peca === p);
  const r = Dispositivo.abrir(e, { onde: m.onde, indice: m.indice, assinatura: m.assinatura, mode: 'auto' });
  assert.ok(r.ok, r.erro);
  return { e, p, inst: Instancia.daSala(e.hunt), monstros: [...e.hunt.monstros, ...Object.values(e.hunt.outrosAndares ?? {}).flat()] };
}

test('as linhas dos 26 mapas únicos: nenhuma sem efeito, nenhuma com erro', { skip: SEM }, () => {
  const r = V.validarTudo();
  assert.deepEqual(r.resumo.unicos, { funciona: r.unicos.flatMap((u) => u.linhas).length, parcial: 0, inexiste: 0, erro: 0 });
  assert.deepEqual(r.resumo.unicosSemEfeito, []);
});

test('o nível da área: o Córtex é 83 em qualquer tier, e os monstros sobem pela diferença', { skip: SEM }, () => {
  const { e, monstros } = abrir('Cortex', 5);
  assert.equal(e.hunt.mapa.nivel, 83);
  assert.equal(e.hunt.mapa.efeitos.monstros.nivelDelta, 83 - Mapas.nivelDoTier(5));
  assert.ok(monstros.filter((m) => !m.chefeDoMapa).every((m) => m.nivelPoe === 83), 'o nível dos monstros vale no drop');
});

test('o Pesadelo de Acton: os Esqueletos, os trechos de Solo Ardente, os Mortos Inquietos e o terreno do Labirinto', { skip: SEM }, () => {
  const { e, inst, monstros } = abrir('Actons_Nightmare');
  assert.match(e.hunt.huntId, /-labirinto$/);
  const comuns = monstros.filter((m) => !m.chefeDoMapa);
  assert.ok(comuns.length > 0 && comuns.every((m) => m.ressurgirMs === 10_000), 'os mortos-vivos se levantam em 10 s');
  assert.ok(inst.solosDoMapa?.length > 0 && inst.solosDoMapa.every((s) => s.tipo === 'ardente' && s.dps > 0));
  // morto, ele espera e volta com a vida cheia (uma vez) — e conta na limpeza enquanto espera
  const m = e.hunt.monstros.find((x) => !x.chefeDoMapa);
  const antes = Instancia.pendentes(e.hunt);
  assert.ok(Instancia.guardarParaRessurgir(e.hunt, m, 0));
  e.hunt.monstros.splice(e.hunt.monstros.indexOf(m), 1);
  assert.equal(Instancia.pendentes(e.hunt), antes);
  assert.deepEqual(Instancia.liberarRessurgidos(e.hunt, 5_000), []);
  assert.deepEqual(Instancia.liberarRessurgidos(e.hunt, 10_000), [m]);
  assert.equal(m.hp, m.maxHp);
  assert.equal(m.ressurgiu, true);
});

test('as Relíquias de Atziri: nenhum monstro, um baú onde nasceria cada grupo, e só conclui com todos abertos', { skip: SEM }, () => {
  const { inst, monstros } = abrir('Vaults_of_Atziri');
  assert.equal(monstros.length, 0);
  assert.ok(Object.values(inst.encontros).filter((x) => x.defId === 'bau-poe').length > 3);
});

test('o Julgamento do Covarde: a área são as ondas (sem grupos nem chefe), a sobrevivência obrigatória perto da entrada', { skip: SEM }, () => {
  const { e, inst, monstros } = abrir('The_Cowards_Trial');
  assert.equal(monstros.length, 0);
  const o = inst.encontros['ondas-do-mapa'];
  assert.equal(o.tipo, 'sobrevivencia');
  assert.equal(o.obrigatorio, true);
  assert.equal(o.ondas.length, 10);
  assert.ok(Math.max(Math.abs(o.x - e.hunt.pos.x), Math.abs(o.y - e.hunt.pos.y)) <= 9);
});

test('o Córtex: os mods de mapa a mais e os Synthesis Globais nascem com a peça e agem no resumo', { skip: SEM }, () => {
  const p = unico('Replica_Cortex', 12);
  const extras = Mapas.extrasDoUnico(p.poe);
  assert.ok(extras.aleatorios >= 6 && extras.globais >= 4);
  assert.equal([...p.poe.prefixos, ...p.poe.sufixos].length, extras.aleatorios);
  const globais = p.poe.modificadores.filter((m) => m.sintese === 'global');
  assert.equal(globais.length, extras.globais);
  assert.ok(p.poe.mapa.linhas.every((l) => l.estado !== 'inerte'));
  assert.ok(p.poe.mapa.efeitos.sintese && Object.keys(p.poe.mapa.efeitos.sintese).length > 0);
  // fora do sorteio: o que pede item que o jogo não tem
  assert.ok(SinteseMapas.sorteaveis().every((g) => !g.semItem));
});

test('o Maquinário de Doryani: três Braços; a escolha amplia o chefe e decide a base da Ilusão de Doryani', { skip: SEM }, () => {
  const { e, inst, monstros } = abrir('Doryanis_Machinarium');
  const bracos = Object.values(inst.encontros).filter((x) => x.tipo === Doryani.TIPO);
  assert.equal(bracos.length, 3);
  assert.ok(Instancia.encontrosVisiveis(inst).filter((x) => x.escolhas?.length === 3).length === 3);
  bracos.forEach((b, i) => { b.escolha = ['ice', 'ice', 'fire'][i]; });
  for (const b of bracos) assert.ok(Encontros.ativar(inst, b.id, { hunt: e.hunt, estado: e, agora: 0 }).ok);
  const chefe = monstros.find((m) => m.chefeDoMapa);
  assert.equal(chefe.danoExtraPct.ice, 2 * Doryani.DANO_POR_BRACO);
  assert.equal(chefe.danoExtraPct.fire, Doryani.DANO_POR_BRACO);
  assert.equal(chefe.rarosExtras, 3);
  assert.equal(Doryani.elementoDaIlusao(Doryani.escolhas(inst)), 'ice');
  assert.equal(Jogo.unicoNaBase('Doryanis_Delusion', Doryani.ELEMENTOS.ice.base, 80).poe.unico, 'Doryanis_Delusion');
});

test('o Salão dos Grão-Mestres: os personagens do ranking (sem nenhum, quem abriu) viram Únicos com a vida e o nome deles', { skip: SEM }, () => {
  const { e, monstros } = abrir('Hall_of_Grandmasters');
  assert.ok(monstros.length >= 1);
  assert.ok(monstros.every((m) => m.graoMestre && m.raridade === 'unico' && /Grão-Mestre$/.test(m.name)));
  assert.ok(!monstros.some((m) => m.chefeDoMapa));
  assert.ok(e.hunt.mapa.efeitos.instancia.graoMestres);
});

test('as cartas de adivinhação: o sorteio pelo peso, a troca da pilha na Zuma e o Baralho Empilhado', { skip: SEM }, () => {
  assert.ok(Cartas.NO_JOGO.length > 300);
  const c = Cartas.NO_JOGO.find((x) => x.recompensa.tipo === 'moeda' && x.recompensa.slug);
  const e = personagem();
  e.inventory = [{ id: c.id, count: c.pilha - 1 }];
  assert.equal(GemasDeSkill.comprarNaLoja(e, { id: c.id }).ok, false, 'falta uma');
  e.inventory = [{ id: c.id, count: c.pilha }];
  assert.ok(Moedas.linhasDaLoja(e).some((l) => l.categoria === 'cartas' && l.troca.pronta));
  const r = GemasDeSkill.comprarNaLoja(e, { id: c.id });
  assert.ok(r.ok, r.erro);
  assert.ok(!e.inventory.some((x) => x.id === c.id), 'a pilha saiu');
  assert.ok(e.inventory.some((x) => Number(x.id) === Moedas.idDa(c.recompensa.slug)), 'a moeda entrou');
  // o Baralho Empilhado tem efeito (uma carta)
  assert.equal(Moedas.STATUS.Stacked_Deck.status, 'funciona');
  // a carta cara sai muito menos que a barata
  const doutor = Cartas.CARTAS.find((x) => x.slug === 'The_Doctor');
  const barata = Cartas.CARTAS.find((x) => x.slug === 'Three_Faces_in_the_Dark');
  assert.ok(doutor.peso * 100 < barata.peso);
});
