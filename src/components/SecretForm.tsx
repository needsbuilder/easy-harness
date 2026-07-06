import { useState } from "react";
import { PrimaryButton } from "./Buttons";

export function SecretForm({ label, onSubmit, submitting = false }: {
  label: string; onSubmit: (value: string) => void; submitting?: boolean;
}) {
  const [value, setValue] = useState("");
  return (
    <form
      className="mx-auto mt-8 flex w-full max-w-md flex-col gap-3 text-left"
      onSubmit={(e) => {
        e.preventDefault();
        const v = value.trim();
        if (v && !submitting) {
          onSubmit(v);
          setValue(""); // 실패로 되돌아와도 빈 폼에서 다시 시작 (이월 백로그 5번)
        }
      }}
    >
      <label htmlFor="secret-input" className="font-bold">
        열쇠 값 붙여넣기
      </label>
      <input
        id="secret-input"
        type="password"
        autoComplete="off"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="복사해 온 값을 여기에 붙여넣어 주세요"
        className="rounded-badge border border-line dark:border-line-dark bg-surface-card dark:bg-surface-card-dark px-4 py-3 font-mono"
      />
      <p className="text-caption text-txt-tertiary">
        이 값({label})은 도구에만 전달하고 이지 하네스는 저장하지 않아요.
      </p>
      <PrimaryButton type="submit" disabled={submitting}>{submitting ? "확인하는 중" : "등록하기"}</PrimaryButton>
    </form>
  );
}
