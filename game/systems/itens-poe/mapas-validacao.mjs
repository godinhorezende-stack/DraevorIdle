// A VALIDAÇÃO dos modificadores dos MAPAS do endgame (dono, 10/10: "verifique se todos os modificadores estão funcionando e coloque uma aba
// na engine dos mapas: comum, mágico, raro, único"). Cada EFEITO de cada linha — os mods do sorteio dos mapas Mágicos e Raros (por faixa de
// tier) e as linhas dos mapas Únicos — passa pelo MESMO caminho do jogo, com o maior valor da faixa, e tem de mudar alguma coisa:
//   monstros / chefe → o monstro de teste muda em `MapasAreas.aplicarEfeitos` (o que a instância faz ao nascer); os mapas e as moedas a mais
//                      do chefe (`DO_DROP_DO_CHEFE`) são lidos no drop (`hunt/combate.mjs → matarMonstro`);
//   instancia        → a composição da área muda (`Mapas.fatoresDaInstancia`: o grupo, as chances de Mágico/Raro, os chefes);
//   jogador          → a maldição existe (`condicoes-poe.MALDICOES_DOS_MONSTROS`) ou o atributo tem efeito na ficha (a mesma conta do balão);
//   mapa             → a Quantidade/Raridade de Itens ou o Tamanho do Grupo do resumo sobe.
// O estado da linha: `funciona` (tudo age), `parcial` (age, com parte que o jogo ainda não tem — a nota), `inexiste` (a mecânica do PoE
// não existe no jogo — a nota) ou `erro` (um efeito que não muda nada, ou o texto e as faixas não batem: é defeito, o teste acusa).
import * as Mapas from './mapas.mjs';
import * as MapasAreas from './mapas-areas.mjs';
import { MALDICOES_DOS_MONSTROS } from './condicoes-poe.mjs';
import { atributoTemEfeito } from './traduzir.mjs';
import * as Catalogo from './catalogo.mjs';

export const ESTADOS = ['funciona', 'parcial', 'inexiste', 'erro'];
/** Os efeitos do chefe que o DROP lê (não o monstro): os mapas e as moedas a mais do mapa único. */
export const DO_DROP_DO_CHEFE = ['mapasExtras', 'moedasExtras'];
const DO_RESUMO = ['quantidade', 'raridade', 'grupo'];

const monstroDeTeste = () => ({ key: 'validacao', hp: 1000, maxHp: 1000, exp: 1000, forca: 1, resist: {} });
const mesmo = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const ok = (onde) => ({ ok: true, onde });
const falha = (motivo) => ({ ok: false, motivo });

/**
 * Um efeito age no jogo? `{ ok, onde }` ou `{ ok: false, motivo }`. `valores`: os da linha (o maior da faixa). Só o efeito, sozinho: outro
 * efeito da mesma linha não esconde o que não age.
 */
export function validarEfeito(e, valores) {
  const ef = {};
  if (e.alvo === 'mapa') {
    const v = e.fixo ?? (Number(valores?.[e.de]) || 0);
    if (!DO_RESUMO.includes(e.stat)) return falha(`"${e.stat}" não é Quantidade, Raridade nem Tamanho do Grupo`);
    return v > 0 ? ok(`o resumo do mapa (${e.stat})`) : falha('o valor é zero');
  }
  if (e.alvo === 'jogador' && e.stat === 'maldicao') return MALDICOES_DOS_MONSTROS[e.fixo] ? ok(`a maldição ${MALDICOES_DOS_MONSTROS[e.fixo].nome} em você`) : falha(`a maldição "${e.fixo}" não existe no jogo`);
  Mapas.somar(ef, e, valores);
  const v = e.stat.split('.').reduce((o, k) => o?.[k], ef[e.alvo]);
  if (!(Number(v) || typeof v === 'string')) return falha('o valor é zero');
  if (e.alvo === 'monstros' || e.alvo === 'chefe') {
    if (e.alvo === 'chefe' && DO_DROP_DO_CHEFE.includes(e.stat)) return ok(`o drop do chefe (${e.stat})`);
    const antes = monstroDeTeste();
    const depois = MapasAreas.aplicarEfeitos(monstroDeTeste(), ef[e.alvo]);
    return mesmo(antes, depois) ? falha(`o monstro não muda: o jogo não lê "${e.stat}"`) : ok(e.alvo === 'chefe' ? 'o chefe do mapa' : 'os monstros do mapa');
  }
  if (e.alvo === 'instancia') return mesmo(Mapas.fatoresDaInstancia({ efeitos: ef }), Mapas.fatoresDaInstancia({})) ? falha(`a área não muda: o jogo não lê "${e.stat}"`) : ok('a composição da área');
  if (e.alvo === 'jogador') return atributoTemEfeito(e.stat) ? ok('a sua ficha, enquanto está no mapa') : falha(`a ficha não lê "${e.stat}"`);
  return falha(`alvo "${e.alvo}" desconhecido`);
}

