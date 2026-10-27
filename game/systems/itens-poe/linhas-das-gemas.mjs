// As LINHAS LOCAIS das gemas ativas do PoE (dono, 17/10: "zero efeitos ausentes … arquitetura reutilizável, mas com comportamento
// específico"). Muitas linhas de gema são um modificador que vale SÓ nos usos daquela gema — "200% de Poder Arcano" (Raio Cinético), "X% mais
// Velocidade de Ataque por Carga de Frenesi" (Frenesi), "X% mais Dano com a Arma Principal" (Golpe Duplo da Ambidestria), "Chance de Crítico
// aumentada em X% contra Inimigos Eletrizados" (Armadilha de Raio) — e o jogo já calcula esse modificador quando ele vem da árvore ou de uma
// peça (`poder_arcano`, `atk_speed_mais`, `mais_dano@maoPrincipal`, `crit_chance_inc@alvoEletrizado`…). Aqui cada linha vira os ATRIBUTOS do
// PoE no formato da soma (`stat%escala@condições` — `condicoes-poe.partir`), e no uso da gema eles entram na ficha DAQUELE uso como
// condicionais de golpe (`ficha.porTag`, com a tag `habilidade`, que todo uso tem): o dano, o crítico, a área, a velocidade e os eventos do
// acerto os leem pelo caminho de sempre (`somaPorTags`/`valor`). Nada vale fora da gema.
//
//   REGRAS: as frases próprias das gemas (o "mais"/"menos" e os "por Carga" que as peças não escrevem assim) e, sem regra própria, o tradutor
//   dos mods das peças e da árvore (`traduzir.traduzirParte`) — a mesma frase, a mesma chave. Só entra a linha cujos atributos têm efeito no
//   combate (`traduzir.atributoTemEfeito`): o resto segue "efeito não simulado" no status da gema.
import { ligado } from './catalogo.mjs';
import { partir, ehCondDeEstado, condicoesDe, vale, fatorDaEscala, comTeto, ESCALAS_DA_FICHA } from './condicoes-poe.mjs';
import { traduzirParte, atributoTemEfeito } from './traduzir.mjs';

const N = String.raw`(\d+(?:[.,]\d+)?)`;
const num = (x) => Number(String(x).replace(',', '.'));
/**
 * [regex, (m) => { atributo: valor }]. O valor é o número da linha no nível (o PoE escreve "menos" com o número positivo: o sinal sai aqui).
 * As condições são as do jogo (`CONDICOES_DE_ESTADO` e `TAGS_DE_GOLPE`); a escala "por Carga de X" é `%carga:<x>` (`fatorDaEscala`).
 */
