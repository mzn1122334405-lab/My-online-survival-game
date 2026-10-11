import { a as getServerFnById, i as TSS_SERVER_FUNCTION, r as createServerFn } from "./ssr.mjs";
import { t as authClient } from "./client-1vAx-gM_.mjs";
import { s as authMiddleware, t as COPY } from "./data-nTq2QRWJ.mjs";
import { t as create } from "../_libs/zustand.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/online-C6tyAErU.js
var emptyInv = () => Array.from({ length: 48 }, () => null);
var useGameStore = create((set, get) => ({
	lang: "ar",
	screen: "menu",
	overlay: "none",
	training: false,
	outfit: 0,
	hasSave: false,
	locked: false,
	health: 100,
	hunger: 100,
	thirst: 100,
	stamina: 100,
	timeOfDay: .28,
	raining: false,
	fps: 60,
	session: 0,
	yaw: 0,
	kills: 0,
	score: 0,
	inventory: emptyInv(),
	hotIndex: 0,
	prompt: null,
	toasts: [],
	quests: {
		wood: 0,
		axe: 0,
		tree: 0,
		hunt: 0,
		base: 0,
		raid: 0
	},
	nearStation: "hand",
	interactOpen: false,
	minimap: "",
	aimOk: false,
	hurt: 0,
	setLang: (lang) => set({ lang }),
	setOutfit: (outfit) => set({ outfit }),
	setScreen: (screen) => set({ screen }),
	setOverlay: (overlay) => set({ overlay }),
	patch: (p) => set(p),
	toast: (text) => {
		const id = Date.now() + Math.random();
		set({ toasts: [...get().toasts.slice(-4), {
			id,
			text
		}] });
		setTimeout(() => {
			set({ toasts: get().toasts.filter((t) => t.id !== id) });
		}, 2800);
	}
}));
function t() {
	return COPY[useGameStore.getState().lang];
}
function freshInventory(training) {
	const inv = emptyInv();
	const give = (i, id, count) => {
		inv[i] = {
			id,
			count
		};
	};
	if (training) {
		give(40, "axe", 1);
		give(41, "pickaxe", 1);
		give(0, "wood", 20);
		give(1, "stone", 16);
		give(2, "berries", 8);
		give(3, "fiber", 12);
		give(4, "herbs", 6);
	} else {
		give(40, "knife", 1);
		give(0, "berries", 4);
		give(1, "fiber", 4);
	}
	return inv;
}
/**
* Current user + loading state. Same behavior in live preview and when deployed:
*   - Auth enabled -> the real signed-in user; `user` is `null` while
*                            the session resolves (`isPending: true`) and when
*                            signed out (`isPending: false`). Session comes from
*                            Better Auth `useSession()` → `/api/auth/get-session`
*                            (cookie when deployed; bearer in live preview).
*   - Auth disabled (`VITE_AUTH_ENABLED=false`) -> `DEV_USER`, never pending.
*
* Protect a route by waiting out `isPending` before acting on `user` —
* redirecting on `user: null` alone bounces signed-in visitors to sign-in on
* every hard reload:
*
*   import { RedirectToSignIn } from "@/lib/auth/gates";
*   const { user, isPending } = useCurrentUserState();
*   if (isPending) return null;              // still resolving — don't redirect yet
*   if (!user) return <RedirectToSignIn />;  // definitely signed out
*
* `authEnabled` is a module-level constant fixed at load, so the guarded hook
* call keeps a stable hook order across every render of a given component.
*/
function useCurrentUserState() {
	const { data, isPending } = authClient.useSession();
	const user = data?.user;
	return {
		user: user ? {
			id: user.id,
			displayName: user.name ?? null,
			primaryEmail: user.email ?? null,
			profileImageUrl: user.image ?? null,
			isDevFallback: false
		} : null,
		isPending
	};
}
/**
* Convenience view of `useCurrentUserState().user` for display (e.g.
* `user?.displayName ?? "Guest"`). NOTE: `null` means *loading OR signed out* —
* for redirects/guards use `useCurrentUserState()` and check `isPending`.
*/
function useCurrentUser() {
	return useCurrentUserState().user;
}
var createSsrRpc = (functionId) => {
	const url = "/_serverFn/" + functionId;
	const serverFnMeta = { id: functionId };
	const fn = async (...args) => {
		return (await getServerFnById(functionId, { origin: "server" }))(...args);
	};
	return Object.assign(fn, {
		url,
		serverFnMeta,
		[TSS_SERVER_FUNCTION]: true
	});
};
function sanitizeName(raw) {
	const s = raw.replace(/[^a-zA-Z0-9_]/g, "").slice(0, 20);
	return s.length >= 3 ? s : "";
}
var upsertProfile = createServerFn({ method: "POST" }).middleware([authMiddleware]).validator((username) => sanitizeName(username)).handler(createSsrRpc("dc493e14c63b83dcf6712275556e48443e007566f840e5c0790ac7df3313914f"));
var getMyProfile = createServerFn({ method: "GET" }).middleware([authMiddleware]).handler(createSsrRpc("412bd0897c846210043a8338397b09ca45f8a17a12806b27308894528675f963"));
var listChat = createServerFn({ method: "GET" }).middleware([authMiddleware]).handler(createSsrRpc("3e1f2eee10824b4fc500b4412a3de60e3bca459d6bc6b940834c44d9f4252644"));
var sendChat = createServerFn({ method: "POST" }).middleware([authMiddleware]).validator((body) => body.trim().slice(0, 240)).handler(createSsrRpc("7cc86dfee0d9215a95744a837385d055895df349be983f860ec3cb8ad5fefb76"));
//#endregion
export { t as a, useCurrentUserState as c, sendChat as i, useGameStore as l, getMyProfile as n, upsertProfile as o, listChat as r, useCurrentUser as s, freshInventory as t };
