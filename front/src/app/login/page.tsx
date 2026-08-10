import { redirect } from "next/navigation";
import { auth, AUTH_ENABLED, signIn } from "@/auth";
import { MARKET_CAPTION_SUFFIX } from "@/lib/config/marketHours";
import { masthead } from "@/lib/format";
import { Masthead } from "@/shared/components/layout/Masthead";
import { Icon } from "@/shared/ui";

/**
 * 로그인 화면.
 *
 * ## 왜 로그인이 필요한가를 화면이 말한다
 *
 * 이 서비스는 로그인 없이도 **전부** 쓸 수 있다. 종목을 보고, 관심종목을 담고, AI
 * 판단까지 받는다. 그래서 "로그인하세요" 만 띄우면 사용자는 왜 해야 하는지 모른다.
 * 실제로 달라지는 것 하나(기기 간 동기화)를 그대로 적는다.
 *
 * ## 설정된 수단만 보여 준다
 *
 * 구글 키가 없으면 구글 버튼이 없고, 메일 경로가 없으면 매직링크 칸이 없다. 둘 다
 * 없으면 이 화면은 아예 안내로 바뀐다 — 누르면 깨지는 버튼을 두지 않는다.
 */
export const dynamic = "force-dynamic";

const GOOGLE_ON = Boolean(
  process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET,
);
const EMAIL_ON = Boolean(process.env.EMAIL_SERVER && process.env.EMAIL_FROM);

/**
 * Auth.js 가 `?error=` 로 넘기는 코드 → 사람이 읽는 문장.
 *
 * **`Configuration` 을 "설정이 잘못됐습니다" 로 번역하면 안 된다.** 이 화면에 그
 * 코드로 도착하는 가장 흔한 경로가 **사용자가 구글 화면에서 취소한 경우**이기
 * 때문이다 — 취소는 `iss` 없는 에러 응답으로 돌아오고, Auth.js 는 그것을
 * `CallbackRouteError` 로 감싸 이 코드로 내보낸다 (`auth.ts` 의 `pages.error` 주석).
 *
 * 그래서 문장을 **양쪽 다 포함하도록** 쓴다. 취소한 사람에게는 "다시 시도" 가
 * 답이고, 진짜 설정 문제라면 로그에 원인이 남아 있다는 것을 알려 준다. 어느 쪽인지
 * 화면이 단정하지 않는 편이 정직하다.
 */
const ERROR_MESSAGES: Record<string, string> = {
  Configuration:
    "로그인이 완료되지 않았습니다. 구글 화면에서 취소했다면 다시 시도하시면 됩니다. " +
    "반복된다면 서버 로그에 원인이 남아 있습니다.",
  AccessDenied: "이 계정으로는 로그인할 수 없습니다. 다른 계정으로 시도해 보세요.",
  Verification:
    "이 로그인 링크는 만료되었거나 이미 사용되었습니다. 링크를 다시 받아 주세요.",
};

const DEFAULT_ERROR = "로그인하지 못했습니다. 잠시 후 다시 시도해 주세요.";

interface LoginPageProps {
  /** Next 16 은 searchParams 를 Promise 로 준다 */
  searchParams: Promise<{ error?: string }>;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  // 이미 로그인했으면 여기 머물 이유가 없다.
  const session = await auth();
  if (session?.user) redirect("/watchlist");

  const { error } = await searchParams;
  const errorMessage = error
    ? (ERROR_MESSAGES[error] ?? DEFAULT_ERROR)
    : null;

  const caption = `${masthead(new Date().toISOString())} · ${MARKET_CAPTION_SUFFIX}`;

