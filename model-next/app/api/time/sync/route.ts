// app/api/time/sync/route.ts
// Edge-runtime SNTP server endpoint.
// Clients ping this to compute their clock offset via Cristian's algorithm.
//
// Precision: Date.now() is ms-resolution. Under Spectre mitigations in
// modern browsers/Node, clamping can coarsen to 1-2ms. This is acceptable
// given our 350ms scheduling lead-time window. Do NOT assume sub-ms accuracy.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json(
    {
      serverEpochMs: Date.now(),
      // ms-clamped: reflects actual Date.now() resolution, not microseconds.
      serverPrecision: "ms-clamped",
    },
    {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate",
        Pragma: "no-cache",
        "X-Content-Type-Options": "nosniff",
      },
    }
  );
}
