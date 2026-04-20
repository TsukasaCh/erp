import './globals.css';
import { Nav } from '@/components/Nav';

export const metadata = {
  title: 'ERP Marketplace',
  description: 'TikTok Shop & Shopee unified ERP',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <body>
        <Nav />
        <main className="max-w-7xl mx-auto px-6 py-8">{children}</main>
      </body>
    </html>
  );
}
