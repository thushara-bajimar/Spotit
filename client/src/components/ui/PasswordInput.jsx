import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Eye, EyeOff, Lock } from 'lucide-react';
import { Input } from './Input.jsx';

/** Password field with a show/hide button (helps avoid typing mistakes on phones). */
export function PasswordInput(props) {
  const { t } = useTranslation();
  const [visible, setVisible] = useState(false);
  const Icon = visible ? EyeOff : Eye;

  return (
    <Input
      {...props}
      type={visible ? 'text' : 'password'}
      icon={Lock}
      autoCapitalize="none"
      autoCorrect="off"
      spellCheck={false}
      trailing={
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? t('common.hidePassword') : t('common.showPassword')}
          aria-pressed={visible}
          className="grid size-10 place-items-center rounded-lg text-muted hover:bg-forest-50 hover:text-forest-800"
        >
          <Icon aria-hidden="true" className="size-5" />
        </button>
      }
    />
  );
}
