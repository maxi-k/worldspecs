// Central state manager for application
// Provides subscribe, getState, setState, and syncs state with URL

// Helper functions for Base64 encoding/decoding of URI components
const base64Encode = (str) => btoa(encodeURIComponent(str));
const base64Decode = (str) => {
  try {
    return decodeURIComponent(atob(str));
  } catch {
    return '';
  }
}

const getQueryParam = (name) => {
  const params = new URLSearchParams(window.location.search);
  return params.get(name);
}

const STATE_PARAM = 'state';
const URL_ENCODED_KEYS = ['sqlQuery', 'rCode'];
// Default state values
const defaultState = {
  sqlQuery: `SELECT *\nFROM aws`,
  rCode: ''
};

// Initialize state from URL or defaults
let initialState = { ...defaultState };
const encoded = getQueryParam(STATE_PARAM);
if (encoded) {
  try {
    const parsed = JSON.parse(base64Decode(encoded));
    console.log('parsed url state', parsed);
    if (parsed.keys().size == URL_ENCODED_KEYS.size
        && URL_ENCODED_KEYS.every(key => parsed.hasOwnProperty(key))) {
      initialState = { ...initialState,  ...parsed };
    } else {
      console.log("not setting invalid url state ", parsed);
    }
  } catch {
    // ignore malformed state
  }
}

let state = { ...initialState };
let subscribers = [];

// Subscribe to state changes. Callback receives (newState, updates).  Returns an unsubscribe function.
const subscribe = (callback) => {
  subscribers.push(callback);
  return () => {
    subscribers = subscribers.filter(fn => fn !== callback);
  };
}

// Get a shallow copy of current state
const getState = () => ({ ...state });

// Merge updates into state, notify subscribers, and sync URL
const setState = (updates) => {
  state = { ...state, ...updates };
  const snapshot = getState();
  subscribers.forEach(cb => cb(snapshot, updates));
  // update URL without reloading
  // only encode specific keys
  const newEncoded = base64Encode(
    JSON.stringify(
      Object.fromEntries(
        Object.entries(snapshot).filter(([key]) => URL_ENCODED_KEYS.includes(key))
      )
    )
  );
  const newUrl = window.location.origin + window.location.pathname + '?' + STATE_PARAM + '=' + newEncoded;
  window.history.replaceState(null, '', newUrl);
}

export default { subscribe, getState, setState };
