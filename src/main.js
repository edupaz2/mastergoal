// Placeholder: Task 9 replaces this with the real controller.
import { createBoardView } from './ui.js';
import { initialState } from './state.js';

const view = createBoardView(document.getElementById('board'), {
  onSquare(sq) { console.log('square', sq); },
});
const state = initialState('W');
view.render(state, {});
window.view = view;
window.state = state;
