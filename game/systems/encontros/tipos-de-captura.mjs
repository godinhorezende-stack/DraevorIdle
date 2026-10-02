// Os encontros de LUTA COM UM PROPÓSITO: `aprisionado`, `invasor` e `area-secreta`. Reaproveitam o que já existe — o grupo de bichos de
// verdade (`sala.nascerGrupo`, como os guardiões de baú) e o boss único (`bosses-unicos`), cada um com o seu papel:
//
//   aprisionado — alguém está preso e vigiado: `captores` (grupo) e/ou `bossId` (um boss captor) guardam a cela. O jogador
//                 "interage" (como num baú) e, quando o último captor cai, o prisioneiro é libertado: paga a `recompensa`
//                 (o agradecimento), a primeira conclusão e, se houver, uma `bencao` temporária (os mesmos efeitos de altar).
//   area-secreta — uma área escondida que o LÍDER decide abrir (`ocupantes` e/ou `bossId`, `recompensa`, `bencao`); recusar a descarta.
//   invasor     — um ataque: quando fica disponível, os `invasores` (grupo e/ou `bossId`) CHEGAM sozinhos, perto do jogador, sem
//                 ninguém interagir e em qualquer modo de caçada (`sozinho`). Vencer paga a `recompensa` (opcional).
//
// Os dois são lutas (`idle: 'combate'`): o combate de sempre resolve e o encontro em andamento segura o CLEAR. Terminam UMA
// vez (`Estado.concluir`); só então pagam. Sem ninguém em campo (não coube, sumiram sem passar pela morte) concluem — nunca
// esperam por quem não existe.
import { registrarTipo } from './tipos.mjs';
import * as Estado from './estado.mjs';
import * as Recompensas from './recompensas.mjs';
import * as Altares from './altares.mjs';
import * as Eventos from './eventos.mjs';
import { CONFIG } from './config.mjs';
import { quemEstaNaSala, nascerGrupo, bichosDaSala, avisarSala } from './sala.mjs';
import { pagarRolagens, pagarConclusao } from './entregar.mjs';
import { errosDeGrupo } from './tipos-de-bau.mjs';
import { bossUnico } from '../bosses-unicos/catalogo.mjs';
import { aparecer, vivoDoEncontro } from '../bosses-unicos/boss.mjs';

const ponto = (e) => (e.x != null ? { x: e.x, y: e.y, ...(e.z != null ? { z: e.z } : {}) } : null);

/** Quem luta contra o jogador neste encontro: o campo do grupo depende do tipo. */
const campoDoGrupo = (tipo) => ({ aprisionado: 'captores', invasor: 'invasores', 'area-secreta': 'ocupantes' })[tipo];
const marcaDoGrupo = (tipo) => (tipo === 'invasor' ? 'invasor' : 'guardiao');

function validar(tipo, e) {
  const erros = [];
  const campo = campoDoGrupo(tipo);
  if (!e[campo] && !e.bossId) erros.push(`${tipo} precisa de "${campo}" (um grupo) e/ou de "bossId" (um boss).`);
  if (e[campo]) erros.push(...errosDeGrupo(e[campo], campo));
  if (e.bossId && !bossUnico(e.bossId)) erros.push(`o boss "${e.bossId}" não está cadastrado.`);
  if (e.recompensa) erros.push(...Recompensas.validar(e.recompensa, 'recompensa'));
  if (e.bencao) {
    erros.push(...Altares.validarEfeitos(e.bencao.efeitos, 'bencao.efeitos'));
    if (!(Number(e.bencao.duracaoMs) > 0 && Number(e.bencao.duracaoMs) <= CONFIG.limites.altarDuracaoMsMax)) erros.push(`bencao.duracaoMs de 1 a ${CONFIG.limites.altarDuracaoMsMax}.`);
  }
  if (tipo === 'area-secreta' && e.x == null) erros.push('a área secreta precisa de posição (x/y): é onde o líder decide entrar.');
  if (tipo === 'invasor' && e.x != null) erros.push('invasor chega perto do jogador: não tem posição (x/y).');
  if (e.prisioneiro != null && typeof e.prisioneiro?.nome !== 'string') erros.push('prisioneiro precisa de "nome".');
  if (e.descricao != null && typeof e.descricao !== 'string') erros.push('descricao precisa ser texto.');
  if (tipo === 'invasor' && e.prisioneiro != null) erros.push('só "aprisionado" tem prisioneiro.');
  if (e.recompensa && e.bossId && e.bossId === e.id) erros.push('bossId inválido.');
  return erros;
}

