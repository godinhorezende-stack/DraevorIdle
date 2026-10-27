// O CHEFE DO MAPA bate depois da volta pelo portal (dono, 27/10: "o chefe não dá ataque básico?"). O VovoGamer (Templar 85) no Mapa 7: o
// General Adus colado nele e 0 golpes, 0 Terremotos, 0 Bombas Vivas — o `proximoGolpe` dele era 350 582 e o relógio da caçada, 93 898.
// A causa: morreu no mapa, voltou pelo portal; a caçada nova começa o relógio em 0, mas os monstros guardados (`MapaAberto.guardarAoSair`)
// trazem os prazos do relógio da entrada anterior — o chefe esperava todo o tempo dela (ali, ~4 min) para golpear e lançar.
// A regra: a volta continua o relógio da instância (`MapaAberto.retomar`); o golpe corpo a corpo sai no intervalo dele (1,5 s no Adus).
// Tudo numa caçada de verdade (`Dispositivo.abrir`/`voltar` + `Cacadas.tique`, 250 ms).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';

process.env.ITENS_POE = '1';
const Catalogo = await import('../systems/itens-poe/catalogo.mjs');
const SEM = (!existsSync(Catalogo.ARQUIVO) || !Catalogo.ligado()) && 'só no jogo oficial (PoE)';
const { personagemDeTeste, PERSONAGEM } = await import('./apoio.mjs');
const Cacadas = await import('../systems/cacadas.mjs');
const Dispositivo = await import('../systems/mapas-dispositivo.mjs');
const MapaAberto = await import('../systems/itens-poe/mapa-aberto.mjs');
const Jogo = await import('../systems/itens-poe/jogo.mjs');
const Bolsa = await import('../systems/bolsa.mjs');
const { gerarPeca } = await import('../systems/itens-poe/gerar.mjs');

/** Um personagem com a campanha vencida (o dispositivo liberado), a vida que não acaba e a barra vazia (só o chefe age). */
function personagem() {
  const e = personagemDeTeste({ vocacao: 'knight', level: 90 });
  e.equipment = { ...(e.equipment ?? {}), weapon: Jogo.pecaDoJogo(gerarPeca({ catalogo: Catalogo.catalogo(), regras: Catalogo.REGRAS, base: 'Two_Hand_Axes/Vaal_Axe', raridade: 'normal', ilvl: 64, rng: () => 0.5 })) };
  for (const d of Object.keys(e.campanha)) e.campanha[d].bosses = Array.from({ length: 10 }, (_, i) => i + 1);
  Bolsa.garantir(e);
  e.actions = (e.actions ?? []).map(() => null);
  return e;
}
function abrir(e, peca) {
  e.inventory.push(peca);
  const m = Dispositivo.mapasCarregados(e).find((x) => x.peca === peca);
  return Dispositivo.abrir(e, { onde: m.onde, indice: m.indice, assinatura: m.assinatura, mode: 'auto' });
}
const todos = (e) => [...e.hunt.monstros, ...Object.values(e.hunt.outrosAndares ?? {}).flat()];

/** O chefe colado no personagem, imortal, no andar dele; os outros monstros longe. */
function chefeColado(e) {
  const h = e.hunt;
  const chefe = todos(e).find((m) => m.chefeDoMapa);
  if (!h.monstros.includes(chefe)) h.monstros.push(chefe);
  for (const o of h.monstros) if (o !== chefe) Object.assign(o, { x: h.pos.x + 80, y: h.pos.y + 80 });
  Object.assign(chefe, { x: h.pos.x + 1, y: h.pos.y, hp: 1e12, maxHp: 1e12 });
  return chefe;
}

/** `segundos` de caçada: quantos golpes corpo a corpo (cada um empurra `proximoGolpe`) e quantas magias (o `proximoPoder`) o chefe usou. */
function rodar(e, relogio, segundos) {
  const chefe = chefeColado(e);
  let golpe = chefe.proximoGolpe;
  let poder = JSON.stringify(chefe.proximoPoder ?? null);
  const r = { golpes: 0, magias: 0 };
  for (let i = 0; i < segundos * 4 && e.hunt; i++) {
    e.hp = e.maxHp = 1e9;
    Cacadas.tique(e, PERSONAGEM, (relogio.agora += 250));
    if (chefe.proximoGolpe !== golpe) { r.golpes++; golpe = chefe.proximoGolpe; }
    const p = JSON.stringify(chefe.proximoPoder ?? null);
    if (p !== poder) { r.magias++; poder = p; }
  }
  return r;
}

/** Entra no Mapa 7, caça `antes` segundos, morre (gasta um portal) e volta pelo portal. */
function morrerEVoltar(e, relogio, antes, { semRelogio = false } = {}) {
  assert.ok(abrir(e, Jogo.mapaSorteado(7, { raridade: 'normal' })).ok);
  e.hunt.ultimoTique = relogio.agora;
  const primeira = rodar(e, relogio, antes);
  assert.deepEqual(MapaAberto.guardarAoSair(e, { morreu: true }), { portais: 5, falhou: false });
  // (um mapa guardado antes do campo `relogio`, como os que estão no banco)
  if (semRelogio) delete e.mapas.aberto.cacada.relogio;
  e.hunt = null;
  relogio.agora += 20_000;
  assert.ok(Dispositivo.voltar(e, { mode: 'auto' }).ok);
  // (o relógio de parede do teste anda à frente do de verdade: o primeiro tique conta a partir daqui, e não de `Date.now()`)
  e.hunt.ultimoTique = relogio.agora;
  return primeira;
}

test('o chefe do mapa golpeia no intervalo dele (1,5 s) e lança as magias também depois de voltar pelo portal', { skip: SEM }, () => {
  const e = personagem();
  const relogio = { agora: Date.now() };
  const primeira = morrerEVoltar(e, relogio, 180);
  assert.ok(primeira.golpes >= 100, `na primeira entrada ele bate (${primeira.golpes} golpes em 180 s)`);
  const volta = rodar(e, relogio, 60);
  assert.ok(volta.golpes >= 25, `na volta, perto de 40 golpes por minuto (1,5 s) — saíram ${volta.golpes}`);
  assert.ok(volta.magias > 0, `e as magias (${volta.magias})`);
});

test('o mapa guardado antes do relógio (o do banco): o chefe também volta a golpear logo', { skip: SEM }, () => {
  const e = personagem();
  const relogio = { agora: Date.now() };
  morrerEVoltar(e, relogio, 180, { semRelogio: true });
  const volta = rodar(e, relogio, 60);
  assert.ok(volta.golpes >= 25, `na volta, perto de 40 golpes por minuto — saíram ${volta.golpes}`);
  assert.ok(volta.magias > 0, `e as magias (${volta.magias})`);
});
