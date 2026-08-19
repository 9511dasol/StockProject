# 프런트 구조 규칙

Next.js 16 App Router 기준. **도메인(feature) 중심**으로 코드를 모으고, 라우팅은 `app/`에만 둔다.
새 화면·기능을 만들 때는 이 문서의 트리와 의존 방향을 그대로 따른다.

## 4가지 원칙

1. **`app/`은 라우팅만** — 페이지는 데이터를 받아 feature 컴포넌트를 조립하는 얇은 껍데기다.
   비즈니스 UI·로직을 `app/` 안에 쌓지 않는다.
2. **기능은 `features/<domain>/`에 수직으로 모은다** — 하나의 도메인을 고칠 때 열어야 할 폴더가 하나다.
   `components/`가 전역에 하나뿐인 구조는 파일이 200개를 넘기면 탐색이 불가능해진다.
3. **아래 계층은 위를 모른다** — `app → features → shared → lib`. 역방향 import는 금지다.
   백엔드의 `api → services → repositories → domain` 규칙과 같은 방향이다.
4. **경계는 `index.ts`로만 노출한다** — feature 내부 파일을 외부에서 깊게 import하지 않는다.

## 트리

```
front/
├── src/
│   ├── app/                          # 라우팅 전용 (URL = 폴더)
│   │   ├── layout.tsx                #   루트 레이아웃
│   │   ├── globals.css               #   Tailwind v4 엔트리 + 테마 토큰
│   │   ├── page.tsx                  #   / 시장 현황
│   │   ├── stocks/
│   │   │   └── [symbol]/
│   │   │       ├── page.tsx          #   /stocks/[symbol] 종목 상세
│   │   │       ├── loading.tsx       #   스트리밍 스켈레톤
│   │   │       ├── error.tsx         #   세그먼트 에러 경계
│   │   │       └── advice/
│   │   │           └── page.tsx      #   /stocks/[symbol]/advice AI 판단
│   │   ├── (docs)/                   #   URL에 안 나오는 라우트 그룹
│   │   │   └── wireframes/page.tsx   #   /wireframes
│   │   └── api/                      #   BFF 라우트 핸들러 (브라우저 → Next → FastAPI)
│   │       └── stocks/suggestions/route.ts
│   │
│   ├── features/                     # 도메인 모듈 — 이 프로젝트 코드의 대부분
│   │   ├── market/                   #   시장 현황
│   │   │   ├── components/           #     이 도메인 전용 UI
│   │   │   ├── services/             #     백엔드 API 호출 (서버에서 실행)
│   │   │   ├── model/                #     types.ts · 스키마 · 파생 계산
│   │   │   └── index.ts              #     공개 API (외부는 여기만 import)
│   │   ├── stocks/                   #   종목 상세·차트
│   │   │   ├── components/
│   │   │   ├── hooks/                #     'use client' 훅
│   │   │   ├── services/
│   │   │   ├── model/
│   │   │   └── index.ts
│   │   ├── advice/                   #   AI 투자 판단
│   │   └── search/                   #   종목 자동완성
│   │
│   ├── shared/                       # 도메인을 모르는 재사용 UI 레이어
│   │   ├── ui/                       #   shadcn/ui 생성물 (button, card, ...) — 직접 수정 O
│   │   ├── components/               #   ui/ 를 조합한 자체 공통 컴포넌트
│   │   │   ├── layout/               #     Header, Footer, Container
│   │   │   ├── chart/                #     서버 SVG 그래픽 프리미티브 (스파크라인 등)
│   │   │   └── feedback/             #     Skeleton, EmptyState, ErrorBox
│   │   ├── hooks/                    #   도메인 무관 훅 (useDebounce 등)
│   │   ├── types/                    #   여러 도메인이 공유하는 타입 (ApiResponse 등)
│   │   └── constants/                #   라우트 경로, 표시 라벨
│   │
│   ├── lib/                          # 프레임워크·외부 연동 어댑터 (React 무관)
│   │   ├── api/                      #   HTTP 클라이언트, 백엔드 베이스 URL, 에러 정규화
│   │   ├── format/                   #   숫자·통화·퍼센트·날짜 표시 포맷
│   │   ├── config/                   #   env 파싱·검증
│   │   └── utils/                    #   cn() 등 순수 유틸
│   │
│   └── store/                        # 전역 클라이언트 상태 (여러 도메인이 공유할 때만)
│
├── public/                           # 정적 파일
├── CONVENTIONS.md                    # 이 문서
├── AGENTS.md · CLAUDE.md             # 에이전트 규칙
├── next.config.ts · tsconfig.json · eslint.config.mjs · postcss.config.mjs
└── package.json
```

