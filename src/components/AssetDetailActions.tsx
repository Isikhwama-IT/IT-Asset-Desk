"use client";

import { useState } from "react";
import { Pencil, ArrowLeftRight, Wrench, RefreshCw } from "lucide-react";
import { EditAssetModal, ChangeStatusModal, AssignAssetModal } from "@/components/AssetModals";
import { AddMaintenanceModal } from "@/components/MaintenanceModals";
import { useAuth } from "@/context/AuthContext";
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
  const [modal, setModal] = useState<"edit" | "status" | "assign" | "maintenance" | null>(null);

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
