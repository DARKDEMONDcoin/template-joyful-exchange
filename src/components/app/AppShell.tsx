import { useEffect, useState, type ReactNode } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { Portrait } from "@/components/site/Portrait";
import {
  LayoutDashboard,
  MessagesSquare,
  CheckCheck,
  ListChecks,
  CalendarClock,
  CalendarDays,
  LineChart,
  FileBarChart,
  BrainCircuit,
  Plug,
  Settings,
  Send,
  Plane,
  Radar,
  ChevronDown,
  Bell,
  Menu,
  X,
} from "lucide-react";

import { team } from "@/data/team";
import { supabase } from "@/integrations/supabase/client";
import { GUEST_EMAIL } from "@/lib/guest.functions";

import { useProfile, useTasks, useWorkspace } from "@/lib/data";
import { cn } from "@/lib/utils";

/** الأساسي دائماً ظاهر؛ الباقي خلف «المزيد» حتى تبقى الواجهة هادئة. */
const primaryNav = [
  { to: "/app", label: "النظرة العامة", icon: LayoutDashboard },
  { to: "/app/chat", label: "المحادثات", icon: MessagesSquare },
  { to: "/app/approvals", label: "الموافقات", icon: CheckCheck },
  { to: "/app/calendar", label: "تقويم المحتوى", icon: CalendarDays },
  { to: "/app/queue", label: "طابور النشر", icon: Send },
] as const;

const secondaryNav = [
  { to: "/app/autopilot", label: "الطيار الآلي", icon: Plane },
  { to: "/app/automations", label: "الجدولة التلقائية", icon: CalendarClock },
  { to: "/app/tasks", label: "المهام", icon: ListChecks },
  { to: "/app/discovery", label: "كشف العلامة", icon: Radar },
  { to: "/app/rankings", label: "تتبّع الترتيب", icon: LineChart },
  { to: "/app/reports", label: "التقارير", icon: FileBarChart },
  { to: "/app/brain", label: "عقل العلامة", icon: BrainCircuit },
  { to: "/app/integrations", label: "التكاملات", icon: Plug },
  { to: "/app/settings", label: "الإعدادات", icon: Settings },
] as const;



function WorkspaceCard() {
  const { data: workspace } = useWorkspace();
  return (
    <div className="flex w-full items-center gap-3 rounded-2xl border border-border bg-card p-3 text-start">
      <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-jade font-display text-sm font-black text-background">
        {workspace?.initials ?? "سه"}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-bold">{workspace?.name ?? "مساحة عملك"}</span>
        <span className="block truncate text-xs text-muted-foreground">
          {workspace?.industry ?? "—"}
        </span>
      </span>
    </div>
  );
}

