import { cx } from '../../utils/cx.js';

/** Centred page-width wrapper with consistent side padding. */
export function Container({ className, ...props }) {
  return <div className={cx('mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8', className)} {...props} />;
}
