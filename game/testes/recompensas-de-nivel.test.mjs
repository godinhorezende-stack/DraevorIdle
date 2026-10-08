// Auditoria das recompensas de nível (baú 50 e 100, montaria 120, outfit 130 — a trilha das armas de treino, 8–50 e a boosted do
// 150, saiu com o treino, dono 06/10): desbloqueio, resgate, ENTREGA de verdade (no sistema de Aparência, para a
// montaria e o outfit), duas recompensas no mesmo level, persistência, resgate repetido, falha na
// entrega e personagens que já tinham resgatado antes da correção.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as Recompensas from '../systems/recompensas.mjs';
import * as Aparencia from '../systems/aparencia.mjs';
import { MONTARIAS_REAIS } from '../systems/dados.mjs';
import { personagemDeTeste } from './apoio.mjs';
import { doClassico } from './apoio-migracao.mjs';

const GORGON = MONTARIAS_REAIS.mounts.find((m) => m.name === 'Gorgon Hydra');
const BLADE = MONTARIAS_REAIS.outfits.filter((o) => o.name === 'Blade Dancer').map((o) => o.look);

const novo = (level = 150, gold = 10_000_000) => {
  const e = personagemDeTeste({ vocacao: 'knight', level });
  e.gold = gold;
  return e;
};
// `abrirProximas` dá o id às recompensas (personagem novo ou salvo antes do id existir).
const porId = (e, id) => {
  if ([...e.presentes.degraus, ...e.presentes.marcos].some((r) => !r.id)) Recompensas.abrirProximas(e);
  return [...e.presentes.degraus, ...e.presentes.marcos].find((r) => r.id === id);
};
/** Resgata uma recompensa pelo id, do jeito que a tela manda. */
function resgatar(e, id) {
  const r = porId(e, id);
  assert.ok(r, `recompensa ${id} existe`);
  if (e.presentes.degraus.includes(r)) {
    const lista = r.boosted ? e.presentes.escolhasBoosted : e.presentes.escolhas;
    return Recompensas.coletarPresente(e, { itemId: lista[0].itemId, id });
  }
  return Recompensas.coletarMarco(e, { id });
}
const FILA = ['bau-50', 'bau-100', 'montaria-120', 'outfit-130'];

test('cadastro: as 4 recompensas (sem a trilha de treino), cada uma com um ID único', { skip: doClassico("As 4 recompensas de nível do Draevor (montaria, outfit, baús); no PoE há um marco só, o Frasco de Vida Pequeno (decisão do dono, recompensas.mjs)") }, () => {
  const e = novo();
  Recompensas.abrirProximas(e);
  const ids = [...e.presentes.degraus, ...e.presentes.marcos].map((r) => r.id);
  assert.deepEqual([...ids].sort(), [...FILA].sort());
  assert.equal(new Set(ids).size, ids.length, 'sem id repetido');
  assert.equal(e.presentes.degraus.length, 0, 'sem degraus de arma de treino');
  assert.equal(porId(e, 'bau-50').level, 50);
});

test('desbloqueio: cada uma abre no level dela, na ordem da fila', { skip: doClassico("As 4 recompensas de nível do Draevor (montaria, outfit, baús); no PoE há um marco só, o Frasco de Vida Pequeno (decisão do dono, recompensas.mjs)") }, () => {
  const e = novo(1);
  for (const id of FILA) {
    const r = porId(e, id) ?? (Recompensas.abrirProximas(e), porId(e, id));
    e.level = r.level - 1;
    Recompensas.abrirProximas(e);
    assert.equal(r.aberto, false, `${id}: fechada no level ${r.level - 1}`);
    e.level = r.level;
    Recompensas.abrirProximas(e);
    assert.equal(r.aberto, true, `${id}: abre no level ${r.level}`);
    assert.equal(resgatar(e, id).ok, true, `${id}: resgata`);
  }
});

test('resgate de TODAS, uma a uma, e a entrega de cada uma', { skip: doClassico("As 4 recompensas de nível do Draevor (montaria, outfit, baús); no PoE há um marco só, o Frasco de Vida Pequeno (decisão do dono, recompensas.mjs)") }, () => {
  const e = novo(150);
  const mochilaAntes = e.inventory.length;
  for (const id of FILA) {
    Recompensas.abrirProximas(e);
    assert.equal(porId(e, id).aberto, true, `${id} é a vez`);
    const r = resgatar(e, id);
    assert.equal(r.ok, true, `${id}: ${r.erro ?? ''}`);
    assert.equal(porId(e, id).pego, true);
  }
  // Os 2 itens de baú na mochila (as armas de treino saíram com o treino).
  assert.equal(e.inventory.length, mochilaAntes + 2);
  assert.ok(Aparencia.temMontaria(e, GORGON.id), 'Gorgon Hydra liberada');
  for (const look of BLADE) assert.ok(Aparencia.temOutfit(e, look), `Blade Dancer (${look}) liberado`);
});

