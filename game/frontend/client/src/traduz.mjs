/*
 * ---- Charms e imbuements em português ----
 *
 * O dono: "traduz as gemas do charms e os imbuementos ok".
 *
 * As duas telas eram as últimas do jogo inteiramente em inglês: "Triggers on a
 * creature with a certain chance and deals 5% of its initial hit points as
 * physical damage once" é a frase que decide se o jogador gasta 240 pontos de
 * charm, e ela estava em inglês num jogo em português.
 *
 * ---- Por que aqui, e não no `gamedata` ----
 *
 * Os dois arquivos (`charms.json`, `imbuements.json`) são EXTRAÍDOS da base do
 * servidor. Reescrever o texto deles faria a próxima extração apagar a tradução
 * em silêncio — e ninguém iria notar, porque a tela continuaria desenhando,
 * só que em inglês de novo.
 *
 * Aqui a tradução é uma camada de LEITURA: o dado continua sendo o da base, o
 * `id` continua sendo o que vai e volta do servidor, e o que muda é só o que
 * aparece na tela.
 *
 * ---- E os nomes próprios ficam ----
 *
 * "Wound", "Strike", "Powerful" são o nome da coisa, e é por eles que o jogador
 * acha o item no mercado, no wiki e na conversa com outro jogador. Traduzir o
 * NOME separaria este jogo do resto do mundo dele; traduzir a EXPLICAÇÃO é o
 * que resolve o problema de verdade. Então o nome fica e ganha um apelido em
 * português ao lado, quando ele ajuda.
 */

/*
 * ---- Os charms, por `id` ----
 *
 * Por id e não por nome: o nome é o que a base pode mudar numa atualização, e
 * uma tradução presa a ele viraria uma linha morta sem ninguém perceber. O id
 * é o que o servidor usa para comprar e atribuir (ver `upgradeCharm`).
 */
const CHARMS = {
  1: { apelido: 'Ferida', texto: 'Dispara numa criatura com certa chance e causa 5% da vida inicial dela como dano físico, uma vez.' },
  2: { apelido: 'Chamas', texto: 'Dispara numa criatura com certa chance e causa 5% da vida inicial dela como dano de fogo, uma vez.' },
  3: { apelido: 'Veneno', texto: 'Dispara numa criatura com certa chance e causa 5% da vida inicial dela como dano de terra, uma vez.' },
  4: { apelido: 'Congelar', texto: 'Dispara numa criatura com certa chance e causa 5% da vida inicial dela como dano de gelo, uma vez.' },
  5: { apelido: 'Choque', texto: 'Dispara numa criatura com certa chance e causa 5% da vida inicial dela como dano de energia, uma vez.' },
  6: { apelido: 'Maldição', texto: 'Dispara numa criatura com certa chance e causa 5% da vida inicial dela como dano de morte, uma vez.' },
  7: { apelido: 'Aleijar', texto: 'Aleija a criatura com certa chance e a paralisa por 10 segundos.' },
  8: { apelido: 'Aparar', texto: 'Todo dano recebido é refletido de volta em quem atacou, com certa chance.' },
  9: { apelido: 'Esquiva', texto: 'Desvia de um ataque com certa chance, sem tomar dano nenhum.' },
  10: { apelido: 'Explosão de Adrenalina', texto: 'Com certa chance, depois de você levar um golpe, a adrenalina acelera seus reflexos e você anda mais rápido por 10 segundos.' },
  11: { apelido: 'Entorpecer', texto: 'Com certa chance, depois do ataque da criatura, entorpece e paralisa ela por 10 segundos.' },
  12: { apelido: 'Purificar', texto: 'Com certa chance, depois de você levar um golpe, remove um efeito negativo ativo ao acaso e deixa você imune a ele por um tempo.' },
  13: { apelido: 'Bênção', texto: 'Abençoa você: a perda de skill e de experiência cai 10% quando a criatura escolhida for quem te matar.' },
  14: { apelido: 'Coletar', texto: 'Aumenta a chance de conseguir esfolar ou recolher pó de uma criatura que permita isso.' },
  15: { apelido: 'Estripar', texto: 'Estripar a criatura rende 20% mais produtos dela.' },
  16: { apelido: 'Golpe Baixo', texto: 'Soma 8% de chance de acerto crítico aos ataques com armas de crítico.' },
  17: { apelido: 'Ira Divina', texto: 'Dispara numa criatura com certa chance e causa 5% da vida inicial dela como dano sagrado, uma vez.' },
  18: { apelido: 'Abraço Vampírico', texto: 'Soma 4% de roubo de vida aos ataques, se você estiver usando equipamento que dê roubo de vida.' },
  19: { apelido: 'Chamado do Vazio', texto: 'Soma 2% de roubo de mana aos ataques, se você estiver usando equipamento que dê roubo de mana.' },
  20: { apelido: 'Golpe Selvagem', texto: 'Soma dano crítico extra aos ataques com armas de crítico.' },
  21: { apelido: 'Agarrão Fatal', texto: 'Impede que criaturas fujam por estarem com pouca vida, por 30 segundos.' },
  22: { apelido: 'Inversão do Vazio', texto: 'Chance de GANHAR mana em vez de perder ao tomar dano de dreno de mana.' },
  23: { apelido: 'Carnificina', texto: 'Matar um monstro causa dano físico nos que estiverem em volta, num raio pequeno.' },
  24: { apelido: 'Dominar', texto: 'Causa dano físico com base na sua vida máxima.' },
  25: { apelido: 'Sobrecarga', texto: 'Causa dano físico com base na sua mana máxima.' },
};

