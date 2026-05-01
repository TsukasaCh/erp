import { prisma } from './db/client';
import { hashPassword } from './services/auth';

// ---------------------------------------------------------------------------
// ALUCURV — spesialis aluminium lengkung (curved aluminium) di Bekasi.
// Channel: Shopee (shopee.co.id/alucurv), TikTok Shop, IG @alucurv.official.
//
// Niche utama: jendela & pintu & kusen aluminium yang dibengkokkan/curved
// custom, dengan profil 3" atau 4", warna Hitam Doff / Silver / Putih,
// dengan atau tanpa ornament. Harga berbasis riset publik (IG/Shopee/BigGo).
// SKU & harga di bawah adalah representatif — sesuaikan dengan katalog
// final melalui UI Inventory Product setelah deploy.
// ---------------------------------------------------------------------------
const PRODUCT_CATEGORIES = [
  'Jendela Lengkung',
  'Pintu Lengkung',
  'Kusen Lengkung',
  'Aksesoris',
  'Custom & Jasa',
];

const PRODUCTS = [
  // === Jendela Lengkung ===
  { sku: 'JDL-LK-3-60120-HD',   name: 'Jendela Lengkung 3" 60x120 Hitam Doff',           categoryName: 'Jendela Lengkung', stock: 8,  price: 1850000 },
  { sku: 'JDL-LK-3-90180-HD-O', name: 'Jendela Lengkung 3" 90x180 Hitam Doff + Ornament', categoryName: 'Jendela Lengkung', stock: 6,  price: 2930000 },
  { sku: 'JDL-LK-3-90180-SLV',  name: 'Jendela Lengkung 3" 90x180 Silver',                categoryName: 'Jendela Lengkung', stock: 5,  price: 2750000 },
  { sku: 'JDL-LK-4-120200-HD',  name: 'Jendela Lengkung 4" 120x200 Hitam Doff',           categoryName: 'Jendela Lengkung', stock: 4,  price: 4250000 },
  { sku: 'JDL-LK-4-150200-HDO', name: 'Jendela Lengkung 4" 150x200 Hitam Doff + Ornament',categoryName: 'Jendela Lengkung', stock: 3,  price: 5500000 },
  { sku: 'JDL-SLD-4-180150',    name: 'Jendela Sliding Lengkung 4" 180x150',              categoryName: 'Jendela Lengkung', stock: 4,  price: 4800000 },

  // === Pintu Lengkung ===
  { sku: 'PTU-LK-3-90210-SGL',  name: 'Pintu Lengkung 3" 90x210 Single',                  categoryName: 'Pintu Lengkung',   stock: 5,  price: 4200000 },
  { sku: 'PTU-LK-4-100220-HD',  name: 'Pintu Lengkung 4" 100x220 Single Hitam Doff',      categoryName: 'Pintu Lengkung',   stock: 4,  price: 5500000 },
  { sku: 'PTU-LK-4-120220-DBL', name: 'Pintu Lengkung 4" 120x220 Double Hitam Doff',      categoryName: 'Pintu Lengkung',   stock: 3,  price: 7800000 },

  // === Kusen Lengkung ===
  { sku: 'KSN-LK-3-PM',         name: 'Kusen Lengkung Custom 3" (per meter)',             categoryName: 'Kusen Lengkung',   stock: 50, price: 450000  },
  { sku: 'KSN-LK-4-PM',         name: 'Kusen Lengkung Custom 4" (per meter)',             categoryName: 'Kusen Lengkung',   stock: 40, price: 550000  },
  { sku: 'KSN-LK-4-200HR',      name: 'Kusen Lengkung 4" 200cm Half-Round',               categoryName: 'Kusen Lengkung',   stock: 6,  price: 1400000 },

  // === Aksesoris ===
  { sku: 'ORN-BUNGA-SET',       name: 'Ornament Bunga Aluminium (set)',                   categoryName: 'Aksesoris',        stock: 20, price: 350000  },
  { sku: 'HDL-PTU-LK',          name: 'Handle Pintu Lengkung Premium',                    categoryName: 'Aksesoris',        stock: 25, price: 180000  },

  // === Custom & Jasa ===
  { sku: 'BND-ALU-PM',          name: 'Jasa Bending Aluminium (per meter)',               categoryName: 'Custom & Jasa',    stock: 9999, price: 250000 },
  { sku: 'JASA-PSG-M2',         name: 'Jasa Pemasangan / m²',                             categoryName: 'Custom & Jasa',    stock: 9999, price: 150000 },
];

