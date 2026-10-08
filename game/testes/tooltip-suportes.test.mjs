// A padronização das gemas de SUPORTE (auditoria de 02/10): nome em português só na apresentação (id, `nome` em inglês e itemId não mudam),
// a tooltip com o número real do efeito e a compatibilidade em português — sem tocar em fórmula, balanceamento nem regra de compatibilidade.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ITEM_CATALOG } from '../systems/dados.mjs';
import * as Gemas from '../systems/skills/gemas.mjs';
import * as Acoes from '../systems/acoes.mjs';
import { personagemDeTeste } from './apoio.mjs';
import { doClassico } from './apoio-migracao.mjs';

const suportes = () => [...Gemas.DEFS.values()].filter((d) => d.tipo === 'support');

// O cliente só roda no navegador (importa de /packages/...): a ficha do suporte é carregada da fonte, sem o resto do módulo.
const fonte = readFileSync(new URL('../frontend/client/src/tooltip.mjs', import.meta.url), 'utf8');
const trecho = fonte.slice(fonte.indexOf('const TAG_PT'), fonte.indexOf('const ESCALA_DA_GEMA'));
const pre = `const CONTAGENS_DA_SUPPORT = new Set(['alvosExtras','perfurar','bifurcar','encadear','retornar','areaExtra']);
const PORCENTO_DO_GOLPE = new Set(['danoDosExtrasPct','danoDaPerfuracaoPct','danoDaBifurcacaoPct','danoDoEncadeamentoPct','danoDoRetornoPct','explosaoPct','segundaExplosaoPct','leechVidaPct','leechManaPct','igniteChance','ignitePct','congelarChance','lentidaoPct','atordoarChance']);
const LENTIDAO_MAXIMA = 40;`;
const cliente = await import(`data:text/javascript,${encodeURIComponent(pre + trecho)}`);
const defDoCliente = (d) => ITEM_CATALOG[d.itemId].gemaDef;

test('os 41 suportes têm nome em português, e o id, o nome em inglês e o nome do item seguem como chave', { skip: doClassico("Os 41 suportes do Draevor (nome em português, loja, compatibilidade)") }, () => {
  const lista = suportes();
  assert.equal(lista.length, 41);
  for (const d of lista) {
    assert.ok(d.nomePt && d.nomePt !== d.nome, d.id);
    assert.equal(ITEM_CATALOG[d.itemId].name, `gema: ${d.nome.toLowerCase()}`, 'o `name` do item não muda');
    assert.equal(ITEM_CATALOG[d.itemId].nomeExibicao, `Gema: ${d.nomePt}`);
    assert.equal(defDoCliente(d).nomePt, d.nomePt);
  }
  assert.equal(new Set(lista.map((d) => d.nomePt)).size, 41, 'nomes únicos');
  assert.equal(Gemas.DEFS.get(911001).id, 'greater-damage');
});

test('as habilidades continuam com o nome original (só os suportes foram traduzidos)', () => {
  const ativa = [...Gemas.DEFS.values()].find((d) => d.tipo === 'ativa');
  assert.equal(ativa.nomePt, undefined);
  assert.equal(ITEM_CATALOG[ativa.itemId].nomeExibicao, undefined);
});

test('a loja mostra o suporte em português', { skip: doClassico("Os 41 suportes do Draevor (nome em português, loja, compatibilidade)") }, () => {
  const e = personagemDeTeste({ vocacao: 'knight', level: 100 });
  const linhas = Gemas.catalogoDaLoja(e);
  const dano = linhas.find((l) => /Dano Superior/.test(l.nome));
  assert.ok(dano, 'o suporte aparece na loja');
  assert.match(dano.nome, /^Gema: Dano Superior \(comum\) · suporte$/);
});

test('a tooltip do suporte traz o número real: nível, raridade e qualidade (nível 30, mítico, qualidade 20)', () => {
  const por = Object.fromEntries(suportes().map((d) => [d.id, cliente.fichaDoSuporte(defDoCliente(d), 30, 20, 2).principais.join(' ')]));
  assert.match(por['greater-damage'], /129,6%/);
  assert.match(por['cooldown-recovery'], /70,8%.*recarga própria.*não reduz o intervalo global/);
  assert.match(por['critical-damage'], /165,6 pontos de dano crítico/);
  assert.match(por['multiple-projectiles'], /\+2 projéteis extras.*100% do dano/, 'contagem não escala; o % tem teto de 100');
  assert.match(por['slow'], /40%/, 'a lentidão mostra o teto');
  assert.match(por['ignite'], /165,6%/);
  assert.doesNotMatch(por['ignite'], /240/, 'a chance de queimar não passa de 100%');
});

test('a Área de Efeito Superior mostra a contrapartida real (a penalidade encolhe com o nível), em linha própria', () => {
  const d = defDoCliente(suportes().find((x) => x.id === 'greater-area-of-effect'));
  const n1 = cliente.fichaDoSuporte(d, 1, 0, 1);
  assert.deepEqual(n1.contrapartidas, ['Contrapartida: -15% de dano.']);
  assert.match(n1.principais[0], /2 casas/);
  assert.match(cliente.fichaDoSuporte(d, 30, 0, 1).contrapartidas[0], /-0,5% de dano/);
});

test('a compatibilidade sai em português, sem tag técnica em inglês', { skip: doClassico("Os 41 suportes do Draevor (nome em português, loja, compatibilidade)") }, () => {
  const cru = /\b(physical|fire|earth|energy|ice|holy|death|spell|projectile|area|wave|line|hit|single|melee|ranged|healing|buff)\b/;
  for (const d of suportes()) {
    const dc = defDoCliente(d);
    assert.doesNotMatch(cliente.textoDaCompatibilidade(dc), cru, d.id);
    const f = cliente.fichaDoSuporte(dc, 1, 0, 1);
    assert.ok(f.etiqueta && f.principais.length + f.contrapartidas.length > 0, d.id);
    assert.doesNotMatch([...f.principais, ...f.contrapartidas].join(' '), /Pct|alvosExtras|undefined|NaN/, d.id);
  }
});

test('a regra de compatibilidade não mudou: quantas habilidades de ataque aceitam cada suporte', { skip: doClassico("Os 41 suportes do Draevor (nome em português, loja, compatibilidade)") }, () => {
  const e = personagemDeTeste({ vocacao: 'knight', level: 300 });
  const cat = Acoes.catalogo(e);
  const ataques = [...cat.spells, ...cat.runes].filter((a) => a.damage && !a.heals && Gemas.ehSkillDeGema(a));
  const aceitam = (id) => ataques.filter((a) => Gemas.compativel(suportes().find((d) => d.id === id).suporte, a.tags)).length;
  assert.equal(ataques.length, 92);
  const esperado = { 'greater-damage': 92, 'multiple-projectiles': 49, 'area-of-effect': 39, explosion: 52, impact: 8, 'physical-damage': 31, 'fire-damage': 12, 'elemental-damage': 50, 'faster-attacks': 31, ignite: 40, freeze: 11, stun: 30, slow: 85, 'life-leech': 85, 'potent-healing': 0 };
  for (const [id, n] of Object.entries(esperado)) assert.equal(aceitam(id), n, id);
});
