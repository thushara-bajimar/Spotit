import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router/dom';

// Self-hosted fonts (no external CDN). Browsers only download the scripts a
// page actually uses (Latin and/or Kannada).
import '@fontsource/noto-sans/400.css';
import '@fontsource/noto-sans/600.css';
import '@fontsource/noto-sans/700.css';
import '@fontsource/noto-sans-kannada/400.css';
import '@fontsource/noto-sans-kannada/600.css';
import '@fontsource/noto-sans-kannada/700.css';
import '@fontsource/baloo-tamma-2/600.css';
import '@fontsource/baloo-tamma-2/700.css';

import './styles/index.css';
import './i18n/index.js';
import { router } from './routes/router.jsx';
import { AuthProvider } from './context/AuthContext.jsx';
import { APP_NAME } from './config/brand.js';

document.title = APP_NAME;

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AuthProvider>
      <RouterProvider router={router} />
    </AuthProvider>
  </StrictMode>,
);
