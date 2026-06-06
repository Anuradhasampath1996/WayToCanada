import { ClientProfilePageClient } from "./client-profile-client";

export default function ClientProfilePage({ params }: { params: Promise<{ id: string }> }) {
  return <ClientProfilePageClient paramsPromise={params} />;
}
