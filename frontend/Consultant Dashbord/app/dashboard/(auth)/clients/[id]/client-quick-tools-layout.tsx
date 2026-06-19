"use client";

import { use } from "react";
import { WorkspaceQuickToolsRail } from "./workspace/workspace-quick-tools-rail";

export function ClientQuickToolsLayout({
  children,
  paramsPromise,
}: {
  children: React.ReactNode;
  paramsPromise: Promise<{ id: string }>;
}) {
  const { id } = use(paramsPromise);
  const clientId = Number(id);

  return (
    <>
      {children}
      {Number.isFinite(clientId) && clientId > 0 && (
        <WorkspaceQuickToolsRail clientId={clientId} />
      )}
    </>
  );
}
