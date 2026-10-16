// (15/10, lote 31 — S001/P025 da auditoria da árvore) QUEM deu o último dano no monstro, e com que golpe. No PoE o abate é SEU só quando o
// golpe fatal é seu: o do lacaio, do totem e do familiar não conta para o "ao Matar", o "Matou Recentemente" e os ganhos por abate (o PoE
// tem stats próprios para eles); e o "ao Matar Corpo a Corpo" olha o golpe fatal (um acerto corpo a corpo — o dano contínuo não é acerto).
// Cada lugar que fere o monstro carimba (`carimbar`); `hunt/combate.processarMortes` lê. Sem carimbo, o abate é seu (como antes).
export const VOCE = 'voce';
export const LACAIO = 'lacaio';
export const TOTEM = 'totem';
/** Marca no monstro quem o feriu por último e as tags do golpe (`null` sem acerto — o dano contínuo, uma explosão). */
export function carimbar(alvo, quem, tags = null) {
  if (alvo) alvo.poeUltimoDano = { quem, tags: tags ? [...tags] : null };
}
/** O abate é seu? (o último dano não foi do lacaio nem do totem) */
export const abateSeu = (alvo) => {
  const q = alvo?.poeUltimoDano?.quem;
  return q !== LACAIO && q !== TOTEM;
};
/** As tags do golpe fatal (vazio se não foi um acerto); com `acerto` quando foi ("Inimigos Mortos com Acertos Mágicos ou de Ataques"). */
export const tagsDoAbate = (alvo) => {
  const t = alvo?.poeUltimoDano?.tags;
  return t ? [...t, 'acerto'] : [];
};
/** O evento do PoE do abate: `matar` (o seu), `matarLacaio` ("por você ou seus Lacaios"), `matarTotem` ("você ou seus Totens Matarem"). */
export const eventoDoAbate = (alvo) => ({ [LACAIO]: 'matarLacaio', [TOTEM]: 'matarTotem' })[alvo?.poeUltimoDano?.quem] ?? 'matar';
