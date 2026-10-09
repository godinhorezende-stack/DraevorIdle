// O MAPA da campanha que a tela WORLD desenha — o que o editor pode gravar e a validação disso. Só dados (sem DOM, sem jogo):
// o editor (servidor) valida aqui; o cliente (`world-dados.mjs`) tem as mesmas constantes (um teste confere que não divergem).
//
//   fases[huntId].mapa = { x, y, icone? }   // posição no espaço LARGURA × ALTURA (sem isso, a tela desenha o caminho sozinha)
//   fases[huntId].tipo = 'quest' | ...        // o tipo do nó (sem isso, deduzido do conteúdo da fase)
//   fases[huntId].conexoes = [huntId]         // ligações extras dentro do Ato
//   atos[n] = { nome, parte, tema, descricao }
export const LARGURA = 1000;
export const ALTURA = 640;
export const RAIO_DA_FASE = 15; // o nó pequeno do mapa de ARPG (dono, 09/10) — o mesmo de `world-dados.mjs`
/** Os tipos de nó que o editor oferece (o `boss` do Ato é um nó à parte, não uma escolha). */
export const TIPOS_DE_FASE = ['comum', 'quest', 'miniboss', 'boss-fase', 'boss-opcional', 'secreta', 'evento', 'cidade', 'retorno', 'especial', 'desafio'];
export const TEMAS_DE_MAPA = ['floresta', 'deserto', 'pantano', 'cinzas', 'neve', 'caverna'];

/**
 * Confere o mapa gravado: posições dentro do espaço, tipos conhecidos, conexões para fases do mesmo Ato, sem ligar a si mesma, requisitos
 * possíveis e nós sobrepostos. `fases`: `[{huntId, ato}]` (na ordem da campanha); `conteudo`: `{[huntId]: {mapa, tipo, conexoes, requisitos}}`.
 * Devolve `[{nivel: 'erro'|'aviso', onde, mensagem}]`.
 */
export function validarMapa(fases, conteudo = {}) {
  const erros = [];
  const porId = new Map(fases.map((f) => [f.huntId, f]));
  const usados = [];
  for (const f of fases) {
    const c = conteudo[f.huntId] ?? {};
    const onde = f.huntId;
    if (c.mapa != null) {
      if (!(Number.isFinite(c.mapa.x) && Number.isFinite(c.mapa.y))) erros.push({ nivel: 'erro', onde, mensagem: 'a posição no mapa precisa de x e y numéricos.' });
      else if (c.mapa.x < 20 || c.mapa.x > LARGURA - 20 || c.mapa.y < 20 || c.mapa.y > ALTURA - 20) erros.push({ nivel: 'erro', onde, mensagem: `a posição no mapa precisa ficar dentro de ${LARGURA}×${ALTURA}.` });
      else {
        const perto = usados.find((u) => u.ato === f.ato && Math.hypot(u.x - c.mapa.x, u.y - c.mapa.y) < RAIO_DA_FASE * 1.6);
        if (perto) erros.push({ nivel: 'aviso', onde, mensagem: `o nó está sobre o de "${perto.id}".` });
        usados.push({ id: f.huntId, ato: f.ato, x: c.mapa.x, y: c.mapa.y });
      }
    }
    if (c.tipo != null && !TIPOS_DE_FASE.includes(c.tipo)) erros.push({ nivel: 'erro', onde, mensagem: `tipo de nó "${c.tipo}" desconhecido.` });
    for (const alvo of c.conexoes ?? []) {
      if (alvo === f.huntId) erros.push({ nivel: 'erro', onde, mensagem: 'a fase não pode se ligar a si mesma.' });
      else if (!porId.has(alvo)) erros.push({ nivel: 'erro', onde, mensagem: `a conexão "${alvo}" não é uma fase da campanha.` });
      else if (porId.get(alvo).ato !== f.ato) erros.push({ nivel: 'aviso', onde, mensagem: `a conexão "${alvo}" é de outro Ato (o mapa só desenha ligações dentro do Ato).` });
    }
    for (const e of c.requisitos?.exige ?? []) {
      if (e === f.huntId) erros.push({ nivel: 'erro', onde, mensagem: 'a fase não pode exigir a si mesma (nunca abriria).' });
      else if (!porId.has(e)) erros.push({ nivel: 'erro', onde, mensagem: `o requisito "${e}" não é uma fase da campanha.` });
      else if (fases.indexOf(porId.get(e)) > fases.indexOf(f)) erros.push({ nivel: 'erro', onde, mensagem: `o requisito "${e}" vem depois desta fase: ela nunca abriria.` });
    }
  }
  // Posições à mão em parte do Ato: o resto continua no caminho automático — funciona, mas costuma não ser a intenção.
  const atos = [...new Set(fases.map((f) => f.ato))];
  for (const ato of atos) {
    const doAto = fases.filter((f) => f.ato === ato);
    const com = doAto.filter((f) => conteudo[f.huntId]?.mapa != null).length;
    if (com > 0 && com < doAto.length) erros.push({ nivel: 'aviso', onde: `ato ${ato}`, mensagem: `só ${com} de ${doAto.length} nós têm posição; os outros usam o caminho automático.` });
  }
  return erros;
}

/** Os erros dos metadados de Ato (`atos[n]`): textos curtos e tema conhecido. `numeros`: os Atos que existem. */
export function validarAtos(atos, numeros) {
  const erros = [];
  for (const [n, a] of Object.entries(atos ?? {})) {
    if (!numeros.includes(Number(n))) erros.push(`Ato ${n}: não existe na campanha.`);
    if (a.nome != null && (typeof a.nome !== 'string' || a.nome.length > 40)) erros.push(`Ato ${n}: nome de até 40 caracteres.`);
    if (a.parte != null && (typeof a.parte !== 'string' || a.parte.length > 30)) erros.push(`Ato ${n}: parte de até 30 caracteres.`);
    if (a.descricao != null && (typeof a.descricao !== 'string' || a.descricao.length > 300)) erros.push(`Ato ${n}: descrição de até 300 caracteres.`);
    if (a.bossMapa != null && !(Number.isFinite(a.bossMapa.x) && Number.isFinite(a.bossMapa.y) && a.bossMapa.x >= 20 && a.bossMapa.x <= LARGURA - 20 && a.bossMapa.y >= 20 && a.bossMapa.y <= ALTURA - 20)) erros.push(`Ato ${n}: a posição do boss (bossMapa) precisa de x e y dentro de ${LARGURA}×${ALTURA}.`);
    if (a.fundo != null && !(typeof a.fundo === 'object' && /^ato-\d+-[0-9a-f]{8}\.(png|jpg|webp)$/.test(a.fundo.arquivo ?? ''))) erros.push(`Ato ${n}: a imagem de fundo é inválida (use o botão de carregar imagem).`);
    if (a.tema != null && !TEMAS_DE_MAPA.includes(a.tema)) erros.push(`Ato ${n}: tema "${a.tema}" desconhecido (${TEMAS_DE_MAPA.join(', ')}).`);
  }
  return erros;
}
