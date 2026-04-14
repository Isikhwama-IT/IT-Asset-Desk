"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, ArrowLeftRight, Wrench, RefreshCw, Trash2 } from "lucide-react";
import { EditAssetModal, ChangeStatusModal, AssignAssetModal } from "@/components/AssetModals";
import { AddMaintenanceModal } from "@/components/MaintenanceModals";
import { useAuth } from "@/context/AuthContext";
import { deleteAsset } from "@/lib/actions";
import type { AssetWithRelations, Status, Category, Department, Location, JobLevel, Contact } from "@/types/database";

interface Props {
  asset: AssetWithRelations;
  statuses: Status[];
  categories: Category[];
  departments: Department[];
  locations: Location[];
  jobLevels: JobLevel[];
  contacts: Contact[];
  // IDs for well-known statuses
  inUseStatusId: string;
  inStorageStatusId: string;
}

export default function AssetDetailActions({
  asset, statuses, categories, departments, locations, jobLevels, contacts,
  inUseStatusId, inStorageStatusId,
}: Props) {
  const { isAdmin } = useAuth();
  const router = useRouter();
  const [modal, setModal] = useState<"edit" | "status" | "assign" | "maintenance" | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  async function handleDelete() {
    setDeleting(true);
    const res = await deleteAsset(asset.id);
    setDeleting(false);
    if (res?.error) return setDeleteError(res.error);
    router.push("/assets");
  }

  if (!isAdmin) return null;

  return (
    <>
      <div className="flex items-center gap-2">
        <button
          onClick={() => setModal("status")}
          className="flex items-center gap-1.5 text-[12.5px] font-medium text-stone-600 border border-stone-200 px-3 py-2 rounded-lg hover:bg-stone-50 transition-colors"
        >
          <RefreshCw size={13} /> Status
        </button>
        <button
          onClick={() => setModal("assign")}
          className="flex items-center gap-1.5 text-[12.5px] font-medium text-stone-600 border border-stone-200 px-3 py-2 rounded-lg hover:bg-stone-50 transition-colors"
        >
          <ArrowLeftRight size={13} /> Assign
        </button>
        <button
          onClick={() => setModal("maintenance")}
          className="flex items-center gap-1.5 text-[12.5px] font-medium text-stone-600 border border-stone-200 px-3 py-2 rounded-lg hover:bg-stone-50 transition-colors"
        >
          <Wrench size={13} /> Maintenance
        </button>
        <button
          onClick={() => setModal("edit")}
          className="flex items-center gap-1.5 text-[12.5px] font-medium text-white px-3 py-2 rounded-lg transition-colors btn-press"
          style={{ background: "#C04F28" }}
        >
          <Pencil size={13} /> Edit
        </button>

        {/* Delete */}
        {!confirmDelete ? (
          <button
            onClick={() => setConfirmDelete(true)}
            className="flex items-center gap-1.5 text-[12.5px] font-medium text-red-600 border border-red-200 px-3 py-2 rounded-lg hover:bg-red-50 transition-colors"
          >
            <Trash2 size={13} /> Delete
          </button>
        ) : (
          <div className="flex items-center gap-1.5">
            <span className="text-[12px] text-red-600 font-medium">Delete this asset?</span>
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="flex items-center gap-1 px-3 py-2 text-[12.5px] font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors"
            >
              {deleting ? "Deleting…" : "Yes, delete"}
            </button>
            <button
              onClick={() => { setConfirmDelete(false); setDeleteError(""); }}
              className="px-3 py-2 text-[12.5px] font-medium text-stone-600 border border-stone-200 rounded-lg hover:bg-stone-50 transition-colors"
            >
              Cancel
            </button>
          </div>
        )}
        {deleteError && <span className="text-[12px] text-red-500">{deleteError}</span>}
      </div>

      {modal === "edit" && (
        <EditAssetModal
          asset={asset}
          onClose={() => setModal(null)}
          lookups={{ categories, departments, locations, jobLevels }}
        />
      )}
      {modal === "status" && (
        <ChangeStatusModal
          asset={asset}
          statuses={statuses}
          onClose={() => setModal(null)}
        />
      )}
      {modal === "assign" && (
        <AssignAssetModal
          asset={asset}
          contacts={contacts}
          locations={locations}
          inUseStatusId={inUseStatusId}
          inStorageStatusId={inStorageStatusId}
          onClose={() => setModal(null)}
        />
      )}
      {modal === "maintenance" && (
        <AddMaintenanceModal
          assetId={asset.id}
          assetLabel={`#${asset.asset_code} · ${asset.description}`}
          onClose={() => setModal(null)}
        />
      )}
    </>
  );
}
