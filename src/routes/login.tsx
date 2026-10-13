import { useEffect, useState, type FormEvent } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { GROK_PROVIDERS, authClient, authEnabled, signIn } from "@/lib/auth/client";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { upsertProfile } from "@/game/online";
import { useGameStore } from "@/game/store";

export const Route = createFileRoute("/login")({ component: Login });

function Login() {
  const nav = useNavigate();
  const lang = useGameStore((s) => s.lang);
  const { user, isPending } = useCurrentUserState();
  const ar = lang === "ar";
  const [mode, setMode] = useState<"in" | "up">("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!isPending && user) void nav({ to: "/" });
  }, [isPending, user, nav]);

  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;
    html.style.overflow = "auto";
    body.style.overflow = "auto";
    body.style.touchAction = "auto";
    return () => {
      html.style.overflow = "hidden";
      body.style.overflow = "hidden";
      body.style.touchAction = "none";
    };
  }, []);

  async function onEmail(e: FormEvent) {
    e.preventDefault();
    setErr("");
    setBusy(true);
    try {
      if (mode === "up") {
        const name = username.replace(/[^a-zA-Z0-9_]/g, "").slice(0, 20);
        if (name.length < 3) throw new Error(ar ? "اسم المستخدم ٣ أحرف على الأقل" : "Username needs 3+ characters");
        const { error } = await authClient.signUp.email({ email, password, name });
        if (error) throw new Error(error.message ?? "sign up failed");
        await upsertProfile({ data: name });
      } else {
        const { error } = await authClient.signIn.email({ email, password });
        if (error) throw new Error(error.message ?? "sign in failed");
        await upsertProfile({ data: username || (email.split("@")[0] ?? "player") });
      }
      await nav({ to: "/" });
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main
      className="grid min-h-dvh place-items-center overflow-y-auto bg-ink p-5 text-foam"
      dir={ar ? "rtl" : "ltr"}
      style={{ fontFamily: "var(--font-sans)" }}
    >
      <div className="w-full max-w-md space-y-5 rounded-2xl border border-line bg-surface p-6">
        <div>
          <p className="text-xs font-semibold tracking-[0.28em] text-amber">TRIBALS</p>
          <h1 className="mt-1 text-2xl font-extrabold">{ar ? "الحساب" : "Account"}</h1>
          <p className="mt-1 text-sm text-muted">
            {ar ? "سجّل للعب أونلاين والدردشة مع اللاعبين." : "Sign in to play online and chat with others."}
          </p>
        </div>

        {!authEnabled ? (
          <p className="text-sm text-muted">{ar ? "تسجيل الدخول متوقف." : "Sign-in is disabled."}</p>
        ) : (
          <>
            <div className="flex gap-2">
              {GROK_PROVIDERS.map((p) => (
                <button
                  key={p.providerId}
                  type="button"
                  onClick={() => signIn(p.providerId, { callbackURL: "/" })}
                  className="flex-1 rounded-xl border border-line bg-raised px-3 py-3 text-sm font-semibold hover:border-sand"
                >
                  {ar ? `متابعة مع ${p.label}` : `Continue with ${p.label}`}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-3 text-xs text-muted">
              <span className="h-px flex-1 bg-line" />
              {ar ? "أو بالبريد" : "or email"}
              <span className="h-px flex-1 bg-line" />
            </div>

            <div className="flex rounded-xl border border-line p-1">
              <button
                type="button"
                onClick={() => setMode("in")}
                className={`flex-1 rounded-lg py-2 text-sm font-semibold ${mode === "in" ? "bg-amber text-ink" : "text-muted"}`}
              >
                {ar ? "دخول" : "Sign in"}
              </button>
              <button
                type="button"
                onClick={() => setMode("up")}
                className={`flex-1 rounded-lg py-2 text-sm font-semibold ${mode === "up" ? "bg-amber text-ink" : "text-muted"}`}
              >
                {ar ? "حساب جديد" : "Create account"}
              </button>
            </div>

            <form className="space-y-3" onSubmit={onEmail}>
              {mode === "up" && (
                <label className="block text-sm">
                  <span className="mb-1 block text-muted">{ar ? "اسم المستخدم" : "Username"}</span>
                  <input
                    required
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="w-full rounded-xl border border-line bg-raised px-3 py-3 text-foam outline-none focus:border-amber"
                    placeholder="sultan1v4"
                    autoComplete="username"
                  />
                </label>
              )}
              <label className="block text-sm">
                <span className="mb-1 block text-muted">{ar ? "البريد" : "Email"}</span>
                <input
                  required
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-xl border border-line bg-raised px-3 py-3 text-foam outline-none focus:border-amber"
                  autoComplete="email"
                />
              </label>
              <label className="block text-sm">
                <span className="mb-1 block text-muted">{ar ? "كلمة المرور" : "Password"}</span>
                <input
                  required
                  type="password"
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-xl border border-line bg-raised px-3 py-3 text-foam outline-none focus:border-amber"
                  autoComplete={mode === "up" ? "new-password" : "current-password"}
                />
              </label>
              {err && <p className="text-sm text-health">{err}</p>}
              <button
                type="submit"
                disabled={busy}
                className="w-full rounded-xl bg-foam py-3 font-bold text-ink disabled:opacity-60"
              >
                {busy ? "…" : mode === "up" ? (ar ? "إنشاء الحساب" : "Create account") : ar ? "دخول" : "Sign in"}
              </button>
            </form>
            <p className="text-xs text-muted">
              {ar
                ? "حساب sultan1v4 هو المالك. إضافة الأدمن من قائمة اللعبة وتظهر له فقط."
                : "sultan1v4 is the owner. Admin grants live in the game menu and only that account can see them."}
            </p>
          </>
        )}

        <Link to="/" className="block text-center text-sm text-sand hover:text-amber">
          {ar ? "العودة للجزيرة" : "Back to the island"}
        </Link>
      </div>
    </main>
  );
}
