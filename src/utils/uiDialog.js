const EVENT_NAME = 'ghost-ui-dialog';

function dispatchDialog(detail) {
  if (typeof window === 'undefined') return false;
  window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail }));
  return true;
}

export function showAlert(message, title = 'Notice') {
  return new Promise((resolve) => {
    const ok = dispatchDialog({
      type: 'alert',
      title,
      message,
      resolve: () => resolve(),
    });

    if (!ok) {
      resolve();
    }
  });
}

export function showConfirm(message, title = 'Confirm') {
  return new Promise((resolve) => {
    const ok = dispatchDialog({
      type: 'confirm',
      title,
      message,
      resolve,
    });

    if (!ok) {
      resolve(true);
    }
  });
}

export function getDialogEventName() {
  return EVENT_NAME;
}
