/* =========================================================================
 * A GRADE DO EQUIPAMENTO — uma só, para o site e para o jogo
 *
 * "o site já tem um card de personagem com o inventário organizado e bonito.
 *  Esse é o visual que eu quero no card do membro da guilda. Localize o
 *  componente/CSS desse card e REAPROVEITE (ou extraia para um componente
 *  compartilhado usado pelos dois lugares). Não reinventar."
 *
 * Ela nasceu dentro do `top5.mjs` (o balão que abre ao parar o mouse numa linha
 * do top 5 da capa) e saiu de lá inteira: mesma ordem de casas, mesmos
 * tamanhos, mesma borda por raridade, mesmo selo de tier e as mesmas estrelas.
 * O card do membro da guilda passou a chamar esta função em vez de desenhar uma
 * fileira própria.
 *
 * ---- POR QUE UM ADAPTADOR, E NÃO "os dados" ----
 *
 * Os dois lugares recebem o equipamento em formatos diferentes, e nenhum dos
 * dois vai mudar por causa desta tela:
 *
 *   site   `/api/personagem` devolve um MAPA por casa (`equipamento.weapon`),
 *          com a peça inteira dentro (`.peca.af`), a raridade noutro mapa
 *          (`itens[id].rarity`) e a régua dos afixos num terceiro (`catalogo`);
 *   jogo   a ficha do membro devolve uma LISTA (`veste: [{slot, id, tier, af}]`),
 *          e a raridade e a régua moram no estado do cliente.
 *
 * Então quem chama passa uma função `pecaDoSlot(slot)` que devolve a peça já
 * traduzida — e a tradução (inclusive o cálculo das estrelas, que cada lado já
 * sabe fazer do seu jeito) fica de fora daqui. É o que permite a mesma grade
 * servir aos dois sem que nenhum dos dois conheça o outro.
 *
 * ---- E O CSS VEM JUNTO ----
 *
 * Injetado uma vez por documento, como o `garantirEstiloDoBrasao` já faz com o
 * escudo das guildas. É o que faz a grade parecer a mesma nos dois lugares sem
 * depender de a folha da página ter as regras: o `site.css` não é carregado
 * pelo jogo, e o `style.css` não é carregado pelo site.
 * ========================================================================= */
import { itemCanvas } from './sprites.mjs';

/* =========================================================================
 * A ORDEM DAS CASAS — o paperdoll do Tibia, em três colunas
 *
 * É a ordem que o card do site usa, e ela não é decorativa: quem jogou Tibia lê
 * esta cruz sem pensar. O segundo nome de cada par é a arte da casa VAZIA
 * (`/client/assets/slots/<nome>.png`), que é o que faz a grade continuar
 * legível numa pessoa com metade do set.
 *
 * `[null, null]` é buraco: ele ocupa a célula para as botas caírem no meio da
 * última linha, e é invisível.
 * ========================================================================= */
export const ORDEM_DO_PAPERDOLL = [
  ['neck', 'neck'], ['head', 'head'], ['backpack', 'back'],
  ['weapon', 'left-hand'], ['body', 'body'], ['shield', 'right-hand'],
  ['ring', 'finger'], ['legs', 'legs'], ['ammo', 'ammo'],
  [null, null], ['feet', 'feet'], [null, null],
];

/* As cinco raridades que pintam a borda. Fora delas, a borda é a neutra. */
const RARIDADES = new Set(['incomum', 'raro', 'epico', 'lendario', 'mitico']);

