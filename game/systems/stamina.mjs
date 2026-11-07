// A STAMINA SAIU (o dono, 07/11/2026: "tire a stamina"). O que ficou dela:
//
// - a caça offline tem um limite de horas no lugar dela — 4 h free, 12 h VIP, contadas da saída; bateu, o personagem volta para a
//   cidade, e o login zera o relógio (`database/caca-offline.limiteDoOffline`, `cacadas.avancarAusencia`);
// - a exp do VIP (premium) fica com o x1,5 fixo que a stamina cheia dava (o dono: "VIP fica com o x1,5 fixo"); o free, x1;
// - a Stamina Extension (item 36725) fica com quem tem, sem uso (o dono: "Fica, sem uso" — não se apagam itens dos jogadores).
export const STAMINA_EXTENSION = 36725;
/** O multiplicador de exp do VIP (o que a stamina acima de 39 h dava com premium). */
export const FATOR_DO_VIP = 1.5;

/** O multiplicador de exp: x1,5 com premium, x1 sem. */
export function fatorDeExp(estado) {
  return (estado?.premiumAte ?? 0) > Date.now() ? FATOR_DO_VIP : 1;
}

/** A Stamina Extension: sem uso (a stamina saiu do jogo). */
export function usarExtension() {
  return { ok: false, erro: 'A stamina não existe mais: a Stamina Extension ficou sem uso.' };
}
