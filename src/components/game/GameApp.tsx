import { useEffect, useRef, useState, type FormEvent, type MutableRefObject, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import {
  Box,
  Compass,
  Crosshair,
  Map as MapIcon,
  MessageSquare,
  Pause,
  Play,
  RotateCcw,
  Swords,
  Volume2,
  VolumeX,
} from "lucide-react";
import { COPY, HOTBAR, INV_SIZE, ITEM, RECIPES, SERVERS, type ItemId, type Recipe } from "@/game/data";
import { hasSave, TribalsEngine, countItem } from "@/game/engine";
import { loadSettings, saveSettings, type GameSettings } from "@/game/settings";
import { t, useGameStore } from "@/game/store";
import { UserButton } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { addAdmin, enterServer, getMyProfile, listAdmins, loadProgress, saveProgress, upsertProfile, type Profile } from "@/game/online";
import { MainMenu } from "./MainMenu";

function fmtTime(s: number) {
  const m = Math.floor(s / 60);
  const r = Math.floor(s % 60);
  return `${m}:${r.toString().padStart(2, "0")}`;
}

function compassLetter(yaw: number, lang: "ar" | "en") {
  const deg = ((-yaw * 180) / Math.PI + 360) % 360;
  const dirs =
    lang === "ar"
      ? [
          [0, "ش"],
          [90, "ق"],
          [180, "ج"],
          [270, "غ"],
        ]
      : [
          [0, "N"],
          [90, "E"],
          [180, "S"],
          [270, "W"],
        ];
  let best = dirs[0][1] as string;
  let bd = 999;
  for (const [a, l] of dirs) {
    const d = Math.min(Math.abs(deg - (a as number)), 360 - Math.abs(deg - (a as number)));
    if (d < bd) {
      bd = d;
      best = l as string;
    }
  }
  return best;
}

export function GameApp() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<TribalsEngine | null>(null);
  const [muted, setMuted] = useState(false);
  const [booting, setBooting] = useState(false);
  const screen = useGameStore((s) => s.screen);
  const overlay = useGameStore((s) => s.overlay);
  const lang = useGameStore((s) => s.lang);
  const serverId = useGameStore((s) => s.serverId);
  const locked = useGameStore((s) => s.locked);
  const copy = COPY[lang];
  const { user, isPending } = useCurrentUserState();
  const [playError, setPlayError] = useState("");

  useEffect(() => {
    const id = useGameStore.getState().serverId;
    if (!SERVERS.some((s) => s.id === id)) useGameStore.getState().setServer("eu-1");
    useGameStore.getState().patch({ hasSave: hasSave() });
    return () => {
      engineRef.current?.stop();
      engineRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (isPending || !user) {
      setProfile(null);
      return;
    }
    const hint = (user.displayName || user.primaryEmail?.split("@")[0] || "player").replace(/[^a-zA-Z0-9_]/g, "").slice(0, 20);
    void upsertProfile({ data: hint || "player" })
      .then(setProfile)
      .catch(() =>
        getMyProfile()
          .then(setProfile)
          .catch(() => setProfile(null)),
      );
  }, [user, isPending]);

  async function begin(training: boolean, load: boolean) {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const chosen = useGameStore.getState().serverId;
    const srv = SERVERS.find((s) => s.id === chosen);
    if (srv?.adminOnly && !user) {
      useGameStore.getState().toast(t().czarOnly);
      return;
    }
    if (user) {
      try {
        const gate = await enterServer({ data: chosen });
        if (!gate.ok) {
          useGameStore.getState().toast(gate.reason === "banned" ? t().banned : t().czarOnly);
          return;
        }
      } catch {
        if (srv?.adminOnly) {
          useGameStore.getState().toast(t().czarOnly);
          return;
        }
      }
    }
    setBooting(true);
    engineRef.current?.stop();
    const eng = new TribalsEngine(canvas);
    engineRef.current = eng;
    window.__tribals = eng;
    const outfit = useGameStore.getState().outfit;
    const key = `tribals-save-v1:${chosen}`;
    if (!training && user) {
      try {
        const remote = await loadProgress({ data: chosen });
        if (remote) localStorage.setItem(key, remote);
      } catch {
        /* keep the local server save */
      }
    }
    try {
      await eng.start({ training, outfit, load: !training, serverId: chosen });
      eng.onProgress = (json) => {
        if (!user) return;
        void saveProgress({ data: { serverId: chosen, data: json } }).catch(() => undefined);
      };
      eng.audio.setMuted(muted);
    } catch (err) {
      console.error(err);
      (window as unknown as { __tribalsError?: string }).__tribalsError = err instanceof Error ? err.stack ?? err.message : String(err);
    } finally {
      setBooting(false);
    }
    eng.input.requestLock();
  }

  function onCanvasClick() {
    if (useGameStore.getState().screen !== "playing") return;
    if (useGameStore.getState().overlay !== "none") return;
    engineRef.current?.audio.unlock();
    engineRef.current?.input.requestLock();
  }

  return (
    <div
      className="relative h-dvh w-full overflow-hidden bg-ink text-foam"
      dir={lang === "ar" ? "rtl" : "ltr"}
      style={{ fontFamily: "var(--font-sans)" }}
    >
      <canvas
        ref={canvasRef}
        className="absolute inset-0 h-full w-full touch-none"
        onClick={onCanvasClick}
      />
      {screen === "menu" && <Menu onPlay={begin} booting={booting} userPending={isPending} signedIn={!!user} profile={profile} />}
      {screen !== "menu" && <Hud muted={muted} setMuted={setMuted} engine={engineRef} />}
      {screen === "playing" && profile && (
        <OnlineSession
          key={serverId}
          engine={engineRef}
          username={profile.username}
          isAdmin={profile.isAdmin}
          nameColor={profile.nameColor}
          canColor={profile.isAdmin || profile.premium}
          room={`tribals-${serverId}`}
        />
      )}
      {screen === "playing" && overlay === "none" && !locked && !engineRef.current?.input.isTouch && (
        <button
          type="button"
          className="absolute inset-0 z-20 flex items-center justify-center bg-ink/50 text-base font-semibold tracking-wide text-foam"
          onClick={onCanvasClick}
        >
          {copy.click}
        </button>
      )}
      {screen === "playing" && <RewardAd engine={engineRef} hide={!!profile?.premium || !!profile?.isAdmin} />}
      {screen === "paused" && <PauseOverlay engine={engineRef} />}
      {screen === "dead" && <DeadOverlay engine={engineRef} />}
      {(overlay === "inventory" || overlay === "craft") && <BagOverlay engine={engineRef} />}
      {overlay === "map" && <MapOverlay />}
      {overlay === "lock" && <LockPad engine={engineRef} />}
    </div>
  );
}

function FounderPanel() {
  const lang = useGameStore((s) => s.lang);
  const copy = COPY[lang];
  const [name, setName] = useState("");
  const [admins, setAdmins] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    listAdmins()
      .then(setAdmins)
      .catch(() => setAdmins([]));
  }, []);
  async function onAdd(e: FormEvent) {
    e.preventDefault();
    const next = name.trim();
    if (!next) return;
    setBusy(true);
    try {
      const res = await addAdmin({ data: next });
      if (!res.ok) {
        useGameStore.getState().toast(res.error === "missing" ? copy.playerMissing : copy.founderOnly);
      } else {
        setAdmins(res.admins);
        setName("");
        useGameStore.getState().toast(`${copy.adminAdded}: ${next}`);
      }
    } catch {
      useGameStore.getState().toast(copy.founderOnly);
    } finally {
      setBusy(false);
    }
  }
  return (
    <form onSubmit={onAdd} className="w-full rounded-2xl border border-amber/40 bg-panel/80 p-3">
      <p className="text-xs font-semibold text-amber">{copy.addAdmin}</p>
      <div className="mt-2 flex gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="flex-1 rounded-xl border border-line bg-raised px-3 py-2 text-sm text-foam outline-none focus:border-amber"
          placeholder="username"
          maxLength={20}
        />
        <button type="submit" disabled={busy} className="rounded-xl bg-amber px-4 py-2 text-sm font-bold text-ink disabled:opacity-60">
          {copy.addAdmin}
        </button>
      </div>
      <p className="mt-3 text-[11px] text-muted">{copy.adminNames}</p>
      <ul className="mt-1 text-sm text-foam">
        {admins.map((a) => (
          <li key={a}>{a}</li>
        ))}
      </ul>
    </form>
  );
}

