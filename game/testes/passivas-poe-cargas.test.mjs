// CARGAS e FÚRIA de ponta a ponta (auditoria de dependências, 09/10): o nó real da árvore → a soma → as regras das cargas (`itens-poe/cargas.mjs`)
// e da Fúria (`condicoes-poe`) → o que a caçada guarda (quantas cargas, quanto duram, a Fúria e a perda dela).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';

process.env.ITENS_POE = '1';
const Catalogo = await import('../systems/itens-poe/catalogo.mjs');
const SEM = !existsSync(Catalogo.ARQUIVO) && 'catálogo do PoE não está nesta máquina';
const P = await import('../systems/passivas/arvore.mjs');
const Comandos = await import('../systems/passivas/comandos.mjs');
const Ficha = await import('../systems/ficha.mjs');
const ModsPoe = await import('../systems/itens-poe/mods-poe.mjs');
const CargasPoe = await import('../systems/itens-poe/cargas.mjs');
const { personagemDeTeste } = await import('./apoio.mjs');

/** O personagem com o caminho até o nó `id` alocado (sem ele) e numa caçada vazia; `alocar()` põe o nó. */
function antesDo(id) {
  const e = Object.assign(personagemDeTeste({ vocacao: 'knight', level: 100 }), { sistema: 'poe', classePoe: 'Scion' });
  delete e.classe;
  P.garantir(e);
  e.equipment = {};
  Comandos.comando(e, { action: 'alocar', ids: P.caminhoAte(e, id).slice(0, -1) });
  e.hunt = { clock: 0, monstros: [], buffs: {} };
  const ficha = () => { Ficha.invalidar(e); return Ficha.combate(e); };
  ModsPoe.definirFichaDaCacada(e.hunt, ficha);
  return { e, ficha, alocar: () => assert.ok(Comandos.comando(e, { action: 'alocar', id }).ok) };
}
const noSo = (chave) => P.arvore().nos.find((n) => !n.ascendencia && n.tipo !== 'mastery' && (n.efeitos ?? []).length && n.efeitos.every((x) => x.add === chave));

for (const tipo of ['frenesi', 'poder', 'tolerancia']) {
  test(`"+1 ao número máximo de Cargas de ${CargasPoe.NOME[tipo]}" (o nó real): a caçada acumula uma carga a mais`, { skip: SEM }, () => {
    const no = noSo(`max_${tipo}`);
    assert.ok(no);
    const { e, ficha, alocar } = antesDo(no.id);
    const encher = () => { delete e.hunt.cargasPoe; for (let i = 0; i < 20; i++) CargasPoe.ganhar(e, tipo, ficha().afPoe, 1, () => 0); return e.hunt.cargasPoe?.[tipo]?.n ?? 0; };
    const antes = encher();
    assert.equal(antes, CargasPoe.maximo(ficha().afPoe, tipo));
    alocar();
    assert.equal(encher(), antes + no.efeitos[0].valor);
  });
}

test('"Duração das Cargas de Frenesi aumentada" (o nó real): a carga ganha na caçada dura mais, na razão exata', { skip: SEM }, () => {
  const no = noSo('duracao_frenesi');
  assert.ok(no);
  const { e, ficha, alocar } = antesDo(no.id);
  const dura = () => { delete e.hunt.cargasPoe; CargasPoe.ganhar(e, 'frenesi', ficha().afPoe, 1, () => 0); return e.hunt.cargasPoe.frenesi.ate - e.hunt.clock; };
  const pct = () => Number(ficha().afPoe.duracao_frenesi) || 0;
  const [antes, p0] = [dura(), pct()];
  alocar();
  assert.equal(dura(), Math.round((antes / (1 + p0 / 100)) * (1 + pct() / 100)));
});

test('"+3 à Fúria máxima" (o nó real): a Fúria passa do teto de 30 para 33 na caçada', { skip: SEM }, () => {
  const no = noSo('furia_max');
  assert.ok(no);
  const { e, alocar } = antesDo(no.id);
  ModsPoe.ganharFuria(e.hunt, 100, 0);
  const antes = e.hunt.furia.n;
  alocar();
  ModsPoe.ganharFuria(e.hunt, 100, 0);
  assert.equal(e.hunt.furia.n, antes + no.efeitos[0].valor);
});

test('"Perda Inerente de Fúria é 10% mais lenta" (o nó real): no mesmo tempo, perde-se menos Fúria', { skip: SEM }, () => {
  const no = noSo('furia_perda_lenta');
  assert.ok(no);
  const { e, ficha, alocar } = antesDo(no.id);
  const perde = () => { e.hunt.furia = { n: 30, ganhou: 0, perdeu: 2000 }; ModsPoe.tiqueDaFuria(e.hunt, 2000 + 10_000); return 30 - e.hunt.furia.n; };
  const lenta = () => Number(ficha().afPoe.furia_perda_lenta) || 0;
  const antes = perde();
  assert.equal(antes, Math.floor(10_000 / (ModsPoe.FURIA.perdaMs * (1 + lenta() / 100))));
  alocar();
  const depois = perde();
  assert.ok(depois < antes, `${antes} → ${depois}`);
  // (o caminho até o nó pode ter outro igual: a conta é com a soma do dono)
  assert.equal(depois, Math.floor(10_000 / (ModsPoe.FURIA.perdaMs * (1 + lenta() / 100))));
});

test('"Ganhe N de Fúria com Acertos Corpo a Corpo" (o nó real, só no corpo a corpo): o acerto corpo a corpo dá a Fúria; o de projétil não', { skip: SEM }, () => {
  const no = P.arvore().nos.find((n) => !n.ascendencia && n.tipo !== 'mastery' && (n.efeitos ?? []).some((x) => x.add === 'furia_por_acerto@corpo') && n.efeitos.every((x) => /^furia_por_acerto/.test(x.add)));
  assert.ok(no);
  const v = no.efeitos.filter((x) => x.add === 'furia_por_acerto@corpo').reduce((s, x) => s + x.valor, 0);
  const { e, ficha, alocar } = antesDo(no.id);
  alocar();
  const acerto = (tags) => {
    e.hunt.furia = { n: 0, ganhou: 0, perdeu: 0 };
    const alvo = { uid: 1, x: 0, y: 0, hp: 1e6, maxHp: 1e6, estados: {} };
    ModsPoe.aoAcertar(e, e.hunt, alvo, ModsPoe.fichaDoGolpe(ficha(), tags, { estado: e }), { dano: 1, agora: 0, rng: () => 0.99 });
    return e.hunt.furia.n;
  };
  assert.ok(acerto(['ataque', 'corpo']) >= v);
  assert.equal(acerto(['ataque', 'projetil']), 0);
});
