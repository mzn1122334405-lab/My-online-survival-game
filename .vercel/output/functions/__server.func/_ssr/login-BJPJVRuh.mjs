import { o as __toESM } from "../_runtime.mjs";
import { S as require_jsx_runtime, Y as require_react, b as useNavigate, y as Link } from "../_libs/@tanstack/react-router+[...].mjs";
import { r as signIn, t as authClient } from "./client-1vAx-gM_.mjs";
import { t as GROK_PROVIDERS } from "./server-ClEkcw8V.mjs";
import { c as useCurrentUserState, l as useGameStore, o as upsertProfile } from "./online-C6tyAErU.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/login-BJPJVRuh.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
function Login() {
	const nav = useNavigate();
	const lang = useGameStore((s) => s.lang);
	const { user, isPending } = useCurrentUserState();
	const ar = lang === "ar";
	const [mode, setMode] = (0, import_react.useState)("in");
	const [email, setEmail] = (0, import_react.useState)("");
	const [password, setPassword] = (0, import_react.useState)("");
	const [username, setUsername] = (0, import_react.useState)("");
	const [err, setErr] = (0, import_react.useState)("");
	const [busy, setBusy] = (0, import_react.useState)(false);
	(0, import_react.useEffect)(() => {
		if (!isPending && user) nav({ to: "/" });
	}, [
		isPending,
		user,
		nav
	]);
	(0, import_react.useEffect)(() => {
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
	async function onEmail(e) {
		e.preventDefault();
		setErr("");
		setBusy(true);
		try {
			if (mode === "up") {
				const name = username.replace(/[^a-zA-Z0-9_]/g, "").slice(0, 20);
				if (name.length < 3) throw new Error(ar ? "اسم المستخدم ٣ أحرف على الأقل" : "Username needs 3+ characters");
				const { error } = await authClient.signUp.email({
					email,
					password,
					name
				});
				if (error) throw new Error(error.message ?? "sign up failed");
				await upsertProfile({ data: name });
			} else {
				const { error } = await authClient.signIn.email({
					email,
					password
				});
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
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("main", {
		className: "grid min-h-dvh place-items-center overflow-y-auto bg-ink p-5 text-foam",
		dir: ar ? "rtl" : "ltr",
		style: { fontFamily: "var(--font-sans)" },
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "w-full max-w-md space-y-5 rounded-2xl border border-line bg-surface p-6",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "text-xs font-semibold tracking-[0.28em] text-amber",
						children: "TRIBALS"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
						className: "mt-1 text-2xl font-extrabold",
						children: ar ? "الحساب" : "Account"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mt-1 text-sm text-muted",
						children: ar ? "سجّل للعب أونلاين والدردشة مع اللاعبين." : "Sign in to play online and chat with others."
					})
				] }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "flex gap-2",
						children: GROK_PROVIDERS.map((p) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							type: "button",
							onClick: () => signIn(p.providerId, { callbackURL: "/" }),
							className: "flex-1 rounded-xl border border-line bg-raised px-3 py-3 text-sm font-semibold hover:border-sand",
							children: ar ? `متابعة مع ${p.label}` : `Continue with ${p.label}`
						}, p.providerId))
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex items-center gap-3 text-xs text-muted",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "h-px flex-1 bg-line" }),
							ar ? "أو بالبريد" : "or email",
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "h-px flex-1 bg-line" })
						]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex rounded-xl border border-line p-1",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							type: "button",
							onClick: () => setMode("in"),
							className: `flex-1 rounded-lg py-2 text-sm font-semibold ${mode === "in" ? "bg-amber text-ink" : "text-muted"}`,
							children: ar ? "دخول" : "Sign in"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							type: "button",
							onClick: () => setMode("up"),
							className: `flex-1 rounded-lg py-2 text-sm font-semibold ${mode === "up" ? "bg-amber text-ink" : "text-muted"}`,
							children: ar ? "حساب جديد" : "Create account"
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("form", {
						className: "space-y-3",
						onSubmit: onEmail,
						children: [
							mode === "up" && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
								className: "block text-sm",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "mb-1 block text-muted",
									children: ar ? "اسم المستخدم" : "Username"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
									required: true,
									value: username,
									onChange: (e) => setUsername(e.target.value),
									className: "w-full rounded-xl border border-line bg-raised px-3 py-3 text-foam outline-none focus:border-amber",
									placeholder: "sultan1v4",
									autoComplete: "username"
								})]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
								className: "block text-sm",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "mb-1 block text-muted",
									children: ar ? "البريد" : "Email"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
									required: true,
									type: "email",
									value: email,
									onChange: (e) => setEmail(e.target.value),
									className: "w-full rounded-xl border border-line bg-raised px-3 py-3 text-foam outline-none focus:border-amber",
									autoComplete: "email"
								})]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
								className: "block text-sm",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "mb-1 block text-muted",
									children: ar ? "كلمة المرور" : "Password"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
									required: true,
									type: "password",
									minLength: 8,
									value: password,
									onChange: (e) => setPassword(e.target.value),
									className: "w-full rounded-xl border border-line bg-raised px-3 py-3 text-foam outline-none focus:border-amber",
									autoComplete: mode === "up" ? "new-password" : "current-password"
								})]
							}),
							err && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "text-sm text-health",
								children: err
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								type: "submit",
								disabled: busy,
								className: "w-full rounded-xl bg-foam py-3 font-bold text-ink disabled:opacity-60",
								children: busy ? "…" : mode === "up" ? ar ? "إنشاء الحساب" : "Create account" : ar ? "دخول" : "Sign in"
							})
						]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "text-xs text-muted",
						children: ar ? "أمر الأدمن: /giveadmin sultan1v4 — الحساب sultan1v4 يصبح أدمن تلقائياً." : "Admin command: /giveadmin sultan1v4 — that account is auto-admin."
					})
				] }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
					to: "/",
					className: "block text-center text-sm text-sand hover:text-amber",
					children: ar ? "العودة للجزيرة" : "Back to the island"
				})
			]
		})
	});
}
//#endregion
export { Login as component };
