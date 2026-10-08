// Os personagens ANTIGOS, do Draevor clássico (dono, 07/10: "as contas existentes devem ser preservadas; NÃO migrar personagens antigos
// para o novo sistema PoE — o personagem novo começa no PoE").
//
// O jogo oficial é o do PoE (`itens-poe/catalogo.ligado`). Um personagem criado no Draevor clássico fica ARQUIVADO: a conta o vê na lista
// (com o selo de arquivado), mas ele não entra no jogo, não é convertido, não roda a caçada offline em segundo plano e não conta no limite
// de personagens da conta (para ninguém ter de apagar um antigo para criar o novo). Os dados dele ficam como estão no banco.
//
// Quem é do PoE: o criado no jogo oficial leva `sistema: 'poe'` (`sessao.estadoInicialPersonagem`); os criados antes dessa marca no jogo
// local do PoE são reconhecidos pelo cinto de frascos (`frascos`) JUNTO com uma classe do PoE (ranger, witch, marauder...).
// Só o cinto não basta (08/10): `morrerNaHunt` enchia o cinto também no Draevor clássico (9cc51225, 07/10) e criava `frascos` em quem morria
// — em produção, personagens do Draevor de level 1024 e 271 passaram por "do PoE", escaparam do arquivamento e seguiram jogando.
import { readFileSync, existsSync } from 'node:fs';
import { ligado } from '../itens-poe/catalogo.mjs';

const ARQUIVO_DAS_CLASSES = new URL('../../gamedata/itens-poe/classes.json', import.meta.url);
/** As classes do PoE (`ranger`, `witch`...): ids que o Draevor clássico nunca usou (as dele são as vocações, `knight`, `druid`...). */
export const CLASSES_DO_POE = new Set(
  existsSync(ARQUIVO_DAS_CLASSES)
    ? Object.keys(JSON.parse(readFileSync(ARQUIVO_DAS_CLASSES, 'utf8')).classes ?? {}).map((c) => c.toLowerCase()).filter((c) => /^[a-z_-]+$/.test(c))
    : [],
);

/** A marca gravada no personagem criado no jogo oficial (PoE). */
export const SISTEMA_DO_POE = 'poe';

/** O personagem é do jogo do PoE? (a marca, ou o cinto de frascos de quem tem classe do PoE) */
export const ehDoPoe = (estado) =>
  estado?.sistema === SISTEMA_DO_POE || (Array.isArray(estado?.frascos) && CLASSES_DO_POE.has(String(estado?.classe ?? '').toLowerCase()));

/** O personagem está ARQUIVADO neste processo? (é do Draevor clássico e o jogo é o oficial, do PoE) */
export const arquivado = (estado) => ligado() && !ehDoPoe(estado);

/**
 * A mesma regra de `ehDoPoe` como condição SQL sobre a tabela `personagens` — para as listas que leem o banco direto (ranking do jogo e
 * do site, pódio da arena, totais do site), que no jogo oficial mostram só quem é do PoE (dono, 07/10: "ranking só com personagens do
 * PoE"). No modo clássico não filtra nada.
 */
export const sqlDoPoe = (dialeto) => {
  if (!ligado()) return '1 = 1';
  const classes = [...CLASSES_DO_POE].map((c) => `'${c}'`).join(', ');
  if (dialeto === 'postgres') {
    const cinto = classes ? ` OR (jsonb_typeof(estado::jsonb -> 'frascos') = 'array' AND lower(estado::jsonb ->> 'classe') IN (${classes}))` : '';
    return `(estado::jsonb ->> 'sistema' = 'poe'${cinto})`;
  }
  const cinto = classes ? ` OR (json_type(estado, '$.frascos') = 'array' AND lower(json_extract(estado, '$.classe')) IN (${classes}))` : '';
  return `(json_extract(estado, '$.sistema') = 'poe'${cinto})`;
};

/** A frase que a tela mostra para o personagem arquivado. */
export const MENSAGEM_DO_ARQUIVADO = 'Este personagem é do Draevor clássico e foi arquivado: ele continua guardado na sua conta, mas não entra no novo Draevor. Crie um novo personagem para jogar.';
