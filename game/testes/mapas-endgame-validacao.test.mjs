// A VALIDAÇÃO dos modificadores dos mapas do endgame (dono, 10/10: "verifique se todos os modificadores estão funcionando e coloque uma aba
// na engine dos mapas: comum, mágico, raro, único, fazendo a validação e colocando também no tooltip"): nenhum mod do sorteio nem linha de
// único com erro; a validação pega o efeito que não muda nada e o número ligado ao atributo errado (os dois defeitos que ela achou: a Vida
// do chefe dos T1–T5 que virava Dano, e o Gelo e o Raio que davam Fogo); a rota da engine e o resumo do balão.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import * as Catalogo from '../systems/itens-poe/catalogo.mjs';

const SEM = (!existsSync(Catalogo.ARQUIVO) || !Catalogo.ligado()) && 'só no jogo oficial (PoE)';
await import('./apoio.mjs');
const V = await import('../systems/itens-poe/mapas-validacao.mjs');
const Mapas = await import('../systems/itens-poe/mapas.mjs');
const Jogo = await import('../systems/itens-poe/jogo.mjs');
const Http = await import('../admin/itens-poe-http.mjs');

test('todos os modificadores dos mapas agem no jogo: nenhum ERRO no sorteio (Mágico/Raro) nem nas linhas dos 26 únicos', { skip: SEM }, () => {
  const r = V.validarTudo();
  const erros = [...r.pool.map((l) => ({ onde: `${l.faixa} ${l.familia}`, l })), ...r.unicos.flatMap((u) => u.linhas.map((l) => ({ onde: u.slug, l })))].filter(({ l }) => l.estado === 'erro');
  assert.deepEqual(erros.map(({ onde, l }) => `${onde}: ${l.texto} — ${l.nota}`), []);
  assert.equal(r.resumo.pool.erro, 0);
  assert.equal(r.resumo.unicos.erro, 0);
  // O que só age em parte tem o porquê; o que não existe no jogo também.
  for (const l of [...r.pool, ...r.unicos.flatMap((u) => u.linhas)]) if (l.estado === 'parcial' || l.estado === 'inexiste') assert.ok(l.nota, l.texto);
  // No sorteio só entra o que age (o resto fica em `naoImplementados`, com o motivo).
  assert.equal(r.resumo.pool.inexiste, 0);
  assert.ok(r.naoImplementados.length > 0 && r.naoImplementados.every((n) => n.motivo));
  // A forma da aba: as 4 raridades, os 16 tiers em 3 faixas, os 26 únicos.
  assert.deepEqual(r.raridades.map((x) => [x.id, x.prefixos, x.sufixos]), [['normal', 0, 0], ['magico', 1, 1], ['raro', 3, 3], ['unico', 0, 0]]);
  assert.equal(r.tiers.length, 16);
  assert.deepEqual(Object.fromEntries(Object.entries(r.faixas).map(([k, v]) => [k, v.length])), { baixo: 5, medio: 5, alto: 6 });
  assert.equal(r.unicos.length, 26);
  assert.equal(r.drop.chanceDoUnico, 0.02);
});