/** O apelido em português de um charm, ou `null` quando não há. */
export function apelidoDoCharm(id) {
  return CHARMS[id]?.apelido ?? null;
}

/** A explicação do charm em português — ou a original, se faltar tradução. */
export function textoDoCharm(id, original) {
  return CHARMS[id]?.texto ?? original ?? '';
}

/*
 * ---- Os imbuements ----
 *
 * O nome fica em inglês (ver o cabeçalho) e ganha apelido; a categoria e a
 * explicação viram português.
 */
const IMBUEMENTS = {
  Strike: 'Crítico',
  Reap: 'Morte',
  Venom: 'Terra',
  Electrify: 'Energia',
  Scorch: 'Fogo',
  Frost: 'Gelo',
  'Lich Shroud': 'Proteção de Morte',
  'Snake Skin': 'Proteção de Terra',
  'Cloud Fabric': 'Proteção de Energia',
  'Dragon Hide': 'Proteção de Fogo',
  'Demon Presence': 'Proteção Sagrada',
  'Quara Scale': 'Proteção de Gelo',
  Vampirism: 'Roubo de Vida',
  Void: 'Roubo de Mana',
  Chop: 'Machado',
  Bash: 'Porrete',
  Precision: 'Distância',
  Punch: 'Punho',
  Epiphany: 'Magia',
  Blockade: 'Escudo',
  Slash: 'Espada',
  Swiftness: 'Velocidade',
  Featherweight: 'Capacidade',
  Vibrancy: 'Paralisia',
};

/** O apelido em português de um imbuement, ou `null` quando não há. */
export function apelidoDoImbuement(nome) {
  return IMBUEMENTS[nome] ?? null;
}

/** Os três graus. */
const GRAUS = { Basic: 'Básico', Intricate: 'Intrincado', Powerful: 'Poderoso' };

export function grauEmPortugues(nome) {
  return GRAUS[nome] ?? nome ?? '';
}

/** As categorias, como elas vêm do `imbuements.json`. */
const CATEGORIAS = {
  'Elemental Damage': 'Dano Elemental',
  'Life Leech': 'Roubo de Vida',
  'Mana Leech': 'Roubo de Mana',
  'Critical Hit': 'Acerto Crítico',
  'Elemental Protection (Death)': 'Proteção Elemental (Morte)',
  'Elemental Protection (Earth)': 'Proteção Elemental (Terra)',
  'Elemental Protection (Fire)': 'Proteção Elemental (Fogo)',
  'Elemental Protection (Ice)': 'Proteção Elemental (Gelo)',
  'Elemental Protection (Energy)': 'Proteção Elemental (Energia)',
  'Elemental Protection (Holy)': 'Proteção Elemental (Sagrado)',
  'Increase Speed': 'Velocidade',
  'Skillboost (Axe Fighting)': 'Perícia (Machado)',
  'Skillboost (Sword Fighting)': 'Perícia (Espada)',
  'Skillboost (Club Fighting)': 'Perícia (Porrete)',
  'Skillboost (Shielding)': 'Perícia (Escudo)',
  'Skillboost (Distance Fighting)': 'Perícia (Distância)',
  'Skillboost (Magic Level)': 'Perícia (Magia)',
  'Skillboost (Fist Fighting)': 'Perícia (Punho)',
  'Increase Capacity': 'Capacidade',
  'Paralysis Removal': 'Remoção de Paralisia',
};

export function categoriaEmPortugues(nome) {
  return CATEGORIAS[nome] ?? nome ?? '';
}

