// Os tipos de encontro que são uma LUTA DE BOSS: `boss` (principal, de evento ou de endgame), `miniboss` e
// `boss-secreto`. O encontro diz ONDE, QUANDO (condição) e COM QUE CHANCE (probabilidade, sorteada uma vez por
// instância); o boss (`bosses-unicos/`) diz O QUE ele faz. O encontro guarda só o `bossId`.
//
// Idle: é uma luta (`idle: 'combate'`) — na Caça Automática o idle ativa o encontro (o boss nasce) e o combate de
// sempre o resolve. O boss que nasceu de um encontro OPCIONAL não conta para o CLEAR (mas o encontro em andamento
// segura a instância até a luta acabar); o de um OBRIGATÓRIO conta como qualquer objetivo.
import { registrarTipo } from './tipos.mjs';
import * as Estado from './estado.mjs';
import { bossUnico } from '../bosses-unicos/catalogo.mjs';
import { aparecer, vivoDoEncontro } from '../bosses-unicos/boss.mjs';

/** Que categorias de boss cada tipo de encontro aceita (categoria é classificação; aqui é só coerência). */
export const CATEGORIAS_DO_TIPO = { boss: ['principal', 'evento', 'endgame'], miniboss: ['miniboss'], 'boss-secreto': ['secreto'] };

function definicaoDoTipo(tipo) {
  return {
    idle: 'combate',
    validar(e) {
      const erros = [];
      const boss = e.bossId ? bossUnico(e.bossId) : null;
      if (!e.bossId) erros.push('encontro de boss precisa de "bossId".');
      else if (!boss) erros.push(`o boss "${e.bossId}" não está cadastrado.`);
      else if (!CATEGORIAS_DO_TIPO[tipo].includes(boss.categoria)) erros.push(`o boss "${boss.id}" é da categoria "${boss.categoria}"; o tipo "${tipo}" aceita ${CATEGORIAS_DO_TIPO[tipo].join(', ')}.`);
      // Um boss secreto é um extra: nunca pode travar a campanha.
      if (tipo === 'boss-secreto' && e.obrigatorio) erros.push('boss secreto não pode ser obrigatório.');
      return erros;
    },
    aoAtivar({ hunt, instancia, encontro }) {
      if (!hunt) return;
      const def = bossUnico(encontro.bossId);
      if (!def) return;
      const ponto = encontro.x != null ? { x: encontro.x, y: encontro.y, ...(encontro.z != null ? { z: encontro.z } : {}) } : null;
      const r = aparecer(hunt, def, ponto, { instanciaId: instancia.id, encontro: encontro.id, opcional: !encontro.obrigatorio });
      if (r.ok) encontro.bossUid = r.monstro.uid;
      else if (r.motivo !== 'ja-existe') encontro.semBoss = r.motivo;
    },
    // O encontro ATIVO sem boss vivo (não coube na tela, ou sumiu sem passar pela morte — a projeção offline)
    // termina aqui: nada fica esperando por um boss que não existe.
    verificar({ hunt, instancia, encontro, agora }) {
      if (vivoDoEncontro(hunt, encontro.id)) return;
      Estado.concluir(instancia, encontro.id, { agora, viaProjecao: true });
    },
  };
}

for (const tipo of Object.keys(CATEGORIAS_DO_TIPO)) registrarTipo(tipo, definicaoDoTipo(tipo));
