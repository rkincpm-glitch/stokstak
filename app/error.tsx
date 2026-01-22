"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // eslint-disable-next-line no-console
    console.error(error);
  }, [error]);

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
      <div className="max-w-lg w-full bg-white border rounded-xl shadow-sm p-6">
        <h1 className="text-lg font-semibold text-slate-900">Something went wrong</h1>
        <p className="text-sm text-slate-600 mt-2">
          An unexpected error occurred. You can try again.
        </p>
        <div className="mt-4 flex gap-2">
          <button
            onClick={() => reset()}
            className="px-3 py-2 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700"
          >
            Retry
          </button>
          <a
            href="/"
            className="px-3 py-2 rounded-lg border text-sm text-slate-700 hover:bg-slate-50"
          >
            Go home
          </a>
        </div>
        <div className="mt-4 text-xs text-slate-400">
          {error.digest ? `Digest: ${error.digest}` : null}
        </div>
      </div>
    </div>
  );
}