## 각 폴더를 그렇게 둔 이유

| 폴더 | 역할 | 왜 여기인가 |
|---|---|---|
| `src/` | 소스 루트 | 설정 파일(`next.config.ts`, `tsconfig.json`, `eslint.config.mjs`)과 소스가 루트에서 섞이지 않는다. Next가 공식 지원하는 선택지이고, `@/*` 별칭이 "소스 루트"라는 하나의 뜻만 갖는다. |
| `app/` | URL 정의 | Next는 폴더 이름을 URL로 쓴다. 즉 `app/`의 구조는 **제품 정보구조에 종속**된다. 도메인 코드를 여기 두면 URL이 바뀔 때 코드가 따라 움직인다. 그래서 라우팅만 남긴다. |
| `features/<domain>/` | 도메인 수직 모듈 | 실무 변경은 "시장 현황 화면 고쳐줘"처럼 **도메인 단위**로 들어온다. 관련 UI·API 호출·타입이 한 폴더에 있으면 변경 범위가 폴더 하나로 닫힌다. 폐기할 때도 폴더째 지운다. |
| `features/*/services/` | 백엔드 호출 | 화면과 API 계약을 분리한다. 컴포넌트는 `getMarketOverview()`만 알고, 엔드포인트·재시도·폴백은 이 파일이 안다. 백엔드 응답 형태가 바뀌어도 컴포넌트는 손대지 않는다. |
| `features/*/model/` | 타입·파생 로직 | 타입을 전역 `types/`에 몰아넣으면 어느 도메인 것인지 알 수 없게 된다. 쓰는 곳 옆에 둔다. |
| `features/*/index.ts` | 공개 경계 | 이게 없으면 외부가 내부 파일을 자유롭게 참조해 리팩터링이 막힌다. 내보내지 않은 것은 내부 구현이다. |
| `shared/ui/` | 원자 UI | shadcn/ui는 코드를 프로젝트에 복사하는 방식이라 **우리 소스**다. 생성물 위치를 한 곳에 고정해 `components.json`의 `aliases.ui`와 일치시킨다. |
| `shared/components/` | 조합 컴포넌트 | shadcn 생성물(`ui/`)과 우리가 만든 공통 컴포넌트를 섞으면, shadcn 업데이트 시 무엇을 덮어써도 되는지 구분할 수 없다. 그래서 분리한다. |
| `lib/` | 외부 세계 어댑터 | HTTP·env·포맷은 React와 무관한 순수 코드다. 분리해 두면 테스트가 쉽고, 어느 계층에서든 안전하게 쓸 수 있다. |
| `store/` | 전역 상태 | 이 프로젝트는 화면 대부분이 서버 컴포넌트다. 전역 상태는 **여러 도메인이 실제로 공유할 때만** 만든다. 도메인 하나에서만 쓰는 상태는 `features/<domain>/store/`에 둔다. |

## 의존 방향

```
app  →  features  →  shared  →  lib
                 ↘           ↗
                    store
```

- 아래 계층은 위 계층을 import하지 않는다. `shared/`가 `features/`를 참조하면 공통이 아니다.
- **feature 간 직접 import 금지.** `features/advice`가 `features/stocks`의 내부를 참조하면 안 된다.
  필요하면 둘 중 하나를 택한다.
  1. 페이지(`app/`)에서 두 feature를 조합한다 — 대부분 이 방법으로 해결된다.
  2. 정말 공용이면 `shared/`로 승격한다.
- `lib/`은 아무것도 import하지 않는다 (외부 패키지 제외).

## 경로 별칭

`tsconfig.json`에 설정되어 있다. 상대 경로 `../../..`는 쓰지 않는다.

