// O tooltip dos BUFFS (gemas de reforço, 02/10): o servidor descreve cada reforço em texto com os números REAIS (da mesma tabela que o combate lê:
// nível, raridade e qualidade da gema, Skill Duration), e o cliente desenha o bloco padronizado no balão da barra, na "Configurar ação" e no da gema.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as Reforcos from '../systems/skills/reforcos.mjs';
import * as Acoes from '../systems/acoes.mjs';
import { personagemDeTeste } from './apoio.mjs';
import * as Rot from '../systems/combate/simulador-rotacao.mjs';
import { aAdaptar, doClassico } from './apoio-migracao.mjs';

const num = (v) => String(Math.round(v * 10) / 10).replace('.', ',');

test('todo reforço tem tooltip com o que faz, a duração e quem é afetado — e nenhum texto genérico', { skip: aAdaptar("O balão da gema de reforço do PoE é a ficha do PoE (corpoDaGemaPoe); o bloco antigo (Reforcos.descrever) fica sem linhas nas 75 gemas do PoE") }, () => {
  for (const id of Object.keys(Reforcos.REFORCOS)) {
    const d = Reforcos.descrever(id);
    assert.ok(d.linhas.length >= 1, `${id} sem linhas`);
    assert.ok(d.duracaoMs > 0 && d.duracao, `${id} sem duração`);
    assert.ok(['Só você', 'Os bichos que você atingir', 'Os bichos por perto'].includes(d.afeta), `${id}: ${d.afeta}`);
    assert.ok(d.tipoNome && d.condicoes.length, id);
    for (const l of d.linhas) assert.doesNotMatch(l, /poder do personagem|aumenta o poder/i, `${id}: texto genérico "${l}"`);
  }
});

test('os números do texto são os da tabela que o combate lê (nada escrito à mão)', () => {
  for (const [id, def] of Object.entries(Reforcos.REFORCOS)) {
    const texto = Reforcos.descrever(id).linhas.join(' | ');
    for (const e of def.efeitos ?? []) if (e.pct != null && e.efeito !== 'treinoDeOutraPericia') assert.ok(texto.includes(num(e.pct)), `${id}: "${num(e.pct)}" não está em "${texto}"`);
    if (def.mult) assert.ok(texto.includes(`+${num((def.mult - 1) * 100)}% de velocidade`), `${id}: ${texto}`);
  }
  assert.match(Reforcos.descrever('spell-blood-rage').linhas[0], /^\+15% de dano nos ataques corpo a corpo$/);
  assert.equal(Reforcos.descrever('spell-haste').duracao, '33 s');
  assert.equal(Reforcos.descrever('spell-magic-shield').duracao, '3 min 20 s');
});

test('o nível da gema e o Skill Duration mudam o texto: o tooltip mostra o valor da gema, não o base', () => {
  const base = Reforcos.descrever('spell-blood-rage');
  const nivel11 = Reforcos.descrever('spell-blood-rage', { nivel: 11, raridade: 'comum', qualidade: 0 });
  assert.match(base.linhas[0], /\+15%/);
  assert.match(nivel11.linhas[0], /\+19,5%/, nivel11.linhas[0]);
  const mais = Reforcos.descrever('spell-blood-rage', { nivel: 1, raridade: 'comum', qualidade: 0, duracaoPct: 30 });
  assert.equal(mais.duracaoMs, 13000);
  assert.equal(mais.duracao, '13 s');
});

test('o catálogo manda `reforco` só nas gemas de reforço, e com a gema equipada o valor é o dela', { skip: doClassico("Balão dos buffs do Draevor") }, () => {
  const e = personagemDeTeste({ vocacao: 'knight', level: 300 });
  const cat = Acoes.catalogo(e);
  const rage = cat.spells.find((a) => a.id === 'spell-blood-rage');
  assert.ok(rage.reforco && rage.reforco.linhas.length);
  assert.equal(cat.spells.find((a) => a.id === 'spell-brutal-strike').reforco, undefined);
  assert.equal(cat.spells.find((a) => a.id === 'spell-wound-cleansing').reforco, undefined);
  const e2 = personagemDeTeste({ vocacao: 'knight', level: 300 });
  assert.ok(Rot.vestirBuild(e2, { grupos: [{ skill: 'spell-blood-rage', supports: ['skill-duration'] }], nivel: 5 }).ok);
  const equipada = Acoes.catalogo(e2).spells.find((a) => a.id === 'spell-blood-rage');
  assert.notEqual(equipada.reforco.duracaoMs, rage.reforco.duracaoMs, 'o Skill Duration aparece na duração');
  assert.match(equipada.reforco.linhas[0], /\+16,8%|\+1[5-9],?\d*%/, equipada.reforco.linhas[0]);
});

test('o cliente desenha o bloco do buff no balão da barra, na configuração e no balão da gema (e abre/fecha no toque pelo mecanismo do balão)', () => {
  const tip = readFileSync(new URL('../frontend/client/src/tooltip.mjs', import.meta.url), 'utf8');
  assert.match(tip, /export function blocoDoReforco/);
  assert.equal((tip.match(/blocoDoReforco\(/g) ?? []).length, 3, 'definição + balão da ação + balão da gema');
  assert.match(tip, /tip-buff-gema-dados/);
  const css = readFileSync(new URL('../frontend/client/balao-item.css', import.meta.url), 'utf8');
  assert.match(css, /\.tip-buff-gema\b/);
  assert.match(tip, /BALAO_NO_TOQUE_MS/, 'o toque longo abre o balão e o próximo toque fecha (mobile)');
});

test('o balão da wand e da rod mostra o Magic Attack na seção Base; as armas físicas não mostram o Poder da arma', () => {
  const tip = readFileSync(new URL('../frontend/client/src/tooltip.mjs', import.meta.url), 'utf8');
  assert.match(tip, /const temBase = meta\.magicAttack \|\|/);
  assert.match(tip, /prop\('Magic Attack', String\(Math\.round\(meta\.magicAttack \* fator\)\), 'mana'\)/);
  assert.doesNotMatch(tip, /Poder da arma'/);
});
