function copyWithSelection(text) {
  const activeElement = document.activeElement;
  const selection = window.getSelection();
  const ranges = Array.from({ length: selection?.rangeCount || 0 }, (_, index) =>
    selection.getRangeAt(index).cloneRange(),
  );
  const field = document.createElement('textarea');
  field.value = text;
  field.readOnly = true;
  field.className = 'clipboard-fallback';
  document.body.append(field);

  try {
    field.select();
    field.setSelectionRange(0, text.length);
    if (!document.execCommand('copy')) throw new Error('Copy failed');
  } finally {
    field.remove();
    activeElement?.focus({ preventScroll: true });
    selection?.removeAllRanges();
    ranges.forEach((range) => selection?.addRange(range));
  }
}

export function initCitation() {
  const button = document.querySelector('#copy-citation');
  const code = document.querySelector('#citation-code');
  const status = document.querySelector('#citation-status');
  if (!button || !code || !status) return;
  let resetTimer;
  let copying = false;

  button.addEventListener('click', async () => {
    if (copying) return;
    clearTimeout(resetTimer);
    copying = true;
    button.setAttribute('aria-busy', 'true');
    button.dataset.state = 'copying';
    status.textContent = '';
    status.dataset.state = '';
    const text = code.textContent.trim();

    try {
      // Clipboard API requires a secure context; retain HTTP preview support.
      if (navigator.clipboard?.writeText) {
        try {
          await navigator.clipboard.writeText(text);
        } catch {
          copyWithSelection(text);
        }
      } else {
        copyWithSelection(text);
      }
      button.dataset.state = 'copied';
      button.dataset.tooltip = 'Copied';
      status.textContent = 'Copied';
    } catch {
      button.dataset.state = 'error';
      button.dataset.tooltip = 'Retry copy';
      status.dataset.state = 'error';
      status.textContent = 'Copy failed';
    } finally {
      copying = false;
      button.removeAttribute('aria-busy');
      resetTimer = setTimeout(() => {
        button.dataset.state = '';
        button.dataset.tooltip = 'Copy citation';
        status.dataset.state = '';
        status.textContent = '';
      }, 2500);
    }
  });
}
