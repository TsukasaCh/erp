import { Router, type Response } from 'express';
import { z } from 'zod';
import { prisma } from '../db/client';
import { requireAuth, requirePermission, type AuthedRequest } from '../middleware/auth';

export const rolesRouter = Router();

// Full list of permission codes known to the app. The IAM UI reads this list.
export const ALL_PERMISSIONS = [
  { code: 'dashboard:view',  label: 'Lihat Dashboard' },
  { code: 'orders:view',     label: 'Lihat Orders Penjualan' },
  { code: 'orders:write',    label: 'Edit / Hapus Orders Penjualan' },
  { code: 'purchases:view',  label: 'Lihat Pembelian / PO' },
  { code: 'purchases:write', label: 'Edit / Hapus Pembelian / PO' },
  { code: 'products:view',   label: 'Lihat Inventory (Produk Jadi)' },
  { code: 'products:write',  label: 'Edit / Hapus Inventory' },
  { code: 'materials:view',  label: 'Lihat Master Bahan Baku' },
  { code: 'materials:write', label: 'Edit / Hapus Master Bahan Baku' },
  { code: 'suppliers:view',  label: 'Lihat Supplier' },
  { code: 'suppliers:write', label: 'Edit / Hapus Supplier' },
  { code: 'production:view', label: 'Lihat Kalender Produksi' },
  { code: 'production:write',label: 'Edit / Hapus Kalender Produksi' },
  { code: 'hpp:view',        label: 'Akses Kalkulator HPP' },
  { code: 'users:manage',    label: 'Kelola User & Role (IAM)' },
];

rolesRouter.use(requireAuth, requirePermission('users:manage'));

function parsePerms(raw: string): string[] {
  try { return JSON.parse(raw) as string[]; } catch { return []; }
}

function serialize(r: { id: string; name: string; description: string | null; permissions: string; createdAt: Date }) {
  return {
    id: r.id,
    name: r.name,
    description: r.description,
    permissions: parsePerms(r.permissions),
    createdAt: r.createdAt,
  };
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

  // Only super admin may create an admin-level role (one that grants users:manage)
  if (!req.auth?.isSuperAdmin && parsed.data.permissions.includes('users:manage')) {
    return res.status(403).json({ error: 'cannot_grant_users_manage' });
  }

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
  const existing = await prisma.role.findUnique({ where: { id } });
  if (!existing) return res.status(404).json({ error: 'not_found' });

  const actorIsSuper = !!req.auth?.isSuperAdmin;
  const currentPerms = parsePerms(existing.permissions);
  const wasAdminLevel = currentPerms.includes('users:manage');

  // Non-super admin may not touch an admin-level role at all
  if (!actorIsSuper && wasAdminLevel) {
    return res.status(403).json({ error: 'cannot_edit_admin_role' });
  }

  // Non-super admin may not escalate a role to admin-level
  if (!actorIsSuper && parsed.data.permissions?.includes('users:manage')) {
    return res.status(403).json({ error: 'cannot_grant_users_manage' });
  }

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

  // Non-super admin may not delete an admin-level role
  const isAdminLevel = parsePerms(role.permissions).includes('users:manage');
  if (!req.auth?.isSuperAdmin && isAdminLevel) {
    return res.status(403).json({ error: 'cannot_delete_admin_role' });
  }

  if (role.users.length > 0) {
    return res.status(400).json({ error: 'role_in_use', users: role.users.length });
  }
  await prisma.role.delete({ where: { id } });
  res.json({ ok: true });
});
