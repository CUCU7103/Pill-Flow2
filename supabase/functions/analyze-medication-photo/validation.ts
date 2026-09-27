// 사진 분석 요청 본문의 크기·형식 검증 (Deno 의존 없는 순수 로직 — deno test로 검증)

// 앱은 1024px로 줄인 JPEG(품질 0.8)만 보내므로 base64 기준 보통 1MB 미만이다.
// 거부된 요청은 호출 한도를 차감하지 않으므로, 과도한 본문 반복으로 메모리를 소모하지 않게 여유를 두고 4MB로 제한한다.
export const MAX_BODY_BYTES = 4_000_000;

const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
type AllowedMime = typeof ALLOWED_MIME_TYPES[number];

export type BodyReadResult =
  | { ok: true; text: string }
  | { ok: false; status: 413 | 400 };

/**
 * 요청 본문을 상한까지만 읽는다.
 * Content-Length가 상한을 넘으면 읽기 전에 거부하고, 헤더가 없거나 거짓이어도
 * 누적 바이트가 상한을 넘는 즉시 스트림을 취소해 메모리 사용을 막는다.
 */
export async function readBodyWithLimit(req: Request, maxBytes = MAX_BODY_BYTES): Promise<BodyReadResult> {
  const declared = req.headers.get("content-length");
  if (declared !== null && Number(declared) > maxBytes) return { ok: false, status: 413 };
  if (!req.body) return { ok: false, status: 400 };

  const reader = req.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel().catch(() => {});
      return { ok: false, status: 413 };
    }
    chunks.push(value);
  }

  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    return { ok: true, text: new TextDecoder("utf-8", { fatal: true }).decode(bytes) };
  } catch {
    return { ok: false, status: 400 };
  }
}

const BASE64_PATTERN = /^[A-Za-z0-9+/]+={0,2}$/;
const DATA_URL_PATTERN = /^data:(image\/[a-z]+);base64,/;

/**
 * imageBase64 값을 검증해 Groq에 보낼 data URL을 만든다.
 * data:image/(jpeg|png|webp);base64, 접두사 또는 순수 base64(JPEG로 간주)만 허용하고,
 * 디코딩한 앞부분 매직 바이트가 선언한 형식과 일치해야 한다. 실패 시 null.
 */
export function toValidatedDataUrl(imageBase64: unknown): string | null {
  if (typeof imageBase64 !== "string" || imageBase64.length === 0) return null;

  let mime: AllowedMime = "image/jpeg";
  let payload = imageBase64;
  if (imageBase64.startsWith("data:")) {
    const match = DATA_URL_PATTERN.exec(imageBase64);
    if (!match || !(ALLOWED_MIME_TYPES as readonly string[]).includes(match[1])) return null;
    mime = match[1] as AllowedMime;
    payload = imageBase64.slice(match[0].length);
  }

  if (payload.length % 4 !== 0 || !BASE64_PATTERN.test(payload)) return null;
  if (detectImageMime(payload) !== mime) return null;
  return `data:${mime};base64,${payload}`;
}

/** base64 앞부분만 디코딩해 파일 시그니처로 이미지 형식을 판별한다. */
function detectImageMime(base64: string): AllowedMime | null {
  let head: Uint8Array;
  try {
    head = Uint8Array.from(atob(base64.slice(0, 16)), (c) => c.charCodeAt(0));
  } catch {
    return null;
  }
  if (head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff) return "image/jpeg";
  if (head[0] === 0x89 && head[1] === 0x50 && head[2] === 0x4e && head[3] === 0x47) return "image/png";
  const riff = String.fromCharCode(...head.slice(0, 4));
  const webp = String.fromCharCode(...head.slice(8, 12));
  if (riff === "RIFF" && webp === "WEBP") return "image/webp";
  return null;
}