/**
 * O que o TRECHO do texto de onde o efeito lê o valor tem de dizer (o pedaço entre " / " com o `{de}`). Pega o efeito ligado ao número
 * errado — a "Vida aumentada" do chefe que virava Dano, o Gelo e o Raio que davam Fogo. Atributo fora da lista: não confere.
 */
export const PALAVRAS = {
  vidaPct: /Vida/, danoPct: /Dano/, velocidadePct: /Movimento/, velocidadeDeAtaquePct: /Ataque/, velocidadeDeConjuracaoPct: /Conjuração/,
  critChance: /Chance de Crítico/, critMultiplicador: /Multiplicador de Crítico/, esPct: /Escudo de Energia/, precisaoPct: /Precisão/,
  'resist.physical': /Dano Físico/, 'resist.chaos': /Caos/, 'resist.fire': /Elemental|Fogo/, 'resist.ice': /Elemental|Gelo/, 'resist.energy': /Elemental|Raio/,
  'danoExtraPct.fire': /Fogo/, 'danoExtraPct.ice': /Gelo/, 'danoExtraPct.energy': /Raio/, experienciaPct: /Experiência/,
  rarosPct: /Raros/, magicosPct: /Mágicos/, mapasExtras: /Mapas/, moedasExtras: /Monetários/,
  quantidade: /Quantidade de Itens/, raridade: /Raridade de Itens/, grupo: /Tamanho do Grupo/,
  recuperacao_inc: /Recuperação/, frasco_cargas_recebidas: /Cargas de Frasco/, cooldown_recovery: /Recarga/, accuracy_less: /Precisão/,
  fire_res_max: /máximos de Resistências/, ice_res_max: /máximos de Resistências/, energy_res_max: /máximos de Resistências/, chaos_res_max: /máximos de Resistências/,
  'frasco_regen_n:todos': /Cargas de Frasco/, 'frasco_regen_s:todos': /segundos/,
};

/**
 * As faixas e o texto batem? (um `{i}` por faixa; o `de` de cada efeito aponta para uma faixa; o trecho do valor fala do mesmo atributo —
 * `PALAVRAS`; a maldição é a do texto). Devolve os problemas (lista vazia: ok).
 */
export function conferirTexto(modelo, faixas, efeitos) {
  const texto = String(modelo);
  const marcas = [...texto.matchAll(/\{(\d+)\}/g)].map((m) => Number(m[1]));
  const problemas = [];
  if (marcas.length !== (faixas ?? []).length) problemas.push(`o texto tem ${marcas.length} valor(es) e a linha ${(faixas ?? []).length} faixa(s)`);
  for (const e of efeitos ?? []) {
    if (e.stat === 'maldicao') {
      const nome = MALDICOES_DOS_MONSTROS[e.fixo]?.nome;
      // ("Debilitar" no texto do poedb é a Enfraquecer do jogo.)
      if (nome && !texto.includes(nome) && !(e.fixo === 'enfraquecer' && texto.includes('Debilitar'))) problemas.push(`a maldição ${nome} não é a do texto`);
      continue;
    }
    if (e.fixo != null) continue;
    if (!(e.de >= 0 && e.de < (faixas ?? []).length)) {
      problemas.push(`o efeito ${e.alvo}.${e.stat} lê o valor {${e.de}}, que não existe`);
      continue;
    }
    const trecho = texto.split(' / ').find((p) => p.includes(`{${e.de}}`)) ?? texto;
    if (PALAVRAS[e.stat] && !PALAVRAS[e.stat].test(trecho)) problemas.push(`o efeito ${e.alvo}.${e.stat} lê o número de "${trecho}"`);
  }
  return problemas;
}

