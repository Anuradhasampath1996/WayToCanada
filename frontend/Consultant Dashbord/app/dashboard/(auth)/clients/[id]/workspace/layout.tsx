import { WorkspaceCaseLifecycleFooter } from "./workspace-case-lifecycle-footer";

export default async function WorkspaceLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <div className="min-w-0 w-full space-y-4 pb-4 sm:space-y-6 sm:pb-6">
      {children}
      <WorkspaceCaseLifecycleFooter profileId={id} />
    </div>
  );
}
