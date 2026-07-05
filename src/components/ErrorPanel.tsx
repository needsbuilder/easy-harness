import { PrimaryButton, SecondaryButton } from "./Buttons";
import mascot from "../assets/mascot.png";

export function ErrorPanel({
  message, friendly, onRetry, onCopyLog,
}: {
  message: string; friendly: string; onRetry: () => void; onCopyLog: () => void;
}) {
  return (
    <div className="flex items-start gap-4 rounded-card border border-status-error/40 bg-surface-card dark:bg-surface-card-dark p-6 shadow-card">
      <img src={mascot} alt="" className="h-12 w-12 object-contain opacity-80" />
      <div className="min-w-0 flex-1">
        <h3 className="text-subtitle font-bold">멈춘 단계: {friendly}</h3>
        <p className="mt-1 text-txt-secondary dark:text-txt-secondary-dark">{message}</p>
        <div className="mt-4 flex gap-2">
          <PrimaryButton onClick={onRetry}>다시 시도</PrimaryButton>
          <SecondaryButton onClick={onCopyLog}>자세한 로그 복사</SecondaryButton>
        </div>
      </div>
    </div>
  );
}
