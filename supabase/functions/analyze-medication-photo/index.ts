import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { readBodyWithLimit, toValidatedDataUrl } from "./validation.ts";

const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_MODEL = "meta-llama/llama-4-scout-17b-16e-instruct";

/**
 * 운영 로그에는 사진·토큰·약 정보·AI 응답 원문을 남기지 않는다.
 * 요청 식별자, 오류 분류, 상태 코드만 기록한다.
 */
function logFailure(requestId: string, kind: string, status?: number) {
  console.error(JSON.stringify({ requestId, kind, ...(status !== undefined ? { status } : {}) }));
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // CORS preflight 처리
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const requestId = crypto.randomUUID();

  // JWT 인증 검증 — 익명 사용자 차단
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? "",
    { global: { headers: { Authorization: authHeader } } }
  );

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // 요청 파싱 — 본문 전체를 읽기 전에 크기 상한을 먼저 적용한다
  const body = await readBodyWithLimit(req);
  if (!body.ok) {
    const message = body.status === 413 ? "이미지가 너무 큽니다" : "요청 형식 오류";
    return new Response(JSON.stringify({ error: message }), {
      status: body.status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let imageBase64: unknown;
  try {
    imageBase64 = (JSON.parse(body.text) as { imageBase64?: unknown })?.imageBase64;
  } catch {
    imageBase64 = undefined;
  }

  // 허용 형식(JPEG/PNG/WEBP)의 올바른 base64인지 확인하고 Groq에 보낼 data URL로 정규화
  const dataUrl = toValidatedDataUrl(imageBase64);
  if (!dataUrl) {
    return new Response(JSON.stringify({ error: "요청 형식 오류" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const groqApiKey = Deno.env.get("GROQ_API_KEY");
  if (!groqApiKey) {
    return new Response(JSON.stringify({ error: "서버 설정 오류" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // 사용자별 호출 한도 확인 — 외부 AI 호출 전에 원자적으로 차감한다.
  // 반환값 0은 허용, 양수는 다시 시도할 수 있을 때까지 남은 초. 확인 실패 시 호출하지 않는다(fail-closed).
  const { data: retryAfter, error: quotaError } = await supabase.rpc("consume_photo_analysis_quota");
  if (quotaError || typeof retryAfter !== "number") {
    logFailure(requestId, "quota_check_failed");
    return new Response(JSON.stringify({ error: "잠시 후 다시 시도해주세요" }), {
      status: 503,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  if (retryAfter > 0) {
    return new Response(JSON.stringify({ error: "분석 요청이 너무 많습니다" }), {
      status: 429,
      headers: { ...corsHeaders, "Content-Type": "application/json", "Retry-After": String(retryAfter) },
    });
  }

  // Groq Vision API 호출 — 20초 타임아웃 설정
  const groqController = new AbortController();
  const groqTimeout = setTimeout(() => groqController.abort(), 20_000);

  let groqRes: Response;
  let groqData: unknown;
  try {
    groqRes = await fetch(GROQ_API_URL, {
      method: "POST",
      signal: groqController.signal,
      headers: {
        "Authorization": `Bearer ${groqApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages: [
          {
            role: "system",
            content: "당신은 약/영양제 패키지 이미지를 분석하는 전문가입니다. 반드시 JSON 형식으로만 응답하세요.",
          },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: '이 이미지에서 약/영양제를 분석해주세요. JSON 형식으로만 응답: {"name": "제품명 (식별 불가능하면 null)", "summary": "한국어로 5줄 이내: (1)주요 성분 (2)효능/용도 (3)권장 복용법 (4)주의사항 (5)특이사항"}',
              },
              {
                type: "image_url",
                image_url: { url: dataUrl },
              },
            ],
          },
        ],
        response_format: { type: "json_object" },
        temperature: 0.2,
        max_tokens: 500,
      }),
    });
    clearTimeout(groqTimeout);

    if (!groqRes.ok) {
      // 오류 본문에는 입력에서 유래한 내용이 있을 수 있으므로 읽고 버린다
      await groqRes.body?.cancel().catch(() => {});
      logFailure(requestId, "groq_http_error", groqRes.status);
      return new Response(JSON.stringify({ error: "AI 분석 실패" }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    groqData = await groqRes.json();
  } catch (err) {
    clearTimeout(groqTimeout);
    // AbortController에 의한 타임아웃 판별
    if (err instanceof Error && err.name === "AbortError") {
      logFailure(requestId, "groq_timeout");
      return new Response(JSON.stringify({ error: "분석 시간 초과" }), {
        status: 504,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    logFailure(requestId, "groq_request_failed");
    return new Response(JSON.stringify({ error: "AI 분석 실패" }), {
      status: 502,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const rawContent = (groqData as { choices?: { message?: { content?: string } }[] })
    ?.choices?.[0]?.message?.content;

  // rawContent 누락 시 명시적 에러 처리
  if (!rawContent) {
    logFailure(requestId, "groq_empty_content");
    return new Response(JSON.stringify({ error: "응답 파싱 실패" }), {
      status: 502,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // JSON 파싱
  let parsed: { name?: string | null; summary?: string };
  try {
    parsed = JSON.parse(rawContent);
  } catch {
    logFailure(requestId, "groq_parse_failed");
    return new Response(JSON.stringify({ error: "응답 파싱 실패" }), {
      status: 502,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  return new Response(
    JSON.stringify({
      name: parsed.name ?? null,
      summary: parsed.summary ?? "",
    }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
});
