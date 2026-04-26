import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_MODEL = "meta-llama/llama-4-scout-17b-16e-instruct";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // CORS preflight 처리
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

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

  // 요청 파싱
  let imageBase64: string;
  try {
    const body = await req.json();
    if (!body.imageBase64 || typeof body.imageBase64 !== "string") {
      throw new Error("imageBase64 필드 누락");
    }
    imageBase64 = body.imageBase64;
  } catch {
    return new Response(JSON.stringify({ error: "요청 형식 오류" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // base64 크기 상한 검증 (10MB 기준 약 13,700,000자)
  if (imageBase64.length > 13_700_000) {
    return new Response(JSON.stringify({ error: "이미지가 너무 큽니다" }), {
      status: 413,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // data URL 형식 정규화 (순수 base64도 허용)
  const dataUrl = imageBase64.startsWith("data:")
    ? imageBase64
    : `data:image/jpeg;base64,${imageBase64}`;

  const groqApiKey = Deno.env.get("GROQ_API_KEY");
  if (!groqApiKey) {
    return new Response(JSON.stringify({ error: "서버 설정 오류" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
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
      const errText = await groqRes.text();
      console.error("Groq API 오류:", errText);
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
      console.error("Groq API 타임아웃");
      return new Response(JSON.stringify({ error: "분석 시간 초과" }), {
        status: 504,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    console.error("Groq API 요청 실패:", err);
    return new Response(JSON.stringify({ error: "AI 분석 실패" }), {
      status: 502,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const rawContent = (groqData as { choices?: { message?: { content?: string } }[] })
    ?.choices?.[0]?.message?.content;

  // rawContent 누락 시 명시적 에러 처리
  if (!rawContent) {
    console.error("Groq 응답 content 없음:", groqData);
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
    console.error("Groq 응답 파싱 실패:", rawContent);
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
