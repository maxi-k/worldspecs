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

let state = (() => {
  const encoded = getQueryParam(STATE_PARAM);
  if (!!encoded) {
    try {
      const parsed = JSON.parse(base64Decode(encoded));
      if (Object.keys(parsed).length == URL_ENCODED_KEYS.length
          && URL_ENCODED_KEYS.every(key => parsed.hasOwnProperty(key))) {
        return { ...defaultState, ...parsed };
      }
    } catch (e) {
      console.error('Error parsing URL state', e);
    }
  }
  return { ...defaultState };
})();
let subscribers = [];
let subscriptionPaths = {}

// Subscribe to state changes. Callback receives (newState, updates).  Returns an unsubscribe function.
const subscribe = (callback, paths = []) => {
  subscribers.push(callback);
  subscriptionPaths[callback] = new Set(paths);
  return () => {
    subscribers = subscribers.filter(fn => fn !== callback);
    delete subscriptionPaths[callback];
  };
}

// Get a shallow copy of current state
const getState = () => ({ ...state });

// Merge updates into state, notify subscribers, and sync URL
const setState = (updates) => {
  state = { ...state, ...updates };
  const snapshot = getState();
  subscribers.forEach(cb => {
    if (Object.keys(updates).some(key => // paths empty or includes key
      subscriptionPaths[cb].size == 0 || subscriptionPaths[cb].has(key))
    ) {
      cb(snapshot, updates);
    }
  });
}

const saveState = () => {
  // update URL without reloading only encode specific keys
  const newEncoded = base64Encode(
    JSON.stringify(
      Object.fromEntries(
        Object.entries(state).filter(([key]) => URL_ENCODED_KEYS.includes(key))
      )
    )
  );
  const newUrl = window.location.origin + window.location.pathname + '?' + STATE_PARAM + '=' + newEncoded;
  window.history.replaceState(null, '', newUrl);
}

export default { subscribe, getState, setState, saveState };
