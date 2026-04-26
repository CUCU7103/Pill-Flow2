# 사진 촬영 기반 약 정보 자동 입력 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** AddView 헤더의 카메라 버튼으로 약/영양제 패키지 사진을 찍으면, Groq Vision AI가 약 이름과 5줄 요약 메모를 자동 채워준다.

**Architecture:** 클라이언트는 `@capacitor/camera`로 이미지를 캡처하고 `<canvas>`로 1024px 리사이즈 후 Supabase Edge Function에 POST한다. Edge Function은 `GROQ_API_KEY` Secret을 사용해 Groq Vision API를 호출하고 `{ name, summary }` JSON을 반환한다. 클라이언트는 촬영 즉시 AddView로 복귀해 non-blocking 상태 배지를 보여주다가, 결과가 오면 비어있는 필드만 채운다.

**Tech Stack:** React + TypeScript (Vite), @capacitor/camera, @capacitor/haptics (기설치), Supabase Edge Function (Deno), Groq API (meta-llama/llama-4-scout-17b-16e-instruct), lucide-react, sonner

---

## 파일 구조

| 파일 | 역할 | 신규/수정 |
|------|------|----------|
| `supabase/functions/analyze-medication-photo/index.ts` | Edge Function 본체 (JWT 검증, Groq 호출, JSON 파싱) | 신규 |
| `supabase/functions/analyze-medication-photo/deno.json` | Deno import 맵 | 신규 |
| `artifacts/pillflow/src/lib/photoAnalyzer.ts` | 이미지 리사이즈 + Edge Function fetch 유틸 (순수 함수) | 신규 |
| `artifacts/pillflow/src/hooks/use-photo-analyzer.ts` | 상태 머신 훅 (idle→uploading→analyzing→slow→done\|error) | 신규 |
| `artifacts/pillflow/src/components/common/PhotoAnalyzeBadge.tsx` | 진행 배지 UI (단계별 메시지 + 스피너) | 신규 |
| `artifacts/pillflow/src/components/views/AddView.tsx` | 카메라 버튼 + 훅 연결 + 배지 렌더링 | 수정 |
| `artifacts/pillflow/package.json` | @capacitor/camera 의존성 추가 | 수정 |

---

## Task 1: Supabase Edge Function 작성

**Files:**
- Create: `supabase/functions/analyze-medication-photo/index.ts`
- Create: `supabase/functions/analyze-medication-photo/deno.json`

### 전제 조건 (코드 작성 전 사용자가 완료해야 함)

- [ ] **Step 0: Groq API 키 폐기 및 재발급**

  브레인스토밍 채팅에 키가 노출되었으므로 반드시 폐기 후 새 키 사용.
  1. https://console.groq.com/keys 에서 노출된 키 revoke
  2. 새 키 발급
  3. Supabase Secret 등록:
  ```bash
  supabase secrets set GROQ_API_KEY=새로_발급한_키
  ```

### 구현

- [ ] **Step 1: supabase 디렉토리 생성**

  ```bash
  mkdir -p supabase/functions/analyze-medication-photo
  ```

- [ ] **Step 2: deno.json 작성**

  `supabase/functions/analyze-medication-photo/deno.json`:
  ```json
  {
    "imports": {
      "jsr:@supabase/functions-js": "jsr:@supabase/functions-js"
    }
  }
  ```

- [ ] **Step 3: Edge Function 본체 작성**

  `supabase/functions/analyze-medication-photo/index.ts`:
  ```typescript
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

    // Groq Vision API 호출
    const groqRes = await fetch(GROQ_API_URL, {
      method: "POST",
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

    if (!groqRes.ok) {
      const errText = await groqRes.text();
      console.error("Groq API 오류:", errText);
      return new Response(JSON.stringify({ error: "AI 분석 실패" }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const groqData = await groqRes.json();
    const rawContent = groqData.choices?.[0]?.message?.content;

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
  ```

