import { createServerFn } from "@tanstack/react-start";
import { getSql } from "@/lib/db";
import { authMiddleware } from "@/lib/auth/middleware";
import { ITEM, type ItemId } from "./data";

export const FOUNDER_ADMIN = "sultan1v4";

export type Profile = {
  userId: string;
  username: string;
  isAdmin: boolean;
  isFounder: boolean;
  nameColor: string;
  premium: boolean;
};

export type ChatRow = {
  id: number;
  userId: string;
  username: string;
  body: string;
  at: string;
  color: string;
};

export type ChatResult =
  | { kind: "chat" }
  | { kind: "give"; item: ItemId; count: number; message: string }
  | { kind: "admin"; username: string; granted: boolean; message: string }
  | { kind: "god" }
  | { kind: "staff" }
  | { kind: "kick"; username: string }
  | { kind: "ban"; username: string }
  | { kind: "unban"; username: string }
  | { kind: "tribe"; name: string }
  | { kind: "help"; message: string }
  | { kind: "error"; message: string };

export type Moderation = {
  banned: boolean;
  kickedAt: string | null;
  tribe: string | null;
};

function sanitizeName(raw: string) {
  const s = raw.replace(/[^a-zA-Z0-9_]/g, "").slice(0, 20);
  return s.length >= 3 ? s : "";
}

function isFounder(name: string) {
  return name.toLowerCase() === FOUNDER_ADMIN;
}

async function readProfile(
  sql: Awaited<ReturnType<typeof getSql>>,
  userId: string,
): Promise<Profile | null> {
  const rows = await sql<{ username: string; is_admin: boolean; name_color: string | null; premium_until: string | null }>`
    select username, is_admin, name_color, premium_until from profiles where user_id = ${userId}
  `;
  if (!rows[0]) return null;
  const founder = isFounder(rows[0].username);
  let admin = rows[0].is_admin;
  if (founder && !admin) {
    await sql`update profiles set is_admin = true where user_id = ${userId}`;
    admin = true;
  }
  const premium = !!rows[0].premium_until && new Date(rows[0].premium_until).getTime() > Date.now();
  const stored = rows[0].name_color && /^#[0-9a-fA-F]{6}$/.test(rows[0].name_color) ? rows[0].name_color : "#ffffff";
  return {
    userId,
    username: rows[0].username,
    isAdmin: admin || founder,
    isFounder: founder,
    nameColor: admin || founder || premium ? stored : "#ffffff",
    premium: premium || admin || founder,
  };
}

async function adminNames(sql: Awaited<ReturnType<typeof getSql>>) {
  const rows = await sql<{ username: string }>`
    select username from profiles where is_admin = true order by lower(username)
  `;
  return rows.map((r) => r.username);
}

export const upsertProfile = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((username: string) => sanitizeName(username))
  .handler(async ({ context, data: username }): Promise<Profile> => {
    const sql = await getSql();
    const existing = await sql<{ username: string; is_admin: boolean }>`
      select username, is_admin from profiles where user_id = ${context.userId}
    `;
    if (existing[0]) {
      const profile = await readProfile(sql, context.userId);
      if (profile) return profile;
    }
    let name = username || `t${context.userId.replace(/[^a-zA-Z0-9]/g, "").slice(0, 8) || "player"}`;
    if (name.length < 3) name = `trib${Math.floor(Math.random() * 900 + 100)}`;
    const taken = await sql<{ user_id: string }>`
      select user_id from profiles where lower(username) = ${name.toLowerCase()}
    `;
    if (taken[0] && taken[0].user_id !== context.userId) {
      name = `${name.slice(0, 12)}${Math.floor(Math.random() * 90 + 10)}`;
    }
    const admin = isFounder(name);
    await sql`
      insert into profiles (user_id, username, is_admin)
      values (${context.userId}, ${name}, ${admin})
      on conflict (user_id) do nothing
    `;
    const row = await readProfile(sql, context.userId);
    return (
      row ?? {
        userId: context.userId,
        username: name,
        isAdmin: admin,
        isFounder: isFounder(name),
        nameColor: "#ffffff",
        premium: admin,
      }
    );
  });

export const getMyProfile = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }): Promise<Profile | null> => {
    const sql = await getSql();
    const profile = await readProfile(sql, context.userId);
    return profile;
  });

export const enterServer = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((id: string) => id.slice(0, 16))
  .handler(async ({ context, data: id }): Promise<{ ok: true } | { ok: false; reason: "banned" | "admin" }> => {
    const sql = await getSql();
    const me = await readProfile(sql, context.userId);
    if (!me) return { ok: false, reason: "admin" };
    const ban = await sql<{ banned: boolean }>`
      select banned from profiles where user_id = ${context.userId}
    `;
    if (ban[0]?.banned) return { ok: false, reason: "banned" };
    if (id === "czar" && !me.isAdmin) return { ok: false, reason: "admin" };
    return { ok: true };
  });

