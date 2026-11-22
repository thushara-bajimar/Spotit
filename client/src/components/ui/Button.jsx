import { cx } from '../../utils/cx.js';

const VARIANTS = {
  primary: 'bg-forest-700 text-white hover:bg-forest-800 active:bg-forest-900',
  accent: 'bg-amber-500 text-ink hover:bg-amber-400 active:bg-amber-300',
  secondary: 'bg-white text-forest-800 border border-forest-200 hover:bg-forest-50',
  ghost: 'text-forest-800 hover:bg-forest-50',
  inverse: 'bg-white text-forest-800 hover:bg-cream-100',
};

// Minimum heights keep touch targets at 44px or larger.
const SIZES = {
  sm: 'min-h-10 px-3.5 text-sm',
  md: 'min-h-12 px-5 text-base',
  lg: 'min-h-14 px-6 text-lg',
};

/**
 * Button or button-styled link.
 *   <Button onClick={...}>Save</Button>
 *   <Button as={Link} to="/register" variant="accent">Register</Button>
 */
export function Button({
  as: Component = 'button',
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  className,
  type,
  ...props
}) {
  const classes = cx(
    'inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition-colors',
    'disabled:cursor-not-allowed disabled:opacity-60',
    VARIANTS[variant],
    SIZES[size],
    fullWidth && 'w-full',
    className,
  );

  if (Component === 'button') {
    return <button type={type ?? 'button'} className={classes} {...props} />;
  }
  return <Component className={classes} {...props} />;
}
