import { Separator } from "@/components/ui/separator";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ToolbarProvider } from "./toolbar-provider";
import { Editor } from "@tiptap/core";
import { BoldToolbar } from "./bold";
import { ItalicToolbar } from "./italic";
import { UnderlineToolbar } from "./underline";
import { StrikeThroughToolbar } from "./strikethrough";
import { LinkToolbar } from "./link";
import { BulletListToolbar } from "./bullet-list";
import { OrderedListToolbar } from "./ordered-list";
import { UndoToolbar } from "./undo";
import { RedoToolbar } from "./redo";

function BasicToolbarButtons() {
  return (
    <>
      <BoldToolbar />
      <ItalicToolbar />
      <UnderlineToolbar />
      <StrikeThroughToolbar />
      <LinkToolbar />
      <Separator orientation="vertical" className="mx-1 h-7" />
      <BulletListToolbar />
      <OrderedListToolbar />
    </>
  );
}

export const EditorToolbarBasic = ({ editor }: { editor: Editor }) => {
  return (
    <>
      <div className="bg-background sticky top-0 z-20 hidden w-full border-b sm:block">
        <ToolbarProvider editor={editor}>
          <TooltipProvider>
            <ScrollArea className="h-fit py-0.5">
              <div>
                <div className="flex items-center gap-1 px-2">
                  <BasicToolbarButtons />
                </div>
              </div>
              <ScrollBar className="hidden" orientation="horizontal" />
            </ScrollArea>
          </TooltipProvider>
        </ToolbarProvider>
      </div>

      <div className="bg-background fixed inset-x-0 bottom-0 z-30 border-t pb-[env(safe-area-inset-bottom)] sm:hidden">
        <ToolbarProvider editor={editor}>
          <TooltipProvider>
            <ScrollArea className="w-full">
              <div className="flex items-center gap-0.5 px-2 py-2">
                <UndoToolbar />
                <RedoToolbar />
                <Separator orientation="vertical" className="mx-0.5 h-7" />
                <BasicToolbarButtons />
              </div>
              <ScrollBar orientation="horizontal" />
            </ScrollArea>
          </TooltipProvider>
        </ToolbarProvider>
      </div>
    </>
  );
};
