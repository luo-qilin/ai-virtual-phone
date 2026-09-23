import { NextResponse } from "next/server";
import { getCurrentAccount } from "@/lib/server/account-auth";
import { getSupabaseServerConfig } from "@/lib/server/supabase-rest";

const BUCKET = "custom-app-market-packages";
const MAX_PACKAGE_BYTES = 20 * 1024 * 1024;

function safeFilename(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "") || "app.zip";
}

export async function POST(request: Request) {
  const config = getSupabaseServerConfig();
  if (!config) return NextResponse.json({ ok: false, error: "missing_supabase_env" }, { status: 503 });
  const account = await getCurrentAccount(request);
  if (!account) return NextResponse.json({ ok: false, error: "请先登录账号。" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const filename = safeFilename(String(body.filename || "app.zip").slice(0, 120));
  const size = Number(body.size || 0);
  if (size > MAX_PACKAGE_BYTES) {
    return NextResponse.json({ ok: false, error: "应用包过大，请控制在 20MB 以内。" }, { status: 400 });
  }

  const path = `${safeFilename(account.id)}/${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}-${filename}`;
  const sign = await fetch(`${config.url}/storage/v1/object/upload/sign/${BUCKET}/${path}`, {
    method: "POST",
    headers: {
      apikey: config.key,
      Authorization: `Bearer ${config.key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ expiresIn: 120 }),
  });
  const data = await sign.json().catch(() => ({}));
  const token = data?.token || data?.data?.token;
  const signedPath = data?.url || data?.data?.url;
  if (!sign.ok || !token) {
    return NextResponse.json({
      ok: false,
      error: data?.message || data?.error || "无法创建上传凭证，请确认已执行 custom-app-market-supabase.sql",
    }, { status: 400 });
  }

  const uploadUrl = signedPath?.startsWith("http")
    ? signedPath
    : `${config.url}/storage/v1${String(signedPath).startsWith("/") ? "" : "/"}${signedPath || `/object/upload/sign/${BUCKET}/${path}?token=${token}`}`;

  return NextResponse.json({
    ok: true,
    path,
    token,
    uploadUrl,
    publicUrl: `${config.url}/storage/v1/object/public/${BUCKET}/${path}`,
  });
}
