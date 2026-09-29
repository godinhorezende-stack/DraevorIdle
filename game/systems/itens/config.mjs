// A configuração do sistema de itens: raridades, níveis dos atributos,
// atributos, pools por equipamento e efeitos — tudo em `gamedata/itens/*.json`,
// para balancear sem mexer em código.
//
// Carregada UMA vez, na subida, e VALIDADA: tabela de chance que não soma 100,
// faixa de nível fora de ordem (N1 < N2 < ... < N5) ou atributo que o combate
// não conhece derrubam o boot com a mensagem do problema, em vez de gerar item
// errado em silêncio. Nada aqui consulta banco, rede ou Redis.
import { readFileSync } from 'node:fs';
import { CATALOGO } from '../dados.mjs';

const ler = (arquivo) => JSON.parse(readFileSync(new URL(`../../gamedata/itens/${arquivo}`, import.meta.url), 'utf8'));

export const RARIDADES = ler('raridades.json');
export const NIVEIS = ler('niveis.json');
export const ATRIBUTOS = ler('atributos.json').atributos;
export const POOLS = ler('pools.json').pools;
export const EFEITOS = ler('efeitos.json');

export const ORDEM = RARIDADES.ordem;
export const DIFICULDADES = ['facil', 'medio', 'dificil'];
export const NIVEL_MAXIMO = 5;

const soma = (lista) => lista.reduce((a, b) => a + Number(b), 0);
const perto100 = (s) => Math.abs(s - 100) < 1e-6;

/** Confere a configuração inteira; devolve a lista de problemas (vazia = ok). */
export function validar() {
  const erros = [];
  for (const [ato, porDif] of Object.entries(RARIDADES.chances)) {
    for (const d of DIFICULDADES) {
      const t = porDif[d];
      if (!t) erros.push(`raridades: falta Ato ${ato} ${d}`);
      else if (!perto100(soma(ORDEM.map((r) => t[r] ?? 0)))) erros.push(`raridades: Ato ${ato} ${d} soma ${soma(Object.values(t))}`);
    }
  }
  for (const r of ORDEM) {
    const q = RARIDADES.raridades[r]?.atributos;
    if (!q) erros.push(`raridades: ${r} sem quantidade de atributos`);
    else if (!perto100(soma(Object.values(q)))) erros.push(`raridades: quantidade de atributos de ${r} soma ${soma(Object.values(q))}`);
  }
  for (const [ato, porDif] of Object.entries(NIVEIS.chances)) {
    for (const d of DIFICULDADES) {
      for (const r of ORDEM) {
        const t = porDif[d]?.[r];
        if (!t || t.length !== NIVEL_MAXIMO) erros.push(`niveis: falta Ato ${ato} ${d} ${r}`);
        else if (!perto100(soma(t))) erros.push(`niveis: Ato ${ato} ${d} ${r} soma ${soma(t)}`);
      }
    }
  }
  for (const [id, a] of Object.entries(ATRIBUTOS)) {
    if (!CATALOGO.afixos?.[id]) erros.push(`atributos: ${id} não é um atributo que o combate conhece`);
    let antes = null;
    for (let n = 1; n <= NIVEL_MAXIMO; n++) {
      const f = a.niveis[String(n)];
      if (!f || !(f[0] <= f[1])) erros.push(`atributos: ${id} N${n} faixa inválida`);
      else if (antes && (f[0] < antes[0] || f[1] < antes[1] || (f[0] + f[1]) / 2 <= (antes[0] + antes[1]) / 2)) erros.push(`atributos: ${id} N${n} não é melhor que N${n - 1}`);
      antes = f;
    }
  }
  for (const [slot, pool] of Object.entries(POOLS)) {
    for (const id of pool) if (id !== 'skill_da_arma' && !ATRIBUTOS[id]) erros.push(`pools: ${slot} tem ${id}, que não existe`);
  }
  return erros;
}

const erros = validar();
if (erros.length) throw new Error(`Configuração de itens inválida:\n - ${erros.join('\n - ')}`);

/*
 * A régua de cada atributo passa a ser a NOVA: do mínimo do N1 ao máximo do N5.
 * `CATALOGO.afixos` é o que vai para o cliente (as estrelas e o balão leem dele)
 * e o que a forja usa para "onde o valor cai na régua": trocar aqui mantém os
 * dois lados na mesma conta. O `teto` (a essência vermelha, 130% da régua)
 * segue a mesma regra de antes.
 */
/**
 * A régua de ANTES do sistema de itens (`{id: {min, max}}`) — só para converter
 * as peças que já existiam (`systems/itens/item.mjs`): o valor antigo é lido
 * nela para achar o nível e reescalado para a faixa nova.
 */
export const REGUA_ANTIGA = Object.fromEntries(Object.entries(CATALOGO.afixos ?? {}).map(([id, f]) => [id, { min: f.antigoMin ?? f.min, max: f.antigoMax ?? f.max }]));

for (const [id, a] of Object.entries(ATRIBUTOS)) {
  const ficha = CATALOGO.afixos[id];
  ficha.antigoMin ??= ficha.min;
  ficha.antigoMax ??= ficha.max;
  const min = a.niveis['1'][0];
  const max = a.niveis[String(NIVEL_MAXIMO)][1];
  Object.assign(ficha, { nome: a.nome, min, max, teto: min + 1.3 * (max - min), niveis: a.niveis });
}

// Os efeitos (nome, texto e números) vão no catálogo do `hello`: o balão do item monta o texto com eles.
CATALOGO.efeitosDeItem = { lendario: EFEITOS.lendario, mitico: EFEITOS.mitico };

/** O ato do drop (enquanto os atos não existem, sai do level da hunt). */
export function atoDoLevel(level) {
  for (const f of RARIDADES.atoPorLevel) if (f.ate == null || (level ?? 1) <= f.ate) return f.ato;
  return 1;
}

/** A dificuldade `degraus` acima de `d` (o boss usa a de cima), sem passar da última. */
export function dificuldadeAcima(d, degraus) {
  const i = DIFICULDADES.indexOf(d);
  return DIFICULDADES[Math.min(DIFICULDADES.length - 1, Math.max(0, i) + degraus)];
}

/** Os nomes para a tela ("Épico", "🟣"). */
export const nomeDaRaridade = (r) => RARIDADES.raridades[r]?.nome ?? r;
