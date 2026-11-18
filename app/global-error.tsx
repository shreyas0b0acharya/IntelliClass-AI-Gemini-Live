"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html>
      <body className="flex min-h-screen flex-col items-center justify-center p-4 text-center">
        <h2 className="text-xl font-bold">Something went wrong!</h2>
        <p className="text-sm text-gray-500 mt-2">{error.message}</p>
        <button
          onClick={() => reset()}
          className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-md text-sm"
        >
          Try again
        </button>
      </body>
    </html>
  );
}
