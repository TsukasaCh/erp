import './globals.css';
import { Sidebar } from '@/components/Nav';

export const metadata = {
  title: 'ERP Marketplace',
  description: 'TikTok Shop & Shopee unified ERP',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <body>
        <Sidebar />
        <main className="ml-60 min-h-screen px-8 py-8">{children}</main>
      </body>
    </html>
  );
}
