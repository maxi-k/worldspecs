import '/splitview.css'
import '/tableview.css'

export default class ResizeHandle {
  #isResizing; #grid; #handle; #handlers;

  constructor(grid, handle) {
    this.#grid = grid;
    this.#handle = handle;
    this.#isResizing = false;
    this.#handlers = {move: this.pointerMove.bind(this),
                      up: this.pointerUp.bind(this),
                      down: this.pointerDown.bind(this) };
    $(this.#handle)[0].addEventListener("pointerdown", this.#handlers.down);
  }

  pointerDown(evt) {
    if (this.#isResizing || !evt.target.closest(this.#handle)) return;
    this.#isResizing = true;
    addEventListener("pointermove", this.#handlers.move);
    addEventListener("pointerup", this.#handlers.up);
  };

  pointerMove(evt) {
    evt.preventDefault();
    const grid = $(this.#grid)[0];
    const pct = 100 * (evt.clientX / grid.clientWidth);
    grid.style["grid-template-columns"] = `calc(${pct}% - 3px) 6px calc(${100-pct}% - 3px)`;
  };

  pointerUp(evt) {
    removeEventListener("pointermove", this.#handlers.move);
    removeEventListener("pointerup", this.#handlers.up);
    this.#isResizing = false;
  };
}