const CARGA = { Frenesi: 'frenesi', Poder: 'poder', Tolerância: 'tolerancia' };
const REGRAS = [
  // (17/10, lote G18) as afecções não danificadoras da gema: o "como se causasse" (o PoB: <Afecção>AsThoughDealing MORE — a força da Eletrização e
  // do Resfriamento, a duração do Congelamento), e a Duração das afecções de Gelo (o Congelamento e o Resfriamento)
  // (lote A5, dono 20/10: o plural da Sobrecarga — "Eletrizam Inimigos como se causassem 690% mais Dano")
  [new RegExp(`^(Eletriza|Resfria|Congela)m? Inimigos como se causassem? ${N} ?% mais Dano$`, 'i'),(m) => ({ [{ eletriza: 'eletrizacao_como_mais', resfria: 'resfriamento_como_mais', congela: 'congelamento_como_mais' }[m[1].toLowerCase()]]: num(m[2]) })],
  [new RegExp(`^Congela inimigos causando ${N} ?% mais Dano$`, 'i'), (m) => ({ congelamento_como_mais: num(m[1]) })],
  // (lote G18b: o Golpe de Misericórdia da gema — mata no acerto com 10% de vida, 5% no Raro/Único — `ModsPoe.aoAcertar`)
  [/^Golpe de Misericórdia$/i, () => ({ culling: 1 })],
  // (lote B3, dono 21/10: a Cascata Glacial — "Empurra Inimigos ao Acertar", o global_knockback do PoB: o Empurrão do jogo em todo acerto da gema, `ModsPoe.aoAcertar`)
  [/^Empurra Inimigos ao Acertar$/i, () => ({ chance_empurrar: 100 })],
  // (o "+N % à Chance de Crítico" das Concocções: pontos na chance base)
  [new RegExp(`^\\+${N} ?% à Chance de Crítico$`, 'i'), (m) => ({ crit_chance: num(m[1]) })],
  // (o Golpe Duplo: o dano dobrado contra quem sangra)
  [new RegExp(`^${N} ?% de chance de causar Dano Dobrado (?:à|a|aos?) Inimigos Sangrando$`, 'i'), (m) => ({ 'chance_dano_dobrado@alvoSangrando': num(m[1]) })],
  // (o atordoamento da gema que o tradutor não conhece: a duração, a chance de dobrar, a duração no inimigo em Vida Cheia)
  [new RegExp(`^Duração do Atordoamento em inimigos aumentada em ${N} ?%$`, 'i'), (m) => ({ stun_duration: num(m[1]) })],
  [new RegExp(`^${N} ?% de chance de dobrar a Duração de Atordoamentos$`, 'i'), (m) => ({ chance_dobrar_atordoamento: num(m[1]) })],
  [new RegExp(`^Duração de Atordoamentos em Inimigos com Vida Cheia aumentada em ${N} ?%$`, 'i'), (m) => ({ 'stun_duration@alvoVidaCheia': num(m[1]) })],
  // (lote C2, dono 20/10: o Esmagar Ossos da Carnificina — active_skill_damage_+%_final_vs_stunned_enemies, o "mais" contra o atordoado: hits e afecções)
  [new RegExp(`^Mais ${N} ?% de dano contra inimigos atordoados$`, 'i'), (m) => ({ 'mais_dano@alvoAtordoado': num(m[1]) })],
  // (o Martelo Glacial: o terceiro golpe seguido — a tag `terceiroGolpe` do golpe)
  [new RegExp(`^Cada terceiro golpe sucessivo Congela inimigos como se houvesse causado ${N} ?% mais Dano$`, 'i'), (m) => ({ 'congelamento_como_mais@terceiroGolpe': num(m[1]) })],
  [/^Cada terceiro golpe sucessivo é um Golpe Crítico$/i, () => ({ 'crit_chance@terceiroGolpe': 100 })],
  [new RegExp(`^Duração d(?:e|as) Afecções de Gelo aumentada em ${N} ?%$`, 'i'), (m) => ({ duracao_congelamento: num(m[1]), duracao_resfriamento: num(m[1]) })],
  // "200 % de Poder Arcano": os aumentos de Dano Mágico também valem no dano de ataque desta gema, a X% do valor (`fichaDoGolpe`).
  [new RegExp(`^${N} ?% de Poder Arcano$`), (m) => ({ poder_arcano: num(m[1]) })],
  // "X% de chance de causar Dano Dobrado" (Golpe Pesado) e "2% de chance de causar dano dobrado para cada 10 de inteligência" (o de Trarthus).
  [new RegExp(`^${N} ?% de chance de causar Dano Dobrado$`, 'i'), (m) => ({ chance_dano_dobrado: num(m[1]) })],
  [new RegExp(`^${N} ?% de chance de causar dano dobrado para cada ${N} de inteligência$`, 'i'), (m) => ({ [`chance_dano_dobrado%atr:int:${num(m[2])}`]: num(m[1]) })],
  // O crítico com condição do alvo.
  [new RegExp(`^${N} ?% de aumento da Chance de Acerto Crítico contra Inimigos Eletrizados$`), (m) => ({ 'crit_chance_inc@alvoEletrizado': num(m[1]) })],
  [new RegExp(`^${N} ?% mais Chance de Acerto Crítico contra Inimigos que estejam em Vida Cheia$`), (m) => ({ 'crit_mais_pct@alvoVidaCheia': num(m[1]) })],
  // Por Carga (de Frenesi, Poder, Tolerância).
  [new RegExp(`^${N} ?% mais Change? de Golpe Crítico por Carga de (Frenesi|Poder|Tolerância)$`), (m) => ({ [`crit_mais_pct%carga:${CARGA[m[2]]}`]: num(m[1]) })],
  [new RegExp(`^\\+${N} ?% de Multiplicador de Acerto Crítico por Carga de (Frenesi|Poder|Tolerância)$`), (m) => ({ [`crit_dmg%carga:${CARGA[m[2]]}`]: num(m[1]) })],
  [new RegExp(`^${N} ?% mais Dano com Ataques por Carga de (Frenesi|Poder|Tolerância)$`), (m) => ({ [`mais_dano%carga:${CARGA[m[2]]}`]: num(m[1]) })],
  [new RegExp(`^${N} ?% mais Velocidade de Ataque por Carga de (Frenesi|Poder|Tolerância)$`), (m) => ({ [`atk_speed_mais%carga:${CARGA[m[2]]}`]: num(m[1]) })],
  [new RegExp(`^${N} ?% mais Área de Efeito por Carga de (Frenesi|Poder|Tolerância)$`), (m) => ({ [`area_mais%carga:${CARGA[m[2]]}`]: num(m[1]) })],
  // (lote A1b, dono 19/10) o Golpe Súbito e o do Poder: "Velocidade de Ataque aumentada em X% por Carga de Frenesi", "Chance de Crítico aumentada em X%
  // por Carga de Poder" — os "aumentados" por carga (o "mais" está nas regras de cima)
  [new RegExp(`^Velocidade de Ataque aumentada em ${N} ?% por Carga de (Frenesi|Poder|Tolerância)$`), (m) => ({ [`atk_speed%carga:${CARGA[m[2]]}`]: num(m[1]) })],
  [new RegExp(`^Chance de Crítico aumentada em ${N} ?% por Carga de (Frenesi|Poder|Tolerância)$`), (m) => ({ [`crit_chance_inc%carga:${CARGA[m[2]]}`]: num(m[1]) })],
  // A Postura (Sangue e Areia) e a mão do ataque.
  [new RegExp(`^${N} ?% mais Área de Efeito enquanto na Postura da Areia$`), (m) => ({ 'area_mais@posturaAreia': num(m[1]) })],
  [new RegExp(`^${N} ?% menos Dano na Postura de Sangue$`), (m) => ({ 'mais_dano@posturaSangue': -num(m[1]) })],
  // (lote C3, dono 25/10) a Postura nas gemas de Postura (o PoB: Condition BloodStance / ChangedStanceRecently): a qualidade da Perfuração da Dualidade ("+0,25% mais Dano
  // na Postura de Sangue" — o mesmo stat do −75%: somam), o Sangrar só na de Sangue da Dilaceração (o poedb escreve "chancer") e a velocidade "se mudou de Postura
  // Recentemente" da qualidade dela; o "12% mais Velocidade de Ataque" da Tempestade de Lâminas dentro de uma Sangrenta sua (`emTempestadeSangrenta`)
  [new RegExp(`^${N} ?% mais Dano na Postura de Sangue$`), (m) => ({ 'mais_dano@posturaSangue': num(m[1]) })],
  [new RegExp(`^${N} ?% de chancer? de causar Sangramento enquanto na Postura de Sangue$`, 'i'), (m) => ({ 'chance_bleed@posturaSangue': num(m[1]) })],
  [new RegExp(`^Velocidade de Ataque aumentada em ${N} ?% caso tenha mudado de Postura Recentemente$`, 'i'), (m) => ({ 'atk_speed@mudouPosturaRecente': num(m[1]) })],
  [new RegExp(`^${N} ?% mais Velocidade de Ataque enquanto estiver em uma Tempestade de Lâminas Sangrentas$`, 'i'), (m) => ({ 'atk_speed_mais@emTempestadeSangrenta': num(m[1]) })],
  [new RegExp(`^${N} ?% mais Dano com a Arma Principal$`), (m) => ({ 'mais_dano@maoPrincipal': num(m[1]) })],
  // (lote E2A, 26/10: a qualidade da Balista de Cerco de Trarthus — active_skill_projectile_damage_+%_final, só no acerto/afecção do projétil)
  [new RegExp(`^${N} ?% mais Dano de Projétil$`), (m) => ({ 'mais_dano@projetil': num(m[1]) })],
  // As frases de gema que as peças escrevem de outro jeito: a duração da habilidade, a velocidade de conjuração (a da gema soma como a "com
  // Habilidades de X" — `cast_speed_tag`), o efeito do Empalamento.
  [new RegExp(`^Duração do Efeito de Habilidades? aumentada em ${N} ?%$`), (m) => ({ duracao_habilidades: num(m[1]) })],
  [new RegExp(`^Velocidade de Conjuração aumentada em ${N} ?%$`), (m) => ({ cast_speed_tag: num(m[1]) })],
  [new RegExp(`^Efeito do Empalamento aumentado em ${N} ?%$`), (m) => ({ efeito_empalamento: num(m[1]) })],
  // "mais Dano com Acertos e Afecções" contra um alvo (o golpe inteiro — as afecções do jogo saem do acerto).
  [new RegExp(`^\\+?${N} ?% mais Dano com Acertos e Afecções contra Inimigos em Vida Cheia$`), (m) => ({ 'mais_dano@alvoVidaCheia': num(m[1]) })],
  [new RegExp(`^${N} ?% mais Dano com Acertos e Afecções contra Inimigos Incendiados$`), (m) => ({ 'mais_dano@alvoIncendiado': num(m[1]) })],
  // ---- (lote A5, dono 20/10: os suportes simples e as linhas das famílias 1–4 — a mesma frase vale na gema e no suporte, sem o "Habilidades
  // Suportadas têm") ----
  // (família 1) o Dreno de Escudo de Energia (o Dreno de Energia; o PoB: energy_shield_leech_from_any_damage_permyriad — `Ficha.aplicarLeech`), a
  // Duração de Efeito da Habilidade na ordem do poedb (a Eficácia), o Acerto Fortificante da Golpe Vigilante (8 s — o PoB gain_fortify_on_melee_hit_ms
  // 8000, act_str.lua:12448 — no lugar dos 6 s da base), o Empalamento do suporte e da Queda de Lâminas do Empalamento, o crítico sem dano extra,
  // o Golpe de Misericórdia (comum) e o Abater o Fraco (só Normal e Mágico), o reflexo elemental, o atordoamento da qualidade da Carga de Tolerância
  // e o Empalamento refletido no golpe final (o Golpe Duplo do Empalamento — D4: 1 casa)
  [new RegExp(`^${N} ?% d[eo] Dano Drenado como Escudo de Energia$`, 'i'), (m) => ({ es_leech: num(m[1]) })],
  [new RegExp(`^${N} ?% de Duração de Efeito da Habilidade aumentada$`, 'i'), (m) => ({ duracao_habilidades: num(m[1]) })],
  [new RegExp(`^Acertos Corpo a Corpo Fortificam por ${N} segundos?$`, 'i'), (m) => ({ 'chance_fortificar@corpo': 100, fortificacao_base_s: num(m[1]) })],
  [new RegExp(`^${N} ?% de chance de Empalar Inimigos ao Acertar$`, 'i'), (m) => ({ chance_empalar: num(m[1]) })],
  [new RegExp(`^O Efeito de Empalamento aument\\S* em ${N} ?%$`, 'i'), (m) => ({ efeito_empalamento: num(m[1]) })],
  [/^Golpes? Críticos infligem Empalamento$/i, () => ({ 'chance_empalar@critico': 100 })],
  [/^Golpes Críticos não causam Dano extra$/i, () => ({ critico_sem_dano_extra: 1 })],
  [new RegExp(`^Mata Inimigos com ${N} ?% de Vida ou menos quando Acertados?$`, 'i'), () => ({ culling: 1 })],
  [new RegExp(`^Mata inimigos de raridade normal e mágica com ${N} ?% de vida ou menos quando atingidos(?: por habilidades reforçadas)?$`, 'i'), (m) => ({ culling_normal_magico: num(m[1]) })],
  [/^Dano Elemental não pode ser Refletido$/i, () => ({ imune_reflexo_elemental: 1 })],
  [new RegExp(`^${N} ?% de Duração de Atordoamentos em Inimigos aumentada$`, 'i'), (m) => ({ stun_duration: num(m[1]) })],
  [/^Golpes Finais fazem com que os Empalamentos em Inimigos Reflitam o Dano aos Inimigos ao redor$/i, () => ({ empalar_reflete_ao_matar: 1 })],
  // (família 2) o Golpe da Víbora com duas armas (o PoB: Speed MORE −30 e Damage MORE −20 com ModFlag.Hit, ambos com DualWielding — act_dex.lua:16470,
  // 16473; o "ㅤ- " do começo é do poedb)
  [new RegExp(`^Quando em Empunhadura Dupla, ${N} ?% Menos Velocidade de Ataque$`, 'i'), (m) => ({ 'atk_speed_mais@duasArmas': -num(m[1]) })],
  [new RegExp(`^[\\sㅤ]*-\\s*${N} ?% de dano de ataque com duas armas$`, 'i'), (m) => ({ 'mais_dano_acerto@duasArmas': -num(m[1]) })],
  // (família 3) a Eletrização: o "Anel sempre Eletriza" da Nova Elétrica (D3: 100% de chance no acerto dela), a duração da Sobrecarga; o Resfriamento
  // do Resfriamento Ósseo e do Coursing Current ("Efeito dos Resfriamentos … aumentado em X%"), o "mais Efeito" do Estalo Gélido (o PoB:
  // active_skill_chill_effect_+%_final, act_int.lua:2832 — D4: também no chão dele) e o Congelar no resfriado da Hipotermia
  [/^Anel sempre Eletriza$/i, () => ({ chance_shock: 100 })],
  [new RegExp(`^${N} ?% de Duração de Eletrização aumentada em Inimigos$`, 'i'), (m) => ({ duracao_eletrizacao: num(m[1]) })],
  [new RegExp(`^Efeito dos Resfriamentos aumentado em ${N} ?%$`, 'i'), (m) => ({ efeito_resfriamento: num(m[1]) })],
  [new RegExp(`^${N} ?% mais Efeito de Resfriamento$`, 'i'), (m) => ({ efeito_resfriamento_mais: num(m[1]) })],
  [new RegExp(`^${N} ?% de chance de Congelar Inimigos Resfriados$`, 'i'), (m) => ({ 'chance_freeze@alvoResfriado': num(m[1]) })],
  // (família 4) a Exposição das Penetrações Despertas (o PoB: base_inflict_<el>_exposure_on_hit_%_chance, sup_int.lua:4633 — a Exposição padrão, −10%
  // por 4 s), a resistência invertida do Golpe Selvagem dos Extremos (o PoB: …_negated_on_elemental_damage_hit_%_chance 100, act_dex.lua:17257), o −X%
  // de Fogo dos Incendiados da Combustão e a penetração da Chuva Explosiva
  [new RegExp(`^${N} ?% de chance de infligir(?:em)? Exposição a (Fogo|Gelo|Raio) ao Acertar$`, 'i'), (m) => ({ [`exposicao_chance_${m[2].toLowerCase()}`]: num(m[1]) })],
  [/^Acertos tratam os valores da Resistência Elemental dos Monstros Inimigos como invertidos$/i, () => ({ chance_res_invertida: 100 })],
  [new RegExp(`^Inimigos Incendiados possuem -?${N} ?% de Resistência a Fogo$`, 'i'), (m) => ({ res_menos_fogo_incendiado: num(m[1]) })],
  [new RegExp(`^Penetra ${N} ?% da Resistência a (Fogo|Gelo|Raio)$`, 'i'), (m) => ({ [`${{ fogo: 'fire', gelo: 'ice', raio: 'energy' }[m[2].toLowerCase()]}_pen`]: num(m[1]) })],
  // (lote A5b, dono 20/10: a PRECISÃO do uso — o "+X de Precisão" já vem do tradutor; o "% aumentada" na ordem do poedb, a qualidade da Precisão Adicional — e o
  // "Não pode ser Evadido" das gemas Vaal, da Evisceração, do Punho Esmagador…: o acerto da gema de ataque não erra — `condicoes-poe.fichaDoGolpe`, `Defesa.errou`)
  [new RegExp(`^${N} ?% de Precisão aumentada$`, 'i'), (m) => ({ accuracy_inc: num(m[1]) })],
  [/^Não pode ser Evadido$/i, () => ({ nunca_erra: 1 })],
  // (lote B1, dono 20/10) a Mutilação da Chuva de Flechas Vaal ("Mutila ao Acertar" — o PoB: global_maim_on_hit — e "150% de aumento do Efeito de Mutilação" —
  // maim_effect_+%: a lentidão de 30% × 2,5 = 75%, `ModsPoe.aoAcertar`) e o "X% mais Velocidade de Conjuração" da qualidade da Nova Elétrica da Procissão (o PoB:
  // active_skill_cast_speed_+%_final — multiplica o tempo de conjuração do uso, `Acoes.temposDaGemaPoe`)
  [/^Mutila ao Acertar$/i, () => ({ chance_mutilar: 100 })],
  [new RegExp(`^${N} ?% de aumento do Efeito de Mutilação$`, 'i'), (m) => ({ efeito_mutilacao: num(m[1]) })],
  [new RegExp(`^${N} ?% mais Velocidade de Conjuração$`, 'i'), (m) => ({ cast_speed_mais: num(m[1]) })],
  // (lote PR1, dono 20/10) o dano ADICIONAL igual a X% da Vida/Mana máxima — a Flecha Ardente do Vigor (o PoB: added_fire_damage_to_attacks_equal_to_%_maximum_life,
  // FireMin e FireMax BASE pelo PercentStat Life, act_dex.lua:3478) e o Sifão de Poder do Arquimago (attack_skills_have_added_lightning_damage_equal_to_%_of_maximum_mana,
  // + 0,15 por qualidade): o mínimo e o máximo iguais, × a Vida/Mana máxima de agora (a escala `vidaMax:1`/`manaMax:1`, `fatorDaEscala`)
  // (lote PR3, dono 21/10: + a ordem do Físico — "Causa Dano Físico Adicional igual a 15% da Mana Máxima", a Explosão Cinética da Ramificação: o PoB,
  // added_physical_damage_to_attacks_equal_to_%_maximum_mana — PhysicalMin/Max BASE pelo PercentStat Mana, act_int.lua:10769)
  [new RegExp(`^Causa Dano (?:de )?(Fogo|Gelo|Raio|Caos|Físico) Adicional igual a ${N} ?% da (Vida|Mana) M[áa]xima$`, 'i'), (m) => {
    const e = { fogo: 'fire', gelo: 'ice', raio: 'energy', caos: 'chaos', físico: 'physical' }[m[1].toLowerCase()];
    const escala = m[3].toLowerCase() === 'vida' ? 'vidaMax:1' : 'manaMax:1';
    return { [`added_${e}_dmg_min%${escala}`]: num(m[2]) / 100, [`added_${e}_dmg_max%${escala}`]: num(m[2]) / 100 };
  }],
  // (lote C1, dono 20/10) a Cegueira das Lâminas Velozes Vaal: "100% de chance de Cegar inimigos ao acertá-los" (o PoB: global_chance_to_blind_on_hit_%) e "Efeito da
  // Cegueira aumentado em 68%" (blind_effect_+%) — a Cegueira do PoE no acerto (`ModsPoe.aoAcertar`: `chance_cegar`, `efeito_cegueira`)
  // (lote S1, 26/10: + a frase do Cegar — "têm 10% de chance de Cegar inimigos ao acertar" — e a duração dele: "38% da duração da Cegueira aumentada", o
  // blind_duration_+% do PoE — `ModsPoe.aoAcertar`, `duracao_cegueira`)
  [new RegExp(`^${N} ?% de chance de Cegar inimigos ao acert(?:á-los|ar)$`, 'i'), (m) => ({ chance_cegar: num(m[1]) })],
  [new RegExp(`^Efeito da Cegueira aumentado em ${N} ?%$`, 'i'), (m) => ({ efeito_cegueira: num(m[1]) })],
  [new RegExp(`^${N} ?% da duração da Cegueira aumentada$`, 'i'), (m) => ({ duracao_cegueira: num(m[1]) })],
  // ---- (lote S1, 26/10: os suportes com 1 ou 2 linhas faltando) ----
  // - a qualidade da Mutilação ("Efeito da Mutilação aumentado em 20%" — maim_effect_+%, como o "de aumento do Efeito de Mutilação" acima);
  [new RegExp(`^Efeito da Mutilação aumentado em ${N} ?%$`, 'i'), (m) => ({ efeito_mutilacao: num(m[1]) })],
  // - o Esmagar da Brutalidade Desperta, o Intimidar do Dano Físico Corpo a Corpo Desperto e o "Enervar" (o Unnerve do PoE — o `inervado`: 10% mais dano
  //   de Magias sofrido) da Destruição Controlada Desperta, "por 4 segundos ao Acertar" (`ModsPoe.aoAcertar`: a chance e a duração; a do Esmagar é sempre 4 s);
  [new RegExp(`^${N} ?% de chance de Esmagar Inimigos por 4 segundos ao Acertar$`, 'i'), (m) => ({ chance_esmagar: num(m[1]) })],
  [new RegExp(`^${N} ?% de chance de (Intimidar|Enervar|Inervar) Inimigos por ${N} segundos ao Acertar$`, 'i'), (m) => (m[2].toLowerCase() === 'intimidar' ? { chance_intimidar: num(m[1]), intimidar_s: num(m[3]) } : { chance_inervar: num(m[1]), inervar_s: num(m[3]) })],
  // - o "X% mais Dano por Carga" sem o "com Ataques" (a Carga de Tolerância no Atordoamento Corpo a Corpo, a Carga de Poder no Crítico — o PoB: Damage MORE
  //   × o Multiplicador da carga);
  [new RegExp(`^${N} ?% mais Dano por Carga de (Frenesi|Poder|Tolerância)$`), (m) => ({ [`mais_dano%carga:${CARGA[m[2]]}`]: num(m[1]) })],
  // (lote E1b, 26/10) a Armadilha de Urso dos Espetos: "Empala Inimigos ao Acertar" (o PoB: impale_on_hit_%_chance 100 — o Empalamento do jogo no acerto)
  [/^Empala Inimigos ao Acertar$/i, () => ({ chance_empalar: 100 })],
];

