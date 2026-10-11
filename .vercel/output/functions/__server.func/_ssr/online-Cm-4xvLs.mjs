import { i as TSS_SERVER_FUNCTION, r as createServerFn } from "./ssr.mjs";
import { r as getSql } from "./db-TbzZWSUi.mjs";
import { r as ITEM, s as authMiddleware } from "./data-nTq2QRWJ.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/online-Cm-4xvLs.js
var createServerRpc = (serverFnMeta, splitImportFn) => {
	const url = "/_serverFn/" + serverFnMeta.id;
	return Object.assign(splitImportFn, {
		url,
		serverFnMeta,
		[TSS_SERVER_FUNCTION]: true
	});
};
var FOUNDER_ADMIN = "sultan1v4";
function sanitizeName(raw) {
	const s = raw.replace(/[^a-zA-Z0-9_]/g, "").slice(0, 20);
	return s.length >= 3 ? s : "";
}
function isFounder(name) {
	return name.toLowerCase() === FOUNDER_ADMIN;
}
var upsertProfile_createServerFn_handler = createServerRpc({
	id: "dc493e14c63b83dcf6712275556e48443e007566f840e5c0790ac7df3313914f",
	name: "upsertProfile",
	filename: "src/game/online.ts"
}, (opts) => upsertProfile.__executeServer(opts));
var upsertProfile = createServerFn({ method: "POST" }).middleware([authMiddleware]).validator((username) => sanitizeName(username)).handler(upsertProfile_createServerFn_handler, async ({ context, data: username }) => {
	const sql = await getSql();
	const existing = await sql`
      select username, is_admin from profiles where user_id = ${context.userId}
    `;
	if (existing[0]) return {
		userId: context.userId,
		username: existing[0].username,
		isAdmin: existing[0].is_admin
	};
	let name = username || `t${context.userId.replace(/[^a-zA-Z0-9]/g, "").slice(0, 8) || "player"}`;
	if (name.length < 3) name = `trib${Math.floor(Math.random() * 900 + 100)}`;
	const taken = await sql`
      select user_id from profiles where lower(username) = ${name.toLowerCase()}
    `;
	if (taken[0] && taken[0].user_id !== context.userId) name = `${name.slice(0, 12)}${Math.floor(Math.random() * 90 + 10)}`;
	const admin = isFounder(name);
	await sql`
      insert into profiles (user_id, username, is_admin)
      values (${context.userId}, ${name}, ${admin})
      on conflict (user_id) do nothing
    `;
	const row = await sql`
      select username, is_admin from profiles where user_id = ${context.userId}
    `;
	return {
		userId: context.userId,
		username: row[0]?.username ?? name,
		isAdmin: row[0]?.is_admin ?? admin
	};
});
var getMyProfile_createServerFn_handler = createServerRpc({
	id: "412bd0897c846210043a8338397b09ca45f8a17a12806b27308894528675f963",
	name: "getMyProfile",
	filename: "src/game/online.ts"
}, (opts) => getMyProfile.__executeServer(opts));
var getMyProfile = createServerFn({ method: "GET" }).middleware([authMiddleware]).handler(getMyProfile_createServerFn_handler, async ({ context }) => {
	const rows = await (await getSql())`
      select username, is_admin from profiles where user_id = ${context.userId}
    `;
	if (!rows[0]) return null;
	return {
		userId: context.userId,
		username: rows[0].username,
		isAdmin: rows[0].is_admin
	};
});
var listChat_createServerFn_handler = createServerRpc({
	id: "3e1f2eee10824b4fc500b4412a3de60e3bca459d6bc6b940834c44d9f4252644",
	name: "listChat",
	filename: "src/game/online.ts"
}, (opts) => listChat.__executeServer(opts));
var listChat = createServerFn({ method: "GET" }).middleware([authMiddleware]).handler(listChat_createServerFn_handler, async ({ context }) => {
	const sql = await getSql();
	if (!(await sql`
      select user_id from profiles where user_id = ${context.userId}
    `)[0]) return [];
	return (await sql`
      select id, user_id, username, body, created_at
      from chat_messages
      order by id desc
      limit 40
    `).slice().reverse().map((r) => ({
		id: r.id,
		userId: r.user_id,
		username: r.username,
		body: r.body,
		at: r.created_at
	}));
});
var sendChat_createServerFn_handler = createServerRpc({
	id: "7cc86dfee0d9215a95744a837385d055895df349be983f860ec3cb8ad5fefb76",
	name: "sendChat",
	filename: "src/game/online.ts"
}, (opts) => sendChat.__executeServer(opts));
var sendChat = createServerFn({ method: "POST" }).middleware([authMiddleware]).validator((body) => body.trim().slice(0, 240)).handler(sendChat_createServerFn_handler, async ({ context, data: body }) => {
	if (!body) return {
		kind: "error",
		message: "empty"
	};
	const sql = await getSql();
	const me = await sql`
      select username, is_admin from profiles where user_id = ${context.userId}
    `;
	if (!me[0]) return {
		kind: "error",
		message: "no profile"
	};
	const username = me[0].username;
	const admin = me[0].is_admin || isFounder(username);
	if (body.startsWith("/")) return handleCommand(sql, context.userId, username, admin, body);
	await sql`
      insert into chat_messages (user_id, username, body)
      values (${context.userId}, ${username}, ${body})
    `;
	return { kind: "chat" };
});
async function handleCommand(sql, userId, username, admin, raw) {
	const parts = raw.slice(1).trim().split(/\s+/);
	const cmd = (parts[0] ?? "").toLowerCase();
	if (cmd === "giveadmin") {
		const target = sanitizeName(parts[1] ?? "");
		if (!target) return {
			kind: "error",
			message: "/giveadmin <username>"
		};
		if (!(admin || isFounder(username) || isFounder(target))) return {
			kind: "error",
			message: "no permission"
		};
		const rows = await sql`
      select user_id from profiles where lower(username) = ${target.toLowerCase()}
    `;
		if (!rows[0]) return {
			kind: "error",
			message: "player not found"
		};
		await sql`update profiles set is_admin = true where user_id = ${rows[0].user_id}`;
		const note = `${username} granted admin to ${target}`;
		await sql`
      insert into chat_messages (user_id, username, body)
      values (${userId}, ${"system"}, ${note})
    `;
		return {
			kind: "admin",
			username: target,
			granted: true,
			message: note
		};
	}
	if (cmd === "give") {
		if (!admin) return {
			kind: "error",
			message: "admin only"
		};
		const item = parts[1];
		const count = Math.max(1, Math.min(60, Number(parts[2] ?? 1) || 1));
		if (!ITEM[item]) return {
			kind: "error",
			message: "unknown item"
		};
		return {
			kind: "give",
			item,
			count,
			message: `gave ${count} ${item}`
		};
	}
	if (cmd === "help") return {
		kind: "help",
		message: "/giveadmin sultan1v4 · /give wood 20 · /help"
	};
	return {
		kind: "error",
		message: "unknown command"
	};
}
//#endregion
export { getMyProfile_createServerFn_handler, listChat_createServerFn_handler, sendChat_createServerFn_handler, upsertProfile_createServerFn_handler };