- [ ] **Step 4: 로컬 테스트 (선택 — supabase CLI 필요)**

  ```bash
  supabase functions serve analyze-medication-photo --no-verify-jwt
  ```
  별도 터미널에서:
  ```bash
  curl -i -X POST http://localhost:54321/functions/v1/analyze-medication-photo \
    -H "Authorization: Bearer 아무_JWT_토큰" \
    -H "Content-Type: application/json" \
    -d '{"imageBase64": "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=="}'
  ```
  Expected: HTTP 200 + `{"name": null, "summary": "..."}` (1x1 픽셀이라 식별 불가)

- [ ] **Step 5: Edge Function 배포**

  ```bash
  supabase functions deploy analyze-medication-photo
  ```

- [ ] **Step 6: 커밋**

  ```bash
  git add supabase/
  git commit -m "[Feat] Edge Function: analyze-medication-photo (Groq Vision 연동)"
  ```

---

## Task 2: @capacitor/camera 설치 및 photoAnalyzer 유틸 작성

**Files:**
- Modify: `artifacts/pillflow/package.json`
- Create: `artifacts/pillflow/src/lib/photoAnalyzer.ts`

- [ ] **Step 1: @capacitor/camera 설치**

  ```bash
  cd artifacts/pillflow && pnpm add @capacitor/camera
  ```
  Expected: `@capacitor/camera` 가 `package.json` dependencies에 추가됨.

- [ ] **Step 2: photoAnalyzer.ts 작성**

  `artifacts/pillflow/src/lib/photoAnalyzer.ts`:
  ```typescript
  import { Camera, CameraResultType, CameraSource } from "@capacitor/camera";
  import { supabase } from "@/lib/supabase";

  export interface AnalyzeResult {
    name: string | null;
    summary: string;
  }

  /**
   * 이미지를 1024px 장변 기준으로 리사이즈한 JPEG base64 data URL을 반환한다.
   * <canvas>를 사용하므로 외부 라이브러리 불필요.
   */
  export async function resizeImageToBase64(dataUrl: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const MAX = 1024;
        const { width, height } = img;
        const scale = Math.min(1, MAX / Math.max(width, height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(width * scale);
        canvas.height = Math.round(height * scale);
        const ctx = canvas.getContext("2d");
        if (!ctx) return reject(new Error("canvas context 없음"));
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", 0.8));
      };
      img.onerror = () => reject(new Error("이미지 로드 실패"));
      img.src = dataUrl;
    });
  }

  /**
   * Capacitor Camera로 사진 촬영 또는 갤러리 선택 후 base64 data URL을 반환한다.
   * 사용자가 취소하면 null 반환.
   */
  export async function capturePhoto(): Promise<string | null> {
    try {
      const photo = await Camera.getPhoto({
        resultType: CameraResultType.DataUrl,
        source: CameraSource.Prompt, // 촬영/갤러리 선택 시트 표시
        quality: 80,
      });
      return photo.dataUrl ?? null;
    } catch (err) {
      // 사용자 취소는 Error: "User cancelled photos app" 형태로 옴
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.toLowerCase().includes("cancel") || msg.toLowerCase().includes("dismissed")) {
        return null;
      }
      throw err;
    }
  }

  /**
   * Supabase Edge Function `analyze-medication-photo`를 호출해 약 정보를 분석한다.
   * AbortSignal로 타임아웃 제어.
   */
  export async function analyzeMedicationPhoto(
    imageBase64: string,
    signal: AbortSignal
  ): Promise<AnalyzeResult> {
    const { data, error } = await supabase.functions.invoke("analyze-medication-photo", {
      body: { imageBase64 },
    });

    if (signal.aborted) throw new DOMException("Aborted", "AbortError");
    if (error) throw new Error(error.message ?? "Edge Function 호출 실패");

    const name = typeof data?.name === "string" ? data.name : null;
    const summary = typeof data?.summary === "string" ? data.summary : "";
    return { name, summary };
  }
  ```

  > **주의:** `supabase.functions.invoke`는 AbortSignal을 직접 지원하지 않으므로, signal 체크를 호출 후 즉시 수행한다. 15초 타임아웃은 훅에서 `setTimeout` + `AbortController`로 관리한다.