/*
 * ---- A explicação, por MOLDE e não uma a uma ----
 *
 * As 72 linhas de imbuement são 24 frases com números trocados — "Raises crit
 * hit damage by 5%..." e "...by 40%..." são a mesma frase. Traduzir as 72 à mão
 * seria copiar a mesma tradução três vezes e deixar as três para envelhecer
 * separadas; pior, um grau novo nasceria sem tradução.
 *
 * Então o que se traduz é o MOLDE, com os números preservados de onde vieram.
 * Uma frase que nenhum molde reconheça volta em inglês — que é feio, mas é
 * honesto, e é melhor do que a tela ficar vazia.
 */
/*
 * ---- Os moldes são expressões LITERAIS, e não montadas de texto ----
 *
 * A primeira versão montava cada uma com `new RegExp` a partir de um pedaço
 * guardado numa string, para não repetir o molde do número. Não vale a pena: um
 * `\d` dentro de uma string JS é só a letra "d" — a barra some na leitura do
 * literal, antes de a expressão existir —, e o resultado eram dez expressões
 * que não casavam com nada e 72 frases voltando em inglês sem erro nenhum no
 * console.
 *
 * Repetir `(\d+(?:\.\d+)?)` dez vezes é feio e é seguro. A barra invertida é do
 * literal de expressão, e ninguém a lê duas vezes.
 *
 * E ele é `(\d+(?:\.\d+)?)` e não `([\d.]+)`: o segundo é guloso e engole o
 * PONTO FINAL da frase junto com o número — "by 4." casava com "4." e a
 * tradução saía "em 4..". Um número é dígitos com um ponto decimal opcional NO
 * MEIO, e é isso que está escrito.
 */
const MOLDES = [
  [/^Raises crit hit damage by (\d+(?:\.\d+)?)% and crit hit chance by (\d+(?:\.\d+)?)%\.?$/i,
    (a, b) => `Aumenta o dano crítico em ${a}% e a chance de crítico em ${b}%.`],
  [/^Converts (\d+(?:\.\d+)?)% of the physical damage to (\w+) damage\.?$/i,
    (a, tipo) => `Converte ${a}% do dano físico em dano ${elemento(tipo)}.`],
  [/^Reduces (\w+) damage by (\d+(?:\.\d+)?)%\.?$/i,
    (tipo, a) => `Reduz o dano ${elemento(tipo)} em ${a}%.`],
  [/^Converts (\d+(?:\.\d+)?)% of damage to HP with a chance of (\d+(?:\.\d+)?)%\.?$/i,
    (a, b) => `Converte ${a}% do dano em vida, com ${b}% de chance.`],
  [/^Converts (\d+(?:\.\d+)?)% of damage to MP with a chance of (\d+(?:\.\d+)?)%\.?$/i,
    (a, b) => `Converte ${a}% do dano em mana, com ${b}% de chance.`],
  [/^Raises (.+) skill by (\d+(?:\.\d+)?)\.?$/i,
    (pericia, a) => `Aumenta a perícia de ${PERICIA[pericia.toLowerCase()] ?? pericia} em ${a}.`],
  [/^Raises magic level by (\d+(?:\.\d+)?)\.?$/i, (a) => `Aumenta o magic level em ${a}.`],
  [/^Raises walking speed by (\d+(?:\.\d+)?)\.?$/i, (a) => `Aumenta a velocidade em ${a}.`],
  [/^Raises capacity by (\d+(?:\.\d+)?)\.?$/i, (a) => `Aumenta a capacidade em ${a}.`],
  [/^deflects PvP paralysis, removes paralysis with a chance of (\d+(?:\.\d+)?)%\.?$/i,
    (a) => `Rebate paralisia de PvP e remove paralisia com ${a}% de chance.`],
];

/*
 * O elemento já vem com a preposição.
 *
 * "dano de fogo" e "dano sagrado" não se escrevem do mesmo jeito, e uma tabela
 * só de substantivos obrigaria a frase a escolher um dos dois — saía "dano de
 * sagrado".
 */
const ELEMENTO = {
  death: 'de morte',
  earth: 'de terra',
  energy: 'de energia',
  fire: 'de fogo',
  ice: 'de gelo',
  holy: 'sagrado',
  physical: 'físico',
};

const elemento = (tipo) => ELEMENTO[String(tipo).toLowerCase()] ?? `de ${tipo}`;

const PERICIA = {
  'melee fighting': 'melee',
  'axe fighting': 'machado',
  'club fighting': 'porrete',
  'sword fighting': 'espada',
  'fist fighting': 'punho',
  'distance fighting': 'distância',
  shielding: 'escudo',
};

/** A explicação do imbuement em português — ou a original, se nenhum molde servir. */
export function textoDoImbuement(original) {
  const frase = String(original ?? '').trim();
  if (!frase) return '';
  for (const [molde, montar] of MOLDES) {
    const achou = frase.match(molde);
    if (achou) return montar(...achou.slice(1));
  }
  return frase;
}
