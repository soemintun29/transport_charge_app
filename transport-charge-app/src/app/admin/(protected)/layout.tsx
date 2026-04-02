import Link from "next/link";
import { redirect } from "next/navigation";
import { AdminHeader } from "@/components/admin/AdminHeader";
import {
  createAdminAuthServerClient,
  isAllowlistedAdminEmail,
} from "@/lib/supabase-auth";

export default async function AdminProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createAdminAuthServerClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user || !isAllowlistedAdminEmail(data.user.email)) {
    redirect("/admin/login");
  }

  return (
    <div className="min-h-screen bg-[#f4f8fb]">
      <header className="border-b border-slate-200 bg-white shadow-sm">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <nav className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm font-medium text-slate-700">
            <Link href="/admin" className="font-semibold text-[#0098D1]">
              Admin
            </Link>
            <Link href="/admin/hubs" className="hover:text-brand">
              Hubs
            </Link>
            <Link href="/admin/zones" className="hover:text-brand">
              Zones
            </Link>
            <Link href="/admin/pricing" className="hover:text-brand">
              Pricing
            </Link>
            <Link href="/admin/logs" className="hover:text-brand">
              Logs
            </Link>
            <Link href="/" className="text-slate-500 hover:text-slate-800">
              Calculator
            </Link>
          </nav>
          <AdminHeader />
        </div>
      </header>
      <div className="mx-auto max-w-6xl px-4 py-6">{children}</div>
    </div>
  );
}
