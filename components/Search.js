import './Search.css'
import { debounce, copyToClipboard } from '/util.js'

const template = `
    <div class="search-container">
        <div class="search-wrapper">
            <input
                type="text"
                class="search-input button-dimensions"
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
      input: debounce(this.searchTables.bind(this), 300),
      click: this.toggleResults.bind(this),
      select: this.selectTable.bind(this)
    }
    const $input = $(this.#input);
    $input[0].innerHTML = template;
    $input[0].addEventListener('input', this.#handlers.input);
    $input[0].addEventListener('focus', this.#handlers.focus);
    document.addEventListener('click', this.#handlers.click);
    $('.results-container').on('click', '.result-item', this.#handlers.select);
  }

  toggleResults(e) {
    if (e.target.closest('.search-input')) {
      $(this.#results).toggleClass('show');
    } else {
      $(this.#results).removeClass('show');
    }
  }

  renderResults(tables) {
    const resultsContainer = $(this.#results);
    if (tables.length === 0) {
      resultsContainer[0].innerHTML = '<div class="no-results">No tables found matching your search</div>';
    } else {
      resultsContainer[0].innerHTML = tables.map(table => `
                    <div class="result-item" data-table-name="${table.name}">
                        <div class="table-name">${table.name}</div>
                        <div class="table-description">${table.description}</div>
                    </div>
                `).join('');
    }
    resultsContainer.addClass('show');
  }

  async searchTables(e) {
    const resultsContainer = $(this.#results)[0];
    const query = e.target.value;
    if (!query.trim()) {
      this.renderResults([]);
      $(this.#results).removeClass('show');
      return;
    }

    this.renderResults(await this.#searchFn(query));
  }

  selectTable(e) {
    let tableName = $(e.target).closest('.result-item').data('table-name');
    copyToClipboard(tableName);
  }
}

