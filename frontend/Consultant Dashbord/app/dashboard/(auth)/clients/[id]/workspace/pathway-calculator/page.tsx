import { PathwayCalculatorClient } from "./pathway-calculator-client";

export default function PathwayCalculatorPage({ params }: { params: Promise<{ id: string }> }) {
  return <PathwayCalculatorClient paramsPromise={params} />;
}
