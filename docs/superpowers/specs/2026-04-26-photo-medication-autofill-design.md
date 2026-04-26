# 사진 촬영 기반 약 정보 자동 입력 — 설계 문서

- **작성일**: 2026-04-26
- **대상 모듈**: `artifacts/pillflow/src/components/views/AddView.tsx`, 신규 Supabase Edge Function
- **상태**: Draft (브레인스토밍 합의 완료, 사용자 승인 대기)

---

## 1. Context — 왜 만드는가

Pill-Flow2 앱에서 사용자는 새 영양제/약을 등록할 때 매번 약 이름과 복용 메모를 직접 타이핑해야 한다. 이는 다음과 같은 마찰을 만든다.

- 약/영양제 이름이 길거나 외국어인 경우(예: "코엔자임Q10 100mg", "오메가-3 트리글리세라이드") 입력이 번거로움
- 사용자가 약의 효능·복용법을 기억해서 메모로 옮기는 작업이 부담스러움
- 결과적으로 등록을 미루거나 메모 칸을 비워두는 경우가 많음

이 기능은 **약/영양제 패키지 사진 한 장**으로 약 이름과 5줄 요약 메모를 자동 채워주어 등록 마찰을 크게 낮추는 것이 목적이다. 사용자는 결과를 검토·수정 후 저장하기만 하면 된다.

성공 기준:
- 사용자가 사진 촬영 → AddView 폼 채워짐까지 **체감 1초 이내**, 실제 평균 2.5초 이내
- 분석 실패/네트워크 오류 시에도 사용자 입력 흐름이 끊기지 않음
- API 키는 클라이언트에 절대 노출되지 않음

---

## 2. 핵심 결정 요약

| 항목 | 결정 | 근거 |
|------|------|------|
| AI 제공자 | Groq (`meta-llama/llama-4-scout-17b-16e-instruct`) | 비전 지원 + 업계 최고 추론 속도 |
| API 호출 위치 | Supabase Edge Function (`analyze-medication-photo`) | API 키 보호, 사용량 통제 가능 |
| 카메라 입력 | `@capacitor/camera` (촬영 + 갤러리 모두 지원) | 네이티브 UX, 권한 자동 처리 |
| 진입 UI | AddView 헤더 우측 카메라 아이콘 버튼 | 기존 흐름 유지, 선택적 기능 |
| 응답 형식 | JSON `{ name, summary }` | 안전한 파싱, 필드 매핑 명확 |
| 채움 정책 | 비어있는 필드만 자동 채움 (C-2) | 사용자 기존 입력 보호 |
| 비차단 처리 | 촬영 후 즉시 AddView 복귀, 백그라운드 분석 | 체감 속도 향상 |
| 진행 표시 | 단계별 메시지 갱신 + 햅틱 | 차단 없는 상태 피드백 |
| 이미지 전처리 | 클라이언트에서 1024px 장변으로 리사이즈 | 업로드 시간/비용 절감 |
| 비용 정책 | 개인 사용 MVP — 무제한 | 추후 필요 시 Edge Function에 카운터 추가 |
| 식별 실패 시 | `summary`만 메모에 채우고 이름 입력 안내 토스트 | 부분 가치라도 제공 |

---

## 3. 아키텍처

### 3.1 데이터 흐름

```
┌─────────────────┐
│  AddView (UI)   │
│  카메라 아이콘 │
└────────┬────────┘
         │ tap
         ▼
┌─────────────────────────────────┐
│ Capacitor Camera Plugin         │
│ (네이티브 카메라/갤러리 시트)   │
└────────┬────────────────────────┘
         │ base64 이미지
         ▼
┌─────────────────────────────────┐
│ usePhotoAnalyzer (훅)           │
│ 1. <canvas>로 1024px 리사이즈   │
│ 2. 햅틱 + AddView 즉시 복귀     │
│ 3. 단계별 상태 갱신             │
└────────┬────────────────────────┘
         │ POST { imageBase64 }
         ▼
┌─────────────────────────────────┐
│ Supabase Edge Function          │
│ analyze-medication-photo        │
│ - JWT 인증 검증                 │
│ - GROQ_API_KEY (Secret) 사용    │
│ - Groq Vision API 호출          │
└────────┬────────────────────────┘
         │ Groq API
         ▼
┌─────────────────────────────────┐
│ Groq                            │
│ llama-4-scout-17b-16e-instruct  │
│ response_format: json_object    │
└────────┬────────────────────────┘
         │ { name, summary }
         ▼
┌─────────────────────────────────┐
│ usePhotoAnalyzer                │
│ - 비어있는 필드만 채움 (C-2)    │
│ - 완료 토스트 + 햅틱            │
└─────────────────────────────────┘
```

