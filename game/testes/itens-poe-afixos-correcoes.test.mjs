// (05/11, dono: "verifique e faça uma relação dos itens que sufixos e prefixos não estão funcionando") O levantamento das peças reais achou um
// só tier sem efeito: o "do Antídoto" (tier 1, ilvl 82) dos Frascos de Vida e de Mana veio da coleção com o texto "Adiciona a de Dano de Raio" e
// sem faixa. A correção (`gamedata/itens-poe/afixos-correcoes.json`, lida pelo catálogo) põe a imunidade a Envenenamento do poedb (15–17 s);
// e nenhum prefixo/sufixo das peças que caem fica sem efeito no balão.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';

process.env.ITENS_POE = '1';
const Catalogo = await import('../systems/itens-poe/catalogo.mjs');
const SEM = !existsSync(Catalogo.ARQUIVO) && 'o catálogo do PoE não está nesta máquina';
await import('../systems/dados.mjs');
const Jogo = await import('../systems/itens-poe/jogo.mjs');
const { gerarPeca } = await import('../systems/itens-poe/gerar.mjs');
// (o jogo do PoE inteiro, como no servidor: as Ramificadoras marcam os mods pelos nós da árvore — `ramificadoras.mjs`)
if (!SEM) await (await import('../systems/itens-poe/iniciar.mjs')).iniciarJogoDoPoe();

const tiersDo = (classe, familia) => Object.values(Catalogo.catalogo().classes[classe].paginas).flatMap((p) => p.sufixos).filter((g) => g.familia === familia).flatMap((g) => g.tiers);

test('o tier 1 do "do Antídoto" dos Frascos de Vida e de Mana: a imunidade a Envenenamento por 15–17 s (como o Híbrido e o poedb)', { skip: SEM }, () => {
  for (const classe of ['Life_Flasks', 'Mana_Flasks', 'Hybrid_Flasks']) {
    const t1 = tiersDo(classe, 'FlaskDispellPoison').find((t) => t.nome === 'do Antídoto');
    assert.equal(t1.modelo, 'Concede Imunidade a Envenenamento por {0} segundos se usado enquanto Envenenado', classe);
    assert.deepEqual(t1.faixas, [[15, 17]], classe);
  }
});

test('as peças que caem (Mágicas e Raras de toda base, Item Level 84): nenhum prefixo ou sufixo sem efeito no balão', { skip: SEM }, () => {
  let semente = 777;
  const rng = () => ((semente = (semente * 16807) % 2147483647) / 2147483647);
  const sem = new Set();
  for (const base of Jogo.registro().porBase.keys()) {
    for (const raridade of ['magico', 'raro']) {
      for (let i = 0; i < 4; i++) {
        const g = gerarPeca({ catalogo: Catalogo.catalogo(), regras: Catalogo.REGRAS, base, raridade, ilvl: 84, rng });
        if (!g || g.erro) continue;
        const p = Jogo.pecaDoJogo(g, Catalogo.REGRAS, rng);
        const imp = p?.poe?.implicitos?.length ?? 0;
        [...(p?.poe?.prefixos ?? []), ...(p?.poe?.sufixos ?? [])].forEach((m, k) => {
          const e = p.poe.estados?.[imp + k];
          if (e === 'registrado' || e === 'inerte') sem.add(`${base}: ${m.texto} (${e})`);
        });
      }
    }
  }
  assert.deepEqual([...sem], []);
});
