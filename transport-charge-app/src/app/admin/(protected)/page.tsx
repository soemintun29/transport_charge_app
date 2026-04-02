import Link from "next/link";
import { GoogleFallbackToggleCard } from "@/components/admin/GoogleFallbackToggleCard";

const cards = [
  {
    href: "/admin/hubs",
    title: "Service hubs",
    desc: "Names, addresses, coordinates, active status",
  },
  {
    href: "/admin/zones",
    title: "Zones & surcharges",
    desc: "Distance bands and zone adjustment (MMK)",
  },
  {
    href: "/admin/pricing",
    title: "City pricing",
    desc: "Base fare and per-km rate per city",
  },
  {
    href: "/admin/logs",
    title: "Calculation logs",
    desc: "Recent fee calculations and filters",
  },
];

export default function AdminHomePage() {
  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
      <p className="mt-1 text-slate-600">
        Manage pricing data used by the agent calculator.
      </p>
      <ul className="mt-8 grid gap-4 sm:grid-cols-2">
        {cards.map((c) => (
          <li key={c.href}>
            <Link
              href={c.href}
              className="block rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-[#0098D1]/40 hover:shadow"
            >
              <h2 className="font-semibold text-slate-900">{c.title}</h2>
              <p className="mt-1 text-sm text-slate-600">{c.desc}</p>
            </Link>
          </li>
        ))}
      </ul>
      <GoogleFallbackToggleCard />
    </div>
  );
}
