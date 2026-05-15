import { permanentRedirect } from "next/navigation";

interface DispatchesPageProps {
  params: Promise<{ orgSlug: string }>;
}

/**
 * /dispatches list page — RETIREMENT shim. 308 permanent redirect to /sales
 * (URL consolidation per poc-dispatch-retirement-into-sales D3). Detail
 * route /dispatches/[dispatchId] and create route /dispatches/new
 * PRESERVED. No data fetch.
 */
export default async function DispatchesPage({ params }: DispatchesPageProps) {
  const { orgSlug } = await params;
  permanentRedirect(`/${orgSlug}/sales`);
}
