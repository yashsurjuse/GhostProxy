import { useMemo, useState, useEffect } from 'react';
import clsx from 'clsx';
import { X } from 'lucide-react';
import {
  groupShortcutDefinitions,
  getEffectiveShortcuts,
  eventToShortcut,
  normalizeShortcutString,
} from '/src/utils/shortcuts';
import { useOptions } from '/src/utils/optionsContext';

const ShortcutsDialog = ({ open, onClose, shortcuts, onSave }) => {
  const { options } = useOptions();
  const grouped = useMemo(() => groupShortcutDefinitions(), []);
  const [draft, setDraft] = useState(() => getEffectiveShortcuts({ shortcuts }));
  const [capturing, setCapturing] = useState(null);

  useEffect(() => {
    if (open) {
      setDraft(getEffectiveShortcuts({ shortcuts }));
      setCapturing(null);
    }
  }, [open, shortcuts]);

  if (!open) return null;

  const save = () => {
    onSave(draft);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div
        className="relative w-full max-w-5xl max-h-[85dvh] rounded-xl border border-white/10 overflow-hidden"
        style={{ backgroundColor: options.quickModalBgColor || '#252f3e' }}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
          <h2 className="text-lg font-semibold">Keyboard Shortcuts</h2>
          <button onClick={onClose} className="p-1 rounded-md hover:bg-[#ffffff12]">
            <X size={18} />
          </button>
        </div>

        <div className="p-4 overflow-y-auto max-h-[calc(85dvh-7.5rem)] space-y-5">
          {Object.entries(grouped).map(([section, items]) => (
            <div key={section}>
              <h3 className="text-sm font-semibold mb-2 opacity-90">{section}</h3>
              <div className="space-y-2">
                {items.map((item) => {
                  const cfg = draft[item.id] || { key: '', enabled: true };
                  return (
                    <div
                      key={item.id}
                      className="grid grid-cols-12 gap-3 items-center rounded-lg px-3 py-2 bg-[#ffffff0d]"
                    >
                      <div className="col-span-6 text-sm">{item.label}</div>

                      <button
                        onClick={() =>
                          setDraft((prev) => ({
                            ...prev,
                            [item.id]: { ...cfg, enabled: !cfg.enabled },
                          }))
                        }
                        className={clsx(
                          'col-span-2 h-8 rounded-md text-xs',
                          cfg.enabled ? 'bg-[#4c6c91]' : 'bg-[#ffffff14]',
                        )}
                      >
                        {cfg.enabled ? 'Enabled' : 'Disabled'}
                      </button>

                      <input
                        className={clsx(
                          'col-span-4 h-8 rounded-md px-2 text-sm bg-[#0000002a] outline-none border border-white/10',
                          capturing === item.id && 'border-[#75b3e8]',
                        )}
                        value={cfg.key}
                        readOnly
                        onFocus={() => setCapturing(item.id)}
                        onBlur={() => capturing === item.id && setCapturing(null)}
                        onKeyDown={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          if (e.key === 'Escape') {
                            setCapturing(null);
                            return;
                          }
                          const combo = normalizeShortcutString(eventToShortcut(e));
                          if (!combo) return;
                          setDraft((prev) => ({
                            ...prev,
                            [item.id]: { ...cfg, key: combo },
                          }));
                          setCapturing(null);
                        }}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        <div className="px-4 py-3 border-t border-white/10 flex items-center justify-end gap-2">
          <button onClick={onClose} className="h-9 px-4 rounded-md bg-[#ffffff14] hover:bg-[#ffffff1f]">
            Cancel
          </button>
          <button onClick={save} className="h-9 px-4 rounded-md bg-[#4c6c91] hover:opacity-90">
            Save Shortcuts
          </button>
        </div>
      </div>
    </div>
  );
};

export default ShortcutsDialog;
