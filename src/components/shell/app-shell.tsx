import { Sidebar } from "./sidebar";
import { Topbar } from "./topbar";
import { BottomTabs } from "./bottom-tabs";
import { CommandMenu } from "./command-menu";

/** Server component: composes the three client nav leaves around server-rendered
 *  page children. Kept server so {children} (RSC pages that call auth() from P4)
 *  are never dragged into the client bundle. */
export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-svh">
      <Sidebar />
      <div className="lg:pl-[264px]">
        <Topbar />
        <main className="mx-auto w-full max-w-6xl px-5 pb-28 pt-8 lg:px-8 lg:pb-16">
          {children}
        </main>
      </div>
      <BottomTabs />
      <CommandMenu />
    </div>
  );
}
