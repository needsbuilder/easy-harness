import { useLocation, useNavigate, useParams } from "react-router";
import { PrimaryButton } from "../components/Buttons";
import mascot from "../assets/mascot.png";

const dots = [
  "left-[18%] top-[22%] bg-line-gold", "right-[20%] top-[18%] bg-line-gold",
  "left-[28%] top-[55%] bg-cloud-mint", "right-[22%] top-[42%] bg-cloud-deep",
  "left-[15%] bottom-[28%] bg-cloud-mint", "right-[16%] bottom-[34%] bg-line-gold",
];

export function Success() {
  const { toolId = "" } = useParams();
  const navigate = useNavigate();
  // Wizard가 넘겨준 표시 이름 (새로고침 등으로 없으면 id 폴백)
  const { state } = useLocation() as { state?: { name?: string; helpers?: string[] } };
  const toolName = state?.name ?? toolId;
  const helpers = state?.helpers ?? [];
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-surface-bg dark:bg-surface-bg-dark px-8">
      {dots.map((cls) => (
        <span key={cls} className={`absolute h-2 w-2 rounded-full ${cls}`} aria-hidden />
      ))}
      <img src={mascot} alt="근두운을 탄 오공이" className="h-52 w-52 object-contain" />
      <h1 className="mt-8 text-display font-extrabold">{toolName} 준비 완료!</h1>
      <p className="mt-2 text-txt-secondary dark:text-txt-secondary-dark">
        방금 첫 인사까지 나눠봤어요. 이제 뭐든 시켜보세요.
      </p>
      {helpers.length > 0 && (
        <p className="mt-1 text-caption text-txt-tertiary">{helpers.join("·")}도 함께 준비했어요.</p>
      )}
      <PrimaryButton className="mt-8" onClick={() => navigate("/tools")}>바로 시작하기</PrimaryButton>
      <footer className="absolute bottom-10 flex flex-col items-center gap-2">
        <span className="bg-gold-gradient h-1 w-11 rounded-badge" aria-hidden />
        <span className="text-caption font-bold tracking-[0.42em] text-[#B9891F]">EASY HARNESS</span>
      </footer>
    </div>
  );
}
