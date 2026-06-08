"use client";

import { useState } from "react";
import { ClipboardList, Package2 } from "lucide-react";
import UpdateSitePaperStockModal from "@/components/UpdateSitePaperStockModal";
import UpdateTonerStockModal from "@/components/UpdateTonerStockModal";
import type { PrinterCapabilities } from "@/lib/printer-capabilities";
import type {
  ConsumableType,
  Location,
  LocationPaperStock,
  PrinterSnmpReading,
  PrinterWithRelations,
} from "@/types/database";

export default function PrinterStockModalTrigger({
  printer,
  location,
  capabilities,
  sitePaperStock,
  avgDailyPages,
  latestReading,
  consumableTypes,
}: {
  printer: PrinterWithRelations;
  location: Location | null;
  capabilities: PrinterCapabilities;
  sitePaperStock: LocationPaperStock[];
  avgDailyPages: number | null;
  latestReading: PrinterSnmpReading | null;
  consumableTypes: ConsumableType[];
}) {
  const [modal, setModal] = useState<"paper" | "toner" | null>(null);

  const btnBase =
    "flex items-center gap-1.5 text-[12px] font-medium px-3 py-1.5 rounded-lg border border-stone-200 text-stone-600 hover:bg-stone-50 hover:border-stone-300 transition-colors";

  return (
    <>
      <div className="flex items-center gap-2">
        {location && (
          <button className={btnBase} onClick={() => setModal("paper")}>
            <Package2 size={12} />
            Update Site Stock
          </button>
        )}
        <button className={btnBase} onClick={() => setModal("toner")}>
          <ClipboardList size={12} />
          Update Consumables
        </button>
      </div>

      {modal === "paper" && location && (
        <UpdateSitePaperStockModal
          location={location}
          existingStock={sitePaperStock}
          avgDailyPages={avgDailyPages}
          onClose={() => setModal(null)}
        />
      )}
      {modal === "toner" && (
        <UpdateTonerStockModal
          printer={printer}
          capabilities={capabilities}
          latestReading={latestReading}
          consumableTypes={consumableTypes}
          onClose={() => setModal(null)}
        />
      )}
    </>
  );
}
