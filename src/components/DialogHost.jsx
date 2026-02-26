    import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { getDialogEventName } from '/src/utils/uiDialog';

const DialogHost = () => {
  const [dialog, setDialog] = useState(null);

  useEffect(() => {
    const eventName = getDialogEventName();
    const handler = (event) => {
      setDialog(event.detail || null);
    };
    window.addEventListener(eventName, handler);
    return () => window.removeEventListener(eventName, handler);
  }, []);

  if (!dialog) return null;

  const close = (result) => {
    try {
      dialog.resolve?.(result);
    } catch {}
    setDialog(null);
  };

  const isConfirm = dialog.type === 'confirm';

  return (
    <div className="fixed inset-0 z-[12000] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/55" onClick={() => close(isConfirm ? false : undefined)} />
      <div className="relative w-full max-w-md rounded-xl border border-white/10 bg-[#252f3e] shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
          <h2 className="text-lg font-semibold">{dialog.title || (isConfirm ? 'Confirm' : 'Notice')}</h2>
          <button onClick={() => close(isConfirm ? false : undefined)} className="p-1 rounded-md hover:bg-[#ffffff12]">
            <X size={18} />
          </button>
        </div>
        <div className="px-4 py-4 text-sm leading-relaxed whitespace-pre-wrap">{dialog.message}</div>
        <div className="px-4 py-3 border-t border-white/10 flex items-center justify-end gap-2">
          {isConfirm && (
            <button
              onClick={() => close(false)}
              className="h-9 px-4 rounded-md bg-[#ffffff14] hover:bg-[#ffffff1f]"
            >
              Cancel
            </button>
          )}
          <button
            onClick={() => close(isConfirm ? true : undefined)}
            className="h-9 px-4 rounded-md bg-[#4c6c91] hover:opacity-90"
          >
            OK
          </button>
        </div>
      </div>
    </div>
  );
};

export default DialogHost;
