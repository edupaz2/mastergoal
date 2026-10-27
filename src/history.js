// Move history: pure text describers plus a tiny DOM list wrapper.
import { squareName } from './board.js';

function fromSquare(piece, before) {
  return piece.kind === 'G' ? before.gk[piece.team] : before.players[piece.team][piece.index];
}

export function describeAction(a, before, ballWord = 'ball') {
  if (a.kind === 'ball') return `${ballWord} →${squareName(a.to)}`;
  const from = fromSquare(a.piece, before);
  return `${a.piece.kind} ${squareName(from)}→${squareName(a.to)}`;
}

// Only the pre-turn state is needed: the counter move comes first and ball
// moves have no from-square.
export function describeTurn(team, actions, before, ballWord = 'ball') {
  return [team, ...actions.map((a) => describeAction(a, before, ballWord))].join(' ');
}

// Items are created with listEl.ownerDocument.createElement('li') when available
// (real browser), else listEl.createElement('li') (test fakes), else a plain
// object, so a minimal fake with only appendChild/replaceChildren still works.
export function createHistory(listEl) {
  const make = () => {
    const doc = listEl.ownerDocument;
    if (doc && doc.createElement) return doc.createElement('li');
    if (typeof listEl.createElement === 'function') return listEl.createElement('li');
    return { textContent: '' };
  };
  return {
    add(turnNumber, text) {
      const li = make();
      li.textContent = `${turnNumber}. ${text}`;
      listEl.appendChild(li);
      if ('scrollTop' in listEl && listEl.scrollHeight !== undefined) {
        listEl.scrollTop = listEl.scrollHeight;
      }
    },
    clear() { listEl.replaceChildren(); },
  };
}
