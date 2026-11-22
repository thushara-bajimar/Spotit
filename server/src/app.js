import express from 'express';
import helmet from 'helmet';
import { config } from './config/env.js';
import { createApiRouter } from './routes/index.js';
import { createErrorHandler, notFound } from './middleware/errorHandler.js';
import { requestLogger } from './middleware/requestLogger.js';
import { createOriginCheck } from './middleware/originCheck.js';
import { createSessionLoader } from './middleware/auth.js';

/**
 * Builds the Express application. The database is passed in (rather than
 * imported) so tests can run the app against an in-memory database.
 */
export function createApp({
  db,
  isProduction = false,
  logRequests = false,
  rateLimit = true,
  allowedOrigins = config.allowedOrigins,
}) {
  const app = express();

  app.disable('x-powered-by');
  app.use(helmet());
  if (logRequests) app.use(requestLogger);
  app.use(express.json({ limit: '100kb' }));

  app.use('/api', createOriginCheck({ allowedOrigins }));
  app.use('/api', createSessionLoader({ db }));
  app.use('/api', createApiRouter({ db, rateLimit }));

  app.use(notFound);
  app.use(createErrorHandler({ isProduction }));

  return app;
}