// ---------------------------------------------------------------------------
// MATERIALS — bahan baku Alucurv.
// Mereka pakai profil aluminium STRAIGHT yang dibending sendiri menjadi
// kurva, plus kaca dan hardware.
// ---------------------------------------------------------------------------
const MATERIALS = [
  // Profil aluminium straight (bahan utama untuk dibending)
  { code: 'PRF-3-HD-6M',    name: 'Profil Aluminium 3" Hitam Doff 6m',  category: 'Aluminium',  unit: 'batang', stock: 60, price: 380000, supplier: 'Sumber Logam Jaya' },
  { code: 'PRF-3-SLV-6M',   name: 'Profil Aluminium 3" Silver 6m',      category: 'Aluminium',  unit: 'batang', stock: 40, price: 340000, supplier: 'Sumber Logam Jaya' },
  { code: 'PRF-3-PTH-6M',   name: 'Profil Aluminium 3" Putih 6m',       category: 'Aluminium',  unit: 'batang', stock: 25, price: 350000, supplier: 'Sumber Logam Jaya' },
  { code: 'PRF-4-HD-6M',    name: 'Profil Aluminium 4" Hitam Doff 6m',  category: 'Aluminium',  unit: 'batang', stock: 35, price: 540000, supplier: 'Aluminium Mas Sentosa' },
  { code: 'PRF-4-SLV-6M',   name: 'Profil Aluminium 4" Silver 6m',      category: 'Aluminium',  unit: 'batang', stock: 28, price: 490000, supplier: 'Aluminium Mas Sentosa' },

  // Kaca (sering dipakai untuk jendela mati / lengkung)
  { code: 'KCA-BNG-5MM',    name: 'Kaca Bening 5mm',                    category: 'Kaca',       unit: 'm²',     stock: 100, price: 145000, supplier: 'Sentosa Kaca' },
  { code: 'KCA-RBN-5MM',    name: 'Kaca Riben 5mm',                     category: 'Kaca',       unit: 'm²',     stock: 80,  price: 165000, supplier: 'Sentosa Kaca' },
  { code: 'KCA-TMP-8MM',    name: 'Kaca Tempered 8mm',                  category: 'Kaca',       unit: 'm²',     stock: 35,  price: 420000, supplier: 'Sentosa Kaca' },

  // Hardware
  { code: 'ENG-LK-PRM',     name: 'Engsel Pintu Lengkung Premium',      category: 'Engsel',     unit: 'pcs',    stock: 60,  price: 85000,  supplier: 'Mitra Hardware' },
  { code: 'HDL-SLV-30',     name: 'Handle Pintu Silver 30cm',           category: 'Handle',     unit: 'pcs',    stock: 45,  price: 75000,  supplier: 'Mitra Hardware' },
  { code: 'HDL-BLK-30',     name: 'Handle Pintu Black 30cm',            category: 'Handle',     unit: 'pcs',    stock: 35,  price: 85000,  supplier: 'Mitra Hardware' },
  { code: 'KNC-PTU-DBL',    name: 'Kunci Pintu Double Bolt',            category: 'Aksesoris',  unit: 'pcs',    stock: 30,  price: 220000, supplier: 'Mitra Hardware' },
  { code: 'ROL-JDL-4INC',   name: 'Roller Jendela Sliding 4 inch',      category: 'Roller',     unit: 'pcs',    stock: 80,  price: 45000,  supplier: 'Mitra Hardware' },
  { code: 'SLR-RBR-5M',     name: 'Karet Seal Aluminium Hitam 5m',      category: 'Karet Seal', unit: 'roll',   stock: 25,  price: 75000,  supplier: 'Mitra Hardware' },
  { code: 'SCR-GLV-25',     name: 'Sekrup Galvanis 2.5cm (box)',        category: 'Sekrup',     unit: 'box',    stock: 50,  price: 45000,  supplier: 'Mitra Hardware' },

  // Ornament bahan
  { code: 'ORN-ALU-PCS',    name: 'Ornament Aluminium (pcs)',           category: 'Aksesoris',  unit: 'pcs',    stock: 100, price: 28000,  supplier: 'Aluminium Mas Sentosa' },
];

