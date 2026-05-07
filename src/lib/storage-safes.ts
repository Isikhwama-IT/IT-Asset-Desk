export type StorageSafeSite = "baker-street" | "rainbow-park";

export interface StorageSafeOption {
  id: string;
  site: StorageSafeSite;
  siteLabel: string;
  label: string;
  contactName: string;
  aliases?: readonly string[];
}

export const STORAGE_SAFE_SITES: readonly { id: StorageSafeSite; label: string }[] = [
  { id: "baker-street", label: "Baker Street" },
  { id: "rainbow-park", label: "Rainbow Park" },
];

export const STORAGE_SAFE_OPTIONS: readonly StorageSafeOption[] = [
  {
    id: "baker-street",
    site: "baker-street",
    siteLabel: "Baker Street",
    label: "Baker Street Safe",
    contactName: "Baker Street Safe",
  },
  {
    id: "rainbow-downstairs",
    site: "rainbow-park",
    siteLabel: "Rainbow Park",
    label: "Downstairs",
    contactName: "Rainbow Park Safe -Downstairs",
    aliases: ["Rainbow Park Safe - Downstairs"],
  },
  {
    id: "rainbow-upstairs",
    site: "rainbow-park",
    siteLabel: "Rainbow Park",
    label: "Upstairs",
    contactName: "Rainbow Park Safe - Upstairs",
  },
];

export function normalizeStorageSafeName(name: string) {
  return name.toLowerCase().replace(/\s*-\s*/g, " - ").replace(/\s+/g, " ").trim();
}

export function storageSafeMatchesContact(option: StorageSafeOption, contactName: string) {
  const normalizedContactName = normalizeStorageSafeName(contactName);
  const names = [option.contactName, ...(option.aliases ?? [])];
  return names.some((name) => normalizeStorageSafeName(name) === normalizedContactName);
}

export function isStorageSafeContactName(contactName: string) {
  return STORAGE_SAFE_OPTIONS.some((option) => storageSafeMatchesContact(option, contactName));
}
