import { useState } from "react";
import { LogOut, Pencil, Check, ChevronDown } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { signOut } from "@/lib/auth";
import { AVATAR_COLORS, loadPrefs, savePrefs, type ProfilePrefs } from "@/lib/profile-prefs";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export default function Header({ title }: { title?: string }) {
  const { user, profile } = useAuth();
  const uid = user!.id;
  const [prefs, setPrefs] = useState<ProfilePrefs>(() => loadPrefs(uid));
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [nameInput, setNameInput] = useState("");

  const name = prefs.displayName || profile?.display_name || "사용자";
  const initial = name.trim().charAt(0).toUpperCase() || "?";

  const update = (patch: Partial<ProfilePrefs>) => {
    const next = { ...prefs, ...patch };
    setPrefs(next);
    savePrefs(uid, next);
  };

  const startEdit = () => {
    setNameInput(name);
    setEditing(true);
  };
  const saveName = () => {
    update({ displayName: nameInput.trim() || undefined });
    setEditing(false);
  };

  return (
    <header className="flex items-center border-b bg-background px-6 py-3">
      {title && <h2 className="text-sm font-semibold text-muted-foreground">{title}</h2>}
      <div className="relative ml-auto">
        <button
          onClick={() => setOpen((o) => !o)}
          className="flex items-center gap-2 rounded-full py-1 pl-1 pr-2 hover:bg-accent"
        >
          <span
            className="flex size-8 items-center justify-center rounded-full text-sm font-semibold text-white"
            style={{ backgroundColor: prefs.avatarColor }}
          >
            {initial}
          </span>
          <span className="text-sm font-medium">{name}</span>
          <ChevronDown className="size-4 text-muted-foreground" />
        </button>

        {open && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
            <div className="absolute right-0 z-50 mt-2 w-64 rounded-xl border bg-background p-3 shadow-lg">
              <div className="mb-3 flex items-center gap-3">
                <span
                  className="flex size-10 items-center justify-center rounded-full text-base font-semibold text-white"
                  style={{ backgroundColor: prefs.avatarColor }}
                >
                  {initial}
                </span>
                {editing ? (
                  <div className="flex flex-1 items-center gap-1">
                    <Input
                      value={nameInput}
                      onChange={(e) => setNameInput(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && saveName()}
                      autoFocus
                      className="h-8"
                    />
                    <button onClick={saveName} className="rounded p-1 hover:bg-accent" title="저장">
                      <Check className="size-4" />
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-1 items-center justify-between">
                    <span className="font-medium">{name}</span>
                    <button onClick={startEdit} className="rounded p-1 text-muted-foreground hover:bg-accent" title="이름 편집">
                      <Pencil className="size-4" />
                    </button>
                  </div>
                )}
              </div>

              <div className="mb-1 text-xs text-muted-foreground">프로필 색상</div>
              <div className="mb-3 flex flex-wrap gap-2">
                {AVATAR_COLORS.map((c) => (
                  <button
                    key={c}
                    onClick={() => update({ avatarColor: c })}
                    className={cn(
                      "flex size-7 items-center justify-center rounded-full ring-offset-2 transition",
                      prefs.avatarColor === c && "ring-2 ring-foreground",
                    )}
                    style={{ backgroundColor: c }}
                    title={c}
                  >
                    {prefs.avatarColor === c && <Check className="size-4 text-white" />}
                  </button>
                ))}
              </div>

              <button
                onClick={() => signOut()}
                className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-sm text-destructive hover:bg-accent"
              >
                <LogOut className="size-4" /> 로그아웃
              </button>
            </div>
          </>
        )}
      </div>
    </header>
  );
}
