// turn: hands a signed-in member short-lived Cloudflare TURN/STUN servers for a live call.
// The long-term TURN key never leaves the server; the credentials returned expire after TTL.
// Secrets (supabase secrets set): CLOUDFLARE_TURN_KEY_ID, CLOUDFLARE_TURN_API_TOKEN.
// Deployed with verify_jwt = false (see config.toml); withSupabase({ auth: 'user' }) checks the JWT.

import "@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "@supabase/server";

const KEY_ID = Deno.env.get("CLOUDFLARE_TURN_KEY_ID") ?? "";
const TOKEN = Deno.env.get("CLOUDFLARE_TURN_API_TOKEN") ?? "";
const TTL = 6 * 60 * 60; // longest call we expect, in seconds
const FALLBACK = [{ urls: ["stun:stun.cloudflare.com:3478"] }];

type IceServer = { urls: string[] | string; username?: string; credential?: string };

export default {
  fetch: withSupabase({ auth: "user" }, async (_req, ctx) => {
    // Only the two members may use the relay (it is metered).
    const { data: me } = await ctx.supabase.from("members").select("user_id").eq("user_id", ctx.userClaims!.id).maybeSingle();
    if (!me) return Response.json({ error: "not a member" }, { status: 403 });

    if (!KEY_ID || !TOKEN) return Response.json({ iceServers: FALLBACK, relay: false });

    const res = await fetch(`https://rtc.live.cloudflare.com/v1/turn/keys/${KEY_ID}/credentials/generate-ice-servers`, {
      method: "POST",
      headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify({ ttl: TTL }),
    });
    if (!res.ok) {
      console.error("cloudflare turn", res.status, await res.text());
      return Response.json({ iceServers: FALLBACK, relay: false });
    }
    const { iceServers } = await res.json() as { iceServers: IceServer[] };
    // Browsers block port 53, so those URLs would only time out.
    const cleaned = iceServers.map((s) => ({
      ...s,
      urls: (Array.isArray(s.urls) ? s.urls : [s.urls]).filter((u) => !/:53(\?|$)/.test(u)),
    }));
    return Response.json({ iceServers: cleaned, relay: true });
  }),
};