/** Uma linha (mod do sorteio ou linha do único) validada: `{ texto, modelo, estado, nota, efeitos: [{ alvo, stat, ok, onde|motivo }] }`. */
export function validarLinha({ texto, modelo, faixas, efeitos = [], nota = null }) {
  const valores = (faixas ?? []).map((f) => f[1]);
  const problemas = conferirTexto(modelo, faixas, efeitos);
  const vistos = efeitos.map((e) => ({ alvo: e.alvo, stat: e.stat, ...(e.parcial ? { parcial: e.parcial } : {}), ...validarEfeito(e, valores) }));
  const parciais = [...new Set(efeitos.filter((e) => e.parcial).map((e) => e.parcial))];
  let estado = 'funciona';
  if (!efeitos.length) estado = 'inexiste';
  else if (problemas.length || vistos.some((v) => !v.ok)) estado = 'erro';
  else if (parciais.length) estado = 'parcial';
  const motivo = estado === 'erro' ? [...problemas, ...vistos.filter((v) => !v.ok).map((v) => v.motivo)].join('; ') : estado === 'parcial' ? parciais.join('; ') : estado === 'inexiste' ? nota ?? 'ainda não tem a mecânica no jogo' : null;
  return { texto, modelo, estado, nota: motivo, efeitos: vistos };
}

const contar = (linhas) => Object.fromEntries(ESTADOS.map((s) => [s, linhas.filter((l) => l.estado === s).length]));

/**
 * Tudo, para a aba Mapas da engine e para o teste: as raridades (o que cada uma tem), as faixas de tier do sorteio, os mods do sorteio
 * (Mágico e Raro usam o mesmo pool da faixa), os do PoE que ficaram fora do sorteio (sem mecânica), os únicos (linha a linha) e as contas.
 */
export function validarTudo() {
  const D = Mapas.DADOS;
  const R = Catalogo.REGRAS.raridades ?? {};
  const faixas = {};
  for (const b of Mapas.bases()) (faixas[b.pool] ??= []).push(b.atributos?.tier);
  const pool = [];
  for (const [faixa, pagina] of Object.entries(D.classe?.paginas ?? {})) {
    for (const g of [...(pagina.prefixos ?? []), ...(pagina.sufixos ?? [])]) {
      const t = g.tiers?.[0] ?? {};
      pool.push({ faixa, tiers: faixas[faixa] ?? [], lado: g.lado, familia: g.familia, nome: t.nome, peso: g.peso, recompensa: g.recompensa ?? {}, ...validarLinha({ texto: t.texto, modelo: t.modelo, faixas: t.faixas, efeitos: g.efeitos }) });
    }
  }
  const unicos = Mapas.unicos().map((u) => {
    const linhas = u.modificadores.map((m) => validarLinha(m));
    return { slug: u.slug, nome: u.nome, icone: Mapas.iconeDoUnico(u, 1), idBase: u.itemIdBase ?? null, linhas, resumo: contar(linhas) };
  });
  const regra = (id) => ({ id, nome: R[id]?.nome ?? id, cor: R[id]?.cor ?? null, prefixos: R[id]?.maxPrefixos ?? 0, sufixos: R[id]?.maxSufixos ?? 0, quantidade: R[id]?.quantidade ?? null });
  return {
    tiers: Mapas.bases().map((b) => ({ tier: b.atributos?.tier, nivel: b.atributos?.nivel_area, faixa: b.pool, icone: b.icone })),
    faixas,
    raridades: ['normal', 'magico', 'raro', 'unico'].map(regra),
    drop: { chanceDoUnico: Mapas.DROP.chanceDoUnico ?? 0, pesos: Catalogo.REGRAS.drop?.raridades ?? {} },
    pool,
    naoImplementados: D.naoImplementados ?? [],
    unicos,
    resumo: { pool: contar(pool), unicos: contar(unicos.flatMap((u) => u.linhas)), unicosSemEfeito: unicos.filter((u) => !u.linhas.some((l) => l.efeitos.length)).map((u) => u.nome) },
  };
}