  return (
    <main className="mx-auto flex w-full max-w-[1180px] flex-col gap-5 px-4 pb-[30px] pt-[26px] md:px-8">
      <Masthead caption={caption} />

      <section className="mx-auto flex w-full max-w-[420px] flex-col gap-5 pt-6">
        <div className="flex flex-col gap-[7px]">
          <h1 className="font-serif-kr font-bold leading-none tracking-[-0.01em] text-[19px] md:text-[22px]">
            로그인
          </h1>
          <p
            className="font-mono leading-none tracking-label-wide text-muted-50"
            style={{ fontSize: 10.5 }}
          >
            관심 종목을 기기 간에 이어서 봅니다
          </p>
        </div>

        {/* 로그인이 무엇을 바꾸는지 — 안 하면 잃는 것이 없다는 것도 함께 말한다 */}
        <p
          className="border-y border-line-20 py-3 text-muted-70"
          style={{ fontSize: 12.5, lineHeight: 1.65 }}
        >
          로그인하지 않아도 이 서비스는 전부 쓸 수 있습니다. 다만 관심 종목이 지금
          쓰는 브라우저에만 남습니다. 로그인하면 <strong>지금까지 담아 둔 목록이
          계정으로 옮겨지고</strong>, 다른 기기에서도 같은 목록을 봅니다.
        </p>

        {/* 실패 안내는 버튼 **위**에 둔다 — 아래 두면 다시 누를 버튼을 지나친 뒤에야
            읽게 되고, 모바일에서는 화면 밖일 수도 있다. role="alert" 로 스크린리더가
            페이지 도착과 함께 읽는다. */}
        {errorMessage ? (
          <p
            role="alert"
            className="flex items-start gap-2 border border-line-35 px-3 py-3 text-muted-70"
            style={{ fontSize: 12.5, lineHeight: 1.6 }}
          >
            {/* 전용 '오류 색' 을 만들지 않는다. 이 팔레트에서 빨강·파랑은 등락 방향이
                소유하고(`lib/format/direction`), 앰버는 AI 액션이다. 여기서 그 셋 중
                하나를 빌리면 화면 전체의 색 규약이 흐려진다 — 실선 테두리와 글리프로
                충분히 구분되고, 바로 아래 안내(점선)와도 다르게 읽힌다. */}
            <Icon name="bell" size={15} className="mt-0.5 flex-none text-muted-45" />
            {errorMessage}
          </p>
        ) : null}

        {!AUTH_ENABLED ? (
          <p
            role="status"
            className="border border-dashed border-line-30 px-3 py-3 text-muted-70"
            style={{ fontSize: 12.5, lineHeight: 1.6 }}
          >
            로그인 수단이 아직 설정되지 않았습니다. <code>front/.env.local</code> 에
            구글 OAuth(<code>AUTH_GOOGLE_ID</code>·<code>AUTH_GOOGLE_SECRET</code>)
            또는 메일 발송(<code>EMAIL_SERVER</code>·<code>EMAIL_FROM</code>)을 넣으면
            이 화면에 버튼이 나타납니다.
          </p>
        ) : null}

        {GOOGLE_ON ? (
          <form
            action={async () => {
              "use server";
              await signIn("google", { redirectTo: "/watchlist" });
            }}
          >
            <button
              type="submit"
              className="flex min-h-[var(--tap)] w-full items-center justify-center gap-2 border-2 border-ink py-3 font-medium hover:bg-ink hover:text-on-ink"
              style={{ fontSize: 14 }}
            >
              <Icon name="user" size={16} />
              구글로 계속하기
            </button>
          </form>
        ) : null}

        {GOOGLE_ON && EMAIL_ON ? (
          <div className="flex items-center gap-3">
            <span className="h-px flex-1 bg-line-20" />
            <span
              className="font-mono uppercase tracking-label text-muted-45"
              style={{ fontSize: 10 }}
            >
              또는
            </span>
            <span className="h-px flex-1 bg-line-20" />
          </div>
        ) : null}

        {EMAIL_ON ? (
          <form
            action={async (formData: FormData) => {
              "use server";
              await signIn("nodemailer", {
                email: String(formData.get("email") ?? ""),
                redirectTo: "/watchlist",
              });
            }}
            className="flex flex-col gap-2"
          >
            <label
              htmlFor="email"
              className="font-mono uppercase tracking-label text-muted-45"
              style={{ fontSize: 10 }}
            >
              이메일로 링크 받기
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              autoComplete="email"
              placeholder="you@example.com"
              className="min-h-[var(--tap)] border border-line-control bg-field px-3.5 py-2.5"
              style={{ fontSize: 13.5 }}
            />
            <button
              type="submit"
              className="min-h-[var(--tap)] border border-ink py-2.5 font-medium hover:bg-ink hover:text-on-ink"
              style={{ fontSize: 13.5 }}
            >
              로그인 링크 보내기
            </button>
            <p className="text-muted-55" style={{ fontSize: 11.5, lineHeight: 1.5 }}>
              비밀번호가 없습니다. 메일로 온 링크를 누르면 로그인됩니다.
            </p>
          </form>
        ) : null}
      </section>
    </main>
  );
}
