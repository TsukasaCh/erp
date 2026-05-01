/**
 * RESEED-CATALOG — wipe demo Product/Material/Supplier/Order lalu re-seed
 * dengan katalog Alucurv terbaru. JANGAN dijalankan kalau sudah ada data
 * production yang riil — ini destructive dan akan menghapus semua row di
 * tabel-tabel berikut.
 *
 * Tabel yang TIDAK disentuh: User, Role, AuditLog, Employee, Attendance,
 * Payroll, ProductionSchedule, MaterialUsage, PurchaseOrder.
 *
 * Run: docker compose exec api node dist/reseed-catalog.js
 *      (atau di dev: npx tsx src/reseed-catalog.ts)
 */

import { prisma } from './db/client';

async function main() {
  console.log('⚠️  RESEED CATALOG — wipe + re-seed demo data');
  console.log('   Ini akan menghapus SEMUA Product, Material, Supplier, Order,');
  console.log('   PurchaseOrder, MaterialUsage, dan ProductCategory.');
  console.log('');

  // Hapus dengan urutan yang benar (anak dulu baru parent, kalau ada FK)
  console.log('Wiping...');
  const r1 = await prisma.materialUsage.deleteMany();
  console.log(`  - ${r1.count} material usage records dihapus`);

  const r2 = await prisma.purchaseOrder.deleteMany();
  console.log(`  - ${r2.count} purchase orders dihapus`);

  const r3 = await prisma.order.deleteMany();
  console.log(`  - ${r3.count} orders dihapus`);

  const r4 = await prisma.product.deleteMany();
  console.log(`  - ${r4.count} products dihapus`);

  const r5 = await prisma.productCategory.deleteMany();
  console.log(`  - ${r5.count} product categories dihapus`);

  const r6 = await prisma.material.deleteMany();
  console.log(`  - ${r6.count} materials dihapus`);

  const r7 = await prisma.supplier.deleteMany();
  console.log(`  - ${r7.count} suppliers dihapus`);

  console.log('');
  console.log('Wipe done. Sekarang jalankan seed: npm run seed:prod');
  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
