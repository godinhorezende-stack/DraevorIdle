// Moeda de loot (platinum/gold coin dropada por bicho) vai para o ouro
// CARREGADO (`estado.gold`), não direto para o banco (`estado.bank`) — só o
// Banqueiro move dinheiro para o banco, de propósito, quando o jogador pede
// (`banqueiro.mjs::depositar`). Uma versão anterior de
// `hunt/combate.mjs::matarMonstro` e `cacadas.mjs::projetar` (a projeção da
// caçada offline além dos 30 min simulados tique a tique) mandava a moeda de
// loot direto para `bank`, a partir de uma medição do jogo original que o
// dono do projeto confirmou estar errada.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as Cacadas from '../systems/cacadas.mjs';
import * as Prey from '../systems/prey.mjs';
import { personagemDeTeste, PERSONAGEM, HUNT_DE_TESTE, huntDoPoe } from './apoio.mjs';

const HORA = 3_600_000;

test('matar bicho com loot de moeda (Troll, troll-cave): o ouro sobe no carregado, o banco não muda', () => {
  const estado = personagemDeTeste({ level: 400 });
  Prey.garantir(estado); // com Math.random de verdade, antes de travar o dado — ver podio-combate.test.mjs
  const bancoAntes = estado.bank;
  const original = Math.random;
  Math.random = () => 0.35; // mesmo sorteio usado em prey-combate.test.mjs para o gold coin (3031) cair
  try {
    // O dado travado JÁ no `entrar` (dono, 09/10): é nele que o spawn sorteia a raridade (`sorteioDaRaridade`, 10% Mágico e 2% Raro
    // por bicho). Com o dado de verdade, em ~15% das vezes o 1º alvo nascia Mágico/Raro (472 a 933 de vida, contra 136 do Comum) e o
    // personagem de teste (a machadinha do kit, 5 por golpe depois da armadura 190) morria antes — regra do PoE, não o que este teste mede.
    assert.ok(Cacadas.entrar(estado, { huntId: HUNT_DE_TESTE, mode: 'auto' }).ok);
    estado.hunt.ultimoTique = Date.now();
    let t = Date.now();
    let subiu = false;
    for (let i = 0; i < 4 * 900 && !subiu; i++) {
      t += 250;
      Cacadas.tique(estado, PERSONAGEM, t);
      if (estado.gold > 500) subiu = true; // 500 é o inicial de personagemDeTeste
    }
    assert.ok(subiu, 'o ouro carregado nunca subiu em 15 minutos de caçada');
  } finally {
    Math.random = original;
  }
  assert.equal(estado.bank, bancoAntes, 'o banco não deveria mudar só por caçar');
});

test('caçada offline projetada (além dos 30 min simulados): o ouro projetado também vai para o carregado', () => {
  const e = personagemDeTeste({ vocacao: 'knight', level: 600 });
  e.hp = e.maxHp = 1e12; // não morre durante a simulação
  assert.ok(Cacadas.entrar(e, { huntId: huntDoPoe('werelions-1'), mode: 'auto', strategy: 'nearest' }).ok);
  e.hunt.offlineDesde = Date.now() - 2 * HORA; // bem além dos 30 min simulados tique a tique -> aciona `projetar`
  const bancoAntes = e.bank;
  const ausencia = Cacadas.simularAusencia(e, PERSONAGEM, Date.now());
  assert.ok(ausencia?.report, 'sem relatório de ausência');
  assert.ok(e.gold > 500, `ouro carregado não subiu com a caçada offline (${e.gold})`);
  assert.equal(e.bank, bancoAntes, 'o banco não deveria mudar só pela caçada offline');
});
