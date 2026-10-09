// O QUE FALTA para cada linha da árvore ainda sem efeito (dono, 09/10: "verifique o que tem a ver com gemas / item; verifique o que precisa
// para poder ser implementado corretamente"): o GRUPO (gema, item, mecânica) e o TEMA, com o que o motor ainda não tem. A primeira regra que
// casa vale; a aba Árvore × PoEDB da engine agrupa por tema.
export const TEMAS = [
  // ---- GEMAS: a linha depende de uma mecânica de habilidade
  ['gema', 'Lacaios', /Lacai/, 'os atributos dos lacaios além de dano/vida/velocidade (área, recarga, penetração, buffs ao matar, resistências máximas) — o lacaio do jogo ainda não tem esses números'],
  ['gema', 'Totens', /Totem/, 'totens múltiplos ("invocar dois"), dano sofrido pelo totem, roubo/provocação do totem — o totem do jogo é um só e simples'],
  ['gema', 'Armadilhas e Minas', /Armadilha|Mina\b|Minas\b/, 'armadilhas e minas de verdade (armar, detonar, limite plantado, auras das minas) — no jogo as gemas viram golpes comuns'],
  ['gema', 'Marcas e Runas', /Marca|Vínculo de Runas|Convocação de Runas|Runa/, 'marcas presas ao inimigo (vínculo, convocação, alcance, duração da marca)'],
  ['gema', 'Clamores', /Clamor/, 'o Poder dos clamores, a recarga e os bônus do clamor reforçado'],
  ['gema', 'Maldições', /Maldi|Amaldi/, 'a duração e o "expirou X%" das maldições, maldição sobre inimigo sem maldição, maldições em você'],
  ['gema', 'Auras e Arautos', /Aura|Arauto/, 'efeitos de aura em aliados e a duração das auras não reservadas'],
  ['gema', 'Guardas', /Guarda/, 'o escudo absorvente das guardas'],
  ['gema', 'Canalização e repetição', /Canaliz|Intensidade|Selos|Repetição|Liberar/, 'canalização por estágios, intensidade, selos (Liberar) e repetição de magias — no jogo cada uso é um'],
  ['gema', 'Conjuração', /Conjura|Magias? Não Instantânea/, 'contar as magias conjuradas recentemente e ignorar atordoamento ao conjurar'],
  ['gema', 'Golpes e ataques', /Golpe Corpo a Corpo|Impel|Postura|Alcance de Golpes|Ataques? Impelid/, 'alcance corpo a corpo, ataques impelidos por clamor, posturas'],
  ['gema', 'Oferendas, golens e invocações', /Oferenda|Golem|Espectro|Zumbi|Esqueleto|Convocaç/, 'os efeitos específicos de cada invocação'],
  ['gema', 'Cadáveres', /Cadáver/, 'usar e consumir cadáveres'],
  ['gema', 'Gemas Vaal', /Vaal|Almas/, 'as almas e a carga das gemas Vaal'],
  // ---- ITENS: a linha depende de uma peça vestida
  ['item', 'Defesa de uma peça', /(Escudo|Elmo|Peitoral|Luvas|Botas)( do| das| de)?[^,]*(Equipad|equipad)|do Escudo|no Escudo|do Elmo|do seu Peitoral|das Botas/, 'a defesa de UMA peça ("Evasão do Peitoral", "Defesas do Escudo equipado") — a ficha precisa guardar a armadura/evasão/escudo de cada peça em separado'],
  ['item', 'Frascos', /Frasco/, 'cargas de frasco por abate/inimigo marcado e efeitos durante o frasco'],
  ['item', 'Encaixes e cores', /encaixe/i, 'condições pela cor dos encaixes da arma/cajado'],
  ['item', 'Aljava, anéis, amuleto, cinto', /Aljava|anéis|Anel|Amuleto|Cinto/, 'condições pelos modificadores de outras peças e os bônus da aljava'],
  ['item', 'Joias', /Joia/, 'encaixes de joia na árvore'],
  // ---- MECÂNICAS gerais do combate
  ['mecanica', 'Dreno', /Dreno|Drenad/, 'o dreno do jogo é instantâneo e sem teto — o que depende de ritmo/teto não muda nada'],
  ['mecanica', 'Escudo de Energia', /Escudo de Energia|Escudo Mágico/, 'a recarga do escudo (atraso, início, ritmo), escudo no ponto de atordoamento, caos que não ignora o escudo'],
  ['mecanica', 'Exposição', /Exposiç/, 'exposição com valor mínimo, efeito de exposição em você'],
  ['mecanica', 'Atordoamento', /Atordo/, 'duração do atordoamento crítico, ignorar atordoamento, atordoar em área ao ser atordoado'],
  ['mecanica', 'Reflexo', /reflet/i, 'reflexo de dano dos monstros (o jogo ainda não reflete dano no personagem)'],
  ['mecanica', 'Afecções e controle', /Resfria|Congel|Eletriz|Incend|Sangra|Envenen|Afecç|Empal|Lent/, 'afecções em você (limite, "enquanto tiver uma"), empalar em você, resfriamento mínimo, dano por segundo congelado'],
  ['mecanica', 'Recuperação e regeneração', /Recupera|Regener/, 'recuperação ao longo do tempo, regeneração periódica e a dos inimigos próximos'],
  ['mecanica', 'Precisão e crítico', /Precisão|Crític|Critic/, 'precisão "mais" contra únicos/de perto, crítico contra o personagem'],
  ['mecanica', 'Defesa e armadura', /Armadura|Evasão|Defender|Bloque/, 'defender com armadura extra, bloqueio máximo, evasão condicional'],
  ['mecanica', 'Fúria, cargas e poder', /Fúria|Carga|Poder/, 'ganhos e perdas de cargas/fúria em situações específicas'],
  ['mecanica', 'Debuffs do PoE', /Crueldade|Esmag|Sangue Corrompido|Debilit|Intimid|Mutila/, 'Crueldade, Esmagado, Sangue Corrompido — debuffs que o jogo ainda não tem'],
  ['mecanica', 'Solo e mapa', /Solo|Baú|chão/i, 'solos (sagrado, ardente…) e baús'],
];
/** O tema de uma linha sem efeito: `{ grupo, tema, precisa }` (sem tema: "outros"). */
export function temaDaLinha(texto) {
  for (const [grupo, tema, re, precisa] of TEMAS) if (re.test(texto)) return { grupo, tema, precisa };
  return { grupo: 'mecanica', tema: 'Outros', precisa: 'mecânica própria desta linha' };
}
