// main.js
// Orchestrates components: state manager, code editors, database querying, and table rendering
import state from './components/state.js';
import CodeEditor from './components/CodeEditor.js';
import DB from './components/db.js';
import ResultTable from './components/ResultTable.js';
import ErrorMessage from './components/ErrorMessage.js';

document.addEventListener('DOMContentLoaded', () => {
  // set up listener for updating url
  state.subscribe((newState, updates) => {
    state.saveState();
  }, ['result', 'rOutput']);

  // button for sharing url
  $('#share-btn').click(() => {
    // state.saveState();
    const text = window.location.href;
    navigator.clipboard.writeText(text).then(() => {
      showToast("Link copied to clipboard!");
    }).catch(err => console.error("Failed to copy: ", err));
  });

  // button for downloading full duckdb
  $('#download-btn').click(() => {
    const base = window.location.origin + window.location.pathname;
    window.location.href = `${base}/static/cloudspecs.duckdb`; // Target URL
  });

  // button for resetting page
  $('#reset-btn').click((e) => {
    const newUrl = window.location.origin + window.location.pathname;
    window.location = newUrl;
  });

  // buttons for changing view type
  $('#toggle-viz-btn').click((e) => {
    let elem = $('#app');
    if (elem.hasClass('splitview')) {
      elem.removeClass('splitview').addClass('tableview');
      $('#toggle-viz-btn').text('Visualize');
    } else {
      elem.removeClass('tableview').addClass('splitview');
      $('#toggle-viz-btn').text('Table only');
    }
  });

  // grid resize drag handler
  var isDragging = false;
  $('#grid-resize')
    .mousedown(function() {
      console.log("mosuedown");
      isDragging = true;
    })
    .mousemove(function() {
      if (!isDragging) return;
      console.log("mousemove");
      // get mouse x position, set grid-template-columns of grid view
      var mouseX = event.pageX;
      var gridPercent = (mouseX / $('#app').width()) * 100;
      console.log("gridPercent", gridPercent);
      $('.splitview').css('grid-template-columns', `calc(${gridPercent}% - 3px) 6px calc(${100 - gridPercent}% - 3px)`);
      isDragging = true;
    })
    .mouseup(function() {
      console.log("mouseup");
      var wasDragging = isDragging;
      isDragging = false;
    });

});

//////////////////////// SQL Editor  ///////////////////////
document.addEventListener('DOMContentLoaded', async () => {
  // Run query based on current state.sqlQuery
  async function runQuery() {
    state.setState({ sqlError: '' });
    const query = state.getState().sqlQuery;
    let result;
    try {
      result = await db.query(query);
    } catch (err) {
      result = { error: [err.toString()] };
    }
    if (result.error) {
      state.setState({ result: { columns: [], rows: [], query }, sqlError: result.error });
    } else {
      state.setState({ result: { columns: result.columns, rows: result.rows, query }, sqlError: '' });
    }
  }

  // SQL Code Editor
  const sqlEditor = new CodeEditor('#sql-editor', {
    mode: 'text/x-sql',
    stateKey: 'sqlQuery',
    extraKeys: {
      'Ctrl-Enter': runQuery
    }
  });
  // error message for SQL
  const sqlError = new ErrorMessage('#sql-status', 'sqlError');

  // Initialize database and result table
  const db = await DB.create();
  const resultTable = new ResultTable('#sql-output');

  // Handle state updates for query results
  state.subscribe((newState, updates) => {
    const { columns, rows, query } = newState.result;
    resultTable.render(columns, rows, query);
    if (window.rmodule) {
      window.rmodule.onDataUpdate({ columns, rows });
    }
  }, ['result']);

  // Load table button
  document.getElementById('load-table').addEventListener('click', async (e) => {
    e.preventDefault();
    await runQuery();
  });

  // Fallback Ctrl+Enter
  document.addEventListener('keydown', (event) => {
    if (event.ctrlKey && event.key === 'Enter') {
      runQuery();
    }
  });

  await runQuery();
});

//////////////////////// R module  ///////////////////////
document.addEventListener('DOMContentLoaded', async () => {
  const RRepl = await import('./components/RRepl.js');
  // error message for R
  const rError = new ErrorMessage('#r-status', 'rError');
  // Prepare R evaluation area
  const rEditor = new CodeEditor("#r-editor", {
      mode: 'text/x-rsrc',
      stateKey: 'rCode',
      extraKeys: {
        'Ctrl-Enter': () => evalR()
      }
  });

  // Initialize R environment
  const outputElem = 'r-output';
  const repl = await RRepl.default.initialize(outputElem);
  async function evalR() {
    const { rCode, result } = state.getState();
    const res = await repl.eval(rCode, result);
    if (res.error) {
      state.setState({ rError: res.error });
    } else {
      state.setState({ rError: '', rOutput: res.svg });
      document.getElementById(outputElem).innerHTML = res.svg;
    }
  }
  // 'Execute R' button
  document.getElementById('execute-r').addEventListener('click', async (e) => {
    await evalR();
  });

  // evaluate R when sql state changes
  state.subscribe((newState, updates) => {
    if (newState.sqlError) { return; }
    evalR();
  }, ['result']);

  // Initial query to populate table based on URL/state
  await evalR();
});
