import { useState } from "react";
import { ChevronLeft, ChevronRight, Plus, Trash2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

// ponytail: 수업 일정 localStorage 저장. 멀티기기/학생 공유 필요하면 classes 테이블로 이관.
interface CalEvent {
  id: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:MM ("" 가능)
  title: string;
  color: string;
}

const CAL_COLORS = ["#3b82f6", "#22c55e", "#f97316", "#8b5cf6", "#ef4444", "#06b6d4"];
const WD = ["일", "월", "화", "수", "목", "금", "토"];

const pad = (n: number) => String(n).padStart(2, "0");
const fmt = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const startOfWeek = (d: Date) => addDays(d, -d.getDay());
const sameDay = (a: string, b: string) => a === b;
const TODAY = fmt(new Date());

function load(uid: string): CalEvent[] {
  try {
    const raw = localStorage.getItem(`flowpy:calendar:${uid}`);
    if (raw) return JSON.parse(raw) as CalEvent[];
  } catch {
    /* noop */
  }
  return [];
}

/** 오늘 등록된 수업 개수. 대시보드 인사말 카드에서 재사용. */
export function todayEventCount(uid: string): number {
  return load(uid).filter((e) => e.date === TODAY).length;
}

/** 이번 주 시간표 항목(요일/시간/제목). 반 관리 화면에서 수업 시간 가져오기용. */
export function currentWeekSchedule(uid: string): { dayOfWeek: number; time: string; title: string }[] {
  const start = startOfWeek(new Date());
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));
  const byDate = new Map(days.map((d) => [fmt(d), d.getDay()]));
  return load(uid)
    .filter((e) => byDate.has(e.date) && e.time)
    .map((e) => ({ dayOfWeek: byDate.get(e.date)!, time: e.time, title: e.title }))
    .sort((a, b) => a.dayOfWeek - b.dayOfWeek || a.time.localeCompare(b.time));
}