// ---------------------------------------------------------------------------
// SUPPLIERS — vendor bahan baku khas industri aluminium di Jabodetabek.
// ---------------------------------------------------------------------------
const SUPPLIERS = [
  { storeName: 'Sumber Logam Jaya',     picName: 'Pak Hendra', phone: '081234567890', address: 'Jl. Industri Raya No. 12, Tangerang' },
  { storeName: 'Aluminium Mas Sentosa', picName: 'Bu Linda',   phone: '081298765432', address: 'Jl. Kapuk No. 88, Jakarta Utara' },
  { storeName: 'Sentosa Kaca',          picName: 'Pak Budi',   phone: '081377889900', address: 'Jl. Daan Mogot KM 12, Jakarta Barat' },
  { storeName: 'Mitra Hardware',        picName: 'Pak Aris',   phone: '081345678910', address: 'Pasar Pagi Mangga Dua Blok C-15' },
];

const BUYERS = ['Pak Andi', 'Bu Dewi', 'Toko Jaya', 'CV Maju', 'Bu Sari', 'Pak Budi', 'Toko Sinar', 'Pak Joko', 'Bu Rina', 'Pak Heru'];
const PLATFORMS = ['Shopee', 'TikTok', 'WhatsApp', 'Offline', 'Instagram'];
const ORDER_STATUSES = ['to_ship', 'to_ship', 'shipped', 'completed', 'completed', 'cancelled'];

// Default roles
const ROLES = [
  {
    name: 'Administrator',
    description: 'Akses penuh termasuk kelola user',
    permissions: [
      'dashboard:view',
      'orders:view', 'orders:write',
      'purchases:view', 'purchases:write',
      'products:view', 'products:write',
      'materials:view', 'materials:write',
      'suppliers:view', 'suppliers:write',
      'production:view', 'production:write',
      'hpp:view',
      'hrd:view', 'hrd:write',
      'users:manage',
    ],
  },
  {
    name: 'Operator',
    description: 'Edit semua data operasional, tanpa IAM',
    permissions: [
      'dashboard:view',
      'orders:view', 'orders:write',
      'purchases:view', 'purchases:write',
      'products:view', 'products:write',
      'materials:view', 'materials:write',
      'suppliers:view', 'suppliers:write',
      'production:view', 'production:write',
      'hpp:view',
      'hrd:view', 'hrd:write',
    ],
  },
  {
    name: 'Viewer',
    description: 'Hanya lihat, tidak bisa edit',
    permissions: [
      'dashboard:view',
      'orders:view',
      'purchases:view',
      'products:view',
      'materials:view',
      'suppliers:view',
      'production:view',
      'hpp:view',
      'hrd:view',
    ],
  },
];

function rand<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)]; }
function randInt(min: number, max: number) { return Math.floor(Math.random() * (max - min + 1)) + min; }

