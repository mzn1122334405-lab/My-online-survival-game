import { useEffect, useRef, useState, type FormEvent, type MutableRefObject } from "react";
import { MessageSquare, Users } from "lucide-react";
import { useP2PRoom } from "@/lib/multiplayer";
import { listChat, moderation, sendChat, type ChatRow } from "@/game/online";
import { COPY } from "@/game/data";
import { useGameStore } from "@/game/store";
import type { TribalsEngine } from "@/game/engine";

type Props = {
  engine: MutableRefObject<TribalsEngine | null>;
  username: string;
  isAdmin: boolean;
  room: string;
};

export function OnlineSession({ engine, username, isAdmin, room }: Props) {
  const p2p = useP2PRoom({ room, name: username });
  const lang = useGameStore((s) => s.lang);
  const overlay = useGameStore((s) => s.overlay);
  const copy = COPY[lang];
  const [chat, setChat] = useState<ChatRow[]>([]);
  const [draft, setDraft] = useState("");
  const [live, setLive] = useState<{ from: string; body: string }[]>([]);
  const [staff, setStaff] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const bootKick = useRef<string | null>(null);

  useEffect(() => {
    engine.current?.setNetName(username);
    engine.current?.setAdmin(isAdmin);
  }, [engine, username, isAdmin]);

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
          });
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
          setLive((rows) => [...rows.slice(-30), { from: String(msg.from ?? from), body: msg.body as string }]);
        }
      }),
    [p2p.onMessage, engine],
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
    if (overlay === "chat") inputRef.current?.focus();
  }, [overlay]);

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
        p2p.send({ t: "chat", from: username, body: text });
        setLive((rows) => [...rows.slice(-30), { from: username, body: text }]);
        const latest = await listChat();
        setChat(latest);
      }
    } catch {
      useGameStore.getState().toast(lang === "ar" ? "تعذر إرسال الرسالة" : "Could not send");
    }
  }

  const lines = [
    ...chat.map((c) => ({ from: c.username, body: c.body, key: `d${c.id}` })),
    ...live.map((c, i) => ({ from: c.from, body: c.body, key: `l${i}-${c.body}` })),
  ].slice(-24);
  const visiblePeers = p2p.peers.filter((p) => p.name && p.name !== "__ghost");
  const connected = visiblePeers.filter((p) => p.connectionState === "connected").length;

  return (
    <>
      <div className="pointer-events-none absolute bottom-20 left-3 z-20 max-w-56 sm:left-5">
        <div className="rounded-xl border border-line bg-panel/80 px-3 py-2 text-[11px] backdrop-blur-sm">
          <p className="flex items-center gap-1 font-semibold text-amber">
            <Users className="size-3" /> {copy.online} · {connected + (staff ? 0 : 1)}
          </p>
          {!staff && (
            <p className="truncate text-foam">
              {username}
              {isAdmin ? ` · ${copy.adminBadge}` : ""}
            </p>
          )}
          {staff && <p className="truncate text-amber">{copy.staffOn}</p>}
          {visiblePeers.slice(0, 6).map((p) => (
            <p key={p.id} className="truncate text-muted">
              {p.name || p.id} {p.connectionState === "connected" ? "" : "…"}
            </p>
          ))}
        </div>
      </div>

      {overlay === "chat" && (
        <div className="absolute inset-x-0 bottom-0 z-30 flex justify-center p-3 sm:p-5">
          <form
            onSubmit={onSend}
            className="flex w-full max-w-xl flex-col gap-2 rounded-2xl border border-line bg-surface/95 p-3"
          >
            <div className="flex items-center justify-between text-sm">
              <span className="font-semibold">
                <MessageSquare className="me-1 inline size-4 text-amber" />
                {copy.chat}
              </span>
              <button type="button" className="text-muted" onClick={() => engine.current?.setOverlay("none")}>
                Esc
              </button>
            </div>
            <div className="max-h-40 overflow-y-auto text-sm">
              {lines.length === 0 && <p className="text-muted">{copy.enterChat}</p>}
              {lines.map((l) => (
                <p key={l.key} className="leading-snug">
                  <span className="font-semibold text-sand">{l.from}: </span>
                  {l.body}
                </p>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                ref={inputRef}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                className="flex-1 rounded-xl border border-line bg-raised px-3 py-2 text-sm text-foam outline-none focus:border-amber"
                placeholder={copy.enterChat}
                maxLength={240}
              />
              <button type="submit" className="rounded-xl bg-amber px-4 py-2 text-sm font-bold text-ink">
                {copy.send}
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