/** "mítico" vira "mitico": o catálogo escreve com acento, a classe do CSS não. */
const semAcento = (texto) =>
  String(texto ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

const MARCA = 'estilo-do-paperdoll';

const ESTILO = `
.pd-grade { display: grid; grid-template-columns: repeat(3, 40px); gap: 4px; justify-content: center; }
.pd-slot {
  --rar: #2c3a3c; position: relative; width: 40px; height: 40px; display: grid; place-items: center;
  background: #0b1114 center / 32px no-repeat; border: 1px solid var(--rar); border-radius: 4px;
}
/* O buraco ocupa a célula e não se vê: é ele que centra as botas na última linha. */
.pd-slot.buraco { visibility: hidden; }
.pd-slot.vazio { opacity: .45; }
.pd-slot canvas { image-rendering: pixelated; }
.pd-slot.rar { box-shadow: inset 0 0 10px color-mix(in srgb, var(--rar) 40%, transparent); }
.pd-slot.rar-incomum { --rar: #37c2a0; }
.pd-slot.rar-raro { --rar: #57a6e8; }
.pd-slot.rar-epico { --rar: #b184e8; }
.pd-slot.rar-lendario { --rar: #e0a84a; }
.pd-slot.rar-mitico { --rar: #f2503f; }
.pd-tier { position: absolute; left: 1px; top: 1px; width: 14px; height: 14px; object-fit: contain; }
.pd-estrelas {
  position: absolute; right: 1px; top: -1px; display: flex; font-style: normal; font-size: 9px; line-height: 1;
  text-shadow: 0 0 2px #000, 0 0 2px #000;
}
.pd-estrelas b { font-weight: 400; }
.pd-estrelas .q1 { color: #57a6e8; }
.pd-estrelas .q2 { color: #b184e8; }
.pd-estrelas .q3 { color: #e0a84a; }
.pd-estrelas .q4 { color: #ff5a52; }
.pd-estrelas .n1 { color: #a7b0ba; }
.pd-estrelas .n2 { color: #5fc46a; }
.pd-estrelas .n3 { color: #57a6e8; }
.pd-estrelas .n4 { color: #b184e8; }
.pd-estrelas .n5 { color: #e0a84a; }
.pd-estrelas .n6 { color: #ff5a52; }
`;

/** Põe a folha no documento, uma vez. Ver a nota do cabeçalho. */
export function garantirEstiloDoPaperdoll(doc = globalThis.document) {
  if (!doc?.head || doc.getElementById?.(MARCA)) return;
  const folha = doc.createElement('style');
  folha.id = MARCA;
  folha.textContent = ESTILO;
  doc.head.append(folha);
}

/**
 * A grade inteira, pronta para pendurar.
 *
 * `pecaDoSlot(slot)` devolve `null` (casa vazia) ou:
 *
 *   { id, tier, count, titulo, raridade, estrelas: [3, 1], corPoe? }
 *
 * `estrelas` são os DEGRAUS já calculados (1 a 4), e não os afixos crus: a
 * régua que transforma um afixo em degrau mora no catálogo, e cada lado já tem
 * o seu. Pedi-la aqui obrigaria esta função a conhecer os dois.
 *
 * `comSprites` é falso enquanto a folha de desenhos não chegou: a grade sai
 * inteira, com as casas e as bordas, e só sem os bonecos — que é melhor do que
 * não sair.
 */
export function gradeDeEquipamento(pecaDoSlot, { tamanho = 32, comSprites = true, doc = globalThis.document } = {}) {
  garantirEstiloDoPaperdoll(doc);
  const grade = doc.createElement('div');
  grade.className = 'pd-grade';

  for (const [slot, arte] of ORDEM_DO_PAPERDOLL) {
    const casa = doc.createElement('div');
    casa.className = 'pd-slot';
    if (!slot) {
      casa.classList.add('buraco');
      grade.append(casa);
      continue;
    }
    const peca = pecaDoSlot(slot) ?? null;
    if (!peca) {
      /*
       * A casa vazia CONTINUA na grade, com a silhueta do que vai nela. Sem
       * isso a cruz se desmonta a cada peça que falta, e duas pessoas com sets
       * diferentes teriam grades de formatos diferentes — o olho perderia o
       * lugar de cada coisa.
       */
      casa.classList.add('vazio');
      casa.style.backgroundImage = `url(/client/assets/slots/${arte}.png)`;
      grade.append(casa);
      continue;
    }

    const raridade = semAcento(peca.raridade);
    if (RARIDADES.has(raridade)) casa.classList.add('rar', `rar-${raridade}`);
    // A peça do PoE: a borda na cor da raridade do PoE (Normal, Mágico, Raro, Único), como no inventário do jogo.
    if (peca.corPoe) {
      casa.classList.add('rar', 'rar-poe');
      casa.style.setProperty('--rar', peca.corPoe);
    }
    // A casa diz de que slot é: quem pendura a grade liga o balão da peça nela.
    casa.dataset.slot = slot;
    if (peca.titulo) casa.title = peca.titulo;

    if (comSprites) {
      try {
        casa.append(itemCanvas(peca.id, tamanho, (peca.count ?? 1) > 1 ? peca.count : undefined));
      } catch {
        /* Item sem desenho empacotado: a casa fica com a borda e o título. */
      }
    }

    const tier = Math.floor(Number(peca.tier) || 0);
    if (tier > 0) {
      const selo = doc.createElement('img');
      selo.className = 'pd-tier';
      selo.src = `/client/assets/ui/tier/tier-${Math.min(tier, 10)}.png`;
      selo.alt = `tier ${tier}`;
      casa.append(selo);
    }

    const estrelas = Array.isArray(peca.estrelas) ? peca.estrelas : [];
    if (estrelas.length) {
      const selo = doc.createElement('i');
      selo.className = 'pd-estrelas';
      for (const q of estrelas) {
        const estrela = doc.createElement('b');
        // Um número (o degrau) ou `{q, n}` (o degrau e a cor do nível).
        estrela.className = typeof q === 'object' ? `q${q.q}${q.n ? ` n${q.n}` : ''}` : `q${q}`;
        estrela.textContent = '★';
        selo.append(estrela);
      }
      casa.append(selo);
    }
    grade.append(casa);
  }
  return grade;
}
