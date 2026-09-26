import { supabase } from "@/lib/supabase";

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? "").replace(/\/+$/, "");
export const DEFAULT_API_ERROR_MESSAGE = "요청 처리에 실패했습니다.";

/** API 요청에 필요한 인증 헤더를 만든다. JSON 본문이 있을 때만 Content-Type을 추가한다. */
export function buildRequestHeaders(accessToken: string, hasJsonBody = false): Record<string, string> {
  return {
    Authorization: `Bearer ${accessToken}`,
    ...(hasJsonBody ? { "Content-Type": "application/json" } : {}),
  };
}

/** 서버 오류 본문에서 사용자에게 보여 줄 메시지를 꺼낸다. */
export async function errorFromResponse(response: Pick<Response, "json">): Promise<Error> {
  try {
    const body: unknown = await response.json();
    if (body && typeof body === "object" && "message" in body && typeof body.message === "string" && body.message) {
      return new Error(body.message);
    }
  } catch {
    // JSON이 아닌 오류 응답은 공통 메시지를 사용한다.
  }
  return new Error(DEFAULT_API_ERROR_MESSAGE);
}

export async function apiRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const { data } = await supabase.auth.getSession();
  const accessToken = data.session?.access_token;
  if (!accessToken) throw new Error("로그인이 필요합니다.");

  const hasJsonBody = typeof init.body === "string";
  const headers = {
    ...buildRequestHeaders(accessToken, hasJsonBody),
    ...init.headers,
  };
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers,
  });

  if (!response.ok) throw await errorFromResponse(response);
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}