/**
 * Os atributos que o USO de uma gema lê da ficha do golpe (com as tags dele — `condicoes-poe.fichaDoGolpe`, `valor`, `alvosDasPecas`,
 * `acoes.temposDaGemaPoe`). Um atributo fora daqui (o máximo de zumbis, a resistência dos lacaios…) vale na ficha do PERSONAGEM, não num
 * uso: a linha local com ele segue "efeito não simulado" até alguém o ler no uso — o balão não promete o que o golpe não faz.
 * (lote A5, dono 20/10: + o dreno de Escudo de Energia e o de Vida das magias — `Ficha.aplicarLeech` pela ficha do uso —, a Fortificação, o crítico sem
 * dano extra, o Golpe de Misericórdia do Normal/Mágico, o reflexo elemental — `Mecanicas.aoReceberDano` com a ficha do uso —, o Empalamento refletido,
 * o alcance corpo a corpo — o golpe da gema —, o "mais Dano só com Acertos", o máximo da Eletrização, a Exposição com chance e o −X% de Fogo dos Incendiados)
 * (lote A5b, dono 20/10: + a precisão — `accuracy`, `accuracy_inc` — e o "Não pode ser Evadido" — `nunca_erra` —: a ficha do golpe as lê, e a gema de ataque
 * rola o acerto por alvo com elas — `acoes.dispararSemMarcar`, `acertar`)
 * (lote B1, dono 20/10: + o "mais Velocidade de Conjuração" — `cast_speed_mais`, `acoes.temposDaGemaPoe`; a Mutilação já entrava pelo `chance_…`/`efeito_…`)
 */