### 3.2 컴포넌트 구성

**클라이언트 측 신규 코드 (`artifacts/pillflow/`):**

| 파일 | 책임 |
|------|------|
| `src/lib/photoAnalyzer.ts` | Edge Function 호출 + 이미지 리사이즈 유틸 (순수 함수) |
| `src/hooks/usePhotoAnalyzer.ts` | 분석 상태 관리 훅 (idle/uploading/analyzing/done/error) |
| `src/components/common/PhotoAnalyzeBadge.tsx` | AddView 상단 진행 배지 (단계별 메시지 표시) |

**클라이언트 측 수정 코드:**

| 파일 | 변경 내용 |
|------|----------|
| `src/components/views/AddView.tsx` | 헤더에 카메라 버튼 추가, `usePhotoAnalyzer` 훅 연결, 진행 배지 렌더링, 비어있는 필드만 채우기 로직 |
| `package.json` | `@capacitor/camera` 의존성 추가 |
| `capacitor.config.ts` | Camera 플러그인 권한 메타데이터 (필요 시) |

**서버 측 신규 코드:**

| 파일 | 책임 |
|------|------|
| `supabase/functions/analyze-medication-photo/index.ts` | Edge Function 본체 — JWT 검증, Groq 호출, JSON 파싱 |
| `supabase/functions/analyze-medication-photo/deno.json` | Deno 임포트 맵 |

**환경 변수 / Secret:**

| 위치 | 키 | 비고 |
|------|-----|------|
| Supabase Secret | `GROQ_API_KEY` | **신규 발급 키 사용 (이전 노출 키 폐기 필수)** |
| 클라이언트 `.env` | (변경 없음) | API 키는 절대 클라이언트에 두지 않음 |

---

## 4. UX 상세 흐름

### 4.1 정상 경로 (Happy Path)

1. 사용자가 AddView 진입 → 헤더 우측 카메라 아이콘 표시
2. 카메라 아이콘 탭 → Capacitor Camera 네이티브 시트 (촬영 / 갤러리 선택)
3. 사용자가 사진 선택/촬영 → base64 반환
4. **즉시 AddView 복귀** + 햅틱 피드백 (`Haptics.impact({ style: Light })`)
5. AddView 상단에 진행 배지 노출:
   - "📷 사진 업로드 중..." (0~1초)
   - "🔍 약 정보 분석 중..." (1~3초)
   - 진행 중에도 사용자는 시간/요일/색상 등 다른 필드 자유롭게 편집 가능
6. 분석 완료 → 비어있는 `name`/`memo` 필드만 자동 채움 (이미 입력된 값은 보존)
7. 햅틱 + 토스트 "✓ 분석 완료. 내용을 확인해주세요"
8. 진행 배지 사라짐 (1초 페이드아웃)

### 4.2 식별 실패 경로 (`name: null`)

1. Groq이 약을 식별하지 못하면 `{ "name": null, "summary": "..." }` 반환
2. `summary`만 비어있으면 메모 필드에 채움
3. 토스트 "약 이름을 식별하지 못했어요. 직접 입력해주세요"
4. 이름 필드에 자동 포커스

### 4.3 에러 경로

| 상황 | 처리 |
|------|------|
| 카메라 권한 거부 | 토스트 "카메라 권한이 필요해요. 설정에서 허용해주세요" |
| 사용자가 카메라 시트 취소 | 조용히 무시 (토스트/배지 없음) |
| 네트워크 실패 / Edge Function 5xx | 토스트 "분석에 실패했어요. 직접 입력해주세요", 배지 제거 |
| 15초 타임아웃 | 위와 동일 |
| 5초 경과 시 (소프트 피드백) | 배지 메시지 "조금 더 걸리고 있어요..."로 갱신 |
| 응답 JSON 파싱 실패 | 위와 동일 (실패 토스트) |

---

## 5. Edge Function 사양

### 5.1 엔드포인트

- 경로: `/functions/v1/analyze-medication-photo`
- 메서드: `POST`
- 인증: Supabase JWT (Authorization 헤더, 자동 검증)

### 5.2 요청 스키마

```typescript
{
  imageBase64: string  // "data:image/jpeg;base64,..." 또는 순수 base64
}
```

