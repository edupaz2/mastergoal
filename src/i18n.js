// UI strings in English, Spanish, Portuguese, French, Italian and Chinese (Simplified).
// The language is the first of the browser's languages that is supported (by primary
// subtag: "es-AR" → es, "zh-TW" → zh), else English. The rules text lives in
// index.html, one block per language (data-lang).

export const LANGUAGES = ['en', 'es', 'pt', 'fr', 'it', 'zh'];

const STRINGS = {
  en: {
    level: 'Level', beginner: 'Beginner', medium: 'Medium', master: 'Master',
    newGame: 'New game', rules: 'Rules', moves: 'Moves', white: 'White', red: 'Red',
    close: 'Close', closeRules: 'Close rules', board: 'Mastergoal board',
    gameOver: 'Game over', wins: '{team} wins', draw: 'Draw', toMove: '{team} to move',
    ballMovesLeft: 'Ball moves left: {n}', moveCounter: 'Move a counter', thinking: 'Thinking...',
    goalYou: 'Goal! Red kicks off.', goalCpu: 'Red scores. Your kick-off.',
    bonusYou: 'Bonus turn: move again.', bonusCpu: 'Red earned a bonus turn.',
    noLegalMove: '{team} has no legal move.', cpuMoving: 'Red is moving...',
    hintBall: 'Move the ball: tap a highlighted square.', hintCounter: 'Your turn: tap one of your counters.',
    youWin: 'You win!', youLose: 'You lose', finalScore: 'Final score {score}.', putOutAt: 'Ball put out at {score}.',
    tossYou: 'Coin toss: you (White) start. Level: {level}.',
    tossCpu: 'Coin toss: Red (computer) starts. Level: {level}.',
    levelNote: 'The new level starts with the next New game.',
    hGoal: 'goal!', hPutOut: 'ball put out', hBonus: 'bonus turn', hNoMove: 'no legal move', ball: 'ball',
  },
  es: {
    level: 'Nivel', beginner: 'Principiante', medium: 'Medio', master: 'Maestro',
    newGame: 'Nueva partida', rules: 'Reglas', moves: 'Jugadas', white: 'Blanco', red: 'Rojo',
    close: 'Cerrar', closeRules: 'Cerrar reglas', board: 'Tablero de Mastergoal',
    gameOver: 'Fin de la partida', wins: 'Gana {team}', draw: 'Empate', toMove: 'Mueve {team}',
    ballMovesLeft: 'Movimientos de balón restantes: {n}', moveCounter: 'Mueve una ficha', thinking: 'Pensando...',
    goalYou: '¡Gol! Saca Rojo.', goalCpu: 'Gol de Rojo. Sacas tú.',
    bonusYou: 'Turno extra: vuelve a mover.', bonusCpu: 'Rojo ganó un turno extra.',
    noLegalMove: '{team} no tiene jugadas legales.', cpuMoving: 'Rojo está moviendo...',
    hintBall: 'Mueve el balón: toca una casilla resaltada.', hintCounter: 'Tu turno: toca una de tus fichas.',
    youWin: '¡Ganaste!', youLose: 'Perdiste', finalScore: 'Resultado final {score}.', putOutAt: 'Balón fuera con {score}.',
    tossYou: 'Sorteo: empiezas tú (Blanco). Nivel: {level}.',
    tossCpu: 'Sorteo: empieza Rojo (ordenador). Nivel: {level}.',
    levelNote: 'El nuevo nivel se aplica en la próxima partida.',
    hGoal: '¡gol!', hPutOut: 'balón fuera', hBonus: 'turno extra', hNoMove: 'sin jugadas legales', ball: 'balón',
  },
  pt: {
    level: 'Nível', beginner: 'Iniciante', medium: 'Médio', master: 'Mestre',
    newGame: 'Novo jogo', rules: 'Regras', moves: 'Jogadas', white: 'Branco', red: 'Vermelho',
    close: 'Fechar', closeRules: 'Fechar regras', board: 'Tabuleiro de Mastergoal',
    gameOver: 'Fim de jogo', wins: '{team} vence', draw: 'Empate', toMove: 'Vez do {team}',
    ballMovesLeft: 'Movimentos de bola restantes: {n}', moveCounter: 'Mova uma peça', thinking: 'Pensando...',
    goalYou: 'Gol! O Vermelho dá a saída.', goalCpu: 'Gol do Vermelho. A saída é sua.',
    bonusYou: 'Turno extra: jogue de novo.', bonusCpu: 'O Vermelho ganhou um turno extra.',
    noLegalMove: '{team} não tem jogada válida.', cpuMoving: 'O Vermelho está jogando...',
    hintBall: 'Mova a bola: toque numa casa destacada.', hintCounter: 'Sua vez: toque numa das suas peças.',
    youWin: 'Você venceu!', youLose: 'Você perdeu', finalScore: 'Placar final {score}.', putOutAt: 'Bola fora com {score}.',
    tossYou: 'Sorteio: você (Branco) começa. Nível: {level}.',
    tossCpu: 'Sorteio: o Vermelho (computador) começa. Nível: {level}.',
    levelNote: 'O novo nível vale a partir do próximo Novo jogo.',
    hGoal: 'gol!', hPutOut: 'bola fora', hBonus: 'turno extra', hNoMove: 'sem jogada válida', ball: 'bola',
  },
  fr: {
    level: 'Niveau', beginner: 'Débutant', medium: 'Moyen', master: 'Maître',
    newGame: 'Nouvelle partie', rules: 'Règles', moves: 'Coups', white: 'Blanc', red: 'Rouge',
    close: 'Fermer', closeRules: 'Fermer les règles', board: 'Plateau de Mastergoal',
    gameOver: 'Partie terminée', wins: '{team} gagne', draw: 'Match nul', toMove: '{team} joue',
    ballMovesLeft: 'Déplacements du ballon restants : {n}', moveCounter: 'Déplacez un pion', thinking: 'Réflexion...',
    goalYou: 'But ! Rouge donne le coup d’envoi.', goalCpu: 'Rouge marque. À vous le coup d’envoi.',
    bonusYou: 'Tour bonus : rejouez.', bonusCpu: 'Rouge gagne un tour bonus.',
    noLegalMove: '{team} n’a aucun coup légal.', cpuMoving: 'Rouge joue...',
    hintBall: 'Déplacez le ballon : touchez une case en surbrillance.', hintCounter: 'À vous : touchez un de vos pions.',
    youWin: 'Vous avez gagné !', youLose: 'Vous avez perdu', finalScore: 'Score final {score}.', putOutAt: 'Ballon sorti à {score}.',
    tossYou: 'Tirage au sort : vous (Blanc) commencez. Niveau : {level}.',
    tossCpu: 'Tirage au sort : Rouge (ordinateur) commence. Niveau : {level}.',
    levelNote: 'Le nouveau niveau s’applique à la prochaine Nouvelle partie.',
    hGoal: 'but !', hPutOut: 'ballon sorti', hBonus: 'tour bonus', hNoMove: 'aucun coup légal', ball: 'ballon',
  },
  it: {
    level: 'Livello', beginner: 'Principiante', medium: 'Medio', master: 'Maestro',
    newGame: 'Nuova partita', rules: 'Regole', moves: 'Mosse', white: 'Bianco', red: 'Rosso',
    close: 'Chiudi', closeRules: 'Chiudi le regole', board: 'Tabellone di Mastergoal',
    gameOver: 'Partita finita', wins: '{team} vince', draw: 'Pareggio', toMove: 'Muove {team}',
    ballMovesLeft: 'Mosse di palla rimaste: {n}', moveCounter: 'Muovi una pedina', thinking: 'Sto pensando...',
    goalYou: 'Gol! Il Rosso batte il calcio d’inizio.', goalCpu: 'Gol del Rosso. Tocca a te il calcio d’inizio.',
    bonusYou: 'Turno bonus: muovi ancora.', bonusCpu: 'Il Rosso ha guadagnato un turno bonus.',
    noLegalMove: '{team} non ha mosse valide.', cpuMoving: 'Il Rosso sta muovendo...',
    hintBall: 'Muovi la palla: tocca una casella evidenziata.', hintCounter: 'Tocca a te: tocca una delle tue pedine.',
    youWin: 'Hai vinto!', youLose: 'Hai perso', finalScore: 'Risultato finale {score}.', putOutAt: 'Palla fuori sul {score}.',
    tossYou: 'Sorteggio: inizi tu (Bianco). Livello: {level}.',
    tossCpu: 'Sorteggio: inizia il Rosso (computer). Livello: {level}.',
    levelNote: 'Il nuovo livello vale dalla prossima Nuova partita.',
    hGoal: 'gol!', hPutOut: 'palla fuori', hBonus: 'turno bonus', hNoMove: 'nessuna mossa valida', ball: 'palla',
  },
  zh: {
    level: '难度', beginner: '初级', medium: '中级', master: '大师',
    newGame: '新游戏', rules: '规则', moves: '走法记录', white: '白方', red: '红方',
    close: '关闭', closeRules: '关闭规则', board: 'Mastergoal 棋盘',
    gameOver: '游戏结束', wins: '{team}获胜', draw: '平局', toMove: '轮到{team}',
    ballMovesLeft: '球还可移动 {n} 次', moveCounter: '移动一枚棋子', thinking: '思考中…',
    goalYou: '进球！由红方开球。', goalCpu: '红方进球。由你开球。',
    bonusYou: '奖励回合：再走一次。', bonusCpu: '红方获得奖励回合。',
    noLegalMove: '{team}没有合法走法。', cpuMoving: '红方正在走棋…',
    hintBall: '移动球：点击高亮的格子。', hintCounter: '轮到你：点击你的一枚棋子。',
    youWin: '你赢了！', youLose: '你输了', finalScore: '最终比分 {score}。', putOutAt: '球无处可走，比分 {score}。',
    tossYou: '掷硬币：你（白方）先走。难度：{level}。',
    tossCpu: '掷硬币：红方（电脑）先走。难度：{level}。',
    levelNote: '新难度从下一局新游戏开始生效。',
    hGoal: '进球！', hPutOut: '球无处可走', hBonus: '奖励回合', hNoMove: '没有合法走法', ball: '球',
  },
};

