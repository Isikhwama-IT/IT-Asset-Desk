import { createSupabaseServerClient, getRole } from "@/lib/supabase-server";
import { redirect, notFound } from "next/navigation";
import RequestDetailClient from "@/components/RequestDetailClient";
import type { AssetRequest } from "@/types/database";
import { formatDate } from "@/lib/utils";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default async function RequestDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const role = await getRole();
  if (role !== "admin") redirect("/dashboard");

  const { id } = await params;
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.from("asset_requests").select("*").eq("id", id).single();
  if (!data) notFound();

  const request = data as AssetRequest;

  return (
    <div className="p-8 max-w-2xl">
      <div className="mb-6 fade-up">
        <Link href="/requests" className="inline-flex items-center gap-1.5 text-[12px] text-stone-400 hover:text-stone-700 mb-4">
          <ArrowLeft size={12} /> Back to Requests
        </Link>
        <p className="text-[11px] font-medium text-stone-400 uppercase tracking-widest mb-1">Asset Request</p>
        <h1 className="text-xl font-semibold text-stone-900" style={{ letterSpacing: "-0.03em" }}>
          {request.requester_name}
        </h1>
        <p className="text-sm text-stone-500 mt-0.5">{formatDate(request.created_at)}</p>
      </div>

      {/* Request details */}
      <div className="bg-white rounded-xl border border-stone-200 overflow-hidden mb-5 fade-up">
        <div className="px-5 py-3.5 border-b border-stone-100 bg-stone-50">
          <p className="text-[11px] font-medium text-stone-500 uppercase tracking-wider">Details</p>
        </div>
        <div className="px-5 py-4 divide-y divide-stone-50">
          {[
            { label: "Name",     value: request.requester_name },
            { label: "Email",    value: request.requester_email },
            { label: "Category", value: request.category_name ?? "—" },
            { label: "Reason",   value: request.reason || "—" },
          ].map(({ label, value }) => (
            <div key={label} className="py-2.5 grid grid-cols-[120px_1fr] gap-4">
              <span className="text-[12px] text-stone-400">{label}</span>
              <span className="text-[13px] text-stone-800">{value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Admin management */}
      <RequestDetailClient request={request} />
    </div>
  );
}