test('montaria: entregue no sistema de Aparência, aparece como dona e dá para montar', { skip: doClassico("As 4 recompensas de nível do Draevor (montaria, outfit, baús); no PoE há um marco só, o Frasco de Vida Pequeno (decisão do dono, recompensas.mjs)") }, () => {
  const e = novo(120);
  for (const id of FILA.slice(0, 2)) resgatar(e, id);
  const r = Recompensas.coletarMarco(e, { id: 'montaria-120' });
  assert.equal(r.ok, true);
  assert.match(r.notice, /Gorgon Hydra.*Aparência/);
  const lista = Aparencia.montariasEOutfits(e).mounts.find((m) => m.id === GORGON.id);
  assert.equal(lista.owned, true, 'a aba Aparência lista como sua');
  assert.equal(Aparencia.equiparMontaria(e, { id: GORGON.id }).ok, true, 'monta');
  assert.equal(e.outfit.mount, GORGON.look);
  const naTela = Recompensas.presentesParaCliente(e).marcos.find((m) => m.id === 'montaria-120');
  assert.equal(naTela.entregue, true);
  assert.equal(naTela.emUso, true);
});

test('outfit: Blade Dancer nos dois sexos, com os DOIS addons, e dá para vestir com eles', { skip: doClassico("As 4 recompensas de nível do Draevor (montaria, outfit, baús); no PoE há um marco só, o Frasco de Vida Pequeno (decisão do dono, recompensas.mjs)") }, () => {
  const e = novo(130);
  for (const id of FILA.slice(0, 3)) resgatar(e, id);
  const r = Recompensas.coletarMarco(e, { id: 'outfit-130' });
  assert.equal(r.ok, true);
  assert.match(r.notice, /Blade Dancer.*2 addons/);
  for (const look of BLADE) {
    assert.equal(Aparencia.addonsQueTem(e, look), 3, `${look}: addons 1 e 2`);
    assert.equal(Aparencia.montariasEOutfits(e).outfits.find((o) => o.look === look).owned, true);
  }
  const look = BLADE[0];
  assert.equal(Aparencia.salvarAparencia(e, { outfit: { ...e.outfit, type: look, addons: 3 } }).ok, true);
  assert.equal(e.outfit.type, look);
  assert.equal(e.outfit.addons, 3, 'vestido com os dois addons');
  const naTela = Recompensas.presentesParaCliente(e).marcos.find((m) => m.id === 'outfit-130');
  assert.equal(naTela.entregue, true);
  assert.equal(naTela.emUso, true);
});

test('persistência: depois de gravar e ler (o save é JSON), resgates e liberações continuam', { skip: doClassico("As 4 recompensas de nível do Draevor (montaria, outfit, baús); no PoE há um marco só, o Frasco de Vida Pequeno (decisão do dono, recompensas.mjs)") }, () => {
  const e = novo(150);
  for (const id of FILA) resgatar(e, id);
  const relido = JSON.parse(JSON.stringify(e));
  Recompensas.marcosDaVocacao(relido); // o que a entrada no jogo roda
  for (const id of FILA) assert.equal(porId(relido, id).pego, true, `${id} continua pego`);
  assert.ok(Aparencia.temMontaria(relido, GORGON.id));
  assert.ok(Aparencia.temOutfit(relido, BLADE[0]));
  assert.equal(Aparencia.addonsQueTem(relido, BLADE[0]), 3);
});

test('resgate repetido: a segunda chamada é recusada, sem cobrar nem entregar de novo', { skip: doClassico("As 4 recompensas de nível do Draevor (montaria, outfit, baús); no PoE há um marco só, o Frasco de Vida Pequeno (decisão do dono, recompensas.mjs)") }, () => {
  const e = novo(150);
  for (const id of FILA.slice(0, 2)) resgatar(e, id);
  assert.equal(Recompensas.coletarMarco(e, { id: 'montaria-120' }).ok, true);
  const ouro = e.gold;
  const montarias = [...e.lojaMontarias];
  const segunda = Recompensas.coletarMarco(e, { id: 'montaria-120' });
  assert.equal(segunda.ok, false);
  assert.match(segunda.erro, /já foi resgatada/);
  assert.equal(e.gold, ouro);
  assert.deepEqual(e.lojaMontarias, montarias);
});

