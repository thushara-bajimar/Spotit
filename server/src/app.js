import express from 'express';
import helmet from 'helmet';
import { createApiRouter } from './routes/index.js';
import { createErrorHandler, notFound } from './middleware/errorHandler.js';
import { requestLogger } from './middleware/requestLogger.js';

/**
 * Builds the Express application. The database is passed in (rather than
 * imported) so tests can run the app against an in-memory database.
 */
export function createApp({ db, isProduction = false, logRequests = false }) {
  const app = express();

  app.disable('x-powered-by');
  app.use(helmet());
  if (logRequests) app.use(requestLogger);
  app.use(express.json({ limit: '100kb' }));

  app.use('/api', createApiRouter({ db }));

  app.use(notFound);
  app.use(createErrorHandler({ isProduction }));

  return app;
}
