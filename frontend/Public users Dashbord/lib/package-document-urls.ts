import { CLIENT_API } from "@/lib/client-api";

export function packageDocumentStreamUrl(
  documentId: number,
  submitted = false,
): string {
  if (submitted) {
    return `${CLIENT_API}/client/package-documents/${documentId}/submission/stream`;
  }
  return `${CLIENT_API}/client/package-documents/${documentId}/stream`;
}