- 최대 페이로드: 2MB (1024px 리사이즈된 JPEG는 통상 200KB 이하)

### 5.3 응답 스키마

성공:
```typescript
{
  name: string | null,    // 식별 못 하면 null
  summary: string         // 한국어 5줄 이내 요약
}
```

실패:
```typescript
{
  error: string           // 사용자에게 노출되지 않음 (로깅용)
}
```

### 5.4 Groq 호출 사양

```typescript
POST https://api.groq.com/openai/v1/chat/completions
Authorization: Bearer ${GROQ_API_KEY}
Content-Type: application/json

{
  "model": "meta-llama/llama-4-scout-17b-16e-instruct",
  "messages": [
    {
      "role": "system",
      "content": "당신은 약/영양제 패키지 이미지를 분석하는 전문가입니다. 반드시 JSON 형식으로만 응답하세요."
    },
    {
      "role": "user",
      "content": [
        {
          "type": "text",
          "text": "이 이미지에서 약/영양제를 분석해주세요. JSON 형식: {\"name\": \"제품명 (식별 못하면 null)\", \"summary\": \"한국어 5줄 이내로 (1) 주요 성분 (2) 효능/용도 (3) 권장 복용법 (4) 주의사항 (5) 특이사항을 간결히 요약\"}"
        },
        {
          "type": "image_url",
          "image_url": { "url": "data:image/jpeg;base64,..." }
        }
      ]
    }
  ],
  "response_format": { "type": "json_object" },
  "temperature": 0.2,
  "max_tokens": 500
}
```

### 5.5 보안

- `GROQ_API_KEY`는 Supabase Secret으로만 보관 (`supabase secrets set GROQ_API_KEY=...`)
- Edge Function은 익명 사용자 차단 — `Authorization` 헤더 검증 후 user_id 추출, 없으면 401 반환
- 추후 비용 통제 필요 시 user_id 기준 일일 호출 카운터 추가 (현재는 미구현)

---

## 6. 기존 AddView 변경 사항 (최소 침습)

`AddView.tsx`는 이미 410줄로 충분히 큰 파일이다. 추가 로직은 훅으로 추출하여 컴포넌트 본체는 최소한만 건드린다.

### 6.1 변경 요약

```tsx
// AddView.tsx 상단
import { Camera as CameraIcon } from "lucide-react";
import { usePhotoAnalyzer } from "@/hooks/usePhotoAnalyzer";
import { PhotoAnalyzeBadge } from "@/components/common/PhotoAnalyzeBadge";

// 컴포넌트 내부
const photo = usePhotoAnalyzer({
  onResult: ({ name: nm, summary }) => {
    // 비어있는 필드만 채움 (C-2)
    if (!name.trim() && nm) setName(nm);
    if (!memo.trim() && summary) setMemo(summary);
    if (!nm) {
      toast.info("약 이름을 식별하지 못했어요. 직접 입력해주세요");
    } else {
      toast.success("✓ 분석 완료. 내용을 확인해주세요");
    }
  },
});

// 헤더 우측에 카메라 버튼 추가
<button
  onClick={photo.start}
  disabled={photo.status !== "idle" && photo.status !== "error" && photo.status !== "done"}
  aria-label="사진으로 약 정보 자동 입력"
  className="ml-auto w-11 h-11 rounded-full ..."
>
  <CameraIcon size={22} />
</button>

// 진행 배지 (헤더 아래에 조건부 렌더)
{photo.status !== "idle" && <PhotoAnalyzeBadge status={photo.status} message={photo.message} />}
```

### 6.2 `usePhotoAnalyzer` 훅 인터페이스

```typescript
type AnalyzeStatus = "idle" | "uploading" | "analyzing" | "slow" | "done" | "error";

interface UsePhotoAnalyzerOpts {
  onResult: (r: { name: string | null; summary: string }) => void;
}

interface UsePhotoAnalyzerReturn {
  status: AnalyzeStatus;
  message: string;        // 현재 단계 사용자용 메시지
  start: () => Promise<void>;  // 카메라 시트 → 분석 → 결과 콜백
}
```

내부 단계:
1. `Camera.getPhoto({ source: Prompt, resultType: Base64, quality: 80 })`
2. 성공 시 `Haptics.impact({ style: Light })` 즉시 호출, 상태를 `uploading`으로
3. `<canvas>` 리사이즈 (1024px 장변, JPEG 80%)
4. 5초 후 상태가 여전히 `analyzing`이면 `slow`로 전환
5. fetch에 `AbortController` + 15초 타임아웃
6. 응답 파싱 → `onResult` 콜백 → 상태 `done` (1초 후 `idle`)
7. 에러 → 상태 `error` + 토스트, 3초 후 `idle`

