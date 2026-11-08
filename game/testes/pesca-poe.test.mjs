// (08/11 — o dono: "Pescar na água da caçada") a PESCA do PoE (`systems/itens-poe/pesca.mjs`): a Vara vestida, parado perto da água, lançar,
// a mordida com a janela para puxar, a linha que arrebenta, a reserva da área e os atributos de pesca dos únicos.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';

process.env.ITENS_POE = '1';
const Catalogo = await import('../systems/itens-poe/catalogo.mjs');
const SEM = (!existsSync(Catalogo.ARQUIVO) || !Catalogo.ligado()) && 'só no modo PoE, com o catálogo do PoE';
await (await import('../systems/itens-poe/iniciar.mjs')).iniciarJogoDoPoe();
const { ITEM_CATALOG } = await import('../systems/dados.mjs');
const Jogo = await import('../systems/itens-poe/jogo.mjs');
const { gerarPeca } = await import('../systems/itens-poe/gerar.mjs');
const Pesca = await import('../systems/itens-poe/pesca.mjs');
const Cacadas = await import('../systems/cacadas.mjs');
const Ficha = await import('../systems/ficha.mjs');
const P = await import('../systems/passivas/arvore.mjs');
const T = await import('../systems/itens-poe/traduzir.mjs');
const So = await import('../systems/itens-poe/so-itens-do-poe.mjs');
const { personagemDeTeste } = await import('./apoio.mjs');

const AREA = 'poe-a1-the-coast';
const vara = (unico = null) => Jogo.pecaDoJogo(gerarPeca({ catalogo: Catalogo.catalogo(), regras: Catalogo.REGRAS, base: Pesca.BASE_DA_VARA, raridade: unico ? 'unico' : 'normal', ilvl: 70, rng: () => 0.5, ...(unico ? { unico } : {}) }));
const tr = (modelo, valores = []) => T.traduzirMod({ modelo, valores });

/** Entra na Costa (uma área do PoE com água — a tag `area_with_water`) com a Vara, na Caça Online. */
function naBeiraDaAgua(extra = {}) {
  const e = Object.assign(personagemDeTeste({ vocacao: 'knight', level: 30 }), { sistema: 'poe', classePoe: 'Marauder' });
  delete e.classe;
  P.garantir(e);
  e.equipment = { weapon: vara(), ...extra };
  Ficha.invalidar(e);
  assert.equal(Cacadas.entrar(e, { huntId: AREA, mode: 'auto', strategy: 'nearest', dificuldade: 'facil' }).ok, true);
  const h = e.hunt;
  h.modo = 'online';
  e.inventory = [];
  return e;
}

test('a Vara de Pescar entra no jogo com o id fixo, é do PoE e veste; os peixes também são do PoE', { skip: SEM }, () => {
  assert.equal(Jogo.registro().porBase.get(Pesca.BASE_DA_VARA), Pesca.ID_DA_VARA);
  const v = vara();
  assert.equal(v.id, Pesca.ID_DA_VARA);
  assert.equal(ITEM_CATALOG[v.id].slot, 'weapon');
  for (const p of Pesca.PEIXES) assert.ok(So.ehDoPoe(p.id) && ITEM_CATALOG[p.id]?.sell === p.venda, p.nome);
  assert.ok(Jogo.registro().porBase.get('Gloves/Iron_Gauntlets') < 7_100_000, 'os ids das outras bases não mudam');
});

test('as linhas de pesca dos únicos e das varas valem', { skip: SEM }, () => {
  for (const [m, v, stat, valor] of [
    ['Sensibilidade da Fisgada aumentada em {0}%', [34], 'pesca_sensibilidade_pct', 34], ['Força da Linha de Pesca aumentada em {0}%', [100], 'pesca_linha_pct', 100],
    ['Quantidade de Peixes Pescados aumentada em {0}%', [20], 'pesca_quantidade_pct', 20], ['Quantidade de Peixes Pescados reduzida em {0}%', [40], 'pesca_quantidade_pct', -40],
    ['Raridade de Peixes Pescados aumentada em {0}%', [40], 'pesca_raridade_pct', 40], ['Consumo da Reserva de Pesca aumentado em {0}%', [50], 'pesca_consumo_pct', 50],
    ['Consumo da Reserva de Pesca reduzido em {0}%', [20], 'pesca_consumo_pct', -20], ['Alcance da Pesca aumentado em {0}%', [20], 'pesca_alcance_pct', 20],
    ['Você pode pescar Peixes Corrompidos', [], 'pesca_corrompidos', 1], ['Você pode pescar Peixes Exóticos', [], 'pesca_exoticos', 1],
    ['Isca Taumatúrgica', [], 'pesca_isca', 1], ['Anzol de Pedra Karui', [], 'pesca_anzol', 1], ['Brilha enquanto estiver em uma área contendo um Peixe Único', [], 'visual:brilho_peixe', 1],
  ]) {
    const t = tr(m, v);
    assert.equal(t.estado, 'equivalente', m);
    assert.deepEqual(t.efeitos.map((x) => [x.stat, x.valor]), [[stat, valor]], m);
  }
});

