import { generateMeta } from "@/lib/utils";
import { promises as fs } from "fs";
import path from "path";

import PosSystemMenu from "./components/pos-system-menu";

export async function generateMetadata() {
  return generateMeta({
    title: "POS System App",
    additionalTitle: true,
    description:
      "Manage table reservations, product orders, and checkout processes with a real-time status tracker and integrated payment options. A professional POS system application built with React, TypeScript, Tailwind CSS, and shadcn/ui.",
    canonical: "/apps/pos-system-app"
  });
}

async function getProductCategories() {
  const data = await fs.readFile(
    path.join(process.cwd(), "app/dashboard/(auth)/apps/pos-system/data/product-categories.json")
  );
  return JSON.parse(data.toString());
}

async function getProducts() {
  const data = await fs.readFile(
    path.join(process.cwd(), "app/dashboard/(auth)/apps/pos-system/data/products.json")
  );
  return JSON.parse(data.toString());
}

async function getTableCategories() {
  const data = await fs.readFile(
    path.join(process.cwd(), "app/dashboard/(auth)/apps/pos-system/data/table-categories.json")
  );
  return JSON.parse(data.toString());
}

async function getTables() {
  const data = await fs.readFile(
    path.join(process.cwd(), "app/dashboard/(auth)/apps/pos-system/data/tables.json")
  );
  return JSON.parse(data.toString());
}

export default async function Page() {
  const productCategories = await getProductCategories();
  const products = await getProducts();
  const tables = await getTables();
  const tableCategories = await getTableCategories();

  return (
    <PosSystemMenu
      productCategories={productCategories}
      products={products}
      tables={tables}
      tableCategories={tableCategories}
    />
  );
}
