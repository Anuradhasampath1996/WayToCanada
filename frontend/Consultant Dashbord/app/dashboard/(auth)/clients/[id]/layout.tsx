import { ClientQuickToolsLayout } from "./client-quick-tools-layout";

export default function ClientIdLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  return (
    <ClientQuickToolsLayout paramsPromise={params}>
      {children}
    </ClientQuickToolsLayout>
  );
}
