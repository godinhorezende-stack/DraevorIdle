/*
 * Quem está online, com o boneco de cada um.
 *
 * ---- Por que o retrato vem do MÓDULO do jogo ----
 *
 * O outfit não é uma figura pronta: é uma pilha de camadas do atlas, tingida
 * com as quatro cores que o jogador escolheu. Quem sabe montar isso é o
 * `sprites.mjs` do cliente, e é o mesmo código que desenha o boneco no mapa.
 *
 * Reusar custa uma folha de dados a mais (`outfits.json`), e paga: um segundo
 * desenhador aqui seria outra régua para o mesmo boneco — no dia em que uma
 * camada mudasse, a página e o jogo mostrariam pessoas diferentes.
 *
 * A folha só é buscada NESTA página, que é a única que precisa dela. A porta da
 * rua continua sendo HTML, um CSS e um módulo curto.
 */
import { loadSpriteData, outfitCanvas } from '/client/src/sprites.mjs';
import { t, aplicarIdioma, montarSeletor } from '/client/site/idiomas.mjs';

const $ = (id) => document.getElementById(id);
const numero = (valor) => Number(valor ?? 0).toLocaleString('pt-BR');

const VOCACOES = {
  knight: 'Knight',
  paladin: 'Paladin',
  druid: 'Druid',
  sorcerer: 'Sorcerer',
  monk: 'Monk',
  none: 'Sem vocação',
};

/*
 * O que cada estado quer dizer, em português de jogador.
 *
 * ---- Por que a lista cresceu ----
 *
 * O dono: "o 'o que esta fazendo' tem que ser mais preciso em algumas parte —
 * se a pessoa estiver treinando no patio tem que dizer treinando no patio, se
 * tiver treinando exercise tem que mostrar tambem e etc".
 *
 * Eram quatro estados, e dois deles carregavam metade do jogo: quem estava
 * batendo no boneco do pátio e quem estava gastando exercise apareciam como
 * "na cidade", ao lado de quem estava parado no templo sem fazer nada.
 *
 * Agora cada coisa tem nome e cor. A distinção que mais importa continua sendo
 * entre as duas caçadas — uma é o personagem sozinho, a outra é a pessoa no
 * teclado, e quem lê a lista quer saber de quem dá para chamar agora.
 */
const ONDE = {
  automatica: { chave: 'online.cacando', rotulo: 'Caçando', classe: 'caca' },
  online: { chave: 'online.online', rotulo: 'Caça Online', classe: 'online' },
  boss: { chave: 'online.boss', rotulo: 'Numa sala de boss', classe: 'boss' },
  patio: { chave: 'online.patio', rotulo: 'Treinando no pátio', classe: 'treino' },
  exercise: { chave: 'online.exercise', rotulo: 'Treinando com exercise', classe: 'treino' },
  treinando: { chave: 'online.treinando', rotulo: 'Treinando', classe: 'treino' },
  cidade: { chave: 'online.cidade', rotulo: 'Na cidade', classe: 'cidade' },
  parado: { chave: 'online.parado', rotulo: 'Conectado', classe: 'parado' },
};

let desenhistaPronto = false;
let ultima = [];

/*
 * ---- A ORDEM da lista, e quem manda nela ----
 *
 * "os nomes tem que ser em ordem alfabetica, e se eu clicar em vocaçao ajusta
 * por vocaçao, se eu clicar em level muda entre ordem crescente e decrescente,
 * ok, e vice versa."
 *
 * Então: alfabética de saída, e cada cabeçalho é um botão. Clicar num outro
 * troca o critério; clicar no MESMO vira o sentido. É o comportamento de
 * qualquer tabela ordenável, e é o que a frase dele descreve.
 *
 * A ordenação é feita AQUI e não no servidor de propósito: ela muda a cada
 * clique, e ir buscar a lista de novo a cada clique poria a rede no meio de uma
 * coisa que é só arrumar trinta linhas que já estão na mão.
 */
const ORDEM_PADRAO = { campo: 'nome', desc: false };
let ordem = { ...ORDEM_PADRAO };

/* O que cada coluna compara. O nome é o desempate de todas — ele é único. */
const CHAVES = {
  nome: (entrada) => String(entrada.name ?? '').toLocaleLowerCase('pt-BR'),
  vocacao: (entrada) => VOCACOES[entrada.vocation] ?? entrada.vocation ?? '',
  level: (entrada) => Number(entrada.level ?? 0),
  fazendo: (entrada) => t(ONDE[entrada.onde]?.chave ?? '', ONDE[entrada.onde]?.rotulo ?? ''),
};

function ordenar(lista) {
  const chave = CHAVES[ordem.campo] ?? CHAVES.nome;
  const sinal = ordem.desc ? -1 : 1;
  return [...lista].sort((a, b) => {
    const va = chave(a);
    const vb = chave(b);
    let comp = 0;
    if (typeof va === 'number' && typeof vb === 'number') comp = va - vb;
    else comp = String(va).localeCompare(String(vb), 'pt-BR');
    if (comp) return comp * sinal;
    // Empate: sempre alfabético, e sempre no mesmo sentido. Duas pessoas de
    // level 300 não podem trocar de lugar sozinhas a cada quinze segundos.
    return String(a.name).localeCompare(String(b.name), 'pt-BR');
  });
}

/**
 * Marca no cabeçalho qual coluna manda e para que lado.
 *
 * A seta é o que torna o clique descobrível: uma tabela ordenável sem nenhuma
 * marca é uma tabela que ninguém sabe que dá para ordenar.
 */
