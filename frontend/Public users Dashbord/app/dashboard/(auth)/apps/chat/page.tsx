import { generateMeta } from "@/lib/utils";
import path from "path";
import { promises as fs } from "fs";
import { ChatItemProps, UserPropsTypes } from "./types";

import { ChatSidebar, ChatContent } from "./components";

export async function generateMetadata() {
  return generateMeta({
    title: "Chat App",
    additionalTitle: true,
    description:
      "Manage real-time conversations, media sharing, and contact lists with a modern messaging ui. A professional chat application page built with React, Next.js, TypeScript, Tailwind CSS, and shadcn/ui.",
    canonical: "/apps/chat"
  });
}

async function getChats() {
  const data = await fs.readFile(
    path.join(process.cwd(), "app/dashboard/(auth)/apps/chat/data/chats.json")
  );
  return JSON.parse(data.toString());
}

async function getChatUser(id: number) {
  const data = await fs.readFile(
    path.join(process.cwd(), "app/dashboard/(auth)/apps/chat/data/contacts.json")
  );

  return JSON.parse(data.toString()).find((item: UserPropsTypes) => item.id === id);
}

export default async function Page() {
  const chats = await getChats();

  const chats_with_user = await Promise.all(
    chats.map(async (item: ChatItemProps) => {
      item.user = await getChatUser(item.user_id);
      return item;
    })
  );

  return (
    <div className="flex h-[calc(100vh-var(--header-height)-3rem)] w-full">
      <ChatSidebar chats={chats_with_user} />
      <div className="grow">
        <ChatContent />
      </div>
    </div>
  );
}