async function ensureRolesAndAdmin() {
  for (const r of ROLES) {
    await prisma.role.upsert({
      where: { name: r.name },
      create: {
        name: r.name,
        description: r.description,
        permissions: JSON.stringify(r.permissions),
      },
      update: {
        description: r.description,
        permissions: JSON.stringify(r.permissions),
      },
    });
  }
  console.log(`  ${ROLES.length} roles ready`);

  const adminRole = await prisma.role.findUnique({ where: { name: 'Administrator' } });
  const existing = await prisma.user.findUnique({ where: { username: 'admin' } });
  if (existing) {
    // Idempotent: jangan reset password admin yang sudah ada di production.
    // Hanya pastikan role + status aktif benar.
    await prisma.user.update({
      where: { id: existing.id },
      data: {
        isSuperAdmin: true,
        active: true,
        roleId: adminRole?.id ?? null,
      },
    });
    console.log('  admin user OK (password tidak diubah)');
  } else {
    await prisma.user.create({
      data: {
        username: 'admin',
        passwordHash: await hashPassword('Tanggor25@'),
        fullName: 'Administrator',
        isSuperAdmin: true,
        active: true,
        roleId: adminRole?.id ?? null,
      },
    });
    console.log('  admin user created (username: admin, password: Tanggor25@)');
  }
}

async function seedSuppliers() {
  const existing = await prisma.supplier.count();
  if (existing > 0) {
    console.log(`  suppliers sudah ada (${existing}), skip`);
    return;
  }
  for (const s of SUPPLIERS) {
    await prisma.supplier.upsert({
      where: { storeName: s.storeName },
      create: s,
      update: s,
    });
  }
  console.log(`  ${SUPPLIERS.length} suppliers`);
}

async function seedMaterials() {
  const existing = await prisma.material.count();
  if (existing > 0) {
    console.log(`  materials sudah ada (${existing}), skip`);
    return;
  }
  for (const m of MATERIALS) {
    await prisma.material.upsert({
      where: { code: m.code },
      create: m,
      update: m,
    });
  }
  console.log(`  ${MATERIALS.length} materials (bahan baku)`);
}

async function seedProductsAndOrders() {
  const existingProducts = await prisma.product.count();
  if (existingProducts > 0) {
    console.log(`  products sudah ada (${existingProducts}), skip seed product+order`);
    return;
  }

  // Create product categories
  const categoryMap = new Map<string, string>();
  for (const cat of PRODUCT_CATEGORIES) {
    const created = await prisma.productCategory.upsert({
      where: { name: cat },
      create: { name: cat },
      update: {},
    });
    categoryMap.set(cat, created.id);
  }
  console.log(`  ${PRODUCT_CATEGORIES.length} product categories`);

  // Create products with category relations
  const createdProducts = [];
  for (const p of PRODUCTS) {
    const { categoryName, ...data } = p;
    const product = await prisma.product.upsert({
      where: { sku: data.sku },
      create: { ...data, categoryId: categoryMap.get(categoryName) ?? null },
      update: { ...data, categoryId: categoryMap.get(categoryName) ?? null },
    });
    createdProducts.push(product);
  }
  console.log(`  ${PRODUCTS.length} products (Alucurv catalog)`);

  // Create demo orders linked to finished products (last 14 days)
  let orderCount = 0;
  for (let dayOffset = 13; dayOffset >= 0; dayOffset--) {
    const ordersPerDay = randInt(2, 6);
    for (let i = 0; i < ordersPerDay; i++) {
      const product = rand(createdProducts);
      const qty = randInt(1, 3);
      const platform = rand(PLATFORMS);
      const orderedAt = new Date(Date.now() - dayOffset * 86400000 - randInt(0, 86400) * 1000);
      orderCount++;
      await prisma.order.create({
        data: {
          orderNo: `INV-${String(orderCount).padStart(4, '0')}`,
          orderedAt,
          platform,
          buyer: rand(BUYERS),
          productId: product.id,
          sku: product.sku,
          productName: product.name,
          quantity: qty,
          price: product.price,
          total: product.price * qty,
          status: rand(ORDER_STATUSES),
        },
      });
    }
  }
  console.log(`  ${orderCount} orders across 14 days`);
}

async function main() {
  console.log('Seeding Alucurv ERP...');
  await ensureRolesAndAdmin();
  await seedSuppliers();
  await seedMaterials();
  await seedProductsAndOrders();
  console.log('Seed done.');
  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
