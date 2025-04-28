import state from './state.js';

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
    $(this.#selector).text(message);
  }
}