function pintarCabecalho() {
  for (const th of document.querySelectorAll('th[data-ordem]')) {
    const campo = th.dataset.ordem;
    th.classList.toggle('ordenando', campo === ordem.campo);
    th.setAttribute(
      'aria-sort',
      campo !== ordem.campo ? 'none' : ordem.desc ? 'descending' : 'ascending'
    );
    const seta = th.querySelector('.seta');
    if (seta) seta.textContent = campo === ordem.campo ? (ordem.desc ? '▼' : '▲') : '';
  }
}

function ligarCabecalho() {
  for (const th of document.querySelectorAll('th[data-ordem]')) {
    if (!th.querySelector('.seta')) {
      const seta = document.createElement('i');
      seta.className = 'seta';
      th.append(seta);
    }
    th.tabIndex = 0;
    const trocar = () => {
      const campo = th.dataset.ordem;
      if (ordem.campo === campo) ordem = { campo, desc: !ordem.desc };
      /*
       * Coluna nova começa no sentido que a pessoa espera dela: nome e vocação
       * de A a Z, level do maior para o menor. Um ranking que abrisse do level
       * 8 para baixo estaria tecnicamente ordenado e não serviria para nada.
       */
      else ordem = { campo, desc: campo === 'level' };
      pintarCabecalho();
      pintar({ jogadores: ultima });
    };
    th.onclick = trocar;
    th.onkeydown = (evento) => {
      if (evento.key === 'Enter' || evento.key === ' ') {
        evento.preventDefault();
        trocar();
      }
    };
  }
  pintarCabecalho();
}

function retrato(entrada) {
  const celula = document.createElement('td');
  celula.className = 'retrato-col';
  if (!desenhistaPronto || !entrada.outfit?.type) return celula;
  try {
    const boneco = outfitCanvas(entrada.outfit.type, entrada.outfit, 44);
    boneco.className = 'retrato';
    celula.append(boneco);
  } catch {
    // Outfit que a folha não conhece: a linha sai sem boneco em vez de a página
    // inteira parar. O nome e o level continuam valendo.
  }
  return celula;
}

function pintar(dados) {
  const lista = dados.jogadores ?? [];
  ultima = lista;
  $('quantos').textContent = numero(lista.length);
  $('quantos-rotulo').textContent =
    lista.length === 1 ? t('online.pessoa', 'pessoa') : t('online.pessoas', 'pessoas');

  const corpo = $('lista-online');
  corpo.innerHTML = '';

  if (!lista.length) {
    const linha = document.createElement('tr');
    const celula = document.createElement('td');
    celula.colSpan = 5;
    celula.className = 'vazio';
    celula.textContent = t('online.vazio', 'ninguém online agora — a caverna está sua');
    linha.append(celula);
    corpo.append(linha);
    return;
  }

  for (const entrada of ordenar(lista)) {
    const linha = document.createElement('tr');

    const nome = document.createElement('td');
    nome.className = 'nome';
    const link = document.createElement('a');
    link.className = 'link-personagem';
    link.href = `/personagem?nome=${encodeURIComponent(entrada.name)}`;
    link.textContent = entrada.name;
    nome.append(link);

    const vocacao = document.createElement('td');
    vocacao.className = 'vocacao';
    vocacao.textContent = VOCACOES[entrada.vocation] ?? entrada.vocation ?? '—';

    const level = document.createElement('td');
    level.className = 'num';
    level.textContent = numero(entrada.level);

    const onde = document.createElement('td');
    const info = ONDE[entrada.onde] ?? ONDE.parado;
    const selo = document.createElement('span');
    selo.className = `selo ${info.classe}`;
    selo.textContent = t(info.chave, info.rotulo);
    onde.append(selo);
    /*
     * O nome do lugar ao lado do selo.
     *
     * "Caçando" sozinho não diz onde; "Treinando" sozinho não diz o quê. O
     * campo é o mesmo para os dois casos porque a pergunta é a mesma — qual
     * caverna, qual sala, qual perícia, qual arma.
     */
    if (entrada.hunt) {
      const lugar = document.createElement('span');
      lugar.className = 'lugar';
      lugar.textContent = entrada.hunt;
      onde.append(lugar);
    }

    linha.append(retrato(entrada), nome, vocacao, level, onde);
    corpo.append(linha);
  }
}

async function atualizar() {
  try {
    const resposta = await fetch('/api/online', { cache: 'no-store' });
    if (!resposta.ok) return;
    pintar(await resposta.json());
  } catch {
    // Rede ruim: a lista fica como estava. Ela se refaz sozinha no próximo giro.
  }
}

// A folha de outfits é grande; a lista não espera por ela. Quem chega vê nomes,
// levels e o que cada um está fazendo na hora, e os bonecos entram quando o
// desenhista fica pronto.
aplicarIdioma();
montarSeletor(document.querySelector('.topo nav'));
ligarCabecalho();
/*
 * Trocar de idioma reescreve o `textContent` de todo `[data-t]` — e isso apaga
 * a setinha que mora dentro do cabeçalho. Remontá-la é uma linha; descobrir por
 * que a seta some ao trocar para inglês custaria bem mais.
 */
window.addEventListener('ravox:idioma', () => {
  ligarCabecalho();
  atualizar();
});

atualizar();
loadSpriteData()
  .then(() => {
    desenhistaPronto = true;
    atualizar();
  })
  .catch(() => {
    /* sem folha de outfits a lista continua, só sem os bonecos */
  });

setInterval(atualizar, 15_000);
