
import clsx from 'clsx';
import { useOptions } from '/src/utils/optionsContext';
import { useState, useEffect } from 'react';


const TextInput = ({
  defValue,
  onChange,
  placeholder = 'Enter text',
  maxW = 40,
  disabled = false,
  inputType = 'text',
  compact = false,
  live = false,
}) => {
  const { options } = useOptions();
  const [value, setValue] = useState(defValue ?? '');

  // Sync with defValue if it changes from outside
  useEffect(() => {
    setValue(defValue ?? '');
  }, [defValue]);

  const handleBlurOrEnter = (val) => {
    if (val !== defValue) onChange?.(val);
  };

  return (
    <div
      className={clsx('relative w-full', 'rounded-xl border border-white/20 transition-all duration-150', 'hover:border-white/30')}
      style={{
        backgroundColor: options.settingsDropdownColor || '#1a2a42',
        maxWidth: `${maxW}rem`,
      }}
    >
      <div className={clsx('flex w-full items-center', 'px-3 pl-4', compact ? 'h-9' : 'h-11')}>
        <input
          type={inputType}
          value={value}
          placeholder={placeholder}
          spellCheck="false"
          disabled={disabled}
          onChange={e => setValue(e.target.value)}
          onBlur={e => handleBlurOrEnter(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') handleBlurOrEnter(e.target.value);
          }}
          className={clsx(
            'flex-1 min-w-0 truncate bg-transparent outline-none',
            compact ? 'text-[0.82rem]' : 'text-[0.9rem]',
            disabled && 'opacity-60 cursor-not-allowed',
          )}
        />
      </div>
    </div>
  );
};

export default TextInput;
