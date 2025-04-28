import state from './state.js';
import './CodeEditor.css'

/**
 * CodeEditor component wraps a CodeMirror instance and syncs its content with central state
 * Options:
 *   selector: string CSS selector for textarea element
 *   mode: CodeMirror mode (e.g., 'text/x-sql', 'text/x-rsrc')
 *   stateKey: key in state object to bind the editor content
 *   extraKeys: optional CodeMirror extraKeys config
 */
export default class CodeEditor {
  constructor(selector, options = {}) {
    const { mode, stateKey, extraKeys = {}, overrides = {} } = options;
    const textarea = document.querySelector(selector);
    if (!textarea) {
      throw new Error(`CodeEditor: element not found (${selector})`);
    }
    // Initialize CodeMirror
    this.editor = CodeMirror.fromTextArea(textarea, {
      mode,
      lineNumbers: true,
      matchBrackets: true,
      autoCloseBrackets: true,
      extraKeys: extraKeys || {},
      ...overrides
    });
    // Set initial content from state
    const init = state.getState()[stateKey] || '';
    this.editor.setValue(init);
    // Update state on editor changes
    this.editor.on('change', (cm) => {
      const val = cm.getValue();
      state.setState({ [stateKey]: val });
    });
    // Reflect external state updates
    state.subscribe((newState, updates) => {
      const newVal = newState[stateKey];
      if (this.editor.getValue() !== newVal) {
        this.editor.setValue(newVal);
      }
    }, [stateKey]);
  }

  refresh() {
    this.editor.refresh();
    console.log('refreshing editor');
  }
}
