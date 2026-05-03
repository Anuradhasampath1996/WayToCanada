import { generateMeta } from "@/lib/utils";
import { promises as fs } from "fs";
import path from "path";

import Tasks from "./components/tasks";

async function getTasks() {
  const data = await fs.readFile(
    path.join(process.cwd(), "app/dashboard/(auth)/apps/todo-list-app/data/tasks.json")
  );
  return JSON.parse(data.toString());
}

export async function generateMetadata() {
  return generateMeta({
    title: "Todo List App",
    additionalTitle: true,
    description:
      "Organize daily tasks, categorize activities, and manage priorities with a clean, multi-pane to-do list ui featuring detailed task views. A professional productivity app built with React, Next.js, TypeScript, Tailwind CSS, and shadcn/ui.",
    canonical: "/apps/todo-list-app"
  });
}

export default async function Page() {
  const tasks = await getTasks();

  return <Tasks tasks={tasks} />;
}