const LIDOS_NO_USO = /^(dmg_inc|crit_chance_inc|crit_chance|crit_dmg|crit_mais_pct|elem_pen|phys_pen|fire_pen|ice_pen|energy_pen|phys_dmg|fire_dmg|ice_dmg|energy_dmg|chaos_dmg|mais_dano|mais_dano_(fisico|fogo|gelo|raio|caos|elemental)|life_leech|mana_leech|poder_arcano|chance_dano_dobrado|chance_dano_triplo|ignora_reducao_fisica|nunca_critico|added_(fire|ice|energy|chaos|physical)_dmg_(min|max)|area_inc|area_mais|atk_speed|atk_speed_mais|cast_speed_tag|furia_por_acerto|life_on_hit|mana_on_hit|velocidade_clamor|enemy_stun_threshold_red|distancia_empurrao|stun_duration|chance_dobrar_atordoamento|culling|(eletrizacao|resfriamento|congelamento)_como_mais|(chance|dot|dano_dot|ailment|poison|bleed|ignite|duracao|efeito)_[a-z_]+|es_leech|es_leech_magia|vida_leech_magia|fortificacao_[a-z_]+|critico_sem_dano_extra|culling_[a-z_]+|imune_reflexo_elemental|empalar_[a-z_]+|alcance_corpo_m|mais_dano_acerto|eletrizacao_maximo|exposicao_chance_(fogo|gelo|raio)|res_menos_fogo_incendiado|accuracy|accuracy_inc|nunca_erra|cast_speed_mais|intimidar_s|inervar_s|phys_as_extra_(fire|ice|energy|chaos))$/;
const lidoNoUso = (k) => LIDOS_NO_USO.test(partir(k).stat) && atributoTemEfeito(k);

