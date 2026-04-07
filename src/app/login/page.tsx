"use client";

import { useActionState } from "react";
import { Boxes, LogIn } from "lucide-react";
import { signIn } from "./actions";

export default function LoginPage() {
  const [state, action, pending] = useActionState(signIn, null);

  return (
    <div className="min-h-screen flex">
      {/* Left panel — brand */}
      <div
        className="hidden md:flex flex-col justify-between w-[420px] flex-shrink-0 p-10"
        style={{ background: "#415445" }}
      >
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: "#C04F28" }}>
            <Boxes size={17} className="text-white" />
          </div>
          <div>
            <p className="text-white font-bold leading-tight" style={{ fontSize: 16, letterSpacing: "-0.03em" }}>IT Asset Desk</p>
            <p className="leading-tight" style={{ fontSize: 10, color: "#859474" }}>by ISIBAG</p>
          </div>
        </div>

        <div>
          <h2 className="text-white font-semibold mb-3" style={{ fontSize: 26, letterSpacing: "-0.04em", lineHeight: 1.2 }}>
            Your IT assets,<br />always in view.
          </h2>
          <p style={{ fontSize: 13, color: "#C9D9A0", lineHeight: 1.6 }}>
            Track, assign, and manage every device, license, and piece of equipment across your organisation — all in one place.
          </p>
        </div>

        <p style={{ fontSize: 11, color: "#859474" }}>© {new Date().getFullYear()} ISIBAG · IT Asset Desk</p>
      </div>

      {/* Right panel — form */}
      <div className="flex-1 flex items-center justify-center p-6 bg-stone-50">
        <div className="w-full max-w-sm fade-up">
          {/* Mobile brand */}
          <div className="flex items-center gap-2.5 mb-8 md:hidden">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: "#C04F28" }}>
              <Boxes size={14} className="text-white" />
            </div>
            <p className="font-bold" style={{ fontSize: 15, color: "#415445", letterSpacing: "-0.03em" }}>IT Asset Desk</p>
          </div>

          <h1 className="text-stone-900 font-semibold mb-1" style={{ fontSize: 22, letterSpacing: "-0.03em" }}>
            Welcome back
          </h1>
          <p className="text-stone-400 mb-7" style={{ fontSize: 13 }}>
            Sign in to your account
          </p>

          {state?.error && (
            <div className="mb-5 px-3.5 py-3 bg-red-50 border border-red-200 rounded-xl text-[12.5px] text-red-700">
              {state.error}
            </div>
          )}

          <form action={action} className="space-y-4">
            <div>
              <label className="block text-stone-500 font-medium uppercase tracking-wider mb-1.5" style={{ fontSize: 11 }}>
                Email
              </label>
              <input
                name="email"
                type="email"
                required
                autoComplete="email"
                placeholder="you@company.com"
                className="w-full px-3.5 py-2.5 text-stone-800 border border-stone-200 rounded-xl bg-white placeholder-stone-300 focus:outline-none focus:border-stone-400 transition-colors"
                style={{ fontSize: 13.5 }}
              />
            </div>

            <div>
              <label className="block text-stone-500 font-medium uppercase tracking-wider mb-1.5" style={{ fontSize: 11 }}>
                Password
              </label>
              <input
                name="password"
                type="password"
                required
                autoComplete="current-password"
                placeholder="••••••••"
                className="w-full px-3.5 py-2.5 text-stone-800 border border-stone-200 rounded-xl bg-white placeholder-stone-300 focus:outline-none focus:border-stone-400 transition-colors"
                style={{ fontSize: 13.5 }}
              />
            </div>

            <button
              type="submit"
              disabled={pending}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 font-medium text-white rounded-xl mt-2 btn-press disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
              style={{ fontSize: 13.5, background: pending ? "#a8431f" : "#C04F28" }}
            >
              {pending ? (
                <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              ) : (
                <LogIn size={14} />
              )}
              {pending ? "Signing in…" : "Sign in"}
            </button>
          </form>

          <p className="text-center text-stone-400 mt-6" style={{ fontSize: 11 }}>
            Contact your administrator to get access.
          </p>
        </div>
      </div>
    </div>
  );
}
