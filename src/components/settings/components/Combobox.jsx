import clsx from 'clsx';
import {
  Combobox,
  ComboboxButton,
  ComboboxOption,
  ComboboxOptions,
} from '@headlessui/react';
import { ChevronDown, Check } from 'lucide-react';
import { useOptions } from '/src/utils/optionsContext';
import { useMemo } from 'react';

const ComboBox = ({
  config = [],
  selectedValue,
  action,
  maxW = 40,
  placeholder = '',
  compact = false,
  dropdownDirection = 'down',
}) => {
  const { options } = useOptions();

  const unwrap = (val) => (val && typeof val === 'object' && 'value' in val ? val.value : val);

  const getOptionId = (val) => {
    const raw = unwrap(val);
    return raw && typeof raw === 'object' ? raw.themeName || raw.id || JSON.stringify(raw) : raw;
  };

  const resolvedSelected =
    config.find((c) => getOptionId(c.value) === getOptionId(selectedValue)) ||
    config.find((c) => getOptionId(c) === getOptionId(selectedValue)) ||
    config[0] ||
    null;

  const selectedLabel = resolvedSelected?.option || placeholder || '';
  const filteredOptions = config;
  const longestOptionLength = useMemo(
    () =>
      Math.max(
        String(selectedLabel || '').length,
        ...config.map((item) => String(item?.option || '').length),
      ),
    [config, selectedLabel],
  );
  const dynamicWidthCh = Math.min(72, Math.max(14, longestOptionLength + 6));

  const scroll = clsx(
    'scrollbar scrollbar-track-transparent scrollbar-thin',
    options?.type === 'dark' || !options?.type
      ? 'scrollbar-thumb-gray-600'
      : 'scrollbar-thumb-gray-500',
  );

  return (
    <Combobox
      value={selectedValue !== undefined ? selectedValue : ''}
      onChange={action}
      by={(a, b) => getOptionId(a) === getOptionId(b)}
    >
      {({ open }) => (
        <div
          className={clsx(
            'relative w-full rounded-xl border transition-all duration-200',
            open ? 'border-white/35 shadow-[0_0_0_1px_rgba(255,255,255,0.12)]' : 'hover:border-white/30',
          )}
          style={{
            backgroundColor: options.settingsDropdownColor || '#162337',
            width: `${dynamicWidthCh}ch`,
            maxWidth: `min(${maxW}rem, 92vw)`,
          }}
        >
          <ComboboxButton className={clsx('flex w-full items-center px-3 pl-4 cursor-pointer', compact ? 'h-9' : 'h-11')}>
            <span className={clsx('flex-1 min-w-0 text-left whitespace-nowrap', compact ? 'text-[0.82rem]' : 'text-[0.88rem]')}>{selectedLabel}</span>
            <span
              className={clsx(
                'flex flex-shrink-0 items-center justify-center px-1 transition-transform duration-200',
                open ? 'rotate-180' : 'rotate-0',
              )}
            >
              <ChevronDown size={compact ? 15 : 17} />
            </span>
          </ComboboxButton>

          {filteredOptions.length !== 0 && (
            <ComboboxOptions
              className={clsx(
                'absolute left-0 z-10 w-max min-w-full max-h-60 overflow-auto',
                dropdownDirection === 'up' ? 'bottom-full mb-1 origin-bottom' : 'top-full mt-1 origin-top',
                'flex flex-col gap-1 rounded-[0.8rem] border bg-inherit p-[0.4rem] shadow-lg backdrop-blur-sm',
                'transition-all duration-150',
                scroll,
              )}
            >
              {filteredOptions.map((cfg) => (
                <ComboboxOption
                  value={cfg.value}
                  key={getOptionId(cfg.value)}
                  className={clsx(
                    'flex items-center cursor-pointer hover:bg-[#ffffff17] px-2 rounded-md transition-colors duration-150',
                    compact ? 'py-1.5' : 'py-2',
                  )}
                >
                  {({ selected }) => (
                    <>
                      <span
                        className={clsx('flex items-center justify-center', 'w-[20px] flex-shrink-0')}
                      >
                        {selected && <Check size={16} />}
                      </span>
                      <p className={clsx('flex-1 min-w-0 ml-2 leading-snug whitespace-nowrap', compact ? 'text-[0.82rem]' : 'text-[0.88rem]')}>
                        {cfg.option}
                      </p>
                    </>
                  )}
                </ComboboxOption>
              ))}
            </ComboboxOptions>
          )}
        </div>
      )}
    </Combobox>
  );
};

export default ComboBox;
