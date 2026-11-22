import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { X } from 'lucide-react';
import { Logo } from '../common/Logo.jsx';
import { SideNav } from './SideNav.jsx';

/**
 * Slide-in navigation for small screens when there are too many items for a
 * bottom bar (admin). Closes on Escape, backdrop click or navigation.
 */
export function MobileDrawer({ id, open, onClose, items, homePath }) {
  const { t } = useTranslation();
  const closeButtonRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    closeButtonRef.current?.focus();
    const onKeyDown = (event) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-40 lg:hidden">
      <div aria-hidden="true" className="absolute inset-0 bg-ink/40" onClick={onClose} />
      <div
        id={id}
        role="dialog"
        aria-modal="true"
        aria-label={t('common.mainNavigation')}
        className="absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col overflow-y-auto bg-white shadow-xl"
      >
        <div className="flex h-16 items-center justify-between border-b border-line px-4">
          <Logo to={homePath} />
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            aria-label={t('common.closeMenu')}
            className="grid size-11 place-items-center rounded-xl text-ink hover:bg-forest-50"
          >
            <X aria-hidden="true" className="size-6" />
          </button>
        </div>
        <SideNav items={items} onNavigate={onClose} />
      </div>
    </div>
  );
}