export default function ScheduleCalendar({ className }: { className?: string }) {
  const { user } = useAuth();
  const uid = user!.id;
  const [events, setEvents] = useState<CalEvent[]>(() => load(uid));
  const [view, setView] = useState<"week" | "month">("week");
  const [cursor, setCursor] = useState(new Date());
  const [draft, setDraft] = useState<CalEvent | null>(null);

  const persist = (next: CalEvent[]) => {
    setEvents(next);
    localStorage.setItem(`flowpy:calendar:${uid}`, JSON.stringify(next));
  };
  const eventsOn = (date: string) =>
    events.filter((e) => sameDay(e.date, date)).sort((a, b) => a.time.localeCompare(b.time));

  const openNew = (date: string) => setDraft({ id: "", date, time: "", title: "", color: CAL_COLORS[0] });
  const save = () => {
    if (!draft || !draft.title.trim()) return;
    const next = draft.id
      ? events.map((e) => (e.id === draft.id ? draft : e))
      : [...events, { ...draft, id: crypto.randomUUID() }];
    persist(next);
    setDraft(null);
  };
  const remove = () => {
    if (!draft) return;
    persist(events.filter((e) => e.id !== draft.id));
    setDraft(null);
  };

  const step = (dir: number) =>
    setCursor((c) =>
      view === "week" ? addDays(c, dir * 7) : new Date(c.getFullYear(), c.getMonth() + dir, 1),
    );

  const label =
    view === "week"
      ? `${cursor.getFullYear()}년 ${cursor.getMonth() + 1}월`
      : `${cursor.getFullYear()}년 ${cursor.getMonth() + 1}월`;

  return (
    <div className={cn("flex flex-col rounded-xl border bg-card p-4 shadow-sm", className)}>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className="text-sm font-semibold">수업 시간표</span>
        <span className="ml-1 text-sm text-muted-foreground">{label}</span>
        <div className="ml-auto flex items-center gap-1">
          <button className="rounded p-1 hover:bg-accent" onClick={() => step(-1)}>
            <ChevronLeft className="size-4" />
          </button>
          <button className="rounded px-2 py-1 text-xs hover:bg-accent" onClick={() => setCursor(new Date())}>
            오늘
          </button>
          <button className="rounded p-1 hover:bg-accent" onClick={() => step(1)}>
            <ChevronRight className="size-4" />
          </button>
          <div className="ml-2 flex overflow-hidden rounded-lg border text-xs">
            {(["week", "month"] as const).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={cn("px-3 py-1", view === v ? "bg-primary text-primary-foreground" : "hover:bg-accent")}
              >
                {v === "week" ? "1주일" : "30일"}
              </button>
            ))}
          </div>
        </div>
      </div>

      {view === "week" ? (
        <WeekView cursor={cursor} eventsOn={eventsOn} onAdd={openNew} onEdit={setDraft} />
      ) : (
        <MonthView cursor={cursor} eventsOn={eventsOn} onAdd={openNew} onEdit={setDraft} />
      )}

      <Dialog open={!!draft} onOpenChange={(o) => !o && setDraft(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{draft?.id ? "수업 편집" : "수업 추가"}</DialogTitle>
          </DialogHeader>
          {draft && (
            <div className="space-y-3">
              <Input
                placeholder="수업 이름"
                value={draft.title}
                autoFocus
                onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                onKeyDown={(e) => e.key === "Enter" && save()}
              />
              <div className="flex gap-2">
                <input
                  type="date"
                  value={draft.date}
                  onChange={(e) => setDraft({ ...draft, date: e.target.value })}
                  className="flex h-9 flex-1 rounded-md border border-input bg-background px-3 text-sm"
                />
                <input
                  type="time"
                  value={draft.time}
                  onChange={(e) => setDraft({ ...draft, time: e.target.value })}
                  className="flex h-9 rounded-md border border-input bg-background px-3 text-sm"
                />
              </div>
              <div className="flex gap-2">
                {CAL_COLORS.map((c) => (
                  <button
                    key={c}
                    onClick={() => setDraft({ ...draft, color: c })}
                    className={cn("size-6 rounded-full", draft.color === c && "ring-2 ring-foreground ring-offset-2")}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
              <div className="flex justify-between pt-1">
                {draft.id ? (
                  <Button variant="ghost" size="sm" className="text-destructive" onClick={remove}>
                    <Trash2 className="size-4" /> 삭제
                  </Button>
                ) : (
                  <span />
                )}
                <Button size="sm" onClick={save} disabled={!draft.title.trim()}>
                  저장
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

interface ViewProps {
  cursor: Date;
  eventsOn: (date: string) => CalEvent[];
  onAdd: (date: string) => void;
  onEdit: (e: CalEvent) => void;
}

function Chip({ e, onEdit }: { e: CalEvent; onEdit: (e: CalEvent) => void }) {
  return (
    <button
      onClick={(ev) => {
        ev.stopPropagation();
        onEdit(e);
      }}
      className="flex w-full items-center gap-1 truncate rounded px-1.5 py-0.5 text-left text-xs text-white"
      style={{ backgroundColor: e.color }}
      title={`${e.time} ${e.title}`}
    >
      {e.time && <span className="opacity-90">{e.time}</span>}
      <span className="truncate">{e.title}</span>
    </button>
  );
}

function WeekView({ cursor, eventsOn, onAdd, onEdit }: ViewProps) {
  const start = startOfWeek(cursor);
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));
  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(119px,1fr))] gap-2">
      {days.map((d) => {
        const ds = fmt(d);
        return (
          <div
            key={ds}
            onClick={() => onAdd(ds)}
            className={cn(
              "group flex min-h-[120px] cursor-pointer flex-col gap-1 rounded-lg border p-1.5",
              ds === TODAY && "border-primary bg-primary/5",
            )}
          >
            <div className="flex items-center justify-between text-xs">
              <span className={cn("font-medium", d.getDay() === 0 && "text-destructive")}>
                {WD[d.getDay()]} {d.getDate()}
              </span>
              <Plus className="size-3 text-muted-foreground opacity-0 group-hover:opacity-100" />
            </div>
            {eventsOn(ds).map((e) => (
              <Chip key={e.id} e={e} onEdit={onEdit} />
            ))}
          </div>
        );
      })}
    </div>
  );
}

function MonthView({ cursor, eventsOn, onAdd, onEdit }: ViewProps) {
  const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
  const gridStart = startOfWeek(first);
  const cells = Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));
  const month = cursor.getMonth();
  return (
    <div>
      <div className="mb-1 grid grid-cols-7 text-center text-xs text-muted-foreground">
        {WD.map((w, i) => (
          <div key={w} className={cn(i === 0 && "text-destructive")}>
            {w}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((d) => {
          const ds = fmt(d);
          const dim = d.getMonth() !== month;
          const list = eventsOn(ds);
          return (
            <div
              key={ds}
              onClick={() => onAdd(ds)}
              className={cn(
                "group flex min-h-[84px] cursor-pointer flex-col gap-0.5 rounded-lg border p-1 text-xs",
                dim && "bg-muted/30 text-muted-foreground",
                ds === TODAY && "border-primary bg-primary/5",
              )}
            >
              <span className={cn("font-medium", d.getDay() === 0 && !dim && "text-destructive")}>{d.getDate()}</span>
              {list.slice(0, 3).map((e) => (
                <Chip key={e.id} e={e} onEdit={onEdit} />
              ))}
              {list.length > 3 && <span className="text-[10px] text-muted-foreground">+{list.length - 3}개</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
