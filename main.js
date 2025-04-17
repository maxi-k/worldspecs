// main.js
// Orchestrates components: state manager, code editors, database querying, and table rendering
import state from './components/state.js';
import CodeEditor from './components/CodeEditor.js';
import DB from './components/db.js';
import ResultTable from './components/ResultTable.js';

document.addEventListener('DOMContentLoaded', async () => {
  // SQL Code Editor
  const sqlEditor = new CodeEditor('#sql-editor', {
    mode: 'text/x-sql',
    stateKey: 'sqlQuery',
    extraKeys: {
      'Ctrl-Enter': () => {
        document.getElementById('error-msg').textContent = '';
        runQuery();
      }
    }
  });

  // Initialize database and result table
  const db = await DB.create();
  const resultTable = new ResultTable('#ec2-instances');

  // Handle state updates for query results
  state.subscribe((newState, updates) => {
    if (Object.prototype.hasOwnProperty.call(updates, 'result')) {
      const { columns, rows, query } = newState.result;
      resultTable.render(columns, rows, query);
      if (window.rmodule) {
        window.rmodule.onDataUpdate({ columns, rows });
      }
    }
  });

  // Run query based on current state.sqlQuery
  async function runQuery() {
    const query = state.getState().sqlQuery;
    let result;
    try {
      result = await db.query(query);
    } catch (err) {
      result = { error: [err.toString()] };
    }
    if (result.error) {
      document.getElementById('error-msg').textContent = result.error.join('\n');
      state.setState({ result: { columns: [], rows: [], query } });
    } else {
      document.getElementById('error-msg').textContent = '';
      state.setState({ result: { columns: result.columns, rows: result.rows, query } });
    }
  }

  // Load table button
  document.getElementById('load-table').addEventListener('click', async (e) => {
    e.preventDefault();
    document.getElementById('error-msg').textContent = '';
    await runQuery();
  });

  // Fallback Ctrl+Enter
  document.addEventListener('keydown', (event) => {
    if (event.ctrlKey && event.key === 'Enter') {
      document.getElementById('error-msg').textContent = '';
      runQuery();
    }
  });

  // Prepare R evaluation area
  const reval = document.getElementById('r-eval');
  reval.innerHTML += '<textarea id="r-editor" class="form-control" rows="10" placeholder="Enter R code here"></textarea>';
  reval.innerHTML += '<button id="execute-r">Plot [Ctrl+Enter]</button>';
  reval.innerHTML += '<div id="r-status" class="output">Loading R...</div>';
  reval.innerHTML += '<div id="r-output" class="output"></div>';

  // Load and initialize R module
  try {
    const rmodule = await import('./static/plot.js');
    window.rmodule = rmodule;
    await rmodule.initializeR('r-status');
    const rEditor = new CodeEditor('#r-editor', {
      mode: 'text/x-rsrc',
      stateKey: 'rCode',
      extraKeys: {
        'Ctrl-Enter': () => document.getElementById('execute-r').click()
      }
    });
    const submitBtn = document.getElementById('execute-r');
    const out = document.getElementById('r-output');
    await rmodule.makeRRepl(rEditor.editor, out, 'r-output', submitBtn);
  } catch (error) {
    console.error('Failed to load R module', error);
    alert('Failed to load R module');
  }

  // Initial query to populate table based on URL/state
  runQuery();
});