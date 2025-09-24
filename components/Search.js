import './Search.css'
import { debounce, copyToClipboard, capStringLen } from '/util.js'

const template = `
    <div class="search-container">
        <div class="search-wrapper">
            <input
                type="text"
                class="search-input dropdown"
                placeholder="Search tables..."
                id="searchInput">
        </div>

        <div class="results-container" id="resultsContainer">
            <div class="no-results">
            Type something to search through table names and descriptions.
            </div>
        </div>
    </div>
`

export default class Search {
  #input; #results; #handlers; #searchFn;

  constructor(input, searchFn) {
    this.#input = input;
    this.#searchFn = searchFn;
    this.#results = '#resultsContainer';
    this.#handlers = {
      input: debounce(this.onInput.bind(this), 300),
      click: this.onClick.bind(this),
      select: this.selectTable.bind(this)
    };
    const $input = $(this.#input);
    $input[0].innerHTML = template;
    $input.on('input', this.#handlers.input);                                   // search on input
    document.addEventListener('click', this.#handlers.click);                   // focus/unfocus on click
    $('.results-container').on('click', '.result-item', this.#handlers.select); // select result
    this.prefillResults();                                                      // initial result rendering (async)
  }

  async prefillResults() {
    const result = await this.searchTables("");
    this.renderResults(result, /*don't show*/ false);
  }

  onClick(e) {
    if (e.target.closest('.search-input')) {
      $(this.#results).toggleClass('show');
    } else {
      $(this.#results).removeClass('show');
    }
  }

  async onInput(e) {
    const results = await this.searchTables(e.target.value);
    this.renderResults(results, true);
  }

  renderResults(tables, show = true) {
    const resultsContainer = $(this.#results);
    if (tables.length === 0) {
      resultsContainer[0].innerHTML = '<div class="no-results">No tables found matching your search</div>';
    } else {
      resultsContainer[0].innerHTML = tables.map(table => `
                    <div class="result-item" data-table-name="${table.name}" title="${table.description}">
                        <span class="table-name">${table.name}</span>
                        <span class="table-columns">${table.columns}</span>
                        <span class="table-description">${capStringLen(table.description, 200)}</span>
                    </div>
                `).join('');
    }
    if (show) {
      resultsContainer.addClass('show');
    }
  }

  async searchTables(query) {
    return await this.#searchFn(query.trim(), 50);
  }

  selectTable(e) {
    let tableName = $(e.target).closest('.result-item').data('table-name');
    copyToClipboard(tableName);
  }
}
