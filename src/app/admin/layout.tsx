import { AdminNav } from './_components/AdminNav';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-bg">
      <AdminNav />
      {children}
    </div>
  );
}
