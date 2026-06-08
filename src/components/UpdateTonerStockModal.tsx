"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  BtnPrimary,
  BtnSecondary,
  ErrorBanner,
  FormStack,
  Modal,
  ModalFooter,
} from "@/components/modal-ui";
import { useToast } from "@/components/Toast";
import { updatePrinterConsumableStock } from "@/lib/actions";
import {
  SLOT_LABEL,
  findConsumableType,
  type PrinterCapabilities,
  type TonerSlot,
} from "@/lib/printer-capabilities";
import type { ConsumableType, PrinterSnmpReading, PrinterWithRelations } from "@/types/database";

const SLOT_SNMP_KEY: Partial<Record<TonerSlot, keyof PrinterSnmpReading>> = {
  black: "black_toner_pct",
  cyan: "cyan_toner_pct",
  magenta: "magenta_toner_pct",
  yellow: "yellow_toner_pct",
  combined: "black_toner_pct",
};

type StockPayload = Parameters<typeof updatePrinterConsumableStock>[1];

function clampWhole(value: string): number {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(0, parsed);
}

function snmpPct(slot: TonerSlot, reading: PrinterSnmpReading | null): number | null {
  if (!reading) return null;
  const key = SLOT_SNMP_KEY[slot];
  if (!key) return null;
  const val = reading[key];
  return typeof val === "number" ? val : null;
}

function rowStatus(value: number, snmpLevel: number | null): string | null {
  if (snmpLevel === null || snmpLevel > 25) return null;
  return value >= 1 ? "Stock Available - Monitor" : "Reorder Required";
}

function partLabel(
  consumableTypes: ConsumableType[],
  kind: string,
  colour: string
): string | undefined {
  const consumable = findConsumableType(consumableTypes, kind, colour);
  if (!consumable) return undefined;
  return [consumable.part_number, consumable.description].filter(Boolean).join(" — ") || undefined;
}

function StockRow({
  label,
  sublabel,
  snmpLevel,
  value,
  onChange,
}: {
  label: string;
  sublabel?: string;
  snmpLevel: number | null;
  value: number;
  onChange: (n: number) => void;
}) {
  const pctColor =
    snmpLevel === null
      ? "text-stone-400"
      : snmpLevel === 0
        ? "text-red-700"
        : snmpLevel <= 25
          ? "text-red-500"
          : snmpLevel <= 50
            ? "text-amber-600"
            : "text-stone-500";
  const status = rowStatus(value, snmpLevel);

  return (
    <div className="flex items-center gap-4 py-2.5 border-b border-stone-50 last:border-0">
      <div className="flex-1 min-w-0">
        <p className="text-[12.5px] font-medium text-stone-700 leading-snug">{label}</p>
        {sublabel && <p className="text-[11px] text-stone-400 truncate">{sublabel}</p>}
        {snmpLevel !== null && (
          <p className={`text-[10.5px] mt-0.5 ${pctColor}`}>In printer: {snmpLevel}%</p>
        )}
        {status && (
          <p className={`text-[10.5px] mt-0.5 ${status === "Reorder Required" ? "text-red-600" : "text-amber-600"}`}>
            {status}
          </p>
        )}
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <span className="text-[10.5px] text-stone-400 mr-1">on shelf</span>
        <button
          type="button"
          onClick={() => onChange(Math.max(0, value - 1))}
          disabled={value === 0}
          className="w-7 h-7 rounded-lg border border-stone-200 flex items-center justify-center text-stone-400 hover:border-stone-300 hover:text-stone-600 disabled:opacity-30 transition-colors text-[13px] font-medium"
        >
          -
        </button>
        <input
          type="number"
          min={0}
          value={value}
          onChange={(event) => onChange(clampWhole(event.target.value))}
          className="w-12 text-center text-[13px] font-semibold tabular-nums border border-stone-200 rounded-lg py-1 focus:outline-none focus:ring-1 focus:ring-stone-300"
          style={{ color: value === 0 ? "#dc2626" : "#415445" }}
        />
        <button
          type="button"
          onClick={() => onChange(value + 1)}
          className="w-7 h-7 rounded-lg border border-stone-200 flex items-center justify-center text-stone-400 hover:border-stone-300 hover:text-stone-600 transition-colors text-[13px] font-medium"
        >
          +
        </button>
      </div>
    </div>
  );
}

function SectionHead({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2 pt-1 pb-1">
      <span className="w-0.5 h-3 rounded-full flex-shrink-0" style={{ background: "#C04F28" }} />
      <p className="text-[10.5px] font-medium uppercase tracking-wider" style={{ color: "#859474" }}>
        {label}
      </p>
    </div>
  );
}

function tonerKey(slot: TonerSlot): string {
  return `toner_${slot}`;
}

function developerKey(slot: TonerSlot): string {
  return `developer_${slot}`;
}

function developerSlots(capabilities: PrinterCapabilities): TonerSlot[] {
  if (!capabilities.hasDeveloperUnits) return [];
  if (capabilities.tonerConfig === "all-in-one") return ["combined"];
  return capabilities.tonerSlots.filter((slot) => slot !== "combined");
}

