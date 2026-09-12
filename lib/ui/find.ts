export const ARCHIVE_FIND_EVENT = "chronokalamos-open-find";

export function requestArchiveFind(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(ARCHIVE_FIND_EVENT));
}