### 6.3 `PhotoAnalyzeBadge` 컴포넌트

```tsx
// 작은 카드, AddView 상단 헤더 바로 아래에 sticky로 표시
// 상태에 따라 아이콘 + 메시지 + 스피너 표시
// 클릭 가능 영역 없음 (정보 표시 전용)
```

상태별 메시지:
- `uploading`: "📷 사진 업로드 중..."
- `analyzing`: "🔍 약 정보 분석 중..."
- `slow`: "⏳ 조금 더 걸리고 있어요..."
- `done`: "✓ 분석 완료" (1초 후 사라짐)
- `error`: "❌ 분석 실패" (3초 후 사라짐)

---

## 7. 변경되지 않는 것 (Out of Scope)

- 약 등록 폼의 다른 필드 (시간, 요일, 색상, 용량) — 사용자 직접 입력 유지
- DB 스키마 — `medications` 테이블 변경 없음
- 분석 결과 캐싱 / 학습 — 현재 범위 외
- 사용량 제한 / 비용 통계 대시보드 — 추후 필요 시 추가
- 다른 화면(EditView 등)에서의 사진 분석 — 이번엔 AddView만

---

## 8. 검증 계획 (How to Test End-to-End)

### 8.1 단위 검증
- `photoAnalyzer.ts`의 리사이즈 함수: 다양한 크기 입력에 대해 1024px 장변 보장 확인
- `usePhotoAnalyzer` 훅: 모킹된 fetch로 각 상태 전이 확인 (idle → uploading → analyzing → done/error)

### 8.2 Edge Function 검증
- `supabase functions serve analyze-medication-photo` 로컬 실행
- 인증 없는 요청 → 401
- 작은 base64 이미지 + 유효 JWT → 200 + JSON `{ name, summary }`
- Groq API 키 누락 시나리오 → 500
- 잘못된 base64 → 400

### 8.3 통합 검증 (Android 디바이스)
1. `pnpm build && npx cap sync android` (pillflow 루트에서)
2. Android Studio로 디바이스에 설치
3. AddView 진입 → 카메라 아이콘 탭 → 권한 허용
4. 영양제 패키지 촬영 → 즉시 AddView 복귀 확인
5. 진행 배지 단계별 메시지 변화 확인
6. 분석 중 다른 필드 편집 가능한지 확인 (non-blocking)
7. 완료 후 비어있던 `name`/`memo`만 채워졌는지 확인
8. 이미 입력한 `name`/`memo`는 덮어쓰지 않는지 확인 (C-2)
9. 식별 어려운 이미지(예: 풍경) 촬영 → 토스트 + 메모만 채움 확인
10. 비행기 모드 → 카메라 → 에러 토스트 확인

### 8.4 성능 측정
- 동일 이미지로 5회 측정, 사진 선택 → 분석 완료까지 평균 시간 기록
- 목표: 평균 2.5초 이하, p95 4초 이하
- 체감 속도: 카메라 닫힘 → AddView 복귀 시간 200ms 이내

---

## 9. 마이그레이션 / 배포 순서

1. Groq에서 **새 API 키 발급** (이전에 채팅에 노출된 키는 즉시 폐기)
2. `supabase secrets set GROQ_API_KEY=새키` (Supabase 프로젝트 설정)
3. `supabase/functions/analyze-medication-photo/` 작성
4. `supabase functions deploy analyze-medication-photo`
5. 클라이언트 코드 작성 (`@capacitor/camera` 추가, 훅/컴포넌트/AddView 수정)
6. `pnpm build && npx cap sync android`
7. 디바이스 테스트 (위 8.3)
8. 커밋 분할: (a) Edge Function (b) Camera 의존성 + 훅/유틸 (c) AddView 통합

---

## 10. 보안 메모 (중요)

브레인스토밍 중 사용자가 채팅에 Groq API 키 일부를 노출했다 (`gsk_...`). 이 키는 다음 조치가 필수:

1. **즉시 폐기**: https://console.groq.com/keys 에서 해당 키 revoke
2. **새 키 발급** 후 Supabase Secret으로만 보관
3. 어떤 파일/커밋/채팅에도 새 키를 평문으로 두지 말 것

이 디자인 문서에는 어떤 키도 포함되지 않는다.
