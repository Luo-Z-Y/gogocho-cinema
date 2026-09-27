/** Vercel's native Node server entrypoint. Application routes and validation
 * remain in backend/server.js; this adapter only opens the platform's port.
 * Local development continues to use npm start and its loopback-only binding. */
import { createServer } from './backend/server.js';
createServer().listen(Number(process.env.PORT || 3000));