export const listAdmins = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }): Promise<string[]> => {
    const sql = await getSql();
    const me = await readProfile(sql, context.userId);
    if (!me?.isFounder) return [];
    return adminNames(sql);
  });

export const addAdmin = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((username: string) => sanitizeName(username))
  .handler(async ({ context, data: target }): Promise<{ ok: true; admins: string[] } | { ok: false; error: "forbidden" | "missing" | "bad" }> => {
    const sql = await getSql();
    const me = await readProfile(sql, context.userId);
    if (!me?.isFounder) return { ok: false, error: "forbidden" };
    if (!target) return { ok: false, error: "bad" };
    const rows = await sql<{ user_id: string }>`
      select user_id from profiles where lower(username) = ${target.toLowerCase()}
    `;
    if (!rows[0]) return { ok: false, error: "missing" };
    await sql`update profiles set is_admin = true where user_id = ${rows[0].user_id}`;
    return { ok: true, admins: await adminNames(sql) };
  });

const HEX = /^#[0-9a-fA-F]{6}$/;

export const setNameColor = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((color: string) => color.trim().slice(0, 7))
  .handler(async ({ context, data: color }): Promise<{ ok: true; color: string } | { ok: false }> => {
    if (!HEX.test(color)) return { ok: false };
    const sql = await getSql();
    const me = await readProfile(sql, context.userId);
    if (!me || (!me.isAdmin && !me.premium)) return { ok: false };
    if (!me.isAdmin && !me.isFounder && color !== "#ffffff") {
      const paid = await sql<{ premium_until: string | null; is_admin: boolean }>`
        select premium_until, is_admin from profiles where user_id = ${context.userId}
      `;
      const until = paid[0]?.premium_until ? new Date(paid[0].premium_until).getTime() : 0;
      if (!paid[0]?.is_admin && until <= Date.now()) return { ok: false };
    }
    await sql`update profiles set name_color = ${color} where user_id = ${context.userId}`;
    return { ok: true, color };
  });

export const moderation = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }): Promise<Moderation> => {
    const sql = await getSql();
    const rows = await sql<{ banned: boolean; kicked_at: string | null; tribe: string | null }>`
      select p.banned, p.kicked_at, t.name as tribe
      from profiles p
      left join tribe_members m on m.user_id = p.user_id
      left join tribes t on t.id = m.tribe_id
      where p.user_id = ${context.userId}
    `;
    return {
      banned: !!rows[0]?.banned,
      kickedAt: rows[0]?.kicked_at ?? null,
      tribe: rows[0]?.tribe ?? null,
    };
  });

export const listChat = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }): Promise<ChatRow[]> => {
    const sql = await getSql();
    const mine = await sql<{ user_id: string }>`
      select user_id from profiles where user_id = ${context.userId}
    `;
    if (!mine[0]) return [];
    const rows = await sql<{
      id: number;
      user_id: string;
      username: string;
      body: string;
      created_at: string;
      name_color: string | null;
    }>`
      select c.id, c.user_id, c.username, c.body, c.created_at, p.name_color
      from chat_messages c
      left join profiles p on p.user_id = c.user_id
      order by c.id desc
      limit 40
    `;
    return rows
      .slice()
      .reverse()
      .filter((r) => !/granted admin/i.test(r.body))
      .map((r) => ({
        id: r.id,
        userId: r.user_id,
        username: r.username,
        body: r.body,
        at: r.created_at,
        color: r.name_color && /^#[0-9a-fA-F]{6}$/.test(r.name_color) ? r.name_color : "#ffffff",
      }));
  });

export const sendChat = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((body: string) => body.trim().slice(0, 240))
  .handler(async ({ context, data: body }): Promise<ChatResult> => {
    if (!body) return { kind: "error", message: "empty" };
    const sql = await getSql();
    const me = await sql<{ username: string; is_admin: boolean }>`
      select username, is_admin from profiles where user_id = ${context.userId}
    `;
    if (!me[0]) return { kind: "error", message: "no profile" };
    const username = me[0].username;
    const admin = me[0].is_admin || isFounder(username);

    if (body.startsWith("/")) {
      return handleCommand(sql, context.userId, username, admin, body);
    }

    await sql`
      insert into chat_messages (user_id, username, body)
      values (${context.userId}, ${username}, ${body})
    `;
    return { kind: "chat" };
  });

