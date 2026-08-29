let activeToastTimeout = null;

function clearExistingToast() {
  const container = document.getElementById('alert-holder');
  if (!container) return;
  
  if (activeToastTimeout) {
    clearTimeout(activeToastTimeout);
    activeToastTimeout = null;
  }
  
  const existingToast = container.querySelector('.toast-alert');
  if (existingToast) {
    existingToast.remove();
  }
}

function loadToast(message) {
  const container = document.getElementById('alert-holder');
  if (!container) return;

  clearExistingToast();

  const toast = document.createElement('div');
  toast.className = 'toast-alert';
  
  const textSpan = document.createElement('span');
  textSpan.textContent = message;

  const closeBtn = document.createElement('span');
  closeBtn.className = 'toast-btn close';
  closeBtn.innerHTML = '&times;';
  closeBtn.onclick = () => closeToast(toast);

  toast.appendChild(textSpan);
  toast.appendChild(closeBtn);
  container.appendChild(toast);

  activeToastTimeout = setTimeout(() => {
    closeToast(toast);
  }, 3000);
}

function closeToast(element) {
  if (!element) return;
  element.classList.add('hide');
  
  setTimeout(() => {
    element.remove();
  }, 250);
}
