import { getRuntimeCatalog } from "@/lib/game/event-catalog";
import type { OriginId } from "@/lib/game/schemas";

type ChapterTimelineProps = {
  originId: OriginId;
  contentVersion?: string;
  currentEventId: string | null;
  completedEventIds?: string[];
  turn?: number;
};

export function ChapterTimeline({
  originId,
  contentVersion = "11.0.0",
  currentEventId,
  completedEventIds = [],
  turn = 0,
}: ChapterTimelineProps) {
  const events = getRuntimeCatalog(contentVersion).events
    .filter((event) => event.originIds.includes(originId));
  const currentIndex = Math.max(0, events.findIndex((event) => event.eventId === currentEventId));
  const chapterId = events[currentIndex]?.chapterId ?? events[0]?.chapterId ?? "unavailable";

  return (
    <section className="chapter-timeline" aria-labelledby="chapter-timeline-title">
      <header>
        <div>
          <span className="eyebrow">CHAPTER STATE · TURN {String(turn).padStart(2, "0")}</span>
          <h2 id="chapter-timeline-title">{chapterId}</h2>
        </div>
        <p><strong>{completedEventIds.length}</strong> / {events.length} 个事件已进入个人记录</p>
      </header>
      <ol>
        {events.map((event, index) => {
          const completed = completedEventIds.includes(event.eventId);
          const current = event.eventId === currentEventId || (!currentEventId && index === 0);
          const status = completed ? "completed" : current ? "current" : index < currentIndex ? "passed" : "upcoming";
          return (
            <li key={event.eventId} className={status} aria-current={current ? "step" : undefined}>
              <span aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>
              <div>
                <strong>{event.title}</strong>
                <small>{completed ? "已提交" : current ? "当前事件" : "尚未进入"}</small>
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
