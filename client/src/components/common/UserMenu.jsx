import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { LogOut } from 'lucide-react';
import { useAuth } from '../../context/AuthContext.jsx';

/** Signed-in user's first name (wider screens) and a log-out button. */
export function UserMenu() {
  const { t } = useTranslation();
  const { user, logout } = useAuth();
  const [busy, setBusy] = useState(false);

  if (!user) return null;
  const firstName = user.fullName.split(' ')[0];

  // After logout the route guard moves the user to the home page.
  const onLogout = async () => {
    setBusy(true);
    await logout();
  };

  return (
    <div className="flex items-center gap-1">
      <span className="hidden max-w-40 truncate text-sm font-semibold text-ink md:inline">
        {t('common.greeting', { name: firstName })}
      </span>
      <button
        type="button"
        onClick={onLogout}
        disabled={busy}
        aria-label={t('common.logout')}
        className="grid size-11 place-items-center rounded-xl text-forest-800 hover:bg-forest-50 disabled:opacity-60 lg:flex lg:w-auto lg:gap-2 lg:px-3 lg:text-sm lg:font-semibold"
      >
        <LogOut aria-hidden="true" className="size-5" />
        <span className="hidden lg:inline">{t('common.logout')}</span>
      </button>
    </div>
  );
}
