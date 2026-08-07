export { AdviceProvider } from "./components/AdviceProvider";
export { AdviceDrawer } from "./components/AdviceDrawer";
export { AdviceTrigger } from "./components/AdviceTrigger";
export {
  useBulkAdvice,
  type BulkAdviceEntry,
  type BulkAdviceState,
  type BulkTarget,
} from "./hooks/useBulkAdvice";
export { ADVICE_STAGE_LABELS } from "./model/types";
/** 화면이 상한을 문장으로 옮겨 적지 않도록 숫자를 한 곳에서 가져간다 */
export { MAX_BULK_SYMBOLS, type AdviceResult } from "./model/cache";

export type {
  AdviceStage,
  AdviceStreamEvent,
  AgentOpinion,
  Decision,
  FitConcern,
  PersonalVerdict,
  Verdict,
} from "./model/types";
