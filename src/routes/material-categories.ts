import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db/client';
import { requirePermission } from '../middleware/auth';

export const materialCategoriesRouter = Router();

const categoryInput = z.object({
  id: z.string().optional(),
  name: z.string().min(1).max(60),
  description: z.string().nullable().optional(),
});

const batchSchema = z.object({
  upserts: z.array(categoryInput).default([]),
  deletes: z.array(z.string()).default([]),
});

// Seed default kategori bahan kalau tabel masih kosong (auto-migration friendly).
// Dipanggil sekali pada GET pertama. Idempotent: kalau kategori sudah ada,
// upsert by name akan no-op.
const DEFAULT_CATEGORIES = [
  'Aluminium', 'Kaca', 'Handle', 'Karet Seal', 'Sekrup', 'Engsel', 'Roller', 'Aksesoris', 'Lainnya',
];
let defaultsEnsured = false;
async function ensureDefaults() {
  if (defaultsEnsured) return;
  const count = await prisma.materialCategory.count();
  if (count === 0) {
    // Pertama kali: bootstrap dari kategori distinct yang ada di Material existing
    // + default list. Mencegah orphan category strings di Material.
    const distinct = await prisma.material.findMany({
      where: { category: { not: null } },
      select: { category: true },
      distinct: ['category'],
    });
    const fromExisting = distinct.map((d) => d.category!).filter(Boolean);
    const all = Array.from(new Set([...DEFAULT_CATEGORIES, ...fromExisting])).sort();
    for (const name of all) {
      await prisma.materialCategory.upsert({
        where: { name },
        update: {},
        create: { name },
      });
    }
  }
  defaultsEnsured = true;
}

materialCategoriesRouter.get('/', requirePermission('materials:view'), async (_req, res) => {
  await ensureDefaults();
  const items = await prisma.materialCategory.findMany({
    orderBy: { name: 'asc' },
  });
  // Hitung berapa material yang pakai tiap kategori (denormalized count).
  // Material.category = String, jadi count manual.
  const counts = await prisma.material.groupBy({
    by: ['category'],
    _count: { _all: true },
  });
  const countMap = new Map(counts.map((c) => [c.category, c._count._all]));
  res.json(
    items.map((c) => ({
      ...c,
      _count: { materials: countMap.get(c.name) ?? 0 },
    })),
  );
});

materialCategoriesRouter.post('/batch', requirePermission('materials:write'), async (req, res) => {
  const parsed = batchSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const { upserts, deletes } = parsed.data;

  const saved = [];
  for (const c of upserts) {
    const { id, ...data } = c;
    if (id && id.length > 0) {
      // Cek apakah nama berubah → kalau iya, update juga semua Material yang
      // pakai kategori lama supaya tetap konsisten.
      const existing = await prisma.materialCategory.findUnique({ where: { id } });
      if (existing && existing.name !== data.name) {
        await prisma.material.updateMany({
          where: { category: existing.name },
          data: { category: data.name },
        });
      }
      try {
        const updated = await prisma.materialCategory.update({ where: { id }, data });
        saved.push(updated);
      } catch {
        const created = await prisma.materialCategory.create({ data });
        saved.push(created);
      }
    } else {
      const created = await prisma.materialCategory.upsert({
        where: { name: data.name },
        update: data,
        create: data,
      });
      saved.push(created);
    }
  }

  let deletedCount = 0;
  if (deletes.length > 0) {
    // Cek dulu apakah ada Material yang pakai kategori yg mau dihapus
    const toDelete = await prisma.materialCategory.findMany({
      where: { id: { in: deletes } },
      select: { name: true },
    });
    const usedCount = await prisma.material.count({
      where: { category: { in: toDelete.map((c) => c.name) } },
    });
    if (usedCount > 0) {
      return res.status(400).json({
        error: 'category_in_use',
        message: `${usedCount} bahan masih pakai kategori ini. Pindahkan dulu ke kategori lain.`,
      });
    }
    const result = await prisma.materialCategory.deleteMany({ where: { id: { in: deletes } } });
    deletedCount = result.count;
  }

  res.json({ saved, deleted: deletedCount });
});

materialCategoriesRouter.delete('/:id', requirePermission('materials:write'), async (req, res) => {
  const id = String(req.params.id);
  const cat = await prisma.materialCategory.findUnique({ where: { id } });
  if (!cat) return res.status(404).json({ error: 'not_found' });
  const used = await prisma.material.count({ where: { category: cat.name } });
  if (used > 0) {
    return res.status(400).json({
      error: 'category_in_use',
      message: `${used} bahan masih pakai kategori "${cat.name}". Pindahkan dulu ke kategori lain.`,
    });
  }
  await prisma.materialCategory.delete({ where: { id } });
  res.json({ ok: true });
});
