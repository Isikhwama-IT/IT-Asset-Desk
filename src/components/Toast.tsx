"use client";

import { createContext, useContext, useState, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle, XCircle, AlertTriangle, X } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

type ToastType = "success" | "error" | "warning";

interface Toast {
  id: string;
  type: ToastType;
  message: string;
}

interface ToastContextValue {
  toast: (type: ToastType, message: string) => void;
  success: (message: string) => void;
  error: (message: string) => void;
  warning: (message: string) => void;
}

// ─── Context ──────────────────────────────────────────────────────────────────

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}

// ─── Individual Toast ─────────────────────────────────────────────────────────

const CONFIG: Record<ToastType, { icon: React.ElementType; bg: string; border: string; iconColor: string; textColor: string }> = {
  success: { icon: CheckCircle, bg: "bg-emerald-50",  border: "border-emerald-200", iconColor: "text-emerald-600", textColor: "text-emerald-900" },
  error:   { icon: XCircle,     bg: "bg-red-50",      border: "border-red-200",     iconColor: "text-red-600",     textColor: "text-red-900"     },
  warning: { icon: AlertTriangle, bg: "bg-amber-50",  border: "border-amber-200",   iconColor: "text-amber-600",   textColor: "text-amber-900"   },
};

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: (id: string) => void }) {
  const cfg = CONFIG[toast.type];
  const Icon = cfg.icon;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: 48, scale: 0.96 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: 48, scale: 0.94, transition: { duration: 0.18 } }}
      transition={{ type: "spring", stiffness: 400, damping: 30 }}
      className={`flex items-start gap-3 px-4 py-3 rounded-xl border shadow-lg min-w-[260px] max-w-[340px] ${cfg.bg} ${cfg.border}`}
    >
      <Icon size={16} className={`flex-shrink-0 mt-0.5 ${cfg.iconColor}`} />
      <p className={`flex-1 text-[13px] font-medium leading-snug ${cfg.textColor}`}>{toast.message}</p>
      <button
        onClick={() => onDismiss(toast.id)}
        className="flex-shrink-0 text-stone-400 hover:text-stone-600 transition-colors mt-0.5"
      >
        <X size={13} />
      </button>
    </motion.div>
  );
}

// ─── Provider ─────────────────────────────────────────────────────────────────

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const dismiss = useCallback((id: string) => {
    setToasts((t) => t.filter((x) => x.id !== id));
    const timer = timers.current.get(id);
    if (timer) { clearTimeout(timer); timers.current.delete(id); }
  }, []);

  const toast = useCallback((type: ToastType, message: string) => {
    const id = crypto.randomUUID();
    setToasts((t) => [...t, { id, type, message }]);
    const timer = setTimeout(() => dismiss(id), 4000);
    timers.current.set(id, timer);
  }, [dismiss]);

  const value: ToastContextValue = {
    toast,
    success: (msg) => toast("success", msg),
    error:   (msg) => toast("error", msg),
    warning: (msg) => toast("warning", msg),
  };

  return (
    <ToastContext.Provider value={value}>
      {children}
      {typeof window !== "undefined" && createPortal(
        <div className="fixed bottom-6 right-6 z-[99999] flex flex-col gap-2 items-end">
          <AnimatePresence mode="popLayout">
            {toasts.map((t) => (
              <ToastItem key={t.id} toast={t} onDismiss={dismiss} />
            ))}
          </AnimatePresence>
        </div>,
        document.body
      )}
    </ToastContext.Provider>
  );
}
