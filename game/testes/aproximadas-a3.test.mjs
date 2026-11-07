// (08/11 — o dono: "continue resolvendo os itens") as APROXIMADAS dos únicos, lote A3: a "Velocidade de Recuperação de Vida/Mana/Escudo de Energia"
// acelera também o dreno, os frascos e (a do escudo) a recarga — antes só a regeneração.
import { test } from 'node:test';
import assert from 'node:assert/strict';

process.env.ITENS_POE = '1';
const Catalogo = await import('../systems/itens-poe/catalogo.mjs');
const SEM = !Catalogo.ligado() && 'só no modo PoE';
const Ficha = await import('../systems/ficha.mjs');
const Frascos = await import('../systems/itens-poe/frascos.mjs');
const Defesa = await import('../systems/personagem/defesa.mjs');
const T = await import('../systems/itens-poe/traduzir.mjs');

test('as linhas da Velocidade de Recuperação saem equivalentes', () => {
  for (const m of ['Velocidade de Recuperação de Vida aumentada em {0}%', 'Velocidade de Recuperação de Mana aumentada em {0}%', 'Velocidade de Recuperação de Escudo de Energia aumentada em {0}%', '{0}% menos Recuperação do Escudo de Energia']) {
    assert.equal(T.traduzirMod({ modelo: m, valores: [20] }).estado, 'equivalente', m);
  }
});

test('o fator: 1 + (a geral + a do recurso); o escudo × o "menos Recuperação"', () => {
  assert.equal(Frascos.fatorDeRecuperacao({}, 'vida'), 1);
  assert.equal(Frascos.fatorDeRecuperacao({ recuperacao_inc: 10, recuperacao_vida_inc: 40 }, 'vida'), 1.5);
  assert.equal(Frascos.fatorDeRecuperacao({ recuperacao_vida_inc: 40 }, 'mana'), 1, 'a da vida não acelera a mana');
  assert.equal(Frascos.fatorDeRecuperacao({ recuperacao_es_inc: 100, recuperacao_es_menos: 50 }, 'es'), 1);
});

test('o DRENO: a instância recupera mais rápido com a Velocidade de Recuperação de Vida', { skip: SEM }, () => {
  const ritmo = (af) => {
    const e = { hunt: { clock: 0 }, hp: 100, maxHp: 1000, mana: 0, maxMana: 0 };
    Ficha.drenarPoe(e, { vida: 50 }, { afPoe: af, energyShield: 0 });
    return e.hunt.roubos[0].porSegundo;
  };
  assert.equal(ritmo({}), 20, '2% de 1000 por segundo');
  assert.equal(ritmo({ recuperacao_vida_inc: 50 }), 30);
});

test('a RECARGA do escudo: × (1 + a Velocidade de Recuperação de Escudo de Energia)', { skip: SEM }, () => {
  const recarga = (af) => {
    const e = { es: 0, esEspera: 0, hunt: { clock: 0 } };
    Defesa.recarregar(e, { energyShield: 1000, afPoe: af }, 1000);
    return e.es;
  };
  const sem = recarga({});
  assert.ok(sem > 0, `recarregou ${sem}`);
  assert.ok(Math.abs(recarga({ recuperacao_es_inc: 100 }) - 2 * sem) <= 1, 'o dobro');
});

test('o FRASCO de Vida: com +100% de Velocidade de Recuperação de Vida, a mesma cura na metade do tempo', { skip: SEM }, async () => {
  const { ITEM_CATALOG } = await import('../systems/dados.mjs');
  const { iniciarJogoDoPoe } = await import('../systems/itens-poe/iniciar.mjs');
  const J = await import('../systems/itens-poe/jogo.mjs');
  const Cacadas = await import('../systems/cacadas.mjs');
  const { gerarPeca } = await import('../systems/itens-poe/gerar.mjs');
  const { personagemDeTeste } = await import('./apoio.mjs');
  await iniciarJogoDoPoe();
  J.iniciar(ITEM_CATALOG);
  const ativo = (af) => {
    const e = Object.assign(personagemDeTeste({ vocacao: 'knight', level: 90 }), { sistema: 'poe', classePoe: 'Marauder' });
    e.equipment = { ...e.equipment, ring: { id: 1, poe: { af } } };
    Ficha.invalidar(e);
    assert.ok(Cacadas.entrar(e, { huntId: 'poe-a1-the-twilight-strand', mode: 'auto', strategy: 'nearest' }).ok);
    e.hunt.monstros.length = 0;
    e.hunt.clock = 100_000;
    e.hp = 1;
    Frascos.cinto(e)[0] = J.pecaDoJogo(gerarPeca({ catalogo: Catalogo.catalogo(), regras: Catalogo.REGRAS, base: 'Life_Flasks/Divine_Life_Flask', raridade: 'normal', ilvl: 60, rng: () => 0.5 }));
    assert.ok(Frascos.usar(e, 0, []));
    const a = e.hunt.frascosPoe.ativos[0];
    return { ms: a.ate - a.de, total: a.porMs * (a.ate - a.de) };
  };
  const sem = ativo({});
  const com = ativo({ recuperacao_vida_inc: 100 });
  assert.ok(Math.abs(com.ms - sem.ms / 2) <= 1, `${com.ms} ms × ${sem.ms} ms`);
  assert.ok(Math.abs(com.total - sem.total) <= 1e-6, 'a mesma cura');
});
