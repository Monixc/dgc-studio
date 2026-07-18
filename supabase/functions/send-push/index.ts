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
  event:
    | "announcement"
    | "message"
    | "shop_order_request"
    | "shop_order_decided"
    | "portfolio_submitted"
    | "portfolio_feedback"
    | "submission_feedback"
    | "class_reminder";
  id?: string;
  user_ids?: string[];
  title?: string;
  body?: string;
  url?: string;
}

// 인앱 알림 피드(헤더 벨)용 행 저장. 채팅(message)은 별도 UI라 호출부에서 제외한다. best-effort.
async function saveNotifications(userIds: string[], title: string, body: string, url: string) {
  if (userIds.length === 0) return;
  try {
    await admin.from("notifications").insert(
      userIds.map((user_id) => ({ user_id, title, body, url })),
    );
  } catch {
    // 알림 저장 실패해도 본 동작(푸시)은 막지 않음
  }
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
  let payload: Payload;
  try {
    payload = (await req.json()) as Payload;
  } catch {
    return new Response("invalid json", { status: 400 });
  }
  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.replace("Bearer ", "");

  // pg_cron이 service role 키로 직접 호출하는 경로: payload를 그대로 신뢰
  if (payload.event === "class_reminder") {
    if (token !== SERVICE_ROLE_KEY) return new Response("forbidden", { status: 403 });
    const ids = payload.user_ids ?? [];
    await saveNotifications(ids, payload.title ?? "", payload.body ?? "", payload.url ?? "/");
    const sent = await sendTo(ids, payload.title ?? "", payload.body ?? "", payload.url ?? "/");
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
  } else if (payload.event === "portfolio_submitted") {
    // 학생이 제출 → 담당 교사에게 알림
    const { data: row } = await admin
      .from("portfolio_submissions")
      .select("id, student_id, teacher_id, title")
      .eq("id", payload.id)
      .single();
    if (!row || row.student_id !== caller.id) return new Response("forbidden", { status: 403 });
    recipientIds = [row.teacher_id];
    title = "포트폴리오 제출";
    body = row.title || "학생이 포트폴리오를 제출했습니다.";
    url = `/students/${row.student_id}/portfolio/${row.id}`;
  } else if (payload.event === "portfolio_feedback") {
    // 교사가 피드백 → 작성 학생에게 알림
    const { data: row } = await admin
      .from("portfolio_comments")
      .select("author_id, body, submission_id")
      .eq("id", payload.id)
      .single();
    if (!row || row.author_id !== caller.id) return new Response("forbidden", { status: 403 });
    const { data: sub } = await admin
      .from("portfolio_submissions")
      .select("student_id, document_id")
      .eq("id", row.submission_id)
      .single();
    if (!sub) return new Response("forbidden", { status: 403 });
    recipientIds = [sub.student_id];
    title = "새 피드백";
    body = row.body.slice(0, 50);
    url = `/student/portfolio?document=${sub.document_id}`;
  } else if (payload.event === "submission_feedback") {
    // 교사가 문제 제출에 첨삭 → 제출 학생에게 알림
    const { data: row } = await admin
      .from("submission_comments")
      .select("author_id, body, submission_id")
      .eq("id", payload.id)
      .single();
    if (!row || row.author_id !== caller.id) return new Response("forbidden", { status: 403 });
    const { data: sub } = await admin
      .from("submissions")
      .select("user_id, problem_id")
      .eq("id", row.submission_id)
      .single();
    if (!sub) return new Response("forbidden", { status: 403 });
    recipientIds = [sub.user_id];
    title = "문제 첨삭 도착";
    body = row.body.slice(0, 50);
    url = `/solve/${sub.problem_id}`;
  } else {
    return new Response("bad event", { status: 400 });
  }

  // 채팅(message)은 채팅 아이콘의 미읽음 배지로 다루므로 알림 피드에는 넣지 않는다.
  if (payload.event !== "message") {
    await saveNotifications(recipientIds, title, body, url);
  }
  const sent = await sendTo(recipientIds, title, body, url);
  return Response.json({ sent });
});
