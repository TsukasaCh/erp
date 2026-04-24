import { Router, type Response } from 'express';
import { z } from 'zod';
import { prisma } from '../db/client';
import { verifyPassword, signJWT } from '../services/auth';
import { requireAuth, type AuthedRequest } from '../middleware/auth';

export const authRouter = Router();

const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

authRouter.post('/login', async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'invalid_input' });
  const { username, password } = parsed.data;

  const user = await prisma.user.findUnique({
    where: { username },
    include: { role: true },
  });
  if (!user || !user.active) {
    return res.status(401).json({ error: 'invalid_credentials' });
  }
  const ok = await verifyPassword(password, user.passwordHash);
  if (!ok) return res.status(401).json({ error: 'invalid_credentials' });

  await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  });

  const token = signJWT({
    sub: user.id,
    username: user.username,
    isSuperAdmin: user.isSuperAdmin,
  });

  let permissions: string[] = [];
  if (user.role) { try { permissions = JSON.parse(user.role.permissions); } catch {} }

  res.json({
    token,
    user: {
      id: user.id,
      username: user.username,
      fullName: user.fullName,
      isSuperAdmin: user.isSuperAdmin,
      role: user.role ? { id: user.role.id, name: user.role.name, permissions } : null,
    },
  });
});

authRouter.get('/me', requireAuth, async (req: AuthedRequest, res: Response) => {
  if (!req.auth) return res.status(401).json({ error: 'unauthenticated' });
  const user = await prisma.user.findUnique({
    where: { id: req.auth.userId },
    include: { role: true },
  });
  if (!user) return res.status(404).json({ error: 'not_found' });
  let permissions: string[] = [];
  if (user.role) { try { permissions = JSON.parse(user.role.permissions); } catch {} }
  res.json({
    id: user.id,
    username: user.username,
    fullName: user.fullName,
    isSuperAdmin: user.isSuperAdmin,
    role: user.role ? { id: user.role.id, name: user.role.name, permissions } : null,
  });
});
