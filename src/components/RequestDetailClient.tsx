"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Save, Trash2 } from "lucide-react";
import { updateAssetRequest, deleteAssetRequest } from "@/lib/actions";
import type { AssetRequest } from "@/types/database";

const STATUSES = ["Pending", "In Review", "Approved", "Declined", "Closed"] as const;

function statusStyle(status: string) {
  switch (status) {
    case "Pending":   return "bg-amber-50 text-amber-700";
    case "In Review": return "bg-sky-50 text-sky-700";
    case "Approved":  return "bg-emerald-50 text-emerald-700";
    case "Declined":  return "bg-red-50 text-red-700";
    case "Closed":    return "bg-stone-100 text-stone-500";
    default:          return "bg-stone-50 text-stone-500";
  }
}

export default function RequestDetailClient({ request }: { request: AssetRequest }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [status, setStatus] = useState(request.status);
  const [notes, setNotes] = useState(request.admin_notes ?? "");
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);

  function handleSave() {
    setError("");
    startTransition(async () => {
      const res = await updateAssetRequest(request.id, { status, admin_notes: notes });
      if (res?.error) {
        setError(res.error);
      } else {
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
        router.refresh();
      }
    });
  }

  function handleDelete() {
    startTransition(async () => {
      const res = await deleteAssetRequest(request.id);
      if (res?.error) {
        setError(res.error);
        setConfirmDelete(false);
      } else {
        router.push("/requests");
      }
    });
  }

  return (
    <div className={`bg-white rounded-xl border border-stone-200 overflow-hidden fade-up ${isPending ? "opacity-60 pointer-events-none" : ""}`}>
      <div className="px-5 py-3.5 border-b border-stone-100 bg-stone-50 flex items-center justify-between">
        <p className="text-[11px] font-medium text-stone-500 uppercase tracking-wider">Admin Actions</p>
        <span className={`text-[11.5px] font-medium px-2 py-0.5 rounded-full ${statusStyle(request.status)}`}>
          {request.status}
        </span>
      </div>
      <div className="px-5 py-5 space-y-4">
        {/* Status */}
        <div>
          <label className="block text-[12px] font-medium text-stone-600 mb-1.5">Status</label>
          <select
            value={status}
            onChange={(e) => { setStatus(e.target.value); setSaved(false); }}
            className="w-full px-3 py-2 text-[13.5px] border border-stone-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-stone-400 text-stone-800 bg-white"
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>

        {/* Notes */}
        <div>
          <label className="block text-[12px] font-medium text-stone-600 mb-1.5">Admin Notes</label>
          <textarea
            value={notes}
            onChange={(e) => { setNotes(e.target.value); setSaved(false); }}
            rows={3}
            placeholder="Internal notes (not visible to requester)…"
            className="w-full px-3 py-2 text-[13.5px] border border-stone-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-stone-400 text-stone-800 placeholder:text-stone-300 resize-none"
          />
        </div>

        {/* Attended by */}
        {request.attended_by_name && (
          <p className="text-[11.5px] text-stone-400">
            Last updated by {request.attended_by_name}
          </p>
        )}

        {error && <p className="text-[12px] text-red-500">{error}</p>}

        <div className="flex items-center justify-between pt-1">
          <button
            onClick={handleSave}
            disabled={isPending}
            className="flex items-center gap-1.5 px-4 py-2 text-[12.5px] font-medium text-white rounded-lg transition-colors disabled:opacity-50 btn-press"
            style={{ background: "#C04F28" }}
          >
            {saved ? <Check size={13} /> : <Save size={13} />}
            {saved ? "Saved" : "Save Changes"}
          </button>

          {confirmDelete ? (
            <div className="flex items-center gap-2">
              <span className="text-[12px] text-stone-500">Delete this request?</span>
              <button
                onClick={handleDelete}
                className="px-3 py-1.5 text-[12px] font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors"
              >
                Yes, delete
              </button>
              <button
                onClick={() => setConfirmDelete(false)}
                className="px-3 py-1.5 text-[12px] font-medium text-stone-600 border border-stone-200 rounded-lg hover:bg-stone-50 transition-colors"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              onClick={() => setConfirmDelete(true)}
              className="flex items-center gap-1.5 px-3 py-2 text-[12px] text-stone-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
            >
              <Trash2 size={13} />
              Delete
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