export default function UpdateTonerStockModal({
  printer,
  capabilities,
  latestReading,
  consumableTypes,
  onClose,
}: {
  printer: PrinterWithRelations;
  capabilities: PrinterCapabilities;
  latestReading: PrinterSnmpReading | null;
  consumableTypes: ConsumableType[];
  onClose: () => void;
}) {
  const router = useRouter();
  const { success } = useToast();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");

  const [stock, setStock] = useState<Record<string, number>>(() => {
    const initial: Record<string, number> = {
      fuser_unit_stock: printer.fuser_unit_stock ?? 0,
      waste_box_stock: printer.waste_box_stock ?? 0,
      drum_unit_stock: printer.drum_unit_stock ?? 0,
    };

    for (const slot of capabilities.tonerSlots) {
      if (slot === "combined") {
        initial[tonerKey(slot)] = printer.black_toner_stock ?? 0;
      } else {
        initial[tonerKey(slot)] =
          ((printer as Record<string, unknown>)[`${slot}_toner_stock`] as number | undefined) ?? 0;
      }
    }

    const developerStock = printer.developer_unit_stock ?? 0;
    for (const slot of developerSlots(capabilities)) {
      initial[developerKey(slot)] =
        capabilities.tonerConfig === "all-in-one"
          ? developerStock
          : Math.floor(developerStock / Math.max(1, developerSlots(capabilities).length));
    }

    return initial;
  });

  function set(key: string, val: number) {
    setStock((prev) => ({ ...prev, [key]: val }));
  }

  function save() {
    startTransition(async () => {
      setError("");
      const payload: StockPayload = {};

      if (capabilities.tonerConfig === "all-in-one") {
        payload.black_toner_stock = stock[tonerKey("combined")] ?? 0;
      } else {
        payload.black_toner_stock = stock[tonerKey("black")] ?? 0;
        if (capabilities.isColour) {
          const cyan = stock[tonerKey("cyan")] ?? 0;
          const magenta = stock[tonerKey("magenta")] ?? 0;
          const yellow = stock[tonerKey("yellow")] ?? 0;
          payload.cyan_toner_stock = cyan;
          payload.magenta_toner_stock = magenta;
          payload.yellow_toner_stock = yellow;
          payload.colour_toner_stock = cyan + magenta + yellow;
        }
      }

      const devSlots = developerSlots(capabilities);
      if (devSlots.length > 0) {
        payload.developer_unit_stock = devSlots.reduce(
          (sum, slot) => sum + (stock[developerKey(slot)] ?? 0),
          0
        );
      }
      if (capabilities.hasFuserTracking) payload.fuser_unit_stock = stock.fuser_unit_stock ?? 0;
      if (capabilities.hasWasteBox) payload.waste_box_stock = stock.waste_box_stock ?? 0;
      if (capabilities.hasDrumTracking) payload.drum_unit_stock = stock.drum_unit_stock ?? 0;

      const res = await updatePrinterConsumableStock(printer.id, payload);
      if (res?.error) {
        setError(res.error);
        return;
      }

      success("Consumable stock updated.");
      router.refresh();
      onClose();
    });
  }

  return (
    <Modal
      title={`Update Consumable Stock - ${printer.name}`}
      onClose={onClose}
      width="max-w-xl"
    >
      <FormStack>
        {error && <ErrorBanner message={error} />}

        <SectionHead label={capabilities.tonerConfig === "all-in-one" ? "Toner" : "Toner Cartridges"} />
        {capabilities.tonerSlots.map((slot) => {
          const colour = slot === "combined" ? "Combined" : SLOT_LABEL[slot];
          return (
            <StockRow
              key={slot}
              label={slot === "combined" ? "Combined Toner Cartridge" : `${SLOT_LABEL[slot]} Toner`}
              sublabel={partLabel(consumableTypes, "Toner", colour)}
              snmpLevel={snmpPct(slot, latestReading)}
              value={stock[tonerKey(slot)] ?? 0}
              onChange={(value) => set(tonerKey(slot), value)}
            />
          );
        })}

        {developerSlots(capabilities).length > 0 && (
          <>
            <SectionHead label="Developer Units" />
            {developerSlots(capabilities).map((slot) => {
              const colour = slot === "combined" ? "N/A" : SLOT_LABEL[slot];
              return (
                <StockRow
                  key={`developer-${slot}`}
                  label={slot === "combined" ? "Developer Unit" : `${SLOT_LABEL[slot]} Developer`}
                  sublabel={partLabel(consumableTypes, "Developer", colour)}
                  snmpLevel={null}
                  value={stock[developerKey(slot)] ?? 0}
                  onChange={(value) => set(developerKey(slot), value)}
                />
              );
            })}
          </>
        )}

        {capabilities.hasFuserTracking && (
          <>
            <SectionHead label="Fuser Unit" />
            <StockRow
              label="Fuser Unit"
              sublabel={partLabel(consumableTypes, "Fuser", "N/A")}
              snmpLevel={latestReading?.fuser_pct ?? null}
              value={stock.fuser_unit_stock ?? 0}
              onChange={(value) => set("fuser_unit_stock", value)}
            />
          </>
        )}

        {capabilities.hasWasteBox && (
          <>
            <SectionHead label="Waste Toner Box" />
            <StockRow
              label="Waste Toner Box"
              sublabel={partLabel(consumableTypes, "Waste Box", "N/A")}
              snmpLevel={latestReading?.waste_box_pct ?? null}
              value={stock.waste_box_stock ?? 0}
              onChange={(value) => set("waste_box_stock", value)}
            />
          </>
        )}

        {capabilities.hasDrumTracking && (
          <>
            <SectionHead label="Drum Unit" />
            <StockRow
              label="Drum Unit"
              sublabel={partLabel(consumableTypes, "Drum", "N/A")}
              snmpLevel={latestReading?.drum_pct ?? null}
              value={stock.drum_unit_stock ?? 0}
              onChange={(value) => set("drum_unit_stock", value)}
            />
          </>
        )}

        <ModalFooter>
          <BtnSecondary onClick={onClose}>Cancel</BtnSecondary>
          <BtnPrimary onClick={save} disabled={pending}>
            {pending ? "Saving..." : "Save Stock"}
          </BtnPrimary>
        </ModalFooter>
      </FormStack>
    </Modal>
  );
}