function RewardAd({
  engine,
  hide,
}: {
  engine: MutableRefObject<TribalsEngine | null>;
  hide: boolean;
}) {
  const copy = t();
  const [busy, setBusy] = useState(false);
  const [cool, setCool] = useState(0);
  useEffect(() => {
    if (cool <= 0) return;
    const id = window.setTimeout(() => setCool((n) => n - 1), 1000);
    return () => window.clearTimeout(id);
  }, [cool]);
  if (hide) return null;
  return (
    <div className="pointer-events-auto absolute bottom-24 right-3 z-30 w-44 rounded-xl border border-line bg-panel/90 p-3 text-xs sm:right-5">
      <p className="text-muted">{copy.subPrice}</p>
      <button
        type="button"
        disabled={busy || cool > 0}
        className="mt-2 w-full rounded-lg bg-amber px-2 py-2 font-bold text-ink disabled:opacity-50"
        onClick={() => {
          if (busy || cool > 0) return;
          setBusy(true);
          window.setTimeout(() => {
            engine.current?.giveItems("wood", 8);
            setBusy(false);
            setCool(40);
          }, 5000);
        }}
      >
        {busy ? copy.adWait : cool > 0 ? `${cool}` : `${copy.watchAd} · ${copy.adReward}`}
      </button>
      <p className="mt-2 text-[10px] leading-snug text-muted">{copy.subLater}</p>
    </div>
  );
}

