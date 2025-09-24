import state from './state.js';
import LoadingBar from './LoadingBar.svg?raw'

export default class ErrorMessage {
  #selector; #stateKeys;

  constructor(selector, stateKeys) {
    if (!Array.isArray(stateKeys)) {
      stateKeys = [stateKeys];
    }
    this.#selector = selector;
    this.#stateKeys = stateKeys;
    state.subscribe((newState, updates) => {
      for (const key of this.#stateKeys) {
        if (key in updates) {
          const newVal = newState[key];
          this.render(newVal);
        }
      }
    }, this.#stateKeys);
  }

  render(message) {
    if (message === 'loading') {
      $(this.#selector).html(LoadingBar);
    } else {
      $(this.#selector).text(message);
    }
  }
}
