import Link from "next/link";
import { Package } from "lucide-react";

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen text-center p-8">
      <div className="w-12 h-12 rounded-xl bg-stone-100 flex items-center justify-center mb-4">
        <Package size={20} className="text-stone-400" />
      </div>
      <h1 className="text-xl font-semibold text-stone-900 mb-1" style={{ letterSpacing: "-0.025em" }}>
        Not found
      </h1>
      <p className="text-sm text-stone-500 mb-6">This page or asset doesn't exist.</p>
      <Link
        href="/dashboard"
        className="text-[13px] font-medium text-stone-700 border border-stone-200 px-4 py-2 rounded-lg hover:bg-stone-50 transition-colors"
      >
        Back to Dashboard
      </Link>
    </div>
  );
}
