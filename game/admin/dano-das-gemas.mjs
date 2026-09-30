// Quantas gemas existem e quanto cada uma de ATAQUE bate num boneco sem
// resistência — pelo disparo de verdade (ver `testes/motor-de-dano.mjs`).
// Não grava nada.
//
//   node game/admin/dano-das-gemas.mjs                         # todas, gema nível 1, personagem no level que o nível pede
//   node game/admin/dano-das-gemas.mjs --nivel 20              # gema nível 20
//   node game/admin/dano-das-gemas.mjs --level 300             # personagem level 300 (todas no mesmo level)
//   node game/admin/dano-das-gemas.mjs --classe knight         # força a classe
//   node game/admin/dano-das-gemas.mjs --raridade mítico --qualidade 20
//   node game/admin/dano-das-gemas.mjs --gema spell-flame-strike
//   node game/admin/dano-das-gemas.mjs --json > dano.json      # para comparar antes/depois
import { contarGemas, medirTodas, medirGema, fichaDaGema } from '../testes/motor-de-dano.mjs';
import * as Gemas from '../systems/skills/gemas.mjs';

const arg = (nome) => {
  const i = process.argv.indexOf(`--${nome}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
};
const num = (v) => (v == null ? undefined : Number(v));
const opcoes = {
  nivel: num(arg('nivel')) ?? 1,
  level: num(arg('level')),
  classe: arg('classe'),
  raridade: arg('raridade') ?? 'comum',
  qualidade: num(arg('qualidade')) ?? 0,
  magicLevel: num(arg('magic')),
  skill: num(arg('skill')),
};

const so = arg('gema');
const linhas = so ? [{ ...fichaDaGema(Gemas.DEFS.get(Gemas.ITEM_DA_ACAO.get(so))), ...medirGema(so, opcoes) }] : medirTodas(opcoes);
const conta = contarGemas();

if (process.argv.includes('--json')) {
  console.log(JSON.stringify({ gemas: conta, opcoes, linhas }, null, 1));
} else {
  console.log(`Gemas: ${conta.total} no total — ${conta.ativas} ativas (${conta.porTipo.magia} magias, ${conta.porTipo.runa} runas) e ${conta.supports} supports.`);
  console.log(`Ativas por função: ${conta.porFuncao.ataque} de ataque, ${conta.porFuncao.cura} de cura, ${conta.porFuncao.suporte} de suporte/buff.`);
  console.log(`Medida: gema nível ${opcoes.nivel}, ${opcoes.raridade}, ${opcoes.qualidade}% de qualidade; personagem ${opcoes.level ? `level ${opcoes.level}` : 'no level que o nível da gema pede'}${opcoes.classe ? `, ${opcoes.classe}` : ', classe recomendada'}; alvo sem resistência. Dano POR ALVO, por uso.\n`);
  const col = (s, n, dir = false) => (dir ? String(s).padStart(n) : String(s).padEnd(n));
  console.log([col('Gema', 28), col('Tipo', 6), col('Elemento', 9), col('Classe', 18), col('Lv', 4, true), col('Mana', 5, true), col('Recarga', 8, true), col('Alcance', 11), col('Alvos', 5, true), col('Dano', 8, true), col('Mín–Máx', 14, true)].join(' '));
  for (const l of linhas.sort((a, b) => a.levelMinimo - b.levelMinimo || a.nome.localeCompare(b.nome))) {
    console.log(
      [
        col(l.nome, 28),
        col(l.tipo, 6),
        col(l.elemento, 9),
        col(l.classe.join('/') || 'todas', 18),
        col(l.levelMinimo, 4, true),
        col(l.mana, 5, true),
        col(`${l.recargaMs / 1000}s`, 8, true),
        col(l.alcance, 11),
        col(l.alvos ?? '—', 5, true),
        col(l.media ?? (l.erro ? `erro: ${l.erro}` : '—'), 8, true),
        col(l.media != null ? `${l.minimo}–${l.maximo}` : '', 14, true),
      ].join(' ')
    );
  }
}
