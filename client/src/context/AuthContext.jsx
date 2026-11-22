import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  fetchCurrentUser,
  loginRequest,
  logoutRequest,
  registerEmployerRequest,
  registerWorkerRequest,
  saveLanguageRequest,
} from '../services/authService.js';

const AuthContext = createContext(null);

/**
 * Holds the signed-in user for the whole app.
 * The session itself lives in an HttpOnly cookie that JavaScript cannot read;
 * on start-up we ask the API who we are (GET /auth/me).
 *
 * Language: the account's saved language is applied after login, and any
 * later language switch is saved back to the account.
 */
export function AuthProvider({ children }) {
  const { i18n } = useTranslation();
  const [state, setState] = useState({ status: 'loading', user: null });
  const userRef = useRef(null);

  const applyUser = useCallback(
    (user) => {
      userRef.current = user;
      setState({ status: 'ready', user });
      if (user && user.preferredLanguage !== i18n.resolvedLanguage) {
        i18n.changeLanguage(user.preferredLanguage);
      }
    },
    [i18n],
  );

  // Who am I? (runs once on start-up)
  useEffect(() => {
    const controller = new AbortController();
    fetchCurrentUser({ signal: controller.signal })
      .then(applyUser)
      .catch((error) => {
        if (error.name === 'AbortError') return;
        // API unreachable: continue as a visitor; protected pages send people to login.
        setState({ status: 'ready', user: null });
      });
    return () => controller.abort();
  }, [applyUser]);

  // Save language switches to the signed-in account.
  useEffect(() => {
    const onLanguageChanged = (language) => {
      const user = userRef.current;
      if (!user || user.preferredLanguage === language) return;
      userRef.current = { ...user, preferredLanguage: language };
      setState((previous) => ({ ...previous, user: userRef.current }));
      saveLanguageRequest(language).catch(() => {
        /* not critical: the choice is still remembered on this device */
      });
    };
    i18n.on('languageChanged', onLanguageChanged);
    return () => i18n.off('languageChanged', onLanguageChanged);
  }, [i18n]);

  const login = useCallback(async (credentials) => {
    const user = await loginRequest(credentials);
    applyUser(user);
    return user;
  }, [applyUser]);

  const registerWorker = useCallback(async (details) => {
    const user = await registerWorkerRequest({ ...details, preferredLanguage: i18n.resolvedLanguage });
    applyUser(user);
    return user;
  }, [applyUser, i18n]);

  const registerEmployer = useCallback(async (details) => {
    const user = await registerEmployerRequest({ ...details, preferredLanguage: i18n.resolvedLanguage });
    applyUser(user);
    return user;
  }, [applyUser, i18n]);

  /**
   * Ends the session. `signedOut: true` tells the route guards that this was
   * a deliberate logout, so they go to the home page instead of
   * /login?next=… (which would send the next person back to this page).
   */
  const logout = useCallback(async () => {
    try {
      await logoutRequest();
    } finally {
      userRef.current = null;
      setState({ status: 'ready', user: null, signedOut: true });
    }
  }, []);

  const value = useMemo(
    () => ({ ...state, login, registerWorker, registerEmployer, logout }),
    [state, login, registerWorker, registerEmployer, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside <AuthProvider>');
  return context;
}