/** Os atributos de UMA linha (com os números do nível): `{ stat: valor }`, ou null se nenhuma regra tem efeito no uso da gema. */
export function atributosDaLinha(linha) {
  const l = String(linha).trim();
  // (a qualidade escreve "+(0 — 50) % de Poder Arcano": o "+" na frente não muda a regra)
  const semMais = l.replace(/^\+\s*/, '');
  for (const [re, f] of REGRAS) {
    const m = re.exec(l) ?? re.exec(semMais);
    if (m) { const af = f(m); return Object.keys(af).every(lidoNoUso) ? af : null; }
  }
  // O tradutor das peças e da árvore: a linha como modelo (cada número vira `{i}`).
  const valores = [];
  const modelo = l.replace(/(\d+(?:[.,]\d+)?)\s*%/g, (_, x) => `${x}%`).replace(/\d+(?:[.,]\d+)?/g, (x) => { valores.push(num(x)); return `{${valores.length - 1}}`; });
  const t = traduzirParte(modelo, valores);
  if (!['equivalente', 'aproximado', 'novo'].includes(t.estado) || !t.efeitos.length) return null;
  const af = {};
  for (const e of t.efeitos) {
    if (typeof e.valor !== 'number' || !lidoNoUso(e.stat)) return null;
    af[e.stat] = (af[e.stat] ?? 0) + e.valor;
  }
  return af;
}
/** A linha é uma linha local que o jogo faz (sai de "efeito não simulado"). */
export const ehLinhaLocalDaGema = (linha) => !!atributosDaLinha(linha);