let lang = 'en';

// First supported language among `languages` (e.g. navigator.languages), else 'en'.
export function pickLanguage(languages) {
  for (const l of languages ?? []) {
    const primary = String(l).toLowerCase().split(/[-_]/)[0];
    if (LANGUAGES.includes(primary)) return primary;
  }
  return 'en';
}

export function setLanguage(l) {
  lang = LANGUAGES.includes(l) ? l : 'en';
}

export function language() {
  return lang;
}

// The string `key` in the current language, with {name} placeholders filled from params.
export function t(key, params = {}) {
  const s = STRINGS[lang][key] ?? STRINGS.en[key] ?? key;
  return s.replace(/\{(\w+)\}/g, (m, k) => (k in params ? String(params[k]) : m));
}

export function teamName(team) {
  return t(team === 'W' ? 'white' : 'red');
}

// Static page text: elements with data-i18n get that string as their text, elements
// with data-i18n-label as their aria-label; the rules block for the language is shown.
export function translatePage(doc) {
  doc.documentElement.lang = lang === 'zh' ? 'zh-Hans' : lang;
  for (const n of doc.querySelectorAll('[data-i18n]')) n.textContent = t(n.dataset.i18n);
  for (const n of doc.querySelectorAll('[data-i18n-label]')) n.setAttribute('aria-label', t(n.dataset.i18nLabel));
  for (const n of doc.querySelectorAll('.rules-body')) n.hidden = n.dataset.lang !== lang;
}

export const _STRINGS = STRINGS;