test('erro na entrega: nada é cobrado nem marcado como resgatado', { skip: doClassico("As 4 recompensas de nível do Draevor (montaria, outfit, baús); no PoE há um marco só, o Frasco de Vida Pequeno (decisão do dono, recompensas.mjs)") }, () => {
  const e = novo(150);
  for (const id of FILA.slice(0, 2)) resgatar(e, id);
  const marco = porId(e, 'montaria-120');
  marco.mount = -1;
  marco.look = -1; // montaria que não existe no catálogo
  const ouro = e.gold;
  const r = Recompensas.coletarMarco(e, { id: 'montaria-120' });
  assert.equal(r.ok, false);
  assert.match(r.erro, /nada foi cobrado/);
  assert.equal(e.gold, ouro);
  assert.equal(marco.pego, false);
  // Baú sem itens: idem.
  const g = novo(50);
  Recompensas.marcosDaVocacao(g);
  porId(g, 'bau-50').itens = [];
  const sets = g.vocation;
  g.vocation = 'sem-vocacao'; // sem a lista da vocação, o baú fica vazio
  const ouroG = g.gold;
  const rb = Recompensas.coletarMarco(g, { id: 'bau-50' });
  g.vocation = sets;
  assert.equal(rb.ok, false);
  assert.equal(g.gold, ouroG);
  assert.equal(porId(g, 'bau-50').pego, false);
});

test('tela: os estados vêm do servidor — bloqueada, disponível, resgatada e, na montaria, entregue/em uso', { skip: doClassico("As 4 recompensas de nível do Draevor (montaria, outfit, baús); no PoE há um marco só, o Frasco de Vida Pequeno (decisão do dono, recompensas.mjs)") }, () => {
  const e = novo(120);
  for (const id of FILA.slice(0, 2)) resgatar(e, id);
  let tela = Recompensas.presentesParaCliente(e);
  const m = (t) => t.marcos.find((x) => x.id === 'montaria-120');
  assert.equal(m(tela).aberto, true, 'disponível');
  assert.equal(tela.marcos.find((x) => x.id === 'outfit-130').aberto, false, 'a do 130: bloqueada');
  Recompensas.coletarMarco(e, { id: 'montaria-120' });
  tela = Recompensas.presentesParaCliente(e);
  assert.equal(m(tela).pego, true);
  assert.equal(m(tela).entregue, true);
  assert.equal(m(tela).emUso, false, 'resgatada e ainda não montada');
  assert.equal(m(tela).onde, 'Personagem › Aparência');
  assert.equal(e.presentes.marcos.find((x) => x.id === 'montaria-120').entregue, undefined, 'o estado da tela não vai para o save');
});

test('compatibilidade: quem resgatou a montaria/outfit ANTES (pagou e não recebeu) recebe na entrada, sem pagar de novo', { skip: doClassico("As 4 recompensas de nível do Draevor (montaria, outfit, baús); no PoE há um marco só, o Frasco de Vida Pequeno (decisão do dono, recompensas.mjs)") }, () => {
  const e = novo(150);
  // Como ficou o save de quem resgatou antes da correção: pego, sem id, sem nada liberado.
  for (const m of e.presentes.marcos) {
    if (m.tipo === 'montaria' || m.tipo === 'outfit') m.pego = true;
    delete m.id;
  }
  e.lojaMontarias = [];
  e.lojaOutfits = [];
  const ouro = e.gold;
  Recompensas.marcosDaVocacao(e); // roda na entrada no jogo
  assert.ok(Aparencia.temMontaria(e, GORGON.id));
  for (const look of BLADE) assert.ok(Aparencia.temOutfit(e, look));
  assert.equal(e.gold, ouro, 'não cobrou');
  Recompensas.abrirProximas(e);
  assert.equal(porId(e, 'montaria-120').pego, true, 'o resgate antigo continua valendo, agora com id');
  assert.equal(porId(e, 'outfit-130').pego, true);
  // E o reparo é idempotente: rodar de novo não duplica nada.
  Recompensas.marcosDaVocacao(e);
  assert.equal(e.lojaMontarias.filter((id) => id === GORGON.id).length, 1);
});