/** Os atributos locais de uma lista de linhas: `{ af, feitas: [linha] }`. */
export function atributosDasLinhas(linhas = []) {
  const af = {};
  const feitas = [];
  for (const l of linhas) {
    const x = atributosDaLinha(l);
    if (!x) continue;
    feitas.push(l);
    for (const [k, v] of Object.entries(x)) af[k] = (af[k] ?? 0) + v;
  }
  return { af, feitas };
}

/**
 * A ficha DESTE uso com as linhas locais da gema (`af`, de `atributosDasLinhas`): cada atributo entra em `ficha.porTag` com a tag
 * `habilidade` (mais as tags de golpe da chave), já com as condições de estado conferidas e a escala ("por Carga") resolvida — como
 * `condicoes-poe.porTag` faz com a soma do personagem (o total para os máximos e as escalas é o do personagem: `ficha.afPoe`). A mesma
 * ficha volta se nada vale. `marca`: para não somar duas vezes no mesmo uso (o `disparar` e o `contaDoDano` passam pela mesma ficha).
 */
export function fichaComAsLinhas(estado, ficha, af, marca) {
  if (!ligado() || !ficha?.afPoe || !af || !Object.keys(af).length || ficha.linhasDaGema === marca) return ficha;
  const extra = [];
  let conds = null;
  for (const [k, v] of Object.entries(af)) {
    if (typeof v !== 'number' || !v || String(k).startsWith('ev:')) continue;
    const { stat, escala, conds: c, teto } = partir(k);
    if (escala && ESCALAS_DA_FICHA.test(escala)) continue;
    const deEstado = c.filter((x) => ehCondDeEstado(x));
    if (deEstado.length) {
      conds ??= condicoesDe(estado, ficha.afPoe, null);
      if (!deEstado.every((x) => vale(conds, x))) continue;
    }
    const m = escala ? fatorDaEscala(estado, ficha.afPoe, null, escala) : 1;
    if (m) extra.push({ stat, tags: ['habilidade', ...c.filter((x) => !ehCondDeEstado(x))], valor: comTeto(v, m, teto) });
  }
  if (!extra.length) return { ...ficha, linhasDaGema: marca };
  return { ...ficha, porTag: [...(ficha.porTag ?? []), ...extra], linhasDaGema: marca };
}

/**
 * (17/10, lote G8) As linhas de BUFF das gemas de aura, arauto, guarda e clamor ("Buff concede…"): o que o buff dá a quem o tem, como os
 * atributos da soma (`GemasPoe.buffNoNivel` → `afPoe` do buff → a ficha). Primeiro as frases próprias (o dano adicionado dos Arautos — aos
 * ataques e às magias), depois o tradutor das peças com o "Buff concede" tirado ("Buff concede Imunidade a Sangramento" → `imune_sangramento`).
 * Só entra o atributo com efeito no combate. `{ stat: valor }` ou null.
 */