async function handleCommand(
  sql: Awaited<ReturnType<typeof getSql>>,
  userId: string,
  username: string,
  admin: boolean,
  raw: string,
): Promise<ChatResult> {
  const parts = raw.slice(1).trim().split(/\s+/);
  const cmd = (parts[0] ?? "").toLowerCase();

  if (cmd === "giveadmin") {
    if (!isFounder(username)) return { kind: "error", message: "founder only" };
    const target = sanitizeName(parts[1] ?? "");
    if (!target) return { kind: "error", message: "/giveadmin <username>" };
    const rows = await sql<{ user_id: string }>`
      select user_id from profiles where lower(username) = ${target.toLowerCase()}
    `;
    if (!rows[0]) return { kind: "error", message: "player not found" };
    await sql`update profiles set is_admin = true where user_id = ${rows[0].user_id}`;
    return { kind: "admin", username: target, granted: true, message: target };
  }

  if (cmd === "give") {
    if (!admin) return { kind: "error", message: "admin only" };
    const item = parts[1] as ItemId;
    const count = Math.max(1, Math.min(60, Number(parts[2] ?? 1) || 1));
    if (!ITEM[item]) return { kind: "error", message: "unknown item" };
    return { kind: "give", item, count, message: `gave ${count} ${item}` };
  }

  if (cmd === "godmode") {
    if (!admin) return { kind: "error", message: "admin only" };
    return { kind: "god" };
  }

  if (cmd === "staffmode") {
    if (!admin) return { kind: "error", message: "admin only" };
    return { kind: "staff" };
  }

  if (cmd === "kick" || cmd === "ban" || cmd === "unban") {
    if (!admin) return { kind: "error", message: "admin only" };
    const target = sanitizeName(parts.slice(1).join(""));
    if (!target) return { kind: "error", message: `/${cmd} <name>` };
    const rows = await sql<{ user_id: string }>`
      select user_id from profiles where lower(username) = ${target.toLowerCase()}
    `;
    if (!rows[0]) return { kind: "error", message: "player not found" };
    if (cmd === "kick") {
      await sql`update profiles set kicked_at = now() where user_id = ${rows[0].user_id}`;
      return { kind: "kick", username: target };
    }
    if (cmd === "ban") {
      await sql`update profiles set banned = true, kicked_at = now() where user_id = ${rows[0].user_id}`;
      return { kind: "ban", username: target };
    }
    await sql`update profiles set banned = false where user_id = ${rows[0].user_id}`;
    return { kind: "unban", username: target };
  }

  if (cmd === "tribe") {
    const sub = (parts[1] ?? "").toLowerCase();
    if (sub === "create") {
      const name = (parts.slice(2).join(" ") || "").replace(/[^\p{L}\p{N}_ ]/gu, "").trim().slice(0, 16);
      if (name.length < 3) return { kind: "error", message: "/tribe create name" };
      const mine = await sql<{ tribe_id: number }>`
        select tribe_id from tribe_members where user_id = ${userId}
      `;
      if (mine[0]) return { kind: "error", message: "already in a tribe" };
      const created = await sql<{ id: number }>`
        insert into tribes (name, owner_id) values (${name}, ${userId}) returning id
      `;
      await sql`
        insert into tribe_members (user_id, tribe_id, role)
        values (${userId}, ${created[0].id}, ${"owner"})
      `;
      return { kind: "tribe", name };
    }
    if (sub === "invite") {
      const target = sanitizeName(parts[2] ?? "");
      if (!target) return { kind: "error", message: "/tribe invite name" };
      const mine = await sql<{ tribe_id: number; role: string }>`
        select tribe_id, role from tribe_members where user_id = ${userId}
      `;
      if (!mine[0] || mine[0].role !== "owner") return { kind: "error", message: "owner only" };
      const who = await sql<{ user_id: string }>`
        select user_id from profiles where lower(username) = ${target.toLowerCase()}
      `;
      if (!who[0]) return { kind: "error", message: "player not found" };
      await sql`
        insert into tribe_members (user_id, tribe_id, role)
        values (${who[0].user_id}, ${mine[0].tribe_id}, ${"member"})
        on conflict (user_id) do update set tribe_id = ${mine[0].tribe_id}, role = ${"member"}
      `;
      return { kind: "tribe", name: target };
    }
    if (sub === "leave") {
      await sql`delete from tribe_members where user_id = ${userId}`;
      return { kind: "tribe", name: "" };
    }
    return { kind: "error", message: "/tribe create · /tribe invite · /tribe leave" };
  }

  if (cmd === "help") {
    return {
      kind: "help",
      message: admin
        ? "/godmode · /staffmode · /kick name · /ban name · /tribe create · /give wood 20"
        : "/tribe create · /tribe invite · /tribe leave · /help",
    };
  }

  return { kind: "error", message: "unknown command" };
}
