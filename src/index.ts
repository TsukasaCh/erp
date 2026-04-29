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
import { employeesRouter } from './routes/employees';
import { attendanceRouter } from './routes/attendance';
import { payrollRouter } from './routes/payroll';
import { productCategoriesRouter } from './routes/product-categories';
import { materialUsageRouter } from './routes/material-usage';
import { requireAuth } from './middleware/auth';

const app = express();
app.use(cors());
app.use(express.json({ limit: '4mb' }));

app.get('/health', (_req, res) => res.json({ ok: true, ts: Date.now() }));

// Public (no auth)
app.use('/api/auth', authRouter);

import { auditRouter } from './routes/audit';
import { prisma } from './db/client';

const auditLogger = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
    const originalSend = res.send;
    res.send = function (body) {
      if (res.statusCode >= 200 && res.statusCode < 300 && req.auth) {
        prisma.auditLog.create({
          data: {
            userId: req.auth.userId,
            username: req.auth.username,
            action: req.method,
            resource: req.originalUrl,
            details: JSON.stringify(req.body)
          }
        }).catch(err => console.error('[audit] error:', err));
      }
      return originalSend.apply(res, arguments as any);
    };
  }
  next();
};

// Protected: require JWT. Finer-grained permission checks live inside each router.
const protectedMw = [requireAuth, auditLogger];

app.use('/api/dashboard',          protectedMw, dashboardRouter);
app.use('/api/orders',             protectedMw, ordersRouter);
app.use('/api/products',           protectedMw, productsRouter);
app.use('/api/product-categories', protectedMw, productCategoriesRouter);
app.use('/api/materials',          protectedMw, materialsRouter);
app.use('/api/material-usage',     protectedMw, materialUsageRouter);
app.use('/api/purchase-orders',    protectedMw, purchasesRouter);
app.use('/api/production',         protectedMw, productionRouter);
app.use('/api/employees',          protectedMw, employeesRouter);
app.use('/api/attendance',         protectedMw, attendanceRouter);
app.use('/api/payroll',            protectedMw, payrollRouter);
app.use('/api/audit-logs',         protectedMw, auditRouter);
app.use('/api/users',              usersRouter);
app.use('/api/roles',              rolesRouter);

app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('[api] error:', err);
  res.status(500).json({ error: err.message });
});

app.listen(env.port, () => {
  console.log(`[api] listening on http://localhost:${env.port}`);
});