- [ ] **Step 3: 커밋**

  ```bash
  git add artifacts/pillflow/package.json artifacts/pillflow/pnpm-lock.yaml artifacts/pillflow/src/lib/photoAnalyzer.ts
  git commit -m "[Feat] @capacitor/camera 추가 및 photoAnalyzer 유틸 작성"
  ```

---

## Task 3: usePhotoAnalyzer 훅 작성

**Files:**
- Create: `artifacts/pillflow/src/hooks/use-photo-analyzer.ts`

- [ ] **Step 1: 훅 작성**

  `artifacts/pillflow/src/hooks/use-photo-analyzer.ts`:
  ```typescript
  import { useState, useCallback, useRef } from "react";
  import { Haptics, ImpactStyle } from "@capacitor/haptics";
  import { toast } from "sonner";
  import { capturePhoto, resizeImageToBase64, analyzeMedicationPhoto } from "@/lib/photoAnalyzer";
  import type { AnalyzeResult } from "@/lib/photoAnalyzer";

  export type AnalyzeStatus = "idle" | "uploading" | "analyzing" | "slow" | "done" | "error";

  /** 상태별 사용자 표시 메시지 */
  const STATUS_MESSAGES: Record<AnalyzeStatus, string> = {
    idle: "",
    uploading: "사진 업로드 중...",
    analyzing: "약 정보 분석 중...",
    slow: "조금 더 걸리고 있어요...",
    done: "분석 완료",
    error: "분석 실패",
  };

  interface UsePhotoAnalyzerOpts {
    /** 분석 완료 시 호출 — name이 null이면 약 식별 실패 */
    onResult: (result: AnalyzeResult) => void;
  }

  interface UsePhotoAnalyzerReturn {
    status: AnalyzeStatus;
    message: string;
    /** 카메라 시트를 열고 전체 분석 흐름을 시작한다 */
    start: () => Promise<void>;
  }

  const TIMEOUT_MS = 15_000;  // 15초 최대 대기
  const SLOW_MS = 5_000;      // 5초 경과 시 "slow" 메시지

  export function usePhotoAnalyzer({ onResult }: UsePhotoAnalyzerOpts): UsePhotoAnalyzerReturn {
    const [status, setStatus] = useState<AnalyzeStatus>("idle");
    const abortRef = useRef<AbortController | null>(null);
    const slowTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const clearTimers = () => {
      if (slowTimerRef.current) clearTimeout(slowTimerRef.current);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      slowTimerRef.current = null;
      timeoutRef.current = null;
    };

    const start = useCallback(async () => {
      // 이미 진행 중이면 중복 실행 방지
      if (status !== "idle" && status !== "done" && status !== "error") return;

      // 1. 카메라 시트 열기
      let dataUrl: string | null;
      try {
        dataUrl = await capturePhoto();
      } catch {
        toast.error("카메라 권한이 필요해요. 설정에서 허용해주세요.");
        return;
      }

      // 사용자 취소
      if (!dataUrl) return;

      // 2. 촬영 완료 — 햅틱 + 즉시 uploading 상태로 전환 (AddView는 이미 보임)
      await Haptics.impact({ style: ImpactStyle.Light });
      setStatus("uploading");

      // 3. AbortController 생성
      abortRef.current = new AbortController();
      const { signal } = abortRef.current;

      // 4. 5초 후 slow 메시지 전환
      slowTimerRef.current = setTimeout(() => {
        setStatus((prev) => (prev === "analyzing" ? "slow" : prev));
      }, SLOW_MS);

      // 5. 15초 타임아웃
      timeoutRef.current = setTimeout(() => {
        abortRef.current?.abort();
      }, TIMEOUT_MS);

      try {
        // 6. 이미지 리사이즈
        const resized = await resizeImageToBase64(dataUrl);
        if (signal.aborted) throw new DOMException("Aborted", "AbortError");

        setStatus("analyzing");

        // 7. Edge Function 호출
        const result = await analyzeMedicationPhoto(resized, signal);

        clearTimers();
        setStatus("done");
        onResult(result);

        // 1초 후 idle 복귀
        setTimeout(() => setStatus("idle"), 1_000);
      } catch (err) {
        clearTimers();
        const isAbort =
          err instanceof DOMException && err.name === "AbortError";
        const msg = isAbort
          ? "분석 시간이 초과됐어요. 직접 입력해주세요."
          : "분석에 실패했어요. 직접 입력해주세요.";
        toast.error(msg);
        setStatus("error");

        // 3초 후 idle 복귀
        setTimeout(() => setStatus("idle"), 3_000);
      }
    }, [status, onResult]);

    return {
      status,
      message: STATUS_MESSAGES[status],
      start,
    };
  }
  ```