test('a validação pega o defeito: o efeito que não muda nada, o número do atributo errado, a maldição errada, texto e faixas que não batem', () => {
  const linha = (modelo, faixas, efeitos, nota) => V.validarLinha({ texto: modelo, modelo, faixas, efeitos, nota });
  // Os dois defeitos que a validação achou (e o gerador corrigiu):
  const vidaComoDano = linha('Chefe Único tem sua Vida aumentada em {0}% / Chefe Único tem seu Efeito em Área aumentado em {1}%', [[25, 25], [45, 45]], [{ alvo: 'chefe', stat: 'danoPct', de: 0 }]);
  assert.equal(vidaComoDano.estado, 'erro');
  assert.match(vidaComoDano.nota, /chefe\.danoPct lê o número de "Chefe Único tem sua Vida/);
  assert.equal(linha('Monstros causam {0}% de Dano Físico como Dano de Gelo extra', [[50, 69]], [{ alvo: 'monstros', stat: 'danoExtraPct.fire', de: 0 }]).estado, 'erro');
  // O atributo que o jogo não lê: o monstro, a área e a ficha não mudam.
  assert.match(linha('Algo {0}%', [[5, 5]], [{ alvo: 'monstros', stat: 'naoExiste', de: 0 }]).nota, /o monstro não muda/);
  assert.match(linha('Algo {0}%', [[5, 5]], [{ alvo: 'instancia', stat: 'naoExiste', de: 0 }]).nota, /a área não muda/);
  assert.match(linha('Jogadores {0}%', [[5, 5]], [{ alvo: 'jogador', stat: 'atributo_que_nao_existe', de: 0 }]).nota, /a ficha não lê/);
  assert.match(linha('Jogadores são Amaldiçoados com Nada', [], [{ alvo: 'jogador', stat: 'maldicao', fixo: 'nada' }]).nota, /não existe no jogo/);
  assert.match(linha('Jogadores são Amaldiçoados com Vulnerabilidade', [], [{ alvo: 'jogador', stat: 'maldicao', fixo: 'flamabilidade' }]).nota, /não é a do texto/);
  assert.match(linha('Algo {0}% e {1}%', [[5, 5]], [{ alvo: 'monstros', stat: 'danoPct', de: 0 }]).nota, /2 valor\(es\) e a linha 1 faixa/);
  assert.match(linha('Dano dos Monstros aumentado em {0}%', [[5, 5]], [{ alvo: 'monstros', stat: 'danoPct', de: 3 }]).nota, /lê o valor \{3\}, que não existe/);
  assert.match(linha('Dano dos Monstros aumentado em {0}%', [[0, 0]], [{ alvo: 'monstros', stat: 'danoPct', de: 0 }]).nota, /o valor é zero/);
  // O que está certo: funciona; com parte que o jogo não tem: parcial (com o porquê); sem efeito: não existe (com o porquê).
  assert.equal(linha('Dano dos Monstros aumentado em {0}%', [[20, 30]], [{ alvo: 'monstros', stat: 'danoPct', de: 0 }]).estado, 'funciona');
  assert.equal(linha('Chefes Únicos derrubam {0} Mapas adicionais', [[4, 4]], [{ alvo: 'chefe', stat: 'mapasExtras', de: 0 }]).estado, 'funciona');
  assert.equal(linha('Tamanho do Grupo aumentado em {0}%', [[25, 25]], [{ alvo: 'mapa', stat: 'grupo', de: 0 }]).estado, 'funciona');
  assert.equal(linha('Área contém dois Chefes Únicos', [], [{ alvo: 'instancia', stat: 'chefes', fixo: 2 }]).estado, 'funciona');
  const parcial = linha('Chefe Único tem sua Vida aumentada em {0}% / Chefe Único tem seu Efeito em Área aumentado em {1}%', [[25, 25], [45, 45]], [{ alvo: 'chefe', stat: 'vidaPct', de: 0, parcial: 'o efeito em área do chefe ainda não existe no jogo' }]);
  assert.deepEqual([parcial.estado, parcial.nota], ['parcial', 'o efeito em área do chefe ainda não existe no jogo']);
  assert.deepEqual([linha('Área é um imenso Labirinto', [], [], 'o terreno é o do tier do mapa').estado, linha('Área é um imenso Labirinto', [], [], 'o terreno é o do tier do mapa').nota], ['inexiste', 'o terreno é o do tier do mapa']);
});

test('os mods corrigidos: a Vida do chefe dos T1–T5 é Vida (não Dano) e a Velocidade de Conjuração do chefe e dos monstros age', { skip: SEM }, () => {
  const pagina = Mapas.DADOS.classe.paginas.baixo;
  const grupo = (re) => [...pagina.prefixos, ...pagina.sufixos].find((g) => re.test(g.tiers[0].texto));
  const peca = (g, valores) => ({ poe: { base: Mapas.baseDoTier(3), prefixos: [{ familia: g.familia, modelo: g.tiers[0].modelo, texto: g.tiers[0].texto, valores }], sufixos: [] } });
  const vida = grupo(/^Chefe Único tem sua Vida aumentada/);
  const r = Mapas.resumo(peca(vida, [25, 45]));
  assert.deepEqual(r.efeitos.chefe, { vidaPct: 25 }, 'Vida, não Dano');
  assert.equal(r.linhas[0].estado, 'parcial');
  const dano = grupo(/^Chefe Único causa Dano aumentado/);
  assert.deepEqual(Mapas.resumo(peca(dano, [15, 20])).efeitos.chefe, { danoPct: 15, velocidadeDeConjuracaoPct: 20 });
  assert.equal(Mapas.resumo(peca(dano, [15, 20])).linhas[0].estado, 'equivalente', 'a conjuração agora age');
  const rapido = grupo(/^Velocidade de Movimento dos Monstros/);
  const m = Mapas.resumo(peca(rapido, [15, 20, 20])).efeitos.monstros;
  assert.deepEqual([m.velocidadePct, m.velocidadeDeAtaquePct, m.velocidadeDeConjuracaoPct], [15, 20, 20]);
  // Em todas as faixas, nenhuma versão "Vida do chefe" ficou ligada a dano.
  for (const p of Object.values(Mapas.DADOS.classe.paginas)) {
    for (const g of [...p.prefixos, ...p.sufixos]) if (/^Chefe Único tem sua Vida/.test(g.tiers[0].texto)) assert.deepEqual(g.efeitos.map((e) => e.stat), ['vidaPct'], g.familia);
  }
});

test('a rota da engine (aba Mapas do endgame) devolve a validação', { skip: SEM }, async () => {
  let resposta = null;
  const json = (_res, status, corpo) => { resposta = { status, corpo }; };
  const url = new URL('http://x/api/mapas/_engine/itens-poe/mapas-endgame');
  assert.equal(await Http.atender({ method: 'GET' }, {}, url.pathname, url, { json, corpoJson: async () => null }), true);
  assert.equal(resposta.status, 200);
  assert.equal(resposta.corpo.unicos.length, 26);
  assert.equal(resposta.corpo.resumo.pool.erro, 0);
});

test('o balão do mapa leva a validação: o estado e o porquê de cada linha, na ordem da peça', { skip: SEM }, () => {
  // O único com linhas sem efeito: as linhas do resumo (o balão conta quantas agem) e as notas (o ✗ mostra o porquê).
  const p = Jogo.mapaSorteado(9, { rng: () => 0.001 });
  assert.equal(p.poe.raridade, 'unico');
  const u = Mapas.unicoDoMapa(p.poe.unico);
  const inertes = u.modificadores.filter((m) => !m.efeitos.length);
  assert.equal(p.poe.mapa.linhas.filter((l) => l.estado === 'inerte').length, inertes.length);
  assert.deepEqual(p.poe.mapa.linhas.filter((l) => l.estado === 'inerte').map((l) => l.nota), inertes.map((m) => m.nota));
  assert.equal(p.poe.estados.length, (p.poe.implicitos?.length ?? 0) + p.poe.mapa.linhas.length);
  // O Raro: todas as linhas agem (no sorteio só entra o que age).
  const raro = Jogo.mapaSorteado(12, { raridade: 'raro' });
  assert.ok(raro.poe.mapa.linhas.length >= 4);
  assert.ok(raro.poe.mapa.linhas.every((l) => l.estado !== 'inerte'));
});
