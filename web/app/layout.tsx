import './globals.css';
import { Sidebar } from '@/components/Nav';
import { AuthGuard } from '@/components/AuthGuard';
import { LayoutMain } from '@/components/LayoutMain';

export const metadata = {
  title: 'Alucurv — ERP',
  description: 'Alucurv ERP — Kreasi alumunium, inovasi tanpa batas.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <body>
        <AuthGuard>
          <Sidebar />
          <LayoutMain>{children}</LayoutMain>
        </AuthGuard>
      </body>
    </html>
  );
}