- [ ] **Step 2: 커밋**

  ```bash
  git add artifacts/pillflow/src/hooks/use-photo-analyzer.ts
  git commit -m "[Feat] usePhotoAnalyzer 훅 작성 (상태 머신 + 햅틱 + 타임아웃)"
  ```

---

## Task 4: PhotoAnalyzeBadge 컴포넌트 작성

**Files:**
- Create: `artifacts/pillflow/src/components/common/PhotoAnalyzeBadge.tsx`

- [ ] **Step 1: 배지 컴포넌트 작성**

  `artifacts/pillflow/src/components/common/PhotoAnalyzeBadge.tsx`:
  ```tsx
  import type { AnalyzeStatus } from "@/hooks/use-photo-analyzer";

  const ICONS: Record<AnalyzeStatus, string> = {
    idle: "",
    uploading: "📷",
    analyzing: "🔍",
    slow: "⏳",
    done: "✓",
    error: "❌",
  };

  /** AddView 헤더 바로 아래에 표시되는 분석 진행 배지 */
  export function PhotoAnalyzeBadge({
    status,
    message,
    dark,
  }: {
    status: AnalyzeStatus;
    message: string;
    dark: boolean;
  }) {
    if (status === "idle") return null;

    const isActive = status === "uploading" || status === "analyzing" || status === "slow";
    const bgColor = dark ? "rgba(108,99,255,0.18)" : "rgba(108,99,255,0.10)";
    const textColor = dark ? "#A5B4FC" : "#6C63FF";
    const borderColor = dark ? "rgba(108,99,255,0.35)" : "rgba(108,99,255,0.25)";

    return (
      <div
        className="flex items-center gap-2 px-4 py-2 rounded-xl border text-sm font-semibold mx-1"
        style={{ backgroundColor: bgColor, borderColor, color: textColor }}
      >
        {/* 진행 중이면 스피너, 아니면 상태 이모지 */}
        {isActive ? (
          <span className="inline-block w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
        ) : (
          <span>{ICONS[status]}</span>
        )}
        <span>{message}</span>
      </div>
    );
  }
  ```

- [ ] **Step 2: 커밋**

  ```bash
  git add artifacts/pillflow/src/components/common/PhotoAnalyzeBadge.tsx
  git commit -m "[Feat] PhotoAnalyzeBadge 컴포넌트 작성 (분석 진행 배지)"
  ```

---

## Task 5: AddView 통합

**Files:**
- Modify: `artifacts/pillflow/src/components/views/AddView.tsx`

현재 AddView.tsx (410줄)에 다음 세 가지만 추가한다:
1. 헤더 우측 카메라 아이콘 버튼
2. `usePhotoAnalyzer` 훅 연결 + 결과 콜백
3. `PhotoAnalyzeBadge` 조건부 렌더링

