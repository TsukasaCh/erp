import { Router, type Response } from 'express';
import { z } from 'zod';
import { prisma } from '../db/client';
import { hashPassword } from '../services/auth';
import { requireAuth, requirePermission, type AuthedRequest } from '../middleware/auth';

export const usersRouter = Router();

// All routes require authentication + users:manage permission
usersRouter.use(requireAuth, requirePermission('users:manage'));

function serialize(u: {
  id: string; username: string; fullName: string | null; isSuperAdmin: boolean;
  active: boolean; roleId: string | null; lastLoginAt: Date | null; createdAt: Date;
  role?: { id: string; name: string } | null;
}) {
  return {
    id: u.id,
    username: u.username,
    fullName: u.fullName,
    isSuperAdmin: u.isSuperAdmin,
    active: u.active,
    roleId: u.roleId,
    role: u.role ? { id: u.role.id, name: u.role.name } : null,
    lastLoginAt: u.lastLoginAt,
    createdAt: u.createdAt,
  };
}

usersRouter.get('/', async (_req, res) => {
  const users = await prisma.user.findMany({
    include: { role: true },
    orderBy: { createdAt: 'asc' },
  });
  res.json(users.map(serialize));
});

const createSchema = z.object({
  username: z.string().min(3).max(60),
  password: z.string().min(6).max(128),
  fullName: z.string().optional(),
  roleId: z.string().nullable().optional(),
  active: z.boolean().optional(),
});

usersRouter.post('/', async (req: AuthedRequest, res: Response) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const { username, password, fullName, roleId, active } = parsed.data;

  const existing = await prisma.user.findUnique({ where: { username } });
  if (existing) return res.status(409).json({ error: 'username_taken' });

  const created = await prisma.user.create({
    data: {
      username,
      passwordHash: await hashPassword(password),
      fullName: fullName ?? null,
      roleId: roleId ?? null,
      active: active ?? true,
    },
    include: { role: true },
  });
  res.json(serialize(created));
});

const updateSchema = z.object({
  fullName: z.string().nullable().optional(),
  password: z.string().min(6).max(128).optional(),
  roleId: z.string().nullable().optional(),
  active: z.boolean().optional(),
});

usersRouter.patch('/:id', async (req: AuthedRequest, res: Response) => {
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const id = String(req.params.id);
  const target = await prisma.user.findUnique({ where: { id } });
  if (!target) return res.status(404).json({ error: 'not_found' });

  // prevent demoting or deactivating the last super admin
  if (target.isSuperAdmin && parsed.data.active === false) {
    const activeSupers = await prisma.user.count({ where: { isSuperAdmin: true, active: true } });
    if (activeSupers <= 1) return res.status(400).json({ error: 'cannot_deactivate_last_superadmin' });
  }

  const data: Record<string, unknown> = {};
  if (parsed.data.fullName !== undefined) data.fullName = parsed.data.fullName;
  if (parsed.data.roleId !== undefined) data.roleId = parsed.data.roleId;
  if (parsed.data.active !== undefined) data.active = parsed.data.active;
  if (parsed.data.password) data.passwordHash = await hashPassword(parsed.data.password);

  const updated = await prisma.user.update({
    where: { id },
    data,
    include: { role: true },
  });
  res.json(serialize(updated));
});

usersRouter.delete('/:id', async (req: AuthedRequest, res: Response) => {
  const id = String(req.params.id);
  const target = await prisma.user.findUnique({ where: { id } });
  if (!target) return res.status(404).json({ error: 'not_found' });
  if (target.id === req.auth?.userId) return res.status(400).json({ error: 'cannot_delete_self' });
  if (target.isSuperAdmin) {
    const activeSupers = await prisma.user.count({ where: { isSuperAdmin: true, active: true } });
    if (activeSupers <= 1) return res.status(400).json({ error: 'cannot_delete_last_superadmin' });
  }
  await prisma.user.delete({ where: { id } });
  res.json({ ok: true });
});
