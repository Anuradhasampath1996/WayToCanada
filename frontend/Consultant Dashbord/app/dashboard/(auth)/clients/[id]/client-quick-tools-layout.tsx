"use client";

import { use } from "react";
import { WorkspaceQuickToolsRail } from "./workspace/workspace-quick-tools-rail";

import "../client-workspace-shell.css";

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
    <div className="client-workspace-shell">
      {children}
      {Number.isFinite(clientId) && clientId > 0 && (
        <WorkspaceQuickToolsRail clientId={clientId} />
      )}
    </div>
  );
}
