"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Modal shell ─────────────────────────────────────────────────────────────

interface ModalProps {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: React.ReactNode;
  width?: string;
}

export function Modal({ title, subtitle, onClose, children, width = "max-w-lg" }: ModalProps) {
  const [mounted, setMounted] = useState(false);

  // Wait for client mount before portalling
  useEffect(() => { setMounted(true); }, []);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  // Prevent body scroll
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  if (!mounted) return null;

  // Portal renders directly on document.body — escapes ALL parent stacking contexts
  return createPortal(
    <div
      className="fixed z-[9999] overflow-y-auto"
      style={{ inset: 0, paddingLeft: "220px" }}
    >
      {/* Backdrop */}
      <div
        className="fixed bg-stone-900/50 backdrop-blur-[2px]"
        style={{ inset: 0, zIndex: -1 }}
        onClick={onClose}
      />

      {/* Scroll container — centres panel, allows tall modals to scroll */}
      <div className="flex items-center justify-center min-h-full p-6">
        {/* Panel */}
        <div className={cn("relative bg-white rounded-2xl shadow-2xl w-full flex flex-col", width)}>
          {/* Header */}
          <div className="flex items-start justify-between px-6 pt-5 pb-4 border-b border-stone-100 flex-shrink-0">
            <div>
              <h2 className="text-[15px] font-semibold text-stone-900" style={{ letterSpacing: "-0.02em" }}>
                {title}
              </h2>
              {subtitle && <p className="text-[12px] text-stone-400 mt-0.5">{subtitle}</p>}
            </div>
            <button
              onClick={onClose}
              className="w-7 h-7 rounded-lg flex items-center justify-center text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition-colors ml-4 mt-0.5 flex-shrink-0"
            >
              <X size={14} />
            </button>
          </div>

          {/* Body */}
          <div className="px-6 py-5">
            {children}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

// ─── Form primitives ─────────────────────────────────────────────────────────

const labelCls = "block text-[11px] font-medium text-stone-500 uppercase tracking-wider mb-1.5";
const inputCls = "w-full px-3 py-2 text-[13.5px] text-stone-800 border border-stone-200 rounded-lg bg-white placeholder-stone-300 focus:outline-none focus:ring-1 focus:ring-stone-400 focus:border-stone-400 transition-colors";
const errorCls = "text-[11px] text-red-500 mt-1";

export function FormField({
  label,
  error,
  required,
  children,
}: {
  label: string;
  error?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className={labelCls}>
        {label}
        {required && <span className="text-red-400 ml-0.5">*</span>}
      </label>
      {children}
      {error && <p className={errorCls}>{error}</p>}
    </div>
  );
}

export function Input(props: React.InputHTMLAttributes<HTMLInputElement> & { error?: boolean }) {
  const { error, className, ...rest } = props;
  return (
    <input
      className={cn(inputCls, error && "border-red-300 focus:ring-red-300 focus:border-red-300", className)}
      {...rest}
    />
  );
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement> & { error?: boolean }) {
  const { error, className, ...rest } = props;
  return (
    <select
      className={cn(inputCls, "cursor-pointer", error && "border-red-300 focus:ring-red-300 focus:border-red-300", className)}
      {...rest}
    />
  );
}

export function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement> & { error?: boolean }) {
  const { error, className, ...rest } = props;
  return (
    <textarea
      rows={3}
      className={cn(inputCls, "resize-none", error && "border-red-300 focus:ring-red-300 focus:border-red-300", className)}
      {...rest}
    />
  );
}

// ─── Modal footer (actions row) ───────────────────────────────────────────────

export function ModalFooter({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-end gap-2 pt-4 mt-2 border-t border-stone-100">
      {children}
    </div>
  );
}

export function BtnSecondary({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      className="px-4 py-2 text-[13px] font-medium text-stone-600 border border-stone-200 rounded-lg hover:bg-stone-50 transition-colors disabled:opacity-50"
      {...props}
    >
      {children}
    </button>
  );
}

export function BtnPrimary({ children, loading, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { loading?: boolean }) {
  return (
    <button
      type="button"
      className="px-4 py-2 text-[13px] font-medium text-white bg-stone-900 rounded-lg hover:bg-stone-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
      disabled={loading || props.disabled}
      {...props}
    >
      {loading && (
        <svg className="animate-spin h-3.5 w-3.5 text-white" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      )}
      {children}
    </button>
  );
}

export function BtnDanger({ children, loading, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { loading?: boolean }) {
  return (
    <button
      type="button"
      className="px-4 py-2 text-[13px] font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
      disabled={loading || props.disabled}
      {...props}
    >
      {loading && (
        <svg className="animate-spin h-3.5 w-3.5 text-white" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      )}
      {children}
    </button>
  );
}

// ─── Inline error banner ──────────────────────────────────────────────────────

export function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="px-3 py-2.5 bg-red-50 border border-red-200 rounded-lg text-[12.5px] text-red-700 mb-4">
      {message}
    </div>
  );
}

// ─── 2-col grid helper ────────────────────────────────────────────────────────

export function FormGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-2 gap-4">{children}</div>;
}

export function FormStack({ children }: { children: React.ReactNode }) {
  return <div className="space-y-4">{children}</div>;
}