- [ ] **Step 1: import 추가**

  `AddView.tsx` 상단의 import 블록에 추가:
  ```tsx
  // 기존 import 목록 유지, 아래 세 줄 추가
  import { Camera } from "lucide-react";
  import { usePhotoAnalyzer } from "@/hooks/use-photo-analyzer";
  import { PhotoAnalyzeBadge } from "@/components/common/PhotoAnalyzeBadge";
  ```

  기존 lucide-react import에 `Camera`를 추가하면 됨:
  ```tsx
  // 변경 전
  import {
    Pill,
    ChevronLeft,
    Clock,
    ChevronRight,
    Droplets,
    Package,
    Hand,
    Eye,
    Wind,
    Sunrise,
    SunMedium,
    MoonStar,
  } from "lucide-react";

  // 변경 후 (Camera 추가)
  import {
    Pill,
    Camera,
    ChevronLeft,
    Clock,
    ChevronRight,
    Droplets,
    Package,
    Hand,
    Eye,
    Wind,
    Sunrise,
    SunMedium,
    MoonStar,
  } from "lucide-react";
  ```

  그리고 컴포넌트 파일 상단에 두 줄 추가 import:
  ```tsx
  import { usePhotoAnalyzer } from "@/hooks/use-photo-analyzer";
  import { PhotoAnalyzeBadge } from "@/components/common/PhotoAnalyzeBadge";
  ```

- [ ] **Step 2: 훅 선언 추가**

  `AddView` 컴포넌트 내부 (기존 `const t = useTheme(dark);` 바로 다음에):
  ```tsx
  // 사진 분석 훅 — 결과가 오면 비어있는 필드만 채운다
  const photo = usePhotoAnalyzer({
    onResult: ({ name: analyzedName, summary }) => {
      if (!name.trim() && analyzedName) setName(analyzedName);
      if (!memo.trim() && summary) setMemo(summary);
      if (!analyzedName) {
        toast.info("약 이름을 식별하지 못했어요. 직접 입력해주세요.");
      } else {
        toast.success("✓ 분석 완료. 내용을 확인해주세요.");
      }
    },
  });
  ```

- [ ] **Step 3: 헤더에 카메라 버튼 추가**

  기존 `<header>` 블록을 다음과 같이 수정한다:
  ```tsx
  {/* 헤더 */}
  <header className="flex items-center gap-4 mb-2">
    <button
      onClick={onBack}
      aria-label="뒤로 가기"
      className="w-11 h-11 rounded-full shadow-sm flex items-center justify-center active:scale-90 transition-transform min-w-[44px] min-h-[44px]"
      style={{ backgroundColor: t.card }}
    >
      <ChevronLeft size={22} style={{ color: t.text }} />
    </button>
    <div>
      <h2 className="text-2xl font-black" style={{ color: t.text }}>
        새 약 추가
      </h2>
      <p className="text-xs font-medium" style={{ color: t.subtext }}>
        복용 정보를 입력해주세요
      </p>
    </div>
    {/* 카메라 버튼 — 분석 진행 중에는 비활성화 */}
    <button
      onClick={photo.start}
      disabled={
        photo.status !== "idle" &&
        photo.status !== "done" &&
        photo.status !== "error"
      }
      aria-label="사진으로 약 정보 자동 입력"
      className="ml-auto w-11 h-11 rounded-full shadow-sm flex items-center justify-center active:scale-90 transition-transform min-w-[44px] min-h-[44px] disabled:opacity-50"
      style={{ backgroundColor: t.card }}
    >
      <Camera size={22} style={{ color: "#6C63FF" }} />
    </button>
  </header>
  ```

- [ ] **Step 4: 진행 배지 렌더링 추가**

  헤더 바로 다음, 첫 번째 `<FormField>` 위에 추가:
  ```tsx
  {/* 사진 분석 진행 배지 — idle이면 null 반환 */}
  <PhotoAnalyzeBadge status={photo.status} message={photo.message} dark={dark} />
  ```

- [ ] **Step 5: 타입 체크**

  ```bash
  cd artifacts/pillflow && pnpm typecheck
  ```
  Expected: 에러 없음. 에러 있으면 import 경로·타입명 확인.