const EL_DO_BUFF = { Gelo: 'ice', Fogo: 'fire', Raio: 'energy', Caos: 'chaos', Físico: 'physical' };
const BUFF_PROPRIO = [
  // (lote A1, dono 19/10 — D7) a Corrida de Fase Antiga como buff: a Furtividade (o raio em que os bichos notam você —
  // `ModsPoe.percepcaoComFurtividade`). (Revisão do A1: o "X% mais Dano Físico Corpo a Corpo" NÃO vale no buff inteiro — no PoE, usar uma
  // habilidade troca o efeito pelo segundo buff, de 0,2 s, que dá esse dano; o jogo não tem a troca: fica "efeito não simulado".)
  [new RegExp(`^Buff concede Furtividade aumentada em ${N} ?%$`, 'i'), (m) => ({ furtividade: num(m[1]) })],
  // (17/10, lote G18b) o "menos Dano sofrido" de um tipo (o Chamado Imortal; o "por Carga removida" fica não feito) e o da Armadura Ártica (parado)
  [new RegExp(`^${N} ?% menos Dano (Físico|Elemental) sofrido$`, 'i'), (m) => (m[2].toLowerCase() === 'físico' ? { dano_physical_recebido_mais: -num(m[1]) } : { dano_fire_recebido_mais: -num(m[1]), dano_ice_recebido_mais: -num(m[1]), dano_energy_recebido_mais: -num(m[1]) })],
  [new RegExp(`^Buff concede ${N} ?% menos Dano (Físico|de Fogo) sofrido de Acertos enquanto parado$`, 'i'), (m) => ({ [m[2].toLowerCase() === 'físico' ? 'dano_physical_recebido_mais@parado' : 'dano_fire_recebido_mais@parado']: -num(m[1]) })],
  // (17/10, lote G18b) as auras com a flag do PoB: a Malevolência — "mais Dano Degenerativo" (ModFlag.Dot: as afecções de dano e o degenerativo,
  // `dano_dot_mais`); a Ira — "mais Dano Mágico de Raio" (só a parte de Raio das magias); o Zelotismo — "mais Dano Mágico" (só o acerto das magias,
  // como o Fogo Justo); a Precisão e o Zelotismo — a Chance de Crítico AUMENTADA (antes, pontos absolutos: +58 pontos na Precisão)
  [new RegExp(`^Você e (?:seus )?aliados próxim\\S* causam ${N} ?% mais Dano Degenerativo$`, 'i'), (m) => ({ dano_dot_mais: num(m[1]) })],
  [new RegExp(`^Você e (?:seus )?aliados próxim\\S* causam ${N} ?% mais Dano Mágico de (Raio|Fogo|Gelo|Caos)$`, 'i'), (m) => ({ [`${{ raio: 'mais_dano_raio', fogo: 'mais_dano_fogo', gelo: 'mais_dano_gelo', caos: 'mais_dano_caos' }[m[2].toLowerCase()]}@magia`]: num(m[1]) })],
  [new RegExp(`^Você e (?:seus )?aliados próxim\\S* causam ${N} ?% mais Dano Mágico$`, 'i'), (m) => ({ 'mais_dano_acerto@magia': num(m[1]) })],
  [new RegExp(`^Você e (?:seus )?aliados próxim\\S* recebem ${N} ?% de aumento da Chance de Acerto Crítico$`, 'i'), (m) => ({ crit_chance_inc: num(m[1]) })],
  [new RegExp(`^Você e (?:seus )?aliados próxim\\S* tem Chance de Acerto Crítico com Magias aumentado em ${N} ?%$`, 'i'), (m) => ({ 'crit_chance_inc@magia': num(m[1]) })],
  [new RegExp(`^Buff concede (?:de )?${N} a ${N} de Dano (?:de Ataque de (Gelo|Fogo|Raio|Caos|Físico)|de (Gelo|Fogo|Raio|Caos|Físico) com Ataques) Adicional$`, 'i'), (m) => { const e = EL_DO_BUFF[m[3] ?? m[4]]; return { [`added_${e}_dmg_min`]: num(m[1]), [`added_${e}_dmg_max`]: num(m[2]) }; }],
  [new RegExp(`^Buff concede (?:de )?${N} a ${N} de Dano (?:Mágico de (Gelo|Fogo|Raio|Caos|Físico) Adicional|de (Gelo|Fogo|Raio|Caos|Físico) Mágico)$`, 'i'), (m) => { const e = EL_DO_BUFF[m[3] ?? m[4]]; return { [`spell_added_${e}_dmg_min`]: num(m[1]), [`spell_added_${e}_dmg_max`]: num(m[2]) }; }],
  // (as auras: "Você e aliados próximos ganham 49 % mais Armadura", "… 4 % de Resistência máxima a Fogo adicional", "… são Imunes à Incêndio")
  [new RegExp(`^(?:Buff concede |Você e aliados próximos ganham )${N} ?% mais Armadura$`, 'i'), (m) => ({ armour_mais: num(m[1]) })],
  [new RegExp(`^(?:Buff concede |Você e aliados próximos ganham )${N} ?% de Resistência máxima a (Fogo|Frio|Gelo|Raio|Caos) adicional$`, 'i'), (m) => ({ [`${{ Fogo: 'fire', Frio: 'ice', Gelo: 'ice', Raio: 'energy', Caos: 'chaos' }[m[2]]}_res_max`]: num(m[1]) })],
  [new RegExp(`^Você e (?:seus )?aliados próxim\\S* (?:ganham|têm|tem) Duração do Efeito de Habilidades aumentada em ${N} ?%$`, 'i'), (m) => ({ duracao_habilidades: num(m[1]) })],
  [/^(?:Buff concede Imunidade a|Você e (?:seus )?aliados próxim\S* são Imunes [àa]) (Incêndio|Resfriamento|Congelamento|Eletrização|Sangramento|Veneno|Envenenamento)$/i, (m) => ({ [`imune_${{ Incêndio: 'incendio', Resfriamento: 'resfriamento', Congelamento: 'congelamento', Eletrização: 'eletrizacao', Sangramento: 'sangramento', Veneno: 'veneno', Envenenamento: 'veneno' }[m[1]]}`]: 1 })],
  // (Sangue e Areia: "Habilidades Corpo a Corpo causam 27 % mais Efeito em Área enquanto na Postura de Areia" — a condição `posturaAreia`)
  // (lote C3, dono 25/10 — D3.1: + as de SANGUE: o buff ligado está numa das duas Posturas — `condicoes-poe.posturaDe`, o `postura` do buff —, e cada linha vale
  // só na dela; antes o buff ligado era sempre a de Areia e as de Sangue ficavam "não simuladas")
  [new RegExp(`^Habilidades Corpo a Corpo (?:causam|têm) ${N} ?% (mais|menos) (Dano|Efeito) em Área enquanto na Postura de (Areia|Sangue)$`, 'i'),
  // (e o SINAL do PoB: o "5 % mais Dano em Área enquanto na Postura de Areia" do poedb é blood_sand_stance_melee_skills_area_damage_+%_final_in_sand_stance = −5 —
  // 5% MENOS, act_str.lua:1268; antes o jogo dava 5% mais)
    (m) => ({ [`${m[3] === 'Dano' ? 'mais_dano' : 'area_mais'}@corpo+area+postura${m[4]}`]: (m[2] === 'menos' || (m[3] === 'Dano' && m[4] === 'Areia') ? -1 : 1) * num(m[1]) })],
  [new RegExp(`^Estandarte concede \\+${N} ?% de chance de Suprimir o Dano Mágico a Você e Aliados$`, 'i'), (m) => ({ spell_suppression: num(m[1]) })],
  [new RegExp(`^Buff concede ${N} ?% mais Dano (Físico|de Fogo|de Gelo|de Raio|de Caos)$`, 'i'), (m) => ({ [{ Físico: 'mais_dano_fisico', 'de Fogo': 'mais_dano_fogo', 'de Gelo': 'mais_dano_gelo', 'de Raio': 'mais_dano_raio', 'de Caos': 'mais_dano_caos' }[m[2]]]: num(m[1]) })],
  // ---- (lote E1b, 26/10) as auras e os Estandartes do lote (gemas-e1b.mjs) ----
  // a Disciplina: "Você e Aliados próximos ganham 30 % de Velocidade de Recarga de Escudo de Energia aumentada" (energy_shield_recharge_rate_+%)
  [new RegExp(`^Você e Aliados próximos ganham ${N} ?% de Velocidade de Recarga de Escudo de Energia aumentada$`, 'i'), (m) => ({ es_recharge: num(m[1]) })],
  // a Graça Vaal: "+15 % de chance de Evadirem Acertos de Ataques" (chance_to_evade_attacks_% — soma à chance da Evasão, defesa.esquivou) e "Dano Mágico Suprimido
  // causado em você é Azarado" (damage_taken_from_suppressed_hits_is_unlucky — poderes: a magia suprimida rola o dano duas vezes e fica o menor)
  [new RegExp(`^Você e aliados próximos têm \\+${N} ?% de chance de Evadirem Acertos de Ataques$`, 'i'), (m) => ({ chance_evadir: num(m[1]) })],
  [/^Dano Mágico Suprimido causado em você é Azarado$/i, () => ({ suprimido_azarado: 1 })],
  // a Clareza Vaal: "Suas Habilidades e de seus aliados próximos não Custam Mana" (no_mana_cost — o custo de Mana × 0)
  [/^Suas Habilidades e de seus aliados próximos não Custam Mana$/i, () => ({ custo_mana_inc: -100 })],
  // a Disciplina Vaal: "A Recarga do seu Escudo de Energia e dos seus aliados próximos não é impedida por Dano" (energy_shield_recharge_not_delayed_by_damage)
  [/^A Recarga do seu Escudo de Energia e dos seus aliados próximos não é impedida por Dano$/i, () => ({ recarga_es_nunca_interrompida: 1 })],
  // a Pureza Elementar: "Imunes a todas as Afecções Elementais" (as quatro do jogo)
  [/^Você e aliados próximos são Imunes a todas as Afecções Elementais$/i, () => ({ imune_incendio: 1, imune_resfriamento: 1, imune_congelamento: 1, imune_eletrizacao: 1 })],
  // o Fanatismo: "Você e Aliados não-Lacaios Próximos têm 10 % de chance de criarem Solo Sagrado ao Acertar um Inimigo Raro ou Único, durando 8 segundos" (o mesmo
  // evento do "X% de chance de criar Solo Sagrado ao Acertar um Inimigo Raro ou Único" das peças)
  [new RegExp(`^Você e Aliados não-Lacaios Próximos têm ${N} ?% de chance de criarem Solo Sagrado ao Acertar um Inimigo Raro ou Único, durando ${N} segundos?$`, 'i'), (m) => ({ [`ev:acertar:soloSagrado:${num(m[2])}@alvoRaro`]: num(m[1]), [`ev:acertar:soloSagrado:${num(m[2])}@alvoUnico`]: num(m[1]) })],
  // o Estandarte Horrendo: "Estandarte faz com que você e Aliados Recuperem X de Vida ao Bloquear" (recover_X_life_on_block); o Desafiador: "Estandarte concede −X de
  // Dano sofrido de cada Tipo de Dano dos Acertos Suprimidos a Você e Aliados" (damage_taken_+_from_suppressed_hits — poderes, na magia suprimida)
  [new RegExp(`^Estandarte faz com que você e Aliados Recuperem ${N} de Vida ao Bloquear$`, 'i'), (m) => ({ 'ev:bloquear:vida': num(m[1]) })],
  [new RegExp(`^Estandarte concede -${N} de Dano sofrido de cada Tipo de Dano dos Acertos Suprimidos a Você e Aliados$`, 'i'), (m) => ({ suprimido_fixo: -num(m[1]) })],
];
export function atributosDoBuff(linha) {
  const l = String(linha).trim();
  for (const [re, f] of BUFF_PROPRIO) { const m = re.exec(l); if (m) { const af = f(m); return Object.keys(af).every(atributoTemEfeito) ? af : null; } }
  // (lote G13: "Estandarte concede Precisão aumentada em 8% a Você e Aliados" — o buff do Estandarte vale em você e nos aliados na área)
  const sem = l.replace(/^Estandarte concede (.+?) a Você e Aliados$/i, '$1').replace(/^Buff concede /i, '').replace(/^Você e (?:seus )?aliados próxim\S* (?:ganham|têm|tem|possuem) /i, '').replace(/^Você e (?:seus )?aliados próxim\S* são /i, 'Você é ');
  if (sem === l && !/^Dano não pode ser Refletido$/i.test(l) && !/^Você é /i.test(sem)) return null;
  const t0 = sem.charAt(0).toUpperCase() + sem.slice(1);
  const valores = [];
  const modelo = t0.replace(/(\d+(?:[.,]\d+)?)\s*%/g, (_, x) => `${x}%`).replace(/\d+(?:[.,]\d+)?/g, (x) => { valores.push(num(x)); return `{${valores.length - 1}}`; });
  const t = traduzirParte(modelo, valores);
  if (!['equivalente', 'aproximado', 'novo'].includes(t.estado) || !t.efeitos.length) return null;
  const af = {};
  for (const e of t.efeitos) {
    if (typeof e.valor !== 'number' || !atributoTemEfeito(e.stat)) return null;
    af[e.stat] = (af[e.stat] ?? 0) + e.valor;
  }
  return af;
}
export const ehLinhaDoBuff = (l) => !!atributosDoBuff(l);
