import type { ButtonHTMLAttributes } from "react";

type Props = ButtonHTMLAttributes<HTMLButtonElement>;

export function PrimaryButton({ className = "", ...rest }: Props) {
  return (
    <button
      className={`bg-gold-gradient text-txt-on-brand shadow-gold-button rounded-button px-6 py-3 font-bold disabled:opacity-50 ${className}`}
      {...rest}
    />
  );
}

export function SecondaryButton({ className = "", ...rest }: Props) {
  return (
    <button
      className={`bg-surface-card dark:bg-surface-card-dark border border-line dark:border-line-dark text-txt-primary dark:text-txt-primary-dark rounded-button px-5 py-2.5 font-semibold ${className}`}
      {...rest}
    />
  );
}

export function DangerButton({ className = "", ...rest }: Props) {
  return (
    <button
      className={`bg-status-error text-txt-on-brand rounded-button px-5 py-2.5 font-semibold ${className}`}
      {...rest}
    />
  );
}
