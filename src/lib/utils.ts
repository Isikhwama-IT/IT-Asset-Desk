import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: string | null): string {
  if (!date) return "—";
  return new Date(date).toLocaleDateString("en-ZA", {
    day: "numeric", month: "short", year: "numeric",
  });
}

export function getStatusConfig(statusName: string | undefined): {
  color: string;
  dot: string;
  bg: string;
} {
  const map: Record<string, { color: string; dot: string; bg: string }> = {
    "In Use":      { color: "text-emerald-700", dot: "bg-emerald-500", bg: "bg-emerald-50" },
    "In Storage":  { color: "text-sky-700",     dot: "bg-sky-400",     bg: "bg-sky-50" },
    "Under Repair":{ color: "text-amber-700",   dot: "bg-amber-400",   bg: "bg-amber-50" },
    "Damaged":     { color: "text-orange-700",  dot: "bg-orange-400",  bg: "bg-orange-50" },
    "Retired":     { color: "text-stone-500",   dot: "bg-stone-400",   bg: "bg-stone-100" },
    "Scrapped":    { color: "text-stone-500",   dot: "bg-stone-400",   bg: "bg-stone-100" },
    "Lost":        { color: "text-red-700",     dot: "bg-red-400",     bg: "bg-red-50" },
    "Stolen":      { color: "text-red-700",     dot: "bg-red-500",     bg: "bg-red-50" },
  };
  return map[statusName ?? ""] ?? { color: "text-stone-500", dot: "bg-stone-300", bg: "bg-stone-50" };
}

export function getPerformanceConfig(rating: string | null): {
  color: string; dot: string; bg: string;
} | null {
  const map: Record<string, { color: string; dot: string; bg: string }> = {
    "Excellent": { color: "text-emerald-700", dot: "bg-emerald-500", bg: "bg-emerald-50" },
    "Good":      { color: "text-sky-700",     dot: "bg-sky-400",     bg: "bg-sky-50"     },
    "Fair":      { color: "text-amber-700",   dot: "bg-amber-400",   bg: "bg-amber-50"   },
    "Poor":      { color: "text-red-700",     dot: "bg-red-400",     bg: "bg-red-50"     },
  };
  return map[rating ?? ""] ?? null;
}

export function getCategoryIcon(categoryName: string | undefined): string {
  const map: Record<string, string> = {
    "Laptop": "💻", "PC": "🖥️", "Monitor": "🖥️", "Tablet": "📱",
    "Smartphone": "📱", "Mobile Phone": "📱", "Printer": "🖨️",
    "Scanner": "📠", "Mouse": "🖱️", "Keyboard": "⌨️",
    "Mouse & Keyboard Combo": "⌨️", "Headset": "🎧", "Headphones": "🎧",
    "Docking Station": "🔌", "UPS": "🔋", "Charger": "🔌",
    "Power Adapter": "🔌", "Cable": "🔗", "Display Cable": "🔗",
    "Flash Drive": "💾", "TV": "📺", "Projector": "📽️",
    "Video Camera": "📹", "Tripod": "📷", "Inverter": "⚡",
    "Pistol Grip": "🔫", "Cover": "📦",
  };
  return map[categoryName ?? ""] ?? "📦";
}