test('pescando na Costa: lançar, a mordida, puxar na janela e o peixe na mochila; longe da água ou no Automático, não', { skip: SEM }, () => {
  const e = naBeiraDaAgua();
  const h = e.hunt;
  h.modo = 'auto';
  assert.match(Pesca.pescar(e).erro, /Automática/);
  h.modo = 'online';
  const r = Pesca.pescar(e, () => 0.5);
  assert.ok(r.ok, r.erro);
  assert.equal(h.pesca.fase, 'esperando');
  assert.match(Pesca.puxar(e, () => 0.5).erro, /Cedo/, 'puxar antes espanta');
  h.clock = h.pesca.mordidaEm;
  Pesca.tique(e, h, () => 0.5);
  assert.equal(h.pesca.fase, 'mordida');
  const janela = h.pesca.janelaAte - h.clock;
  assert.equal(janela, 1200, 'a janela base');
  const pegou = Pesca.pescar(e, () => 0.99);
  assert.ok(pegou.ok, pegou.erro);
  assert.match(pegou.notice, /Você pescou: Salmão/);
  assert.equal(e.inventory.find((x) => x.id === 7_900_104)?.count, 1);
  // a janela passa: o peixe escapa
  h.clock = h.pesca.mordidaEm;
  Pesca.tique(e, h, () => 0.5);
  h.clock = h.pesca.janelaAte + 1;
  Pesca.tique(e, h, () => 0.5);
  assert.equal(h.pesca.fase, 'esperando', 'escapou e a linha espera de novo');
  // andar recolhe a linha
  h.pos = { ...h.pos, x: h.pos.x + 1 };
  Pesca.tique(e, h, () => 0.5);
  assert.equal(h.pesca, undefined);
  // a tela vê a fase
  assert.equal(Pesca.paraCliente(e).pesca.fase, 'parado');
  // a área sem água (o Ilhéu da Maré também tem; a Prisão Superior não)
  const seca = naBeiraDaAgua();
  seca.hunt.huntId = 'poe-a1-the-upper-prison';
  assert.match(Pesca.motivo(seca), /não tem água/);
});

test('o Laço do Pescador: a janela maior, a linha forte e os Peixes Corrompidos; a reserva da área acaba', { skip: SEM }, () => {
  const laco = Jogo.pecaDoJogo(gerarPeca({ catalogo: Catalogo.catalogo(), regras: Catalogo.REGRAS, base: 'Rings/Unset_Ring', raridade: 'unico', ilvl: 70, rng: () => 0.99, unico: 'Anglers_Plait' }));
  assert.ok(laco.poe.af.pesca_corrompidos > 0, 'o Laço');
  assert.ok(laco.poe.estados.every((x) => !['inerte', 'registrado'].includes(x)), JSON.stringify(laco.poe.estados));
  const e = naBeiraDaAgua({ ring: laco });
  const h = e.hunt;
  assert.ok(Pesca.pescar(e, () => 0.5).ok);
  h.clock = h.pesca.mordidaEm;
  Pesca.tique(e, h, () => 0.5);
  assert.equal(h.pesca.janelaAte - h.clock, Math.round(1200 * (1 + laco.poe.af.pesca_sensibilidade_pct / 100)), 'a Sensibilidade alarga a janela');
  // rng baixo: a linha (20% ÷ 2 = 10%) arrebenta com 0.05
  assert.match(Pesca.pescar(e, () => 0.05).notice, /arrebentou/);
  h.clock = h.pesca.mordidaEm;
  Pesca.tique(e, h, () => 0.5);
  // 0.12: não arrebenta (12 ≥ 10), não é raro … é corrompido (12 < 15)
  assert.match(Pesca.pescar(e, () => 0.12).notice, /Peixe Corrompido/);
  // a reserva acaba
  const area = (Pesca.paraCliente(e).pesca.reserva);
  assert.ok(area > 0 && area < 12);
});
