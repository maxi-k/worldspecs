
export const showToast = (message) => {
    const toast = $("#toast").text(message).addClass("show");
    setTimeout(() => { toast.removeClass("show"); }, 2000);
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
