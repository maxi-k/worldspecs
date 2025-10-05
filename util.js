
export const showToast = (message, type = 'info') => {
    const toast = $("#toast").text(message).addClass("show");
    // Add type-specific styling if needed
    toast.removeClass('toast-error toast-success toast-info').addClass(`toast-${type}`);
    setTimeout(() => { toast.removeClass("show"); }, 2000);
}

export const setGlobalError = (message) => {
  $('#global-error').text(message);
}

export const debounce = (callback, delay_ms) => {
  let id = null;
  return (...args) => {
    window.clearTimeout(id);
    id = window.setTimeout(() => {callback(...args);}, delay_ms);
  };
}

export const copyToClipboard = (text, msg = "Copied to clipboard!") => {
  navigator.clipboard.writeText(text).then(() => {
    showToast(msg);
  }).catch(err => console.error("Failed to copy: ", err));
}

export const capStringLen = (text, maxlen) => {
  if (text.length > (maxlen - 3)) {
    return text.substring(0, maxlen - 3) + "...";
  }
  return text;
}
