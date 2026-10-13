import { useEffect, useRef, useState, type FormEvent, type MutableRefObject } from "react";
import { MessageSquare, Users } from "lucide-react";
import { useP2PRoom } from "@/lib/multiplayer";
import { COPY, NAME_COLORS } from "@/game/data";
import { useGameStore } from "@/game/store";
import { listChat, moderation, sendChat, setNameColor, type ChatRow } from "@/game/online";
import type { TribalsEngine } from "@/game/engine";

type Props = {
  engine: MutableRefObject<TribalsEngine | null>;
  username: string;
  isAdmin: boolean;
  nameColor: string;
  canColor: boolean;
  room: string;
};

export function OnlineSession({ engine, username, isAdmin, nameColor, canColor, room }: Props) {
  const p2p = useP2PRoom({ room, name: username });
  const lang = useGameStore((s) => s.lang);
  const copy = COPY[lang];
  const [chat, setChat] = useState<ChatRow[]>([]);
  const [draft, setDraft] = useState("");
  const [live, setLive] = useState<{ from: string; body: string; color: string }[]>([]);
  const [colors, setColors] = useState<Record<string, string>>({});
  const [staff, setStaff] = useState(false);
  const [mine, setMine] = useState(nameColor || "#ffffff");
  const inputRef = useRef<HTMLInputElement>(null);
  const bootKick = useRef<string | null>(null);

  useEffect(() => {
    engine.current?.setNetName(username);
    engine.current?.setAdmin(isAdmin);
    engine.current?.setNameColor(mine);
    engine.current?.setCombatSend((msg) => p2p.send(msg));
  }, [engine, username, isAdmin, mine, p2p.send]);

  useEffect(() => {
    listChat()
      .then(setChat)
      .catch(() => setChat([]));
  }, []);

  useEffect(() => {
    let stop = false;
    const boot = async () => {
      try {
        const s = await moderation();
        if (stop) return;
        bootKick.current = s.kickedAt;
        if (s.banned) leave(copy.banned);
      } catch {
        bootKick.current = "";
      }
    };
    const tick = async () => {
      if (bootKick.current === null) return;
      try {
        const s = await moderation();
        if (stop) return;
        if (s.banned) leave(copy.banned);
        else if (s.kickedAt && s.kickedAt !== bootKick.current) leave(copy.kicked);
      } catch {
        /* offline */
      }
    };
    void boot();
    const id = window.setInterval(() => void tick(), 2500);
    return () => {
      stop = true;
      window.clearInterval(id);
    };
    function leave(msg: string) {
      engine.current?.stop();
      engine.current = null;
      useGameStore.getState().setScreen("menu");
      useGameStore.getState().toast(msg);
    }
  }, [copy.banned, copy.kicked, engine]);

  useEffect(
    () =>
      p2p.onMessage((from, data) => {
        if (!data || typeof data !== "object") return;
        const msg = data as Record<string, unknown>;
        if (msg.t === "p" && typeof msg.x === "number") {
          engine.current?.syncRemote(from, {
            x: msg.x as number,
            y: (msg.y as number) ?? 0,
            z: (msg.z as number) ?? 0,
            yaw: (msg.yaw as number) ?? 0,
            hp: (msg.hp as number) ?? 100,
            name: String(msg.name ?? from),
            color: typeof msg.color === "string" ? msg.color : "#ffffff",
          });
          if (typeof msg.color === "string") {
            setColors((prev) => (prev[from] === msg.color ? prev : { ...prev, [from]: msg.color as string }));
          }
        }
        if (msg.t === "hit" && msg.to === p2p.selfId && typeof msg.dmg === "number") {
          engine.current?.applyIncoming(msg.dmg, msg.head === true);
        }
        if (msg.t === "mod" && typeof msg.name === "string") {
          if (String(msg.name).toLowerCase() === username.toLowerCase()) {
            engine.current?.stop();
            engine.current = null;
            useGameStore.getState().setScreen("menu");
            useGameStore.getState().toast(msg.action === "ban" ? copy.banned : copy.kicked);
          }
        }
        if (msg.t === "hide") {
          engine.current?.dropRemote(from);
        }
        if (msg.t === "chat" && typeof msg.body === "string") {
          setLive((rows) => [
            ...rows.slice(-30),
            {
              from: String(msg.from ?? from),
              body: msg.body as string,
              color: typeof msg.color === "string" ? msg.color : "#ffffff",
            },
          ]);
        }
      }),
    [p2p.onMessage, p2p.selfId, engine, username, copy.banned, copy.kicked],
  );

  useEffect(() => {
    engine.current?.keepRemotes(p2p.peers.map((p) => p.id));
  }, [p2p.peers, engine]);

  useEffect(() => {
    let raf = 0;
    let last = 0;
    const loop = (now: number) => {
      if (now - last >= 70) {
        const snap = engine.current?.netSnapshot();
        if (snap) p2p.broadcast(snap);
        last = now;
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [p2p.broadcast, engine]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== "KeyT") return;
      if (document.activeElement === inputRef.current) return;
      if (useGameStore.getState().screen !== "playing") return;
      if (useGameStore.getState().overlay !== "none") return;
      e.preventDefault();
      inputRef.current?.focus();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  async function onSend(e: FormEvent) {
    e.preventDefault();
    const text = draft.trim();
    if (!text) return;
    setDraft("");
    try {
      const res = await sendChat({ data: text });
      if (res.kind === "give" && engine.current) {
        engine.current.giveItems(res.item, res.count);
        useGameStore.getState().toast(res.message);
      } else if (res.kind === "admin") {
        if (res.username.toLowerCase() === username.toLowerCase()) engine.current?.setAdmin(true);
        useGameStore.getState().toast(res.message);
      } else if (res.kind === "god") {
        const on = engine.current?.toggleGod() ?? false;
        useGameStore.getState().toast(on ? copy.godOn : copy.godOff);
      } else if (res.kind === "staff") {
        const on = engine.current?.toggleStaff() ?? false;
        setStaff(on);
        p2p.setName(on ? "__ghost" : username);
        if (on) p2p.send({ t: "hide" });
        useGameStore.getState().toast(on ? copy.staffOn : copy.staffOff);
      } else if (res.kind === "kick" || res.kind === "ban" || res.kind === "unban") {
        const label = res.kind === "kick" ? copy.kickedThem : res.kind === "ban" ? copy.bannedThem : copy.unbannedThem;
        useGameStore.getState().toast(`${label} ${res.username}`);
        if (res.kind !== "unban") p2p.send({ t: "mod", action: res.kind, name: res.username });
      } else if (res.kind === "tribe") {
        useGameStore.getState().toast(res.name ? `Tribe · ${res.name}` : copy.leaveTribe);
      } else if (res.kind === "help" || res.kind === "error") {
        useGameStore.getState().toast(res.message);
      } else {
        p2p.send({ t: "chat", from: username, body: text, color: mine });
        setLive((rows) => [...rows.slice(-30), { from: username, body: text, color: mine }]);
        const latest = await listChat();
        setChat(latest);
      }
    } catch {
      useGameStore.getState().toast(lang === "ar" ? "تعذر إرسال الرسالة" : "Could not send");
    }
  }

  const lines = [
    ...chat.map((c) => ({ from: c.username, body: c.body, color: c.color || "#ffffff", key: `d${c.id}` })),
    ...live.map((c, i) => ({ from: c.from, body: c.body, color: c.color || "#ffffff", key: `l${i}-${c.body}` })),
  ].slice(-24);
  const visiblePeers = p2p.peers.filter((p) => p.name && p.name !== "__ghost");
  const connected = visiblePeers.filter((p) => p.connectionState === "connected").length;

  return (
    <div className="pointer-events-auto absolute bottom-3 left-3 z-30 w-[min(22rem,calc(100vw-7.5rem))] sm:left-5">
      <form onSubmit={onSend} className="rounded-2xl border border-line bg-ink/80 p-2 text-sm shadow-lg backdrop-blur-sm">
        <div className="mb-1 flex items-center justify-between text-[11px] text-muted">
          <span className="font-semibold text-foam">
            <MessageSquare className="me-1 inline size-3 text-amber" />
            {copy.chat}
            <Users className="ms-2 me-1 inline size-3" />
            {connected + (staff ? 0 : 1)}
          </span>
          {!staff && (
            <span className="truncate" style={{ color: mine }}>
              {username}
              {isAdmin ? ` · ${copy.adminBadge}` : ""}
            </span>
          )}
        </div>
        <div className="max-h-28 overflow-y-auto text-xs leading-snug">
          {lines.length === 0 && <p className="text-muted">{copy.enterChat}</p>}
          {lines.map((l) => (
            <p key={l.key}>
              <span className="font-semibold" style={{ color: l.color }}>
                {l.from}:{" "}
              </span>
              <span className="text-foam">{l.body}</span>
            </p>
          ))}
          {visiblePeers.slice(0, 4).map((p) => (
            <p key={p.id} className="truncate text-[10px]" style={{ color: colors[p.id] || "#ffffff" }}>
              {p.name || p.id}
              {p.connectionState === "connected" ? "" : " …"}
            </p>
          ))}
        </div>
        {canColor && (
          <div className="mt-1 flex gap-1">
            {NAME_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                aria-label={copy.nameColor}
                className="size-4 rounded-full border border-white/40"
                style={{ background: c, outline: mine === c ? "2px solid #fff" : undefined }}
                onClick={() => {
                  setMine(c);
                  void setNameColor({ data: c });
                }}
              />
            ))}
          </div>
        )}
        {!canColor && <p className="mt-1 text-[10px] text-muted">{copy.subPrice}</p>}
        <div className="mt-1 flex gap-1">
          <input
            ref={inputRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onFocus={() => engine.current?.setTyping(true)}
            onBlur={() => engine.current?.setTyping(false)}
            onKeyDown={(e) => {
              e.stopPropagation();
              if (e.key === "Escape") {
                e.preventDefault();
                e.currentTarget.blur();
              }
            }}
            className="flex-1 rounded-lg border border-line bg-raised px-2 py-1.5 text-xs text-foam outline-none focus:border-amber"
            placeholder={copy.enterChat}
            maxLength={240}
          />
          <button type="submit" className="rounded-lg bg-amber px-2 py-1.5 text-xs font-bold text-ink">
            {copy.send}
          </button>
        </div>
      </form>
    </div>
  );
}
