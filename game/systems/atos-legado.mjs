// Os 4 atos de HOJE (`campanha.json` + `campanha-conteudo.json`) descritos no modelo novo (`atos-modelo.mjs`), SÓ PARA LEITURA: nada do
// que o jogo usa é alterado. O jogo continua executando o caminho linear atual; estes "atos legados" servem para o editor mostrá-los,
// duplicá-los como ponto de partida e para os testes provarem que a regra do grafo (`fasesAbertas`) dá o MESMO que o runtime atual.
//
// Regras do importador (espelham `campanha.mjs`):
//  - ligações em cadeia dentro do ato, na ordem de `fases[]`;
//  - a fase travada (`pular`, ex.: dark-thais) NÃO entra no grafo (o runtime a trata como completa sozinha e a cadeia passa por cima dela:
//    `faseExigida`); fica em `legado.travadas`;
//  - `requisitos.exige` do conteúdo vira requisito da fase (só entre fases do mesmo ato; o resto fica em `legado.exigeDeOutroAto`);
//  - o boss do ato vira `bossFinal`, com a última fase jogável como `faseAnterior`.
import { FASES, CAMPANHA, ATOS, ultimaFaseDoAto } from './campanha.mjs';
import { conteudoDaFase, atosDoConteudo } from './campanha-conteudo.mjs';
import { normalizar } from './atos-modelo.mjs';

export const ID_LEGADO = (n) => `legado-${n}`;
export const ehLegado = (id) => /^legado-\d+$/.test(String(id));

export function atoLegado(n) {
  const doAto = FASES.filter((f) => f.ato === n);
  if (!doAto.length) return null;
  const jogaveis = doAto.filter((f) => !f.pular);
  const ids = new Set(jogaveis.map((f) => f.huntId));
  const meta = atosDoConteudo()[String(n)] ?? {};
  const exigeDeOutroAto = [];
  const fases = jogaveis.map((f, i) => {
    const c = conteudoDaFase(f.huntId);
    const exige = (c.requisitos?.exige ?? []).filter((e) => {
      if (ids.has(e)) return true;
      exigeDeOutroAto.push({ fase: f.huntId, exige: e });
      return false;
    });
    return { id: f.huntId, nome: f.nome, descricao: c.descricao ?? '', ordem: i + 1, huntId: f.huntId, tipo: f.huntId === ultimaFaseDoAto(n)?.huntId ? 'fase-final-do-ato' : 'hunt-normal', nivel: f.nivel, obrigatoria: true, requisitos: { exige }, conclusao: { tipo: 'limpar-hunt' }, posicao: c.mapa ?? null };
  });
  const conexoes = [];
  for (let i = 0; i + 1 < fases.length; i++) conexoes.push({ de: fases[i].id, para: fases[i + 1].id, requisito: null, rotulo: '' });
  const boss = CAMPANHA.bosses[String(n)];
  const ato = normalizar({
    id: ID_LEGADO(n),
    nome: meta.nome ?? `Ato ${n}`,
    descricao: meta.descricao ?? '',
    nivelRecomendado: doAto[0]?.nivel?.facil ?? null,
    ordem: n,
    anterior: n > 1 ? ID_LEGADO(n - 1) : null,
    seguinte: n < ATOS ? ID_LEGADO(n + 1) : null,
    requisitos: { exige: n > 1 ? [ID_LEGADO(n - 1)] : [] },
    estado: 'publicado',
    inicio: fases[0]?.id ?? null,
    fases,
    conexoes,
    bossFinal: boss ? { bossId: boss.bossId, faseAnterior: ultimaFaseDoAto(n)?.huntId ?? null, arena: boss.bossId, recompensas: null, drops: null } : null,
  });
  return { ...ato, legado: { somenteLeitura: true, travadas: doAto.filter((f) => f.pular).map((f) => f.huntId), exigeDeOutroAto } };
}

export const atosLegados = () => Array.from({ length: ATOS }, (_, i) => atoLegado(i + 1)).filter(Boolean);
