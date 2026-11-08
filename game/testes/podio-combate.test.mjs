// O bônus de pódio da Arena (exp/loot) chegava até `matarMonstro` via
// `Arena.bonusDoPodio(personagem.nome)`, chamado direto de dentro de
// `hunt/combate.mjs` — o que fazia esse módulo (parte do tique da hunt)
// importar `arena.mjs` (sessão, `vivas`, banco), inviável dentro de um
// worker_thread (Fase 5). Agora `sessao.mjs` calcula o bônus uma vez por
// tique e deixa pronto em `hunt.podio` (mesmo padrão não-enumerável de
// `hunt.guia`/`hunt.partilha`); `combate.mjs` só lê `hunt.podio ?? SEM_PODIO`.
// Este teste prova que o bônus continua sendo aplicado igual — só mudou de
// onde ele vem.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as Cacadas from '../systems/cacadas.mjs';
import * as Prey from '../systems/prey.mjs';
import { personagemDeTeste, PERSONAGEM, HUNT_DE_TESTE } from './apoio.mjs';
import { CATALOGO, ITEM_CATALOG } from '../systems/dados.mjs';
import { BESTIARY } from '../systems/hunt/monstros.mjs';
import { catalogo as catalogoDoPoe, REGRAS as REGRAS_DO_POE } from '../systems/itens-poe/catalogo.mjs';
import { gerarPeca } from '../systems/itens-poe/gerar.mjs';
import * as JogoDoPoe from '../systems/itens-poe/jogo.mjs';

/** `Prey.garantir` sorteia as listas de prey na primeira vez — precisa rodar
 * com Math.random de verdade, ANTES de qualquer teste travar o dado (senão o
 * sorteio de candidatas do prey trava num `while` que nunca acha uma nova
 * candidata com o mesmo número sempre saindo — mesmo motivo pelo qual
 * `prey-combate.test.mjs` chama isto fora de `cacarAte`). */
function personagem(opcoes) {
  const estado = personagemDeTeste(opcoes);
  Prey.garantir(estado);
  // (08/11, adaptado ao PoE — o dono: "Adaptar antes") Desarmado no PoE o personagem de teste não mata nada na área em 15 minutos: uma arma
  // de verdade do PoE na mão — o Machado Vaal, como a caçada offline de xp-da-hunt.test.mjs. O level 400 do Draevor fazia esse papel.
  JogoDoPoe.iniciar(ITEM_CATALOG);
  estado.equipment = { ...(estado.equipment ?? {}), weapon: JogoDoPoe.pecaDoJogo(gerarPeca({ catalogo: catalogoDoPoe(), regras: REGRAS_DO_POE, base: 'Two_Hand_Axes/Vaal_Axe', raridade: 'normal', ilvl: 64, rng: () => 0.5 })) };
  return estado;
}

function cacarAte(estado, acaso, achou) {
  const original = Math.random;
  Math.random = () => acaso;
  try {
    assert.ok(Cacadas.entrar(estado, { huntId: HUNT_DE_TESTE, mode: 'auto' }).ok);
    let t = Date.now();
    estado.hunt.ultimoTique = t;
    for (let i = 0; i < 4 * 900; i++) {
      t += 250;
      estado.hp = estado.maxHp;
      for (const ev of Cacadas.tique(estado, PERSONAGEM, t) ?? []) if (achou(ev)) return ev;
    }
  } finally {
    Math.random = original;
  }
  assert.fail('o evento esperado nunca aconteceu em 15 minutos de caçada');
}

// O bicho comum da área no lugar do Troll da Troll Cave: o primeiro monstro do PoE da área que não é o chefe único (no Navio Encalhado, o
// Marinheiro Amaldiçoado).
const COMUM_DA_AREA = CATALOGO.hunts.find((h) => h.id === HUNT_DE_TESTE).creatures.find((c) => BESTIARY[c.key]?.poe && !BESTIARY[c.key].poe.unico).name;
const morteDoComum = (ev) => ev.t === 'kill' && ev.name === COMUM_DA_AREA;

test('sem hunt.podio: mata sem bônus (o padrão de hoje, igual antes da mudança)', () => {
  const estado = personagem({ level: 400 });
  const ev = cacarAte(estado, 0.5, morteDoComum);
  assert.ok(ev.exp > 0);
});

test('com hunt.podio (setado como sessao.mjs faz, 1x por tique): +8% de exp aplicado no kill', () => {
  const semBonus = personagem({ level: 400 });
  const semExp = cacarAte(semBonus, 0.5, morteDoComum).exp;

  const comBonus = personagem({ level: 400 });
  const original = Math.random;
  Math.random = () => 0.5;
  let exp;
  try {
    assert.ok(Cacadas.entrar(comBonus, { huntId: HUNT_DE_TESTE, mode: 'auto' }).ok);
    comBonus.hunt.podio = { exp: 8, loot: 0, lugar: 1 }; // 1º lugar da semana, como `arena.mjs::buscarBonus` devolveria
    let t = Date.now();
    comBonus.hunt.ultimoTique = t;
    for (let i = 0; i < 4 * 900 && exp === undefined; i++) {
      t += 250;
      comBonus.hp = comBonus.maxHp;
      for (const ev of Cacadas.tique(comBonus, PERSONAGEM, t) ?? []) if (morteDoComum(ev)) exp = ev.exp;
    }
  } finally {
    Math.random = original;
  }
  assert.equal(exp, Math.round(semExp * 1.08));
});
