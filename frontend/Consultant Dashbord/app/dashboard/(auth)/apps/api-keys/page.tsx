import { generateMeta } from "@/lib/utils";
import { promises as fs } from "fs";
import path from "path";
import ApiKeysDataTable from "./components/datatable";
import UpgradePlanCard from "./components/upgrade-plan-card";
import SuccessfulConversionsCard from "./components/successful-conversions-card";
import FailedConversionsCard from "./components/failed-conversions-card";
import ApiCallsCard from "./components/api-calls-card";

export async function generateMetadata() {
  return generateMeta({
    title: "Api Keys",
    additionalTitle: true,
    description:
      "Securely manage API keys, track usage analytics, and monitor conversion success rates with real-time metrics. A professional API management dashboard built with React, Next.js, TypeScript, Tailwind CSS, and shadcn/ui.",
    canonical: "/apps/api-keys"
  });
}

async function getApiKeys() {
  const data = await fs.readFile(
    path.join(process.cwd(), "app/dashboard/(auth)/apps/api-keys/data.json")
  );
  return JSON.parse(data.toString());
}

export default async function Page() {
  const apiKeys = await getApiKeys();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between space-y-2">
        <h1 className="text-2xl font-bold tracking-tight">Api Keys Management</h1>
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <UpgradePlanCard />
        <SuccessfulConversionsCard />
        <FailedConversionsCard />
        <ApiCallsCard />
      </div>
      <ApiKeysDataTable data={apiKeys} />
    </div>
  );
}