function aoAtivar(tipo, ctx) {
  const { hunt, instancia, encontro: e } = ctx;
  if (!hunt) return;
  if (ctx.estado && ctx.personagem?.nome && tipo === 'aprisionado') avisarSala(hunt, ctx.estado, `${ctx.personagem.nome} chegou à cela: ${e.nome}.`);
  const grupo = e[campoDoGrupo(tipo)];
  if (grupo?.criaturas?.length) nascerGrupo(hunt, { ...grupo, ponto: ponto(e), instanciaId: instancia.id, encontro: e.id, opcional: !e.obrigatorio, marca: marcaDoGrupo(tipo) });
  const def = e.bossId ? bossUnico(e.bossId) : null;
  if (def) {
    const r = aparecer(hunt, def, ponto(e), { instanciaId: instancia.id, encontro: e.id, opcional: !e.obrigatorio });
    if (r.ok) e.bossUid = r.monstro.uid;
  }
  Eventos.empurrar(hunt, [{ t: 'say', uid: 'player', text: tipo === 'invasor' ? `Invasão! ${e.nome}` : tipo === 'area-secreta' ? `Área secreta: ${e.nome}` : 'Os captores!', x: hunt.pos.x, y: hunt.pos.y, color: tipo === 'invasor' ? '#ff4a4a' : tipo === 'area-secreta' ? '#5cc8ff' : '#c040ff' }]);
}

const emCampo = (hunt, e) => bichosDaSala(hunt).some((m) => m.hp > 0 && m.encontro === e.id && (m.guardiao || m.invasor)) || vivoDoEncontro(hunt, e.id);

function verificar(tipo, ctx) {
  const { hunt, instancia, encontro: e, agora } = ctx;
  if (!hunt || emCampo(hunt, e)) return;
  if (!Estado.concluir(instancia, e.id, { agora }).ok) return;
  if (e.recompensa) pagarRolagens(ctx, e, e.recompensa.rolagens ?? 1);
  pagarConclusao(ctx, e);
  if (e.bencao && ctx.estado) Altares.aplicar(quemEstaNaSala(hunt, ctx.estado), e.bencao.efeitos, e.bencao.duracaoMs, { id: `${e.id}:bencao`, hunt });
  Eventos.empurrar(hunt, [{ t: 'say', uid: 'player', text: tipo === 'aprisionado' ? `${e.prisioneiro?.nome ?? 'O prisioneiro'} foi libertado!` : tipo === 'area-secreta' ? 'A área secreta foi limpa!' : 'A invasão foi repelida!', x: hunt.pos.x, y: hunt.pos.y, color: '#4fbf7a' }]);
}

for (const tipo of ['aprisionado', 'invasor', 'area-secreta']) {
  registrarTipo(tipo, {
    // A área secreta pede a DECISÃO do líder: o idle não entra nela (só opcional; expira se `expiraMs`).
    idle: tipo === 'area-secreta' ? 'escolha' : 'combate',
    ...(tipo === 'area-secreta' ? { decisaoDoLider: true } : {}),
    // O invasor não espera interação: chega sozinho, em qualquer modo.
    ...(tipo === 'invasor' ? { sozinho: true } : {}),
    validar: (e) => validar(tipo, e),
    podeAtivar: () => ({ ok: true }),
    aoAtivar: (ctx) => aoAtivar(tipo, ctx),
    verificar: (ctx) => verificar(tipo, ctx),
  });
}