function SidebarBody({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { data: workspace } = useWorkspace();
  const { data: tasks } = useTasks(workspace?.id);
  const pendingCount = (tasks ?? []).filter((t) => t.status === "review").length;
  const inSecondary = secondaryNav.some((i) => pathname.startsWith(i.to));
  const [moreOpen, setMoreOpen] = useState(inSecondary);

  const renderItem = (item: { to: string; label: string; icon: typeof Bell }) => {
    const active = item.to === "/app" ? pathname === "/app" : pathname.startsWith(item.to);
    const badge = item.to === "/app/approvals" ? pendingCount : 0;
    return (
      <Link
        key={item.to}
        to={item.to}
        onClick={onNavigate}
        className={cn(
          "flex items-center gap-3 rounded-2xl px-3.5 py-2.5 text-sm font-bold transition-colors",
          active ? "bg-foreground text-background" : "text-ink-soft hover:bg-secondary",
        )}
      >
        <item.icon className="size-4.5 shrink-0" strokeWidth={2.2} />
        <span className="flex-1">{item.label}</span>
        {badge ? (
          <span
            className={cn(
              "rounded-full px-2 py-0.5 text-[0.7rem] font-black",
              active ? "bg-background/20" : "bg-coral/15 text-coral",
            )}
          >
            {badge}
          </span>
        ) : null}
      </Link>
    );
  };

  return (
    <div className="flex h-full flex-col gap-5 p-5">
      <Link to="/" className="font-display text-2xl font-black tracking-tight">
        سهل<span className="text-jade">.</span>
      </Link>

      <WorkspaceCard />

      <div className="space-y-1.5">
        <p className="px-2 text-xs font-bold text-muted-foreground">فريقك</p>
        {team.map((m) => (
          <Link
            key={m.id}
            to="/app/chat/$id"
            params={{ id: m.id }}
            onClick={onNavigate}
            className={cn(
              "flex items-center gap-2.5 rounded-xl px-2.5 py-2 text-sm transition-colors hover:bg-secondary",
              pathname === `/app/chat/${m.id}` && "bg-secondary",
            )}
          >
            <span className="relative block size-7 shrink-0 overflow-hidden rounded-lg">
              <Portrait memberId={m.id} name={m.name} className="size-full" />
            </span>
            <span className="truncate font-semibold">{m.name}</span>
            <span className="ms-auto size-2 shrink-0 rounded-full bg-jade" />
          </Link>
        ))}
      </div>

      <nav className="space-y-1">
        {primaryNav.map(renderItem)}

        <button
          type="button"
          onClick={() => setMoreOpen((v) => !v)}
          aria-expanded={moreOpen}
          className="flex w-full items-center gap-3 rounded-2xl px-3.5 py-2.5 text-sm font-bold text-ink-soft transition-colors hover:bg-secondary"
        >
          <ChevronDown
            className={cn("size-4.5 shrink-0 transition-transform", moreOpen && "rotate-180")}
            strokeWidth={2.2}
          />
          <span className="flex-1 text-start">{moreOpen ? "أقل" : "المزيد"}</span>
        </button>

        {moreOpen ? <div className="space-y-1">{secondaryNav.map(renderItem)}</div> : null}
      </nav>

      <Link
        to="/pricing"
        className="mt-auto block rounded-xl bg-foreground py-2 text-center text-xs font-bold text-background"
      >
        زد ساعات فريقك
      </Link>
    </div>
  );
}


/** شريط يوضّح أن الجلسة الحالية تجريبية ويقود لإنشاء حساب حقيقي. */
function GuestBar() {
  const [isGuest, setIsGuest] = useState(false);

  useEffect(() => {
    let alive = true;
    void supabase.auth.getUser().then(({ data }) => {
      if (alive) setIsGuest(data.user?.email === GUEST_EMAIL);
    });
    return () => {
      alive = false;
    };
  }, []);

  if (!isGuest) return null;
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-amber/15 px-5 py-3">
      <p className="text-sm font-bold">
        أنت في وضع التجربة — العمل هنا مشترك ولن يُحفظ باسمك.
      </p>
      <Link
        to="/auth"
        search={{ mode: "signup" }}
        className="rounded-full bg-foreground px-4 py-1.5 text-xs font-bold text-background"
      >
        أنشئ حسابك المجاني
      </Link>
    </div>
  );
}

export function AppShell({

  title,
  lead,
  actions,
  children,
  padded = true,
}: {
  title: string;
  lead?: string;
  actions?: ReactNode;
  children: ReactNode;
  padded?: boolean;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { data: profile } = useProfile();
  const initial = (profile?.full_name ?? "ع").trim().charAt(0) || "ع";

  return (
    <div className="min-h-screen bg-background">
      <aside className="fixed inset-y-0 start-0 z-40 hidden w-72 overflow-y-auto border-e border-border bg-card lg:block">
        <SidebarBody />
      </aside>

      {mobileOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            aria-label="إغلاق"
            className="absolute inset-0 bg-foreground/40 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
          />
          <div className="absolute inset-y-0 start-0 w-72 overflow-y-auto bg-card shadow-2xl">
            <SidebarBody onNavigate={() => setMobileOpen(false)} />
          </div>
        </div>
      ) : null}

      <div className="lg:ps-72">
        <header className="sticky top-0 z-30 border-b border-border bg-background/85 backdrop-blur-xl">
          <div className="flex items-center gap-3 px-5 py-4">
            <button
              className="grid size-10 place-items-center rounded-xl border border-border lg:hidden"
              onClick={() => setMobileOpen(true)}
              aria-label="القائمة"
            >
              {mobileOpen ? <X className="size-5" /> : <Menu className="size-5" />}
            </button>
            <div className="min-w-0 flex-1">
              <h1 className="truncate font-display text-xl font-black md:text-2xl">{title}</h1>
              {lead ? <p className="truncate text-sm text-muted-foreground">{lead}</p> : null}
            </div>
            <div className="flex items-center gap-2">
              {actions}
              <Link
                to="/app/approvals"
                className="relative grid size-10 place-items-center rounded-xl border border-border transition-colors hover:bg-secondary"
                aria-label="التنبيهات"
              >
                <Bell className="size-4.5" />
              </Link>
              <span className="grid size-10 place-items-center rounded-xl bg-foreground font-display text-sm font-black text-background">
                {initial}
              </span>
            </div>
          </div>
        </header>
        <GuestBar />
        <main className={padded ? "px-5 py-7" : ""}>{children}</main>

      </div>
    </div>
  );
}
