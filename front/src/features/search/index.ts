export { SearchProvider, useSearch } from "./components/SearchProvider";
export { SearchTrigger } from "./components/SearchTrigger";
export { useRecentSearches } from "./hooks/useRecentSearches";
export { resolveCandidates } from "./services/resolveCandidates";

export type {
  ListedCompaniesStatus,
  SearchMode,
  Suggestion,
  SuggestionGroup,
  SuggestionResponse,
} from "./model/types";
