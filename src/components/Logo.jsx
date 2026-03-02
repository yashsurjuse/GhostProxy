import clsx from 'clsx';
import { useOptions } from '/src/utils/optionsContext';
import { memo, useMemo } from 'react';

/** Spacing (in px) between the Ghost text‑logo and the Beta badge. */
const LOGO_BADGE_GAP = 0;

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
      <div className="inline-flex items-center" style={{ gap: `${LOGO_BADGE_GAP}px` }}>
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
        <span className="text-xs font-bold tracking-wider uppercase px-2 py-0.5 rounded-md border border-white/20 bg-white/8 select-none" style={{ color: logoColor }}>Beta</span>
      </div>
    );
  }

  return (
    <div className="inline-flex items-center" style={{ gap: `${LOGO_BADGE_GAP}px` }}>
      <img
        src={logoSrc}
        className={className}
        id="btn-logo"
        draggable="false"
        alt="logo"
        onClick={action}
        style={style}
      />
      <span className="text-xs font-bold tracking-wider uppercase px-2 py-0.5 rounded-md border border-white/20 bg-white/8 text-white/70 select-none">Beta</span>
    </div>
  );
});

Logo.displayName = 'Logo';
export default Logo;
