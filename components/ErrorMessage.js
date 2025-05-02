import state from './state.js';
import LoadingBar from './LoadingBar.svg?raw'

export default class ErrorMessage {
  #selector; #stateKey;

  constructor(selector, stateKey) {
    this.#selector = selector;
    this.#stateKey = stateKey;
    state.subscribe((newState, updates) => {
      if (this.#stateKey in updates) {
        const newVal = newState[this.#stateKey];
        this.render(newVal);
      }
    }, [this.#stateKey]);
  }

  render(message) {
    if (message === 'loading') {
      $(this.#selector).html(LoadingBar);
    } else {
      $(this.#selector).text(message);
    }
  }
}
