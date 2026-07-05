import { useNavigate, useParams } from "react-router";
import { PrimaryButton } from "../components/Buttons";

const guide = [
  "아래 버튼을 누르면 인터넷 창이 열려요",
  "쓰던 계정으로 로그인하세요",
  "허용 버튼만 누르면 끝나요",
];

export function Auth() {
  const { toolId = "" } = useParams();
  const navigate = useNavigate();
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-surface-bg dark:bg-surface-bg-dark px-8">
      <h1 className="text-display font-extrabold">딱 한 번, 로그인만 하면 돼요</h1>
      <p className="mt-2 text-txt-secondary dark:text-txt-secondary-dark">
        설치는 끝났어요! 이제 계정을 연결해 줄 차례예요.
      </p>
      <div className="mt-10 grid w-full max-w-4xl grid-cols-1 gap-4 md:grid-cols-3">
        {guide.map((text, i) => (
          <div key={text} className="rounded-card border border-line dark:border-line-dark bg-surface-card dark:bg-surface-card-dark p-6 shadow-card">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-surface-gold-tint font-bold text-txt-gold">{i + 1}</span>
            <p className="mt-3 font-bold">{text}</p>
          </div>
        ))}
      </div>
      <PrimaryButton className="mt-10" onClick={() => navigate(`/success/${toolId}`)}>
        로그인 시작
      </PrimaryButton>
      <button type="button" className="mt-3 text-caption text-txt-tertiary hover:text-txt-secondary">
        로그인 창이 안 뜨나요?
      </button>
    </div>
  );
}
