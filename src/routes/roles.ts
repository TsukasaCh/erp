import { Router, type Response } from 'express';
import { z } from 'zod';
import { prisma } from '../db/client';
import { requireAuth, requirePermission, type AuthedRequest } from '../middleware/auth';

export const rolesRouter = Router();

// Full list of permission codes known to the app. The IAM UI reads this list.
export const ALL_PERMISSIONS = [
  { code: 'dashboard:view', label: 'Lihat Dashboard' },
  { code: 'orders:view',    label: 'Lihat Orders' },
  { code: 'orders:write',   label: 'Edit / Hapus Orders' },
  { code: 'products:view',  label: 'Lihat Inventory' },
  { code: 'products:write', label: 'Edit / Hapus Inventory' },
  { code: 'users:manage',   label: 'Kelola User & Role (IAM)' },
];

rolesRouter.use(requireAuth, requirePermission('users:manage'));

function serialize(r: { id: string; name: string; description: string | null; permissions: string; createdAt: Date }) {
  let perms: string[] = [];
  try { perms = JSON.parse(r.permissions); } catch {}
  return { id: r.id, name: r.name, description: r.description, permissions: perms, createdAt: r.createdAt };
}

rolesRouter.get('/', async (_req, res) => {
  const roles = await prisma.role.findMany({
    orderBy: { name: 'asc' },
    include: { _count: { select: { users: true } } },
  });
  res.json(
    roles.map((r) => ({
      ...serialize(r),
      userCount: r._count.users,
    })),
  );
});

rolesRouter.get('/permissions', (_req, res) => {
  res.json(ALL_PERMISSIONS);
});

const roleSchema = z.object({
  name: z.string().min(1).max(60),
  description: z.string().nullable().optional(),
  permissions: z.array(z.string()).default([]),
});

rolesRouter.post('/', async (req: AuthedRequest, res: Response) => {
  const parsed = roleSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const existing = await prisma.role.findUnique({ where: { name: parsed.data.name } });
  if (existing) return res.status(409).json({ error: 'name_taken' });
  const created = await prisma.role.create({
    data: {
      name: parsed.data.name,
      description: parsed.data.description ?? null,
      permissions: JSON.stringify(parsed.data.permissions),
    },
  });
  res.json(serialize(created));
});

rolesRouter.patch('/:id', async (req: AuthedRequest, res: Response) => {
  const parsed = roleSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const id = String(req.params.id);
  const data: Record<string, unknown> = {};
  if (parsed.data.name !== undefined) data.name = parsed.data.name;
  if (parsed.data.description !== undefined) data.description = parsed.data.description;
  if (parsed.data.permissions !== undefined) data.permissions = JSON.stringify(parsed.data.permissions);
  const updated = await prisma.role.update({ where: { id }, data });
  res.json(serialize(updated));
});

rolesRouter.delete('/:id', async (req: AuthedRequest, res: Response) => {
  const id = String(req.params.id);
  const role = await prisma.role.findUnique({ where: { id }, include: { users: true } });
  if (!role) return res.status(404).json({ error: 'not_found' });
  if (role.users.length > 0) {
    return res.status(400).json({ error: 'role_in_use', users: role.users.length });
  }
  await prisma.role.delete({ where: { id } });
  res.json({ ok: true });
});
