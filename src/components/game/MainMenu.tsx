import { useEffect, useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import {
  Backpack,
  Crown,
  Hammer,
  ScrollText,
  Settings,
  Shield,
  ShoppingBag,
  Swords,
  Trophy,
  UserRound,
  Volume2,
  VolumeX,
} from "lucide-react";
import { COPY, ITEM, NAME_COLORS, OUTFITS, RECIPES, SERVERS, type ItemId } from "@/game/data";
import { DEFAULT_SETTINGS, loadSettings, saveSettings, type GameSettings } from "@/game/settings";
import { useGameStore } from "@/game/store";
import { UserButton } from "@/lib/auth/gates";
import { listLeaderboard, listTribes, moderation, setNameColor, type Profile } from "@/game/online";
import { MenuWorld } from "./MenuWorld";

type Tab = "play" | "character" | "inventory" | "craft" | "shop" | "pass" | "quests" | "clans" | "ranks" | "settings" | "profile";

type SaveSnap = {
  kills?: number;
  score?: number;
  session?: number;
  quests?: Record<string, number>;
  inventory?: { id: ItemId; count: number }[] | null;
};

const PREVIEW = {
  coins: 1250,
  gems: 40,
  passTier: 3,
  passMax: 10,
};

const SHOP_PREVIEW = [
  { id: "skin-scout", ar: "زي الكشافة الذهبي", en: "Gold scout wrap", price: "240", kind: "gems" },
  { id: "skin-knife", ar: "سكين تجميلي", en: "Cosmetic knife", price: "120", kind: "gems" },
  { id: "pack-coins", ar: "حزمة عملات", en: "Coin pack", price: "$4.99", kind: "cash" },
  { id: "season", ar: "عرض الموسم", en: "Season offer", price: "$9.99", kind: "cash" },
];

const PASS_PREVIEW = [
  { tier: 1, ar: "150 عملة", en: "150 coins" },
  { tier: 2, ar: "ضمادة ×5", en: "Bandage ×5" },
  { tier: 3, ar: "لون اسم تجريبي", en: "Preview name color" },
  { tier: 4, ar: "صندوق موارد", en: "Resource crate" },
  { tier: 5, ar: "شارة الموسم", en: "Season badge" },
];
const NOTES = {
  ar: [
    "كل سيرفر يحفظ تقدمك لوحده عند الدخول.",
    "القفل بكود من 4 أرقام للباب والصندوق.",
    "حلقة الباب بحجم الجدار، والموارد مجمّعة في بقع.",
    "عملات المتجر ومسار الموسم أرقام تجريبية إلى أن يُربط الدفع.",
  ],
  en: [
    "Each server keeps your progress and restores it when you enter.",
    "Doors and crates take a 4-digit lock.",
    "Door frames match wall size. Resources sit in groves.",
    "Shop coins and the season track are preview numbers until payments are connected.",
  ],
};

function readSave(serverId: string): SaveSnap | null {
  try {
    const raw = localStorage.getItem(`tribals-save-v1:${serverId}`);
    if (!raw) return null;
    return JSON.parse(raw) as SaveSnap;
  } catch {
    return null;
  }
}

export function MainMenu({
  onPlay,
  booting,
  playError,
  userPending,
  signedIn,
  profile,
  muted,
  setMuted,
  founder,
  guestName,
}: {
  onPlay: (training: boolean) => void;
  booting: boolean;
  playError: string;
  userPending: boolean;
  signedIn: boolean;
  profile: Profile | null;
  muted: boolean;
  setMuted: (v: boolean) => void;
  founder: ReactNode;
  guestName: string;
}) {
  const lang = useGameStore((s) => s.lang);
  const serverId = useGameStore((s) => s.serverId);
  const outfit = useGameStore((s) => s.outfit);
  const copy = COPY[lang];
  const [tab, setTab] = useState<Tab>("play");
  const [reduce, setReduce] = useState(() => localStorage.getItem("tribals-reduce-motion") === "1");
  const [setts, setSetts] = useState<GameSettings>(() => loadSettings());
  const [tribe, setTribe] = useState<string | null>(null);
  const [tribes, setTribes] = useState<{ name: string; members: number }[]>([]);
  const [board, setBoard] = useState<{ username: string; score: number; kills: number }[]>([]);
  const [boardState, setBoardState] = useState<"idle" | "loading" | "error" | "ready">("idle");
  const save = readSave(serverId);
  const xp = (save?.kills ?? 0) * 25 + Object.values(save?.quests ?? {}).reduce((a, n) => a + (n || 0) * 10, 0);
  const level = 1 + Math.floor(xp / 100);

  useEffect(() => {
    if (!signedIn) {
      setTribe(null);
      setTribes([]);
      setBoard([]);
      return;
    }
    void moderation()
      .then((m) => setTribe(m.tribe))
      .catch(() => setTribe(null));
    void listTribes()
      .then(setTribes)
      .catch(() => setTribes([]));
  }, [signedIn]);

  useEffect(() => {
    if (tab !== "ranks" || !signedIn) return;
    setBoardState("loading");
    void listLeaderboard({ data: serverId })
      .then((rows) => {
        setBoard(rows);
        setBoardState("ready");
      })
      .catch(() => setBoardState("error"));
  }, [tab, signedIn, serverId]);

  const nav: { id: Tab; label: string; icon: typeof Swords }[] = [
    { id: "play", label: lang === "ar" ? "لعب" : "Play", icon: Swords },
    { id: "character", label: lang === "ar" ? "الشخصية" : "Character", icon: UserRound },
    { id: "inventory", label: copy.inv, icon: Backpack },
    { id: "craft", label: copy.craft, icon: Hammer },
    { id: "shop", label: lang === "ar" ? "المتجر" : "Shop", icon: ShoppingBag },
    { id: "pass", label: lang === "ar" ? "مسار المهام" : "Quest track", icon: Crown },
    { id: "quests", label: lang === "ar" ? "المهام" : "Quests", icon: ScrollText },
    { id: "clans", label: lang === "ar" ? "القبائل" : "Clans", icon: Shield },
    { id: "ranks", label: lang === "ar" ? "المتصدرون" : "Leaderboard", icon: Trophy },
    { id: "settings", label: copy.settings, icon: Settings },
  ];

  function apply(next: GameSettings) {
    setSetts(next);
    saveSettings(next);
  }

  return (
    <div className="absolute inset-0 z-30 overflow-hidden">
      <MenuWorld outfit={outfit} reduce={reduce} />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-ink/80 via-ink/15 to-ink/55" />
      <div className="relative flex h-full flex-col p-3 sm:p-5">
        <header className="pointer-events-auto flex flex-wrap items-center gap-3 rounded-2xl border border-line/80 bg-ink/70 px-3 py-2 backdrop-blur-md">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold tracking-[0.22em] text-amber">{copy.tag}</p>
            <h1 className="text-xl font-extrabold leading-none text-foam">{copy.title}</h1>
          </div>
          <div className="mx-auto hidden text-center sm:block">
            <p className="text-sm font-bold" style={{ color: profile?.nameColor || "#fff" }}>
              {profile?.username || guestName}
            </p>
            <p className="text-[11px] text-muted">
              {lang === "ar" ? "مستوى" : "Lv"} {level} · XP {xp}
              {profile?.isAdmin ? ` · ${copy.adminBadge}` : ""}
            </p>
            <p className="text-[10px] text-sand">
              {lang === "ar" ? "عملات" : "Coins"} {PREVIEW.coins} · {lang === "ar" ? "جواهر" : "Gems"} {PREVIEW.gems}
              <span className="text-muted"> · {lang === "ar" ? "أرقام تجريبية" : "preview numbers"}</span>
            </p>
          </div>
          <div className="ms-auto flex items-center gap-2">
            <span className="rounded-full border border-line px-2 py-1 text-[11px] text-sand">
              {signedIn ? (lang === "ar" ? "الحساب متصل" : "Account online") : lang === "ar" ? `أونلاين · ${guestName}` : `Online · ${guestName}`}
            </span>
            <button type="button" className="rounded-lg border border-line px-2 py-1 text-xs" onClick={() => setTab("shop")}>
              {lang === "ar" ? "المتجر" : "Shop"}
            </button>
            <button type="button" className="rounded-lg border border-line px-2 py-1 text-xs" onClick={() => setTab("settings")}>
              {copy.settings}
            </button>
            <button type="button" className="rounded-lg border border-line px-2 py-1 text-xs" onClick={() => setTab("profile")}>
              {copy.account}
            </button>
          </div>
        </header>

        <div className="mt-3 flex min-h-0 flex-1 gap-3">
          <nav className="pointer-events-auto flex w-[9.5rem] shrink-0 flex-col gap-1 overflow-auto rounded-2xl border border-line/80 bg-ink/65 p-2 backdrop-blur-md sm:w-48">
            {nav.map((item) => {
              const Icon = item.icon;
              const on = tab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setTab(item.id)}
                  className={`flex items-center gap-2 rounded-xl px-2 py-2 text-start text-sm transition ${
                    on ? "bg-amber/20 text-foam shadow-[0_0_0_1px_rgba(201,162,39,0.45)]" : "text-muted hover:bg-raised/80 hover:text-foam"
                  }`}
                >
                  <Icon className="size-4 shrink-0" />
                  <span className="truncate">{item.label}</span>
                </button>
              );
            })}
          </nav>

          <div className="pointer-events-none min-w-0 flex-1" />

          <section className="pointer-events-auto w-[min(24rem,46vw)] overflow-auto rounded-2xl border border-line/80 bg-ink/72 p-4 backdrop-blur-md">
            {tab === "play" && (
              <div className="flex flex-col gap-3">
                <h2 className="text-lg font-bold">{lang === "ar" ? "اختر السيرفر" : "Choose a server"}</h2>
                <div className="grid grid-cols-2 gap-2">
                  {SERVERS.map((srv) => (
                    <button
                      key={srv.id}
                      type="button"
                      onClick={() => useGameStore.getState().setServer(srv.id)}
                      className={`rounded-xl border px-3 py-2 text-start text-sm ${
                        serverId === srv.id ? "border-amber bg-amber/15" : "border-line bg-raised/70"
                      }`}
                    >
                      <span className="block font-bold">{lang === "ar" ? srv.ar : srv.en}</span>
                      <span className="text-[11px] text-muted">{lang === "ar" ? srv.blurbAr : srv.blurbEn}</span>
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  disabled={booting}
                  onClick={() => onPlay(false)}
                  className="rounded-2xl bg-amber px-4 py-4 text-lg font-extrabold text-ink shadow-[0_0_24px_rgba(201,162,39,0.28)] transition hover:brightness-110 active:scale-[0.99] disabled:opacity-60"
                >
                  {booting ? "…" : copy.play}
                </button>
                {playError && <p className="text-sm text-health">{playError}</p>}
                <button type="button" disabled={booting} onClick={() => onPlay(true)} className="rounded-xl border border-line px-4 py-2 text-sm">
                  {copy.train}
                </button>
                <p className="text-[11px] leading-relaxed text-muted">{lang === "ar" ? "الدخول يرجّع تقدم هذا السيرفر إن وُجد." : "Entering restores this server's save when one exists."}</p>
              </div>
            )}

            {tab === "character" && (
              <div>
                <h2 className="text-lg font-bold">{profile?.username || copy.outfits[outfit]}</h2>
                <p className="text-xs text-muted">{lang === "ar" ? "اسحب المشهد لتدوير الشخصية." : "Drag the scene to turn the character."}</p>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  {OUTFITS.map((o) => (
                    <button
                      key={o.id}
                      type="button"
                      onClick={() => useGameStore.getState().setOutfit(o.id)}
                      className={`rounded-xl border px-3 py-3 text-start text-sm ${outfit === o.id ? "border-amber" : "border-line"}`}
                    >
                      <span className="mb-2 block h-2 rounded-full" style={{ background: o.accent }} />
                      {copy.outfits[o.id]}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {tab === "inventory" && <BagView save={save} lang={lang} empty={copy.empty} />}
            {tab === "craft" && (
              <div className="space-y-2">
                <h2 className="text-lg font-bold">{copy.craft}</h2>
                {RECIPES.map((r) => (
                  <div key={r.id} className="rounded-xl border border-line bg-raised/60 px-3 py-2 text-sm">
                    <p className="font-semibold">{copy.items[r.out]} × {r.count}</p>
                    <p className="text-[11px] text-muted">
                      {Object.entries(r.cost)
                        .map(([id, n]) => `${copy.items[id as ItemId]} ${n}`)
                        .join(" · ")}
                    </p>
                  </div>
                ))}
              </div>
            )}

            {tab === "shop" && (
              <Shop
                lang={lang}
                profile={profile}
                signedIn={signedIn}
                price={copy.subPrice}
              />
            )}

            {tab === "pass" && (
              <QuestList
                copy={copy}
                save={save}
                lang={lang}
                note={lang === "ar" ? "المكافآت أعلاه تجريبية. المهام تحتها من حفظك الحقيقي." : "The rewards above are preview data. Quests below come from your real save."}
              />
            )}
            {tab === "quests" && <QuestList copy={copy} save={save} lang={lang} />}

            {tab === "clans" && (
              <div className="space-y-2 text-sm">
                <h2 className="text-lg font-bold">{lang === "ar" ? "القبائل" : "Clans"}</h2>
                <p className="text-muted">{tribe ? `${lang === "ar" ? "قبيلتي" : "My clan"}: ${tribe}` : lang === "ar" ? "لست في قبيلة. من الشات: /tribe create اسم" : "No clan. In chat: /tribe create name"}</p>
                {tribes.length === 0 && <p className="text-xs text-muted">{signedIn ? (lang === "ar" ? "لا توجد قبائل بعد." : "No clans yet.") : lang === "ar" ? "سجل الدخول لرؤية القبائل." : "Sign in to see clans."}</p>}
                {tribes.map((t) => (
                  <div key={t.name} className="flex justify-between rounded-xl border border-line px-3 py-2">
                    <span>{t.name}</span>
                    <span className="text-muted">{t.members}</span>
                  </div>
                ))}
              </div>
            )}

            {tab === "ranks" && (
              <div className="space-y-2 text-sm">
                <h2 className="text-lg font-bold">{serverId}</h2>
                {!signedIn && <p className="text-muted">{lang === "ar" ? "سجل الدخول ليظهر ترتيب السيرفر." : "Sign in to see this server's board."}</p>}
                {boardState === "loading" && <p className="text-muted">…</p>}
                {boardState === "error" && <p className="text-health">{lang === "ar" ? "تعذر تحميل الترتيب." : "Could not load the board."}</p>}
                {boardState === "ready" && board.length === 0 && <p className="text-muted">{lang === "ar" ? "لا نتائج محفوظة بعد." : "No saved scores yet."}</p>}
                {board.map((row, i) => (
                  <div key={row.username} className="flex justify-between rounded-xl border border-line px-3 py-2">
                    <span>{i + 1}. {row.username}</span>
                    <span className="text-sand">{row.score}</span>
                  </div>
                ))}
              </div>
            )}

            {tab === "settings" && (
              <div className="space-y-3 text-sm">
                <h2 className="text-lg font-bold">{copy.settings}</h2>
                <button type="button" className="flex items-center gap-2 rounded-xl border border-line px-3 py-2" onClick={() => setMuted(!muted)}>
                  {muted ? <VolumeX className="size-4" /> : <Volume2 className="size-4" />}
                  {muted ? (lang === "ar" ? "الصوت مغلق" : "Muted") : lang === "ar" ? "الصوت يعمل" : "Sound on"}
                </button>
                <label className="block text-xs text-muted">
                  {copy.sens} · {setts.sens.toFixed(1)}
                  <input type="range" min={0.4} max={2.2} step={0.1} value={setts.sens} onChange={(e) => apply({ ...setts, sens: Number(e.target.value) })} className="mt-1 w-full" />
                </label>
                <label className="block text-xs text-muted">
                  {copy.fov} · {Math.round(setts.fov)}
                  <input type="range" min={60} max={100} step={1} value={setts.fov} onChange={(e) => apply({ ...setts, fov: Number(e.target.value) })} className="mt-1 w-full" />
                </label>
                <label className="flex items-center justify-between text-xs">
                  {copy.bob}
                  <input type="checkbox" checked={setts.headBob} onChange={(e) => apply({ ...setts, headBob: e.target.checked })} />
                </label>
                <label className="flex items-center justify-between text-xs">
                  {copy.particles}
                  <input type="checkbox" checked={setts.particles} onChange={(e) => apply({ ...setts, particles: e.target.checked })} />
                </label>
                <label className="block text-xs text-muted">
                  {copy.viewDist} · {Math.round(setts.view)}
                  <input type="range" min={80} max={280} step={10} value={setts.view} onChange={(e) => apply({ ...setts, view: Number(e.target.value) })} className="mt-1 w-full" />
                </label>
                <div className="flex gap-2">
                  {(["low", "med", "high"] as const).map((q) => (
                    <button key={q} type="button" onClick={() => apply({ ...setts, quality: q })} className={`rounded-lg border px-2 py-1 text-xs ${setts.quality === q ? "border-amber" : "border-line"}`}>
                      {q === "low" ? copy.qLow : q === "high" ? copy.qHigh : copy.qMed}
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  className="rounded-xl border border-line px-3 py-2 text-xs"
                  onClick={() => {
                    const next = !reduce;
                    setReduce(next);
                    localStorage.setItem("tribals-reduce-motion", next ? "1" : "0");
                  }}
                >
                  {lang === "ar" ? "تقليل الحركة" : "Reduce motion"}: {reduce ? (lang === "ar" ? "تشغيل" : "On") : lang === "ar" ? "إيقاف" : "Off"}
                </button>
                <button type="button" className="rounded-xl border border-line px-3 py-2 text-xs" onClick={() => useGameStore.getState().setLang(lang === "ar" ? "en" : "ar")}>
                  {copy.lang}
                </button>
                <button type="button" className="rounded-xl border border-line px-3 py-2 text-xs" onClick={() => apply({ ...DEFAULT_SETTINGS })}>
                  {lang === "ar" ? "استعادة الافتراضي" : "Reset defaults"}
                </button>
                <p className="text-[11px] text-muted">{copy.controls}</p>
              </div>
            )}

            {tab === "profile" && (
              <div className="space-y-2 text-sm">
                <h2 className="text-lg font-bold">{copy.account}</h2>
                {userPending ? (
                  <div className="h-8 animate-pulse rounded-lg bg-raised" />
                ) : signedIn && profile ? (
                  <>
                    <UserButton />
                    <p style={{ color: profile.nameColor }}>{profile.username}</p>
                    <p className="text-muted">{lang === "ar" ? "مستوى" : "Level"} {level} · XP {xp}</p>
                    <p className="text-muted">{lang === "ar" ? "القتل" : "Kills"} {save?.kills ?? 0} · {lang === "ar" ? "النقاط" : "Score"} {save?.score ?? 0}</p>
                    <p className="text-muted">{lang === "ar" ? "وقت اللعب (ث)" : "Session (s)"} {Math.floor(save?.session ?? 0)}</p>
                    <p className="text-muted">{tribe ? tribe : lang === "ar" ? "بدون قبيلة" : "No clan"}</p>
                    {profile.isFounder && founder}
                  </>
                ) : (
                  <Link to="/login" className="inline-block rounded-xl bg-amber px-4 py-2 font-bold text-ink">
                    {copy.login}
                  </Link>
                )}
              </div>
            )}

            <div className="mt-4 border-t border-line pt-3">
              <p className="mb-1 text-[11px] font-semibold text-sand">{lang === "ar" ? "سجل التحديث" : "Patch notes"}</p>
              <ul className="space-y-1 text-[11px] leading-snug text-muted">
                {NOTES[lang].map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

function BagView({ save, lang, empty }: { save: SaveSnap | null; lang: "ar" | "en"; empty: string }) {
  const copy = COPY[lang];
  const slots = (save?.inventory ?? []).filter((s) => s && s.count > 0);
  return (
    <div>
      <h2 className="mb-2 text-lg font-bold">{copy.inv}</h2>
      {slots.length === 0 && <p className="text-sm text-muted">{empty}</p>}
      <div className="grid grid-cols-2 gap-2">
        {slots.map((s) => (
          <div key={s.id} className="flex items-center gap-2 rounded-xl border border-line bg-raised/60 px-2 py-2 text-sm">
            <img src={ITEM[s.id].icon} alt="" className="size-8 object-contain" />
            <span>
              {copy.items[s.id]}
              <span className="block text-[11px] text-muted">{s.count}</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function QuestList({
  copy,
  save,
  note,
  lang,
}: {
  copy: (typeof COPY)["ar"] | (typeof COPY)["en"];
  save: SaveSnap | null;
  note?: string;
  lang: "ar" | "en";
}) {
  return (
    <div className="space-y-2">
      {note && <p className="text-xs text-muted">{note}</p>}
      {note && (
        <>
          <p className="text-xs text-sand">
            {lang === "ar" ? "الموسم التجريبي" : "Preview season"} {PREVIEW.passTier}/{PREVIEW.passMax}
          </p>
          {PASS_PREVIEW.map((step) => (
            <div key={step.tier} className="flex justify-between rounded-xl border border-line px-3 py-2 text-sm">
              <span>
                {step.tier}. {lang === "ar" ? step.ar : step.en}
              </span>
              <span className="text-muted">{step.tier <= PREVIEW.passTier ? "✓" : "·"}</span>
            </div>
          ))}
        </>
      )}
      {copy.quests.map((q) => {
        const cur = save?.quests?.[q.id] ?? 0;
        const pct = Math.min(100, Math.round((cur / q.target) * 100));
        return (
          <div key={q.id}>
            <div className="flex justify-between text-sm">
              <span>{q.title}</span>
              <span className="text-muted">{Math.min(cur, q.target)}/{q.target}</span>
            </div>
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-raised">
              <div className="h-full bg-amber" style={{ width: `${pct}%` }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function Shop({
  lang,
  profile,
  signedIn,
  price,
}: {
  lang: "ar" | "en";
  profile: Profile | null;
  signedIn: boolean;
  price: string;
}) {
  const [msg, setMsg] = useState("");
  const canColor = !!profile && (profile.isAdmin || profile.premium);
  return (
    <div className="space-y-3 text-sm">
      <h2 className="text-lg font-bold">{lang === "ar" ? "المتجر" : "Shop"}</h2>
      <div className="rounded-xl border border-line bg-raised/70 p-3">
        <p className="font-bold">{lang === "ar" ? "كتالوج تجريبي" : "Preview catalog"}</p>
        <p className="mt-1 text-[11px] text-muted">
          {lang === "ar" ? "العناصر التالية شكل فقط. الشراء سيُربط لاحقاً ولا يمنح شيئاً الآن." : "These cards are placeholders. Buying does nothing until payments are connected."}
        </p>
        <div className="mt-2 space-y-2">
          {SHOP_PREVIEW.map((item) => (
            <button
              key={item.id}
              type="button"
              className="flex w-full items-center justify-between rounded-xl border border-line px-3 py-2 text-start"
              onClick={() => setMsg(lang === "ar" ? "سيُفعّل الشراء لاحقاً" : "Purchases will be enabled later")}
            >
              <span>{lang === "ar" ? item.ar : item.en}</span>
              <span className="text-sand">{item.price}</span>
            </button>
          ))}
        </div>
      </div>
      <div className="rounded-xl border border-amber/40 bg-raised/70 p-3">
        <p className="font-bold">{lang === "ar" ? "عضوية الاسم" : "Name membership"}</p>
        <p className="mt-1 text-xs text-muted">{price}</p>
        <p className="mt-2 text-xs text-sand">
          {profile?.premium
            ? lang === "ar"
              ? "العضوية مفعّلة على حسابك."
              : "Membership is active on this account."
            : lang === "ar"
              ? "الدفع غير موصول. لا يمكن شراء العضوية من المتصفح."
              : "Payments are not connected. The browser cannot grant membership."}
        </p>
      </div>
      <div>
        <p className="mb-2 text-xs text-muted">{lang === "ar" ? "لون الاسم" : "Name color"}</p>
        <div className="flex gap-2">
          {NAME_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              disabled={!canColor}
              title={canColor ? c : price}
              onClick={() => {
                void setNameColor({ data: c })
                  .then((r) => setMsg(r.ok ? c : lang === "ar" ? "غير متاح" : "Unavailable"))
                  .catch(() => setMsg(lang === "ar" ? "تعذر الحفظ" : "Could not save"));
              }}
              className="size-7 rounded-full border border-line disabled:opacity-40"
              style={{ background: c }}
            />
          ))}
        </div>
        {msg && <p className="mt-2 text-xs text-sand">{msg}</p>}
        {!signedIn && <p className="mt-2 text-xs text-muted">{lang === "ar" ? "سجل الدخول أولاً." : "Sign in first."}</p>}
      </div>
      <p className="text-[11px] text-muted">
        {lang === "ar"
          ? "إعلان المكافأة يظهر داخل الجزيرة فقط، ولا يُمنح من هذه القائمة."
          : "The reward ad only runs inside the island, not from this menu."}
      </p>
    </div>
  );
}
