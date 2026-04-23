import express from 'express';
import cors from 'cors';
import { env } from './config/env';
import { dashboardRouter } from './routes/dashboard';
import { ordersRouter } from './routes/orders';
import { productsRouter } from './routes/products';

const app = express();
app.use(cors());
app.use(express.json({ limit: '4mb' }));

app.get('/health', (_req, res) => res.json({ ok: true, ts: Date.now() }));

app.use('/api/dashboard', dashboardRouter);
app.use('/api/orders', ordersRouter);
app.use('/api/products', productsRouter);

app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('[api] error:', err);
  res.status(500).json({ error: err.message });
});

app.listen(env.port, () => {
  console.log(`[api] listening on http://localhost:${env.port}`);
});
