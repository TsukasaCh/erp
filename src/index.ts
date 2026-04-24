import express from 'express';
import cors from 'cors';
import { env } from './config/env';
import { dashboardRouter } from './routes/dashboard';
import { ordersRouter } from './routes/orders';
import { productsRouter } from './routes/products';
import { materialsRouter } from './routes/materials';
import { purchasesRouter } from './routes/purchases';
import { productionRouter } from './routes/production';
import { authRouter } from './routes/auth';
import { usersRouter } from './routes/users';
import { rolesRouter } from './routes/roles';
import { requireAuth } from './middleware/auth';

const app = express();
app.use(cors());
app.use(express.json({ limit: '4mb' }));

app.get('/health', (_req, res) => res.json({ ok: true, ts: Date.now() }));

// Public (no auth)
app.use('/api/auth', authRouter);

// Protected: require JWT. Finer-grained permission checks live inside each router.
app.use('/api/dashboard',       requireAuth, dashboardRouter);
app.use('/api/orders',          requireAuth, ordersRouter);
app.use('/api/products',        requireAuth, productsRouter);
app.use('/api/materials',       requireAuth, materialsRouter);
app.use('/api/purchase-orders', requireAuth, purchasesRouter);
app.use('/api/production',      requireAuth, productionRouter);
app.use('/api/users',           usersRouter);
app.use('/api/roles',           rolesRouter);

app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('[api] error:', err);
  res.status(500).json({ error: err.message });
});

app.listen(env.port, () => {
  console.log(`[api] listening on http://localhost:${env.port}`);
});
