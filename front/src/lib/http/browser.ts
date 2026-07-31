import axios, { AxiosError } from "axios";
import { ApiError, toApiError, toTransportError } from "@/lib/api/errors";

/**
 * 브라우저 → 우리 BFF(`/api/*`) 용 axios 인스턴스.
 *
 * `lib/api/axios.ts`(서버 → FastAPI)와 분리한 이유:
 *   - baseURL 이 다르다. 이쪽은 같은 오리진이라 상대 경로만 쓴다.
 *   - 백엔드 주소·타임아웃 같은 서버 전용 설정이 브라우저 번들에 실리면 안 된다.
 *
 * React Query 가 넘겨주는 `signal` 을 그대로 받아 취소를 지원한다 — 타이핑 중
 * 이전 요청이 자동으로 끊긴다.
 */
export const bffApi = axios.create({
  baseURL: "",
  timeout: 20_000,
  headers: { "Content-Type": "application/json" },
});

bffApi.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    // 취소는 실패가 아니다. React Query 가 알아볼 수 있게 원본을 그대로 올린다.
    if (axios.isCancel(error)) throw error;

    if (error.response) {
      throw toApiError(error.response.status, error.response.data);
    }
    throw toTransportError(
      error.code === "ECONNABORTED"
        ? "요청이 시간 내에 완료되지 않았습니다."
        : (error.message ?? "네트워크에 연결하지 못했습니다."),
    );
  },
);

export { ApiError };