- [ ] **Step 6: 커밋**

  ```bash
  git add artifacts/pillflow/src/components/views/AddView.tsx
  git commit -m "[Feat] AddView에 사진으로 약 정보 자동 입력 기능 통합"
  ```

---

## Task 6: Android 빌드 및 디바이스 검증

**Files:**
- 빌드 아티팩트만 영향 (코드 변경 없음)

- [ ] **Step 1: 빌드 및 Android 동기화**

  ```bash
  cd artifacts/pillflow && pnpm build && npx cap sync android
  ```
  Expected: `BUILD SUCCESSFUL` 및 `Sync finished` 메시지.

- [ ] **Step 2: Android Studio에서 디바이스 실행**

  ```bash
  cd artifacts/pillflow && npx cap open android
  ```
  Android Studio에서 Run 버튼으로 실제 디바이스에 설치.

- [ ] **Step 3: Happy Path 검증 체크리스트**

  - [ ] AddView 진입 → 헤더 우측에 보라색 카메라 아이콘 보임
  - [ ] 카메라 아이콘 탭 → 네이티브 시트 (촬영/갤러리) 표시
  - [ ] 사진 선택/촬영 직후 → AddView 화면 유지됨 (새 화면으로 이동 안 함)
  - [ ] 햅틱 피드백 느껴짐
  - [ ] 상단에 배지 "사진 업로드 중..." → "약 정보 분석 중..." 순서로 표시
  - [ ] 배지 표시 중에도 시간/요일/색상 필드 편집 가능 (non-blocking)
  - [ ] 분석 완료 → 비어있던 `name`/`memo` 자동 채워짐
  - [ ] 이미 입력한 `name`/`memo` 는 덮어쓰지 않음
  - [ ] 약 식별 실패 (풍경 사진 등) → 메모만 채워지고 "약 이름을 식별하지 못했어요" 토스트
  - [ ] 비행기 모드 → "분석에 실패했어요. 직접 입력해주세요." 토스트

- [ ] **Step 4: 성능 측정**

  타이머로 "사진 선택 완료 → 배지 사라짐" 시간을 5회 측정.
  - 목표 평균: ≤ 2.5초
  - 목표 p95: ≤ 4초
  - 카메라 닫힘 → AddView 복귀: ≤ 200ms (체감)

---

## Self-Review 체크리스트

### Spec 커버리지

| 요구사항 | 구현 Task |
|---------|----------|
| Groq Vision API 호출 (Edge Function) | Task 1 |
| @capacitor/camera (촬영+갤러리) | Task 2 |
| 1024px 리사이즈 | Task 2 - resizeImageToBase64 |
| 헤더 우측 카메라 버튼 | Task 5 Step 3 |
| JSON `{ name, summary }` 응답 | Task 1 Step 3 |
| 비어있는 필드만 채움 (C-2) | Task 5 Step 2 |
| 즉시 복귀 + non-blocking 상태 배지 | Task 3 (훅 내부: uploading 전환 후 비동기 계속) |
| 단계별 메시지 (uploading→analyzing→slow) | Task 3, Task 4 |
| 햅틱 피드백 | Task 3 Step 1 |
| 5초 → slow 전환 | Task 3 Step 1 |
| 15초 타임아웃 | Task 3 Step 1 |
| 식별 실패 시 토스트 + 메모만 채움 | Task 5 Step 2 |
| 에러 토스트 | Task 3 Step 1 |
| JWT 인증 (익명 차단) | Task 1 Step 3 |
| GROQ_API_KEY Secret | Task 1 Step 0 |

### 타입 일관성

- `AnalyzeResult`: `photoAnalyzer.ts`에서 정의, `use-photo-analyzer.ts`와 `AddView.tsx`에서 import
- `AnalyzeStatus`: `use-photo-analyzer.ts`에서 정의, `PhotoAnalyzeBadge.tsx`에서 import
- `photo.start`, `photo.status`, `photo.message`: 훅 반환값과 AddView 사용처 일치

### 플레이스홀더 검사

없음 — 모든 코드 블록은 실제 구현체.
