// 웹 푸시 발송. 클라이언트는 event+id만 넘기고, 실제 제목/본문/수신자는 여기서 DB 조회로 확정한다
// (임의 user_id/문구로 스팸 발송하는 걸 막기 위함). 반 리마인더(class_reminder)는 pg_cron이
// service role 키로 직접 호출하며, 이 경우엔 payload를 그대로 신뢰한다.
import { createClient } from "npm:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const VAPID_PUBLIC_KEY = Deno.env.get("VAPID_PUBLIC_KEY")!;
const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY")!;

webpush.setVapidDetails("mailto:admin@flowpy.local", VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

interface Payload {
  event: "announcement" | "message" | "shop_order_request" | "shop_order_decided" | "class_reminder";
  id?: string;
  user_ids?: string[];
  title?: string;
  body?: string;
  url?: string;
}

async function sendTo(userIds: string[], title: string, body: string, url: string) {
  if (userIds.length === 0) return 0;
  const { data: subs } = await admin.from("push_subscriptions").select("*").in("user_id", userIds);
  await Promise.all(
    (subs ?? []).map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          JSON.stringify({ title, body, url }),
        );
      } catch (e) {
        const status = (e as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) {
          await admin.from("push_subscriptions").delete().eq("id", s.id);
        }
      }
    }),
  );
  return (subs ?? []).length;
}

Deno.serve(async (req) => {
  const payload = (await req.json()) as Payload;
  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.replace("Bearer ", "");

  // pg_cron이 service role 키로 직접 호출하는 경로: payload를 그대로 신뢰
  if (payload.event === "class_reminder") {
    if (token !== SERVICE_ROLE_KEY) return new Response("forbidden", { status: 403 });
    const sent = await sendTo(payload.user_ids ?? [], payload.title ?? "", payload.body ?? "", payload.url ?? "/");
    return Response.json({ sent });
  }

  // 그 외는 인증된 사용자 호출: DB에서 실제 소유자 검증 후 제목/본문/수신자 확정
  const { data: authData } = await admin.auth.getUser(token);
  const caller = authData?.user;
  if (!caller) return new Response("unauthorized", { status: 401 });
  if (!payload.id) return new Response("bad request", { status: 400 });

  let title = "";
  let body = "";
  let url = "/";
  let recipientIds: string[] = [];

  if (payload.event === "announcement") {
    const { data: row } = await admin.from("announcements").select("*").eq("id", payload.id).single();
    if (!row || row.created_by !== caller.id) return new Response("forbidden", { status: 403 });
    const { data: students } = await admin.from("profiles").select("id").eq("role", "student");
    recipientIds = (students ?? []).map((s) => s.id);
    title = "새 공지사항";
    body = row.title || row.body.slice(0, 50);
    url = "/student";
  } else if (payload.event === "message") {
    const { data: row } = await admin.from("messages").select("*").eq("id", payload.id).single();
    if (!row || row.sender_id !== caller.id) return new Response("forbidden", { status: 403 });
    recipientIds = [row.recipient_id];
    title = "새 쪽지";
    body = row.body.slice(0, 50);
    url = "/dashboard";
  } else if (payload.event === "shop_order_request") {
    const { data: row } = await admin
      .from("shop_orders")
      .select("*, shop_items(name, created_by)")
      .eq("id", payload.id)
      .single();
    if (!row || row.student_id !== caller.id) return new Response("forbidden", { status: 403 });
    recipientIds = [row.shop_items.created_by];
    title = "구매 요청 도착";
    body = `${row.shop_items.name} 구매 요청이 도착했습니다.`;
    url = "/shop";
  } else if (payload.event === "shop_order_decided") {
    const { data: row } = await admin
      .from("shop_orders")
      .select("*, shop_items(name)")
      .eq("id", payload.id)
      .single();
    if (!row || row.decided_by !== caller.id) return new Response("forbidden", { status: 403 });
    recipientIds = [row.student_id];
    title = row.status === "approved" ? "구매 승인됨" : "구매 거절됨";
    body = row.shop_items.name;
    url = "/student/shop";
  } else {
    return new Response("bad event", { status: 400 });
  }

  const sent = await sendTo(recipientIds, title, body, url);
  return Response.json({ sent });
});