function Menu({
  onPlay,
  booting,
  userPending,
  signedIn,
  profile,
}: {
  onPlay: (training: boolean, load: boolean) => void;
  booting: boolean;
  userPending: boolean;
  signedIn: boolean;
  profile: Profile | null;
}) {
  const lang = useGameStore((s) => s.lang);
  const serverId = useGameStore((s) => s.serverId);
  const copy = COPY[lang];

  return (
    <div className="absolute inset-0 z-30 overflow-y-auto">
      <img
        src="/images/menu-hero.jpg"
        alt=""
        className="absolute inset-0 h-full w-full object-cover"
        crossOrigin="anonymous"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-ink via-ink/70 to-ink/25" />
      <div className="relative mx-auto flex min-h-dvh max-w-5xl flex-col justify-end gap-6 px-5 pb-10 pt-16 sm:justify-center sm:pb-16">
        <div className="max-w-xl animate-[tribals-fade_0.5s_var(--ease-smooth-out)]">
          <p className="text-sm font-semibold tracking-[0.28em] text-amber">{copy.tag}</p>
          <h1 className="mt-2 text-5xl font-extrabold leading-none tracking-tight text-foam sm:text-7xl">
            {copy.title}
          </h1>
          <p className="mt-4 max-w-md text-sm leading-relaxed text-muted">{copy.tutorial}</p>
        </div>
        <div>
          <p className="mb-2 text-xs font-semibold tracking-wide text-sand">{copy.servers}</p>
          <div className="flex flex-wrap gap-2">
            {SERVERS.map((srv) => {
              const on = serverId === srv.id;
              return (
                <button
                  key={srv.id}
                  type="button"
                  onClick={() => useGameStore.getState().setServer(srv.id)}
                  className={`rounded-lg border px-3 py-2 text-start text-sm ${
                    on ? "border-amber bg-amber/15 text-foam" : "border-line bg-raised/80 text-muted"
                  }`}
                >
                  <span className="block font-bold">{lang === "ar" ? srv.ar : srv.en}</span>
                  <span className="block text-[11px] opacity-80">
                    {lang === "ar" ? srv.blurbAr : srv.blurbEn}
                    {srv.adminOnly ? ` · ${copy.adminBadge}` : ""}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row">
          <button
            type="button"
            disabled={booting}
            onClick={() => onPlay(false, false)}
            className="rounded-xl bg-foam px-6 py-3 text-base font-bold text-ink transition hover:bg-sand disabled:opacity-60"
          >
            {booting ? "…" : copy.play}
          </button>
          <button
            type="button"
            disabled={booting}
            onClick={() => onPlay(true, false)}
            className="rounded-xl border border-line bg-raised/80 px-6 py-3 text-base font-semibold text-foam"
          >
            {copy.train}
          </button>
          <button
            type="button"
            onClick={() => useGameStore.getState().setLang(lang === "ar" ? "en" : "ar")}
            className="rounded-xl border border-line px-4 py-3 text-sm font-semibold text-muted"
          >
            {copy.lang}
          </button>
        </div>
        <p className="text-xs text-muted">{copy.controls}</p>
        <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-line bg-panel/80 p-3">
          {userPending ? (
            <div className="h-8 w-40 animate-pulse rounded-lg bg-raised" />
          ) : signedIn ? (
            <>
              <UserButton />
              {profile && (
                <span className="text-xs text-sand">
                  {copy.online}: {profile.username}
                  {profile.isAdmin ? ` · ${copy.adminBadge}` : ""}
                </span>
              )}
              {profile?.isFounder && <FounderPanel />}
            </>
          ) : (
            <>
              <Link
                to="/login"
                className="rounded-xl bg-amber px-4 py-2 text-sm font-bold text-ink"
              >
                {copy.login}
              </Link>
              <span className="text-xs text-muted">{copy.guest}</span>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Hud({
  muted,
  setMuted,
  engine,
}: {
  muted: boolean;
  setMuted: (v: boolean) => void;
  engine: MutableRefObject<TribalsEngine | null>;
}) {
  const s = useGameStore();
  const copy = COPY[s.lang];
  const inv = s.inventory;
  const hot = s.hotIndex;
  const phase =
    s.raining ? copy.storm : s.timeOfDay < 0.22 || s.timeOfDay > 0.78 ? copy.nightLabel : s.timeOfDay > 0.7 ? copy.dusk : copy.day;

  return (
    <>
      {s.hurt > 0 && (
        <div
          className="pointer-events-none absolute inset-0 z-10"
          style={{ boxShadow: `inset 0 0 120px rgba(160,20,16,${Math.min(0.55, s.hurt)})` }}
        />
      )}
      <div className="pointer-events-none absolute left-1/2 top-1/2 z-10 -translate-x-1/2 -translate-y-1/2 text-center">
        <Crosshair className={`mx-auto size-5 ${s.hitMark > 0 ? "text-health" : "text-foam/80"}`} strokeWidth={1.6} />
        {s.combo > 1 && (
          <p className="mt-1 text-xs font-bold text-amber">
            {copy.combo} ×{s.combo}
          </p>
        )}
        {s.blocking && <p className="text-[11px] font-semibold text-sand">{copy.blocked}</p>}
      </div>
      <div className="absolute left-3 top-3 z-10 flex flex-col gap-2 sm:left-5 sm:top-5">
        <div className="rounded-xl border border-line bg-panel/85 px-3 py-2 backdrop-blur-sm">
          <p className="text-[11px] font-semibold tracking-wide text-muted">
            {phase} · FPS {s.fps} · {fmtTime(s.session)}
          </p>
          <p className="text-[11px] text-sand">
            {copy.kills} {s.kills} · {copy.score} {s.score}
          </p>
        </div>
        <div className="hidden w-56 rounded-xl border border-line bg-panel/80 p-3 text-[12px] sm:block">
          <p className="mb-1 font-semibold text-amber">{copy.missions}</p>
          {copy.quests.map((q) => {
            const v = s.quests[q.id as keyof typeof s.quests] ?? 0;
            const done = v >= q.target;
            return (
              <p key={q.id} className={done ? "text-ok" : "text-muted"}>
                {q.title} · {Math.min(v, q.target)}/{q.target}
              </p>
            );
          })}
        </div>
      </div>
      <div className="absolute right-3 top-3 z-10 flex gap-2 sm:right-5 sm:top-5">
        <div className="flex w-44 flex-col gap-1.5 rounded-xl border border-line bg-panel/85 p-3 backdrop-blur-sm">
          <Bar color="var(--color-health)" value={s.health} label={copy.health} />
          <Bar color="var(--color-hunger)" value={s.hunger} label={copy.hunger} />
          <Bar color="var(--color-thirst)" value={s.thirst} label={copy.thirst} />
          <Bar color="var(--color-stamina)" value={s.stamina} label={copy.stamina} />
          <Bar color="#c4a46a" value={s.armor} label={copy.armor} />
          <Bar color="#d07a4a" value={s.temp} label={copy.temp} />
        </div>
        <div className="relative hidden size-28 overflow-hidden rounded-full border border-line bg-panel/90 sm:block">
          {s.minimap && (
            <img src={s.minimap} alt="" className="h-full w-full object-cover" crossOrigin="anonymous" />
          )}
          <div className="absolute inset-x-0 top-1 flex justify-center text-[10px] font-bold text-foam">
            <Compass className="ml-1 size-3" /> {compassLetter(s.yaw, s.lang)}
          </div>
        </div>
      </div>
      {s.prompt && s.overlay === "none" && (
        <div className="absolute left-1/2 top-[58%] z-10 -translate-x-1/2 rounded-lg border border-line bg-panel/90 px-3 py-1.5 text-sm">
          <span className="me-2 inline-block rounded bg-raised px-1.5 font-mono text-xs text-amber">{s.prompt.key}</span>
          {s.prompt.label}
        </div>
      )}
      <div className="absolute bottom-3 left-1/2 z-10 flex -translate-x-1/2 gap-1 sm:bottom-5">
        {Array.from({ length: HOTBAR }, (_, i) => {
          const slot = inv[INV_SIZE + i];
          return (
            <button
              key={i}
              type="button"
              onClick={() => engine.current?.useHot(i)}
              className={`pointer-events-auto flex size-11 flex-col items-center justify-center rounded-lg border sm:size-12 ${
                hot === i ? "border-amber bg-raised" : "border-line bg-panel/80"
              }`}
            >
              {slot ? (
                <>
                  <img src={ITEM[slot.id].icon} alt="" className="size-7 object-contain" crossOrigin="anonymous" />
                  <span className="text-[9px] tabular-nums text-muted">{slot.count}</span>
                </>
              ) : (
                <span className="text-[10px] text-muted">{i + 1}</span>
              )}
            </button>
          );
        })}
      </div>
      <div className="absolute bottom-3 right-3 z-10 flex gap-2 sm:bottom-5 sm:right-5">
        <IconBtn
          onClick={() => {
            const v = !muted;
            setMuted(v);
            engine.current?.audio.setMuted(v);
          }}
        >
          {muted ? <VolumeX className="size-4" /> : <Volume2 className="size-4" />}
        </IconBtn>
        <IconBtn onClick={() => engine.current?.setOverlay(overlayOf(s.overlay, "inventory"))}>
          <Box className="size-4" />
        </IconBtn>
        <IconBtn onClick={() => engine.current?.setOverlay(overlayOf(s.overlay, "map"))}>
          <MapIcon className="size-4" />
        </IconBtn>
        <IconBtn onClick={() => engine.current?.setOverlay(overlayOf(s.overlay, "chat"))}>
          <MessageSquare className="size-4" />
        </IconBtn>
        <IconBtn onClick={() => useGameStore.getState().setScreen("paused")}>
          <Pause className="size-4" />
        </IconBtn>
      </div>
      {engine.current?.input.isTouch && s.overlay === "none" && s.screen === "playing" && (
        <TouchPad engine={engine} />
      )}
      <div className="pointer-events-none absolute bottom-24 left-1/2 z-20 flex -translate-x-1/2 flex-col items-center gap-1">
        {s.toasts.map((x) => (
          <div key={x.id} className="rounded-md border border-line bg-panel/90 px-3 py-1 text-sm">
            {x.text}
          </div>
        ))}
      </div>
    </>
  );
}

function overlayOf(cur: string, next: "inventory" | "craft" | "map" | "chat") {
  return cur === next ? "none" : next;
}

function Bar({ color, value, label }: { color: string; value: number; label: string }) {
  return (
    <div>
      <div className="mb-0.5 flex justify-between text-[10px] text-muted">
        <span>{label}</span>
        <span className="tabular-nums">{Math.round(value)}</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-ink">
        <div className="h-full rounded-full" style={{ width: `${Math.max(0, Math.min(100, value))}%`, background: color }} />
      </div>
    </div>
  );
}

function IconBtn({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="pointer-events-auto flex size-11 items-center justify-center rounded-xl border border-line bg-panel/85 text-foam"
    >
      {children}
    </button>
  );
}

function TouchPad({ engine }: { engine: MutableRefObject<TribalsEngine | null> }) {
  const copy = t();
  return (
    <div className="pointer-events-none absolute inset-0 z-10">
      <div className="absolute bottom-24 left-6 size-28 rounded-full border border-line/80 bg-raised/30" />
      <div className="absolute bottom-24 right-6 flex flex-col gap-2">
        <button
          type="button"
          className="pointer-events-auto size-14 rounded-full border border-line bg-panel/80 text-xs font-semibold"
          onPointerDown={() => {
            const i = engine.current?.input;
            if (i) i.fireClick = true;
          }}
        >
          {copy.attack}
        </button>
        <button
          type="button"
          className="pointer-events-auto size-12 rounded-full border border-line bg-panel/80 text-xs"
          onPointerDown={() => {
            const i = engine.current?.input;
            if (i) i.jumpClick = true;
          }}
        >
          ⌃
        </button>
        <button
          type="button"
          className="pointer-events-auto size-12 rounded-full border border-line bg-panel/80 text-xs"
          onPointerDown={() => {
            const i = engine.current?.input;
            if (i) i.interactClick = true;
          }}
        >
          E
        </button>
      </div>
    </div>
  );
}

function LockPad({ engine }: { engine: MutableRefObject<TribalsEngine | null> }) {
  const lang = useGameStore((s) => s.lang);
  const ask = useGameStore((s) => s.lockAsk);
  const copy = COPY[lang];
  const [code, setCode] = useState("");
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        engine.current?.closeLock();
        return;
      }
      if (e.key === "Backspace") {
        setCode((c) => c.slice(0, -1));
        return;
      }
      if (e.key === "Enter") {
        engine.current?.submitLock(code);
        return;
      }
      if (/^\d$/.test(e.key) && code.length < 4) setCode((c) => c + e.key);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [code, engine]);
  return (
    <div className="pointer-events-auto absolute inset-0 z-40 flex items-center justify-center bg-ink/55">
      <form
        className="w-72 rounded-2xl border border-line bg-panel p-4 text-center shadow-lg"
        onSubmit={(e) => {
          e.preventDefault();
          engine.current?.submitLock(code);
        }}
      >
        <h3 className="mb-3 font-bold">{ask?.mode === "set" ? copy.lockSet : copy.lockEnter}</h3>
        <div className="mb-3 flex justify-center gap-2">
          {Array.from({ length: 4 }, (_, i) => (
            <span key={i} className="flex size-10 items-center justify-center rounded-lg border border-line bg-raised font-mono text-lg">
              {code[i] ?? ""}
            </span>
          ))}
        </div>
        <div className="grid grid-cols-3 gap-1">
          {["1", "2", "3", "4", "5", "6", "7", "8", "9", "⌫", "0", "OK"].map((k) => (
            <button
              key={k}
              type="button"
              className="rounded-lg border border-line bg-raised py-2"
              onClick={() => {
                if (k === "⌫") setCode((c) => c.slice(0, -1));
                else if (k === "OK") engine.current?.submitLock(code);
                else if (code.length < 4) setCode((c) => c + k);
              }}
            >
              {k}
            </button>
          ))}
        </div>
        <button type="button" className="mt-3 text-sm text-muted" onClick={() => engine.current?.closeLock()}>
          {lang === "ar" ? "إلغاء" : "Cancel"}
        </button>
      </form>
    </div>
  );
}

function PauseOverlay({ engine }: { engine: MutableRefObject<TribalsEngine | null> }) {
  const copy = t();
  const [setts, setSetts] = useState<GameSettings>(() => loadSettings());
  function apply(next: GameSettings) {
    setSetts(next);
    saveSettings(next);
    engine.current?.applySettings(next);
  }
  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center bg-ink/70 p-4">
      <div className="max-h-[88dvh] w-full max-w-sm overflow-auto rounded-2xl border border-line bg-surface p-6">
        <h2 className="text-2xl font-bold">{copy.paused}</h2>
        <div className="mt-5 flex flex-col gap-2">
          <button
            type="button"
            className="rounded-xl bg-foam px-4 py-3 font-semibold text-ink"
            onClick={() => {
              useGameStore.getState().setScreen("playing");
              engine.current?.input.requestLock();
            }}
          >
            <Play className="me-2 inline size-4" />
            {copy.play}
          </button>
          <button
            type="button"
            className="rounded-xl border border-line px-4 py-3 font-semibold"
            onClick={() => {
              engine.current?.save();
              engine.current?.stop();
              engine.current = null;
              useGameStore.getState().setScreen("menu");
              useGameStore.getState().patch({ hasSave: hasSave(), overlay: "none" });
            }}
          >
            {copy.title}
          </button>
        </div>
        <h3 className="mt-5 text-sm font-semibold text-sand">{copy.settings}</h3>
        <label className="mt-3 block text-xs text-muted">
          {copy.sens} · {setts.sens.toFixed(1)}
          <input
            type="range"
            min={0.4}
            max={2.2}
            step={0.1}
            value={setts.sens}
            onChange={(e) => apply({ ...setts, sens: Number(e.target.value) })}
            className="mt-1 w-full"
          />
        </label>
        <label className="mt-2 block text-xs text-muted">
          {copy.fov} · {Math.round(setts.fov)}
          <input
            type="range"
            min={60}
            max={100}
            step={1}
            value={setts.fov}
            onChange={(e) => apply({ ...setts, fov: Number(e.target.value) })}
            className="mt-1 w-full"
          />
        </label>
        <label className="mt-2 block text-xs text-muted">
          {copy.viewDist} · {Math.round(setts.view)}
          <input
            type="range"
            min={80}
            max={280}
            step={10}
            value={setts.view}
            onChange={(e) => apply({ ...setts, view: Number(e.target.value) })}
            className="mt-1 w-full"
          />
        </label>
        <div className="mt-3 flex gap-2">
          {(["low", "med", "high"] as const).map((q) => (
            <button
              key={q}
              type="button"
              onClick={() => apply({ ...setts, quality: q })}
              className={`flex-1 rounded-lg border px-2 py-2 text-xs font-semibold ${
                setts.quality === q ? "border-amber text-foam" : "border-line text-muted"
              }`}
            >
              {q === "low" ? copy.qLow : q === "high" ? copy.qHigh : copy.qMed}
            </button>
          ))}
        </div>
        <label className="mt-3 flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={setts.headBob}
            onChange={(e) => apply({ ...setts, headBob: e.target.checked })}
          />
          {copy.bob}
        </label>
        <label className="mt-2 flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={setts.particles}
            onChange={(e) => apply({ ...setts, particles: e.target.checked })}
          />
          {copy.particles}
        </label>
      </div>
    </div>
  );
}

function DeadOverlay({ engine }: { engine: MutableRefObject<TribalsEngine | null> }) {
  const copy = t();
  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center bg-ink/75 p-4">
      <div className="w-full max-w-sm rounded-2xl border border-line bg-surface p-6 text-center">
        <Swords className="mx-auto size-8 text-health" />
        <h2 className="mt-3 text-2xl font-bold">{copy.dead}</h2>
        <button
          type="button"
          className="mt-5 w-full rounded-xl bg-foam px-4 py-3 font-semibold text-ink"
          onClick={() => {
            engine.current?.respawn();
            engine.current?.input.requestLock();
          }}
        >
          <RotateCcw className="me-2 inline size-4" />
          {copy.respawn}
        </button>
      </div>
    </div>
  );
}

function BagSlots({
  engine,
  start,
  count,
  hold,
  setHold,
}: {
  engine: MutableRefObject<TribalsEngine | null>;
  start: number;
  count: number;
  hold: number | null;
  setHold: (n: number | null) => void;
}) {
  const inv = useGameStore((s) => s.inventory);
  const dragging = useRef(false);
  return (
    <div className="grid grid-cols-6 gap-1 sm:grid-cols-8">
      {Array.from({ length: count }, (_, n) => {
        const i = start + n;
        const slot = inv[i];
        return (
          <button
            key={i}
            type="button"
            draggable={!!slot}
            onDragStart={(e) => {
              dragging.current = true;
              e.dataTransfer.setData("text/plain", String(i));
              e.dataTransfer.effectAllowed = "move";
              setHold(i);
            }}
            onDragEnd={() => {
              window.setTimeout(() => {
                dragging.current = false;
              }, 0);
            }}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const from = Number(e.dataTransfer.getData("text/plain"));
              if (!Number.isNaN(from)) engine.current?.moveSlot(from, i);
              setHold(null);
            }}
            onClick={() => {
              if (dragging.current) return;
              if (hold == null) {
                if (!slot) return;
                const it = ITEM[slot.id];
                if (it.kind === "none" && (it.heal || it.hunger || it.thirst)) {
                  engine.current?.useConsumable(slot.id);
                  return;
                }
                setHold(i);
                return;
              }
              if (hold === i) {
                setHold(null);
                return;
              }
              engine.current?.moveSlot(hold, i);
              setHold(null);
            }}
            className={`flex aspect-square flex-col items-center justify-center rounded-lg border bg-raised p-1 ${
              hold === i ? "border-amber" : "border-line"
            }`}
          >
            {slot ? (
              <>
                <img src={ITEM[slot.id].icon} alt="" className="size-8 object-contain" crossOrigin="anonymous" />
                <span className="text-[9px] tabular-nums text-muted">{slot.count}</span>
              </>
            ) : (
              <span className="text-[10px] text-muted">{start === INV_SIZE ? n + 1 : ""}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}

function BagOverlay({ engine }: { engine: MutableRefObject<TribalsEngine | null> }) {
  const s = useGameStore();
  const copy = COPY[s.lang];
  const [sel, setSel] = useState<Recipe>(RECIPES[0]);
  const [hold, setHold] = useState<number | null>(null);
  const inv = s.inventory;
  const can = (r: Recipe) => {
    if (r.station !== "hand" && r.station !== s.nearStation) return false;
    return Object.entries(r.cost).every(([k, n]) => countItem(inv, k as ItemId) >= (n ?? 0));
  };

  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center bg-ink/55 p-3 sm:p-6">
      <div className="flex max-h-[88dvh] w-full max-w-5xl flex-col gap-3 overflow-hidden rounded-2xl border border-line bg-surface p-4 sm:flex-row">
        <div className="flex-1 overflow-auto">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="font-bold">{copy.inv}</h3>
            <button type="button" className="text-sm text-muted" onClick={() => engine.current?.setOverlay("none")}>
              Esc
            </button>
          </div>
          <p className="mb-2 text-xs text-muted">{copy.drag}</p>
          <BagSlots engine={engine} start={0} count={INV_SIZE} hold={hold} setHold={setHold} />
          <p className="mb-1 mt-3 text-xs font-semibold text-amber">{copy.hotbar}</p>
          <BagSlots engine={engine} start={INV_SIZE} count={HOTBAR} hold={hold} setHold={setHold} />
        </div>
        <div className="w-full overflow-auto sm:w-80">
          <h3 className="mb-2 font-bold">{copy.craft}</h3>
          <p className="mb-2 text-xs text-muted">
            {s.nearStation === "bench"
              ? copy.stationBench
              : s.nearStation === "furnace"
                ? copy.stationFurnace
                : s.nearStation === "fire"
                  ? copy.stationFire
                  : copy.stationHand}
          </p>
          <div className="flex max-h-48 flex-col gap-1 overflow-auto">
            {RECIPES.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => setSel(r)}
                className={`flex items-center gap-2 rounded-lg border px-2 py-1.5 text-start text-sm ${
                  sel.id === r.id ? "border-amber bg-raised" : "border-line"
                } ${can(r) ? "text-foam" : "text-muted"}`}
              >
                <img src={ITEM[r.out].icon} alt="" className="size-7 object-contain" crossOrigin="anonymous" />
                {copy.items[r.out]} ×{r.count}
              </button>
            ))}
          </div>
          <div className="mt-3 rounded-xl border border-line bg-raised p-3">
            <p className="font-semibold">{copy.items[sel.out]}</p>
            <ul className="mt-1 text-xs text-muted">
              {Object.entries(sel.cost).map(([k, n]) => (
                <li key={k}>
                  {copy.items[k as ItemId]} {n} / {countItem(inv, k as ItemId)}
                </li>
              ))}
            </ul>
            <button
              type="button"
              disabled={!can(sel)}
              onClick={() => engine.current?.craft(sel.id)}
              className="mt-3 w-full rounded-lg bg-ok px-3 py-2 text-sm font-bold text-ink disabled:opacity-40"
            >
              {copy.make}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function MapOverlay() {
  const s = useGameStore();
  const copy = COPY[s.lang];
  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center bg-ink/60 p-4">
      <div className="w-full max-w-lg rounded-2xl border border-line bg-surface p-4">
        <h3 className="mb-3 font-bold">{copy.map}</h3>
        <div className="overflow-hidden rounded-xl border border-line">
          {s.minimap ? (
            <img src={s.minimap} alt="" className="aspect-square w-full object-cover" crossOrigin="anonymous" />
          ) : (
            <img src="/images/island-map.jpg" alt="" className="aspect-square w-full object-cover" crossOrigin="anonymous" />
          )}
        </div>
        <button
          type="button"
          className="mt-3 w-full rounded-lg border border-line py-2 text-sm"
          onClick={() => useGameStore.getState().setOverlay("none")}
        >
          Esc
        </button>
      </div>
    </div>
  );
}