| 별칭 | 실제 경로 | 예시 |
|---|---|---|
| `@/*` | `src/*` | `@/app/globals.css` |
| `@/features/*` | `src/features/*` | `@/features/stocks` |
| `@/shared/*` | `src/shared/*` | `@/shared/components/layout/Header` |
| `@/ui/*` | `src/shared/ui/*` | `@/ui/button` |
| `@/lib/*` | `src/lib/*` | `@/lib/format/number` |
| `@/store/*` | `src/store/*` | `@/store/watchlist` |

규칙:

```ts
// ✅ feature는 공개 경계로만
import { StockChart } from "@/features/stocks";

// ❌ 내부 파일 직접 참조
import { StockChart } from "@/features/stocks/components/StockChart";

// ✅ 같은 feature 내부는 상대 경로 (모듈 이동에 안전)
import { toSeries } from "../model/series";

// ✅ 공통 레이어는 별칭
import { Button } from "@/ui/button";
import { formatKrw } from "@/lib/format/number";
```

## 새 기능을 추가하는 절차

1. 도메인 이름을 정하고 `src/features/<domain>/`을 만든다.
2. `model/types.ts` — 백엔드 응답 타입부터 적는다. 백엔드 `app/schemas`와 이름을 맞춘다.
3. `services/` — API 호출 함수. 서버에서 실행되며 `lib/api`의 클라이언트를 쓴다.
4. `components/` — 기본은 서버 컴포넌트. 상호작용이 필요한 조각만 `'use client'`로 잘라낸다.
5. `index.ts` — 페이지가 쓸 것만 export한다.
6. `app/`에 라우트를 만들고 3~4단계를 조립한다. 느린 조회는 `<Suspense>`로 감싼다.

## 이 프로젝트에 한정된 제약

- **서버 컴포넌트가 기본이다.** `'use client'`는 사용자 입력이 필요한 최소 단위에만 붙인다.
- **차트는 예외적으로 클라이언트다.** 원래 "차트도 서버에서 SVG로" 였으나, 휠 줌·크로스헤어
  툴팁·프리셋 전환은 서버 렌더로 구현할 수 없어 `lightweight-charts`(캔버스)로 간다.
  데이터는 서버에서 받아 prop 으로 넘기고, 클라이언트는 그리기만 한다
  (`features/stocks/components/StockChart.tsx`). 스파크라인처럼 상호작용이 없는 그래픽은
  계속 서버 SVG(`shared/ui/Sparkline.tsx`)로 그린다.
- **지표 계산은 백엔드 소유다.** `/stocks/history` 응답의 `metrics`를 쓰고, 프런트에서 같은 공식을
  다시 구현하지 않는다.
- **브라우저에서 FastAPI를 직접 호출하지 않는다.** 클라이언트 컴포넌트가 데이터를 필요로 하면
  `app/api/`의 BFF 라우트를 경유한다. 백엔드 주소·키를 브라우저에 노출하지 않기 위함이다.
- **Next 16은 학습 데이터와 다르다.** 프레임워크 API를 쓸 때는 `node_modules/next/dist/docs/`의
  해당 문서를 먼저 읽는다 (`AGENTS.md`).

## 예외적으로 허용되는 배치

- 한 라우트에서만 쓰이고 재사용 계획이 없는 조각은 `app/<route>/_components/`에 둔다.
  `_` 접두사 폴더는 라우팅에서 제외된다. 두 번째 사용처가 생기면 `features/`로 옮긴다.
- **여러 라우트가 공유하는 서버 데이터 조립은 `app/_data/`에 둔다.** 신원(세션·쿠키)을
  도메인 서비스와 엮는 일은 app 계층의 몫이라 `features/`로 내릴 수 없고
  (`features/`가 `@/auth`를 알면 안 된다), 한쪽 라우트의 `_components/`에 두면 다른
  라우트가 남의 내부를 깊게 참조하게 된다. 지금 있는 것은 `_data/watchlist.ts`
  (관심종목 화면과 대시보드가 공유) 하나다.
- 라우트 그룹 `(name)/`은 URL에 나타나지 않는다. 레이아웃을 공유하거나 화면을 묶을 때 쓴다.

## 검증

```bash
cd front && npx tsc --noEmit && npm run lint && npm run build
```
