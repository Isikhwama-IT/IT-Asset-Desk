"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-stone-50 flex items-center justify-center p-6">
        <div className="text-center max-w-sm">
          <div className="w-12 h-12 rounded-2xl bg-red-100 flex items-center justify-center mx-auto mb-4">
            <svg className="w-6 h-6 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
            </svg>
          </div>
          <h1 className="text-[16px] font-semibold text-stone-900 mb-1" style={{ letterSpacing: "-0.02em" }}>
            Something went wrong
          </h1>
          <p className="text-[13px] text-stone-400 mb-5">
            An unexpected error occurred. Please try again.
          </p>
          <button
            onClick={reset}
            className="px-4 py-2 text-[13px] font-medium text-white bg-stone-900 rounded-lg hover:bg-stone-700 transition-colors"
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
