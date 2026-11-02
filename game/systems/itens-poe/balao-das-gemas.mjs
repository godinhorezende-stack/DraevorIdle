// O BALÃO DE TODAS AS GEMAS (dono, 02/11: "atualize o tooltip de todas"): o que a ficha da gema (`GemasPoe.fichaNoNivel`, `SuportesPoe.fichaNoNivel`) leva ao
// balão do jogo — no inventário, nos encaixes, na barra e na tela "Configurar ação" — depois que todas as gemas ficaram feitas. Só texto, sem estado: as
// PROPRIEDADES do poedb em português (os rótulos que vieram em inglês, as "Utilizações" das Vaal, os "metres per Second") e as NOTAS curtas (o "não se
// aplica" e as escolhas do dono, sem o arquivo nem a data).

/**
 * Os rótulos de RAIO que o poedb trouxe nas propriedades ("AoE Radius: 9", "Explosion Radius", "Raio: 60"): estão em unidades do PoE e não mudam com o nível;
 * o raio que o jogo usa é o das linhas da gema ("O raio Base é de 1.8 metro", "+0.3 metros de raio"), que já vão no balão — e o balão do PoE não mostra o raio
 * nas propriedades. Fora do balão.
 */
const RAIO_NAS_PROPRIEDADES = /\bRadius\b|^AoE Length$|^Raio$/i;

/**
 * Uma propriedade do poedb (`[rótulo, valor]`) como o balão mostra: em português, sem o raio em unidades; null — fora do balão.
 * - "Almas por Utilização: 30" → "Almas por Uso: 30"; "Pode Armazenar 3 Utilização" → "Pode Armazenar 3 Usos" (o texto do PoE);
 * - "10.4 metres per Second" → "10.4 metros por segundo"; "0.75 Seg" → "0.75 seg" (o mesmo "seg" das outras); "(3 Times)" → "(3 usos)".
 */
export function propDoBalao([rotulo, valor]) {
  const r = String(rotulo ?? '').trim();
  if (!r || RAIO_NAS_PROPRIEDADES.test(r)) return null;
  const v = String(valor ?? '')
    .replace(/(\d+(?:\.\d+)?) metres per Second/i, '$1 metros por segundo')
    .replace(/(\d)\s*Seg\b/g, '$1 seg')
    // (a faixa das cargas interpolada pode sair com casa — "(4.2 Times)" acima do 20: o número inteiro, como os usos do PoE)
    .replace(/\(([\d.]+) Times\)/, (_, x) => `(${Math.round(Number(x))} ${Math.round(Number(x)) === 1 ? 'uso' : 'usos'})`);
  if (/^Almas por Utilização$/i.test(r)) return ['Almas por Uso', v];
  const armazena = r.match(/^Pode Armazenar (\d+) Utiliza/i);
  if (armazena) return [`Pode Armazenar ${armazena[1]} ${armazena[1] === '1' ? 'Uso' : 'Usos'}`, v];
  return [r, v];
}

/** A linha do poedb que é um STAT interno, não um texto ("CooldownTime: 1000" no Conjurar ao Perder Salvaguarda): fora do balão. */
export const ehLinhaInterna = (t) => /^[A-Z][A-Za-z]+(?:_[A-Za-z]+)*: -?\d+(?:\.\d+)?$/.test(String(t ?? '').trim());

/**
 * A NOTA CURTA do balão a partir da nota do registro: sem o "não se aplica:" do começo (o balão já diz "Não se aplica ao jogo"), sem os parênteses de
 * arquivo, lote, aval e data ("(mapa-aberto.mjs)", "(aval do dono 27/10)", "(dono, 26/10)") e só a primeira frase antes do travessão; com a inicial maiúscula e
 * o ponto final.
 */
export function notaCurta(nota) {
  let t = String(nota ?? '').replace(/^não se aplica:\s*/i, '');
  t = t.replace(/\s*\([^()]*(?:\.mjs|\blote\b|\baval\b|\bdono\b|\d{1,2}\/\d{1,2})[^()]*\)/gi, '');
  t = t.split(/\s+—\s+/)[0].trim().replace(/[\s.;,:]+$/, '');
  return t ? `${t[0].toUpperCase()}${t.slice(1)}.` : '';
}

/**
 * As linhas que o poedb trouxe em INGLÊS nos dados da gema (o texto de desenvolvimento "[DNT]" da Parede de Gelo da Invasão, a linha da Marca do Assassino): o
 * texto em português do balão, no estilo das outras ("+30 % de Multiplicador de Golpes Críticos" do Vínculo Destrutivo). Só o texto: a regra do jogo segue lendo
 * a linha como veio.
 */
const LINHAS_EM_INGLES = [
  [/^\[DNT\] Deals ([\d.]+) % more Damage per active wall$/, 'Causa $1 % mais Dano por Parede ativa'],
  [/^Hits against Cursed Enemies have \+([\d.]+) % to Critical Strike Multiplier$/, 'Acertos contra Inimigos Amaldiçoados têm +$1 % de Multiplicador de Golpes Críticos'],
];
export const linhaEmPortugues = (t) => {
  const s = String(t ?? '');
  const r = LINHAS_EM_INGLES.find(([re]) => re.test(s));
  return r ? s.replace(r[0], r[1]) : s;
};

/**
 * A linha do NÍVEL que o balão não mostra: a sem número ("Distância de Deslocamento máxima aumentada em %" — a célula vazia da tabela) e a que vale ZERO neste
 * nível ("0 metros de raio", "… aumentada em 0 %": o stat ainda não existe — o balão do PoE não mostra o que vale 0). As da qualidade ficam (com o 0 da
 * qualidade 0, como antes).
 */
export function linhaEscondida(t) {
  const s = String(t ?? '').trim();
  if (!s || ehLinhaInterna(s) || /^[A-Z][a-z]+(?:[A-Z][a-z]+)+$/.test(s)) return true;
  if (/(?:^|\s)%/.test(s.replace(/\d\s*%/g, ''))) return true;
  const nums = s.match(/-?\d+(?:[.,]\d+)?/g);
  return !!nums && nums.every((x) => Number(x.replace(',', '.')) === 0);
}
