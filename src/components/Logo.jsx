import clsx from 'clsx';
import { useOptions } from '/src/utils/optionsContext';
import { memo, useMemo } from 'react';

const Logo = memo(({ options, action, width, height }) => {
  const { options: op } = useOptions();
  const isLightTheme =
    op.type === 'light' ||
    op.theme === 'light' ||
    op.themeName === 'light';
  const logoSrc = isLightTheme ? '/ghost-text-logo-black.png' : '/ghost-text-logo-white.png';

  const style = useMemo(() => {
    const dimensions = {
      ...(width && { width }),
      ...(height && { height }),
    };
    return { ...dimensions };
  }, [width, height]);

  const className = useMemo(
    () =>
      clsx(
        options,
        action && 'cursor-pointer duration-300 ease-out scale-[1.12] hover:scale-[1.15]',
        'select-none object-contain',
      ),
    [options, action],
  );

  const logoColor = (op.logoColor || '').trim();

  if (logoColor) {
    return (
      <div
        className={className}
        id="btn-logo"
        onClick={action}
        style={{
          ...style,
          backgroundColor: logoColor,
          WebkitMaskImage: `url('${logoSrc}')`,
          maskImage: `url('${logoSrc}')`,
          WebkitMaskRepeat: 'no-repeat',
          maskRepeat: 'no-repeat',
          WebkitMaskPosition: 'center',
          maskPosition: 'center',
          WebkitMaskSize: 'contain',
          maskSize: 'contain',
        }}
      />
    );
  }

  return (
    <img
      src={logoSrc}
      className={className}
      id="btn-logo"
      draggable="false"
      alt="logo"
      onClick={action}
      style={style}
    />
  );
});

Logo.displayName = 'Logo';
export default Logo;
