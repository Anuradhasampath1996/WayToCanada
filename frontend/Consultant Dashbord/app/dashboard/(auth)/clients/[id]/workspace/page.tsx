import { WorkspacePageClient } from "./workspace-client";

export default function WorkspacePage({ params }: { params: Promise<{ id: string }> }) {
  return <WorkspacePageClient paramsPromise={params} />;
}
