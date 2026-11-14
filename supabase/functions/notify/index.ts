// notify: sends a push notification to the other member's devices.
// Called by the page (signed-in user) right after it saves a message:
//   { action: "message", message_id }  -> notify the recipient of that message (caller must be its sender)
//   { action: "test" }                 -> notify the caller's own devices
//   { action: "call" }                 -> "<name> is calling" to the other member's devices
//   { action: "key" }                  -> return the public VAPID key the page needs to subscribe
// Secrets (supabase secrets set): VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT (mailto:you@...).
// Deployed with verify_jwt = false (see config.toml); withSupabase({ auth: 'user' }) checks the JWT instead.

import "@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "@supabase/server";
import webpush from "web-push";

const VAPID = {
  subject: Deno.env.get("VAPID_SUBJECT") ?? "",
  publicKey: Deno.env.get("VAPID_PUBLIC_KEY") ?? "",
  privateKey: Deno.env.get("VAPID_PRIVATE_KEY") ?? "",
};

type Sub = { endpoint: string; p256dh: string; auth: string };

// Encrypt + sign with web-push, but send with fetch (web-push's own sender uses Node's https).
async function push(sub: Sub, payload: object): Promise<number> {
  const req = webpush.generateRequestDetails(
    { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
    JSON.stringify(payload),
    { TTL: 60 * 60 * 24, urgency: "high", vapidDetails: VAPID },
  );
  const res = await fetch(req.endpoint, {
    method: req.method,
    headers: req.headers as Record<string, string>,
    body: new Uint8Array(req.body),
  });
  await res.body?.cancel();
  return res.status;
}

function messageText(sender: string, m: { clip_path: string | null; text: string | null }) {
  if (m.clip_path) return { title: sender + " sent you a holo", body: m.text ? "🎬 " + m.text : "🎬 Tap to watch" };
  return { title: sender + " sent you a message", body: "♥ " + (m.text ?? "") };
}

export default {
  fetch: withSupabase({ auth: "user" }, async (req, ctx) => {
    const me = ctx.userClaims!.id;
    const { action, message_id } = await req.json().catch(() => ({}));

    if (action === "key") return Response.json({ key: VAPID.publicKey });
    if (!VAPID.publicKey || !VAPID.privateKey || !VAPID.subject) {
      return Response.json({ error: "VAPID secrets are not set" }, { status: 500 });
    }

    let to: string, payload: Record<string, string>;
    if (action === "test") {
      to = me;
      payload = { title: "Holo", body: "Notifications are on ♥", tag: "holo-test" };
    } else if (action === "message") {
      // ctx.supabase is RLS-scoped to the caller, so this only finds messages they can see.
      const { data: m, error } = await ctx.supabase.from("messages")
        .select("id, sender, recipient, clip_path, text").eq("id", message_id).single();
      if (error || !m) return Response.json({ error: "message not found" }, { status: 404 });
      if (m.sender !== me) return Response.json({ error: "not your message" }, { status: 403 });
      const { data: sender } = await ctx.supabase.from("members").select("name").eq("user_id", me).single();
      to = m.recipient;
      payload = { ...messageText(sender?.name ?? "Someone", m), tag: "holo-msg-" + m.id };
    } else if (action === "call") {
      const { data: members } = await ctx.supabase.from("members").select("user_id, name");
      const me_ = members?.find((m: { user_id: string }) => m.user_id === me);
      const other = members?.find((m: { user_id: string }) => m.user_id !== me);
      if (!me_ || !other) return Response.json({ error: "no one to call" }, { status: 400 });
      to = other.user_id;
      payload = { title: me_.name + " is calling", body: "📞 Open Holo to answer", tag: "holo-call" };
    } else {
      return Response.json({ error: "unknown action" }, { status: 400 });
    }

    // The recipient's devices: only readable with the secret key (RLS hides them from the caller).
    const { data: subs, error } = await ctx.supabaseAdmin.from("push_subscriptions")
      .select("endpoint, p256dh, auth").eq("user_id", to);
    if (error) return Response.json({ error: error.message }, { status: 500 });

    let sent = 0;
    const gone: string[] = [];
    await Promise.all((subs ?? []).map(async (s: Sub) => {
      try {
        const status = await push(s, payload);
        if (status === 404 || status === 410) gone.push(s.endpoint); // device unsubscribed or app removed
        else if (status < 300) sent++;
        else console.error("push failed", status, new URL(s.endpoint).host);
      } catch (e) {
        console.error("push error", String(e));
      }
    }));
    if (gone.length) await ctx.supabaseAdmin.from("push_subscriptions").delete().in("endpoint", gone);

    return Response.json({ devices: subs?.length ?? 0, sent, removed: gone.length });
  }),
};
