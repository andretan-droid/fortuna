/** Decoupled open-signal for the ⌘K command palette. Any client component can
 *  call openCommandMenu(); CommandMenu (mounted once in AppShell) listens. */
export const COMMAND_EVENT = "fortuna:open-command";

export function openCommandMenu() {
  window.dispatchEvent(new Event(COMMAND_EVENT));
}
