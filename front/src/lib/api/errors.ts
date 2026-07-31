/**
 * 백엔드 에러 봉투 → ApiError 정규화.
 *
 * fetch 경로와 axios 경로가 같은 예외 타입을 던져야 호출부가 전송 수단을
 * 몰라도 된다. 그래서 클라이언트 구현이 아니라 여기에 둔다.
 */

export class ApiError extends Error {
  readonly status: number;
  /** stock_not_found · provider_unavailable · llm_unavailable … */
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }

  /** 종목을 찾지 못한 경우 — 후보 선택 화면으로 보낸다 */
  get isNotFound(): boolean {
    return this.status === 404;
  }

  /** yfinance·KRX 등 외부 공급자 문제 — 재시도가 의미 있다 */
  get isUpstream(): boolean {
    return this.status === 503 || this.code === "provider_unavailable";
  }
}

/** back/app/core/exceptions.py 가 내려주는 형태 */
export interface ErrorEnvelope {
  error?: { code?: string; message?: string };
}

export function toApiError(status: number, body: unknown): ApiError {
  const envelope = body as ErrorEnvelope | undefined;
  return new ApiError(
    status,
    envelope?.error?.code ?? `http_${status}`,
    envelope?.error?.message ?? `요청이 실패했습니다 (${status})`,
  );
}

/** 응답 본문을 읽을 수 없을 때(프록시 오류 등)의 폴백 */
export function toTransportError(message: string): ApiError {
  return new ApiError(0, "network_error", message);
}
