"use client";

import { useState, useTransition, useEffect } from "react";
import { getPublicCategories, submitAssetRequest } from "./actions";
import { Boxes, CheckCircle } from "lucide-react";

type Category = { id: string; name: string };

export default function RequestPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [isPending, startTransition] = useTransition();
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  const [form, setForm] = useState({
    requesterName: "",
    requesterEmail: "",
    categoryId: "",
    reason: "",
  });

  useEffect(() => {
    getPublicCategories().then(setCategories);
  }, []);

  function set(field: keyof typeof form, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
    setError("");
  }

  function handleSubmit() {
    const category = categories.find((c) => c.id === form.categoryId);
    startTransition(async () => {
      const res = await submitAssetRequest({
        requesterName: form.requesterName,
        requesterEmail: form.requesterEmail,
        categoryId: form.categoryId,
        categoryName: category?.name ?? "",
        reason: form.reason,
      });
      if (res.error) {
        setError(res.error);
      } else {
        setSubmitted(true);
      }
    });
  }

  return (
    <div className="min-h-screen bg-stone-50 flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        {/* Brand */}
        <div className="flex items-center gap-2.5 mb-8 justify-center">
          <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: "#C04F28" }}>
            <Boxes size={15} className="text-white" />
          </div>
          <div>
            <p className="font-bold leading-tight" style={{ fontSize: 15, color: "#415445", letterSpacing: "-0.03em" }}>IT Asset Desk</p>
            <p className="leading-tight" style={{ fontSize: 10, color: "#859474" }}>by ISIBAG</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-stone-200 overflow-hidden shadow-sm">
          {submitted ? (
            <div className="px-8 py-12 text-center">
              <div className="w-12 h-12 rounded-full bg-emerald-50 flex items-center justify-center mx-auto mb-4">
                <CheckCircle size={22} className="text-emerald-600" />
              </div>
              <h2 className="text-[17px] font-semibold text-stone-900 mb-2" style={{ letterSpacing: "-0.02em" }}>
                Request submitted
              </h2>
              <p className="text-[13px] text-stone-500 leading-relaxed">
                Your request has been submitted successfully. We&apos;ll review it and be in touch shortly.
              </p>
            </div>
          ) : (
            <>
              <div className="px-6 py-5 border-b border-stone-100">
                <h1 className="text-[16px] font-semibold text-stone-900" style={{ letterSpacing: "-0.02em" }}>
                  Request an Asset
                </h1>
                <p className="text-[12.5px] text-stone-500 mt-0.5">
                  Fill in the form below and we&apos;ll get back to you.
                </p>
              </div>

              <div className="px-6 py-5 space-y-4">
                {/* Name */}
                <div>
                  <label className="block text-[12px] font-medium text-stone-600 mb-1.5">
                    Full Name <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={form.requesterName}
                    onChange={(e) => set("requesterName", e.target.value)}
                    placeholder="Jane Smith"
                    className="w-full px-3 py-2 text-[13.5px] border border-stone-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-stone-400 text-stone-800 placeholder:text-stone-300"
                  />
                </div>

                {/* Email */}
                <div>
                  <label className="block text-[12px] font-medium text-stone-600 mb-1.5">
                    Email Address <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="email"
                    value={form.requesterEmail}
                    onChange={(e) => set("requesterEmail", e.target.value)}
                    placeholder="jane@company.com"
                    className="w-full px-3 py-2 text-[13.5px] border border-stone-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-stone-400 text-stone-800 placeholder:text-stone-300"
                  />
                </div>

                {/* Category */}
                <div>
                  <label className="block text-[12px] font-medium text-stone-600 mb-1.5">
                    Asset Category <span className="text-red-400">*</span>
                  </label>
                  <select
                    value={form.categoryId}
                    onChange={(e) => set("categoryId", e.target.value)}
                    className="w-full px-3 py-2 text-[13.5px] border border-stone-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-stone-400 text-stone-800 bg-white appearance-none"
                  >
                    <option value="">Select a category…</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Reason */}
                <div>
                  <label className="block text-[12px] font-medium text-stone-600 mb-1.5">
                    Reason / Justification
                  </label>
                  <textarea
                    value={form.reason}
                    onChange={(e) => set("reason", e.target.value)}
                    placeholder="Briefly describe why you need this asset…"
                    rows={3}
                    className="w-full px-3 py-2 text-[13.5px] border border-stone-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-stone-400 text-stone-800 placeholder:text-stone-300 resize-none"
                  />
                </div>

                {error && (
                  <p className="text-[12px] text-red-500">{error}</p>
                )}

                <button
                  onClick={handleSubmit}
                  disabled={isPending}
                  className="w-full py-2.5 text-[13.5px] font-medium text-white rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-2 btn-press"
                  style={{ background: "#C04F28" }}
                >
                  {isPending ? (
                    <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                  ) : null}
                  {isPending ? "Submitting…" : "Submit Request"}
                </button>
              </div>
            </>
          )}
        </div>

        <p className="text-center text-[11px] text-stone-400 mt-6">
          ISIBAG IT Asset Desk
        </p>
      </div>
    </div>
  );
}
