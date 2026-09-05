"use client";

import { useRef, useState, useTransition, type ReactNode, type FormEvent } from "react";
import { useRouter } from "next/navigation";

type Result = { error?: string; redirectTo?: string };

export default function MutationForm({ action, children, className, buttonClassName, label, pendingLabel, publish = false }: {
  action: (formData: FormData) => Promise<Result>;
  children?: ReactNode;
  className?: string;
  buttonClassName: string;
  label: string;
  pendingLabel: string;
  publish?: boolean;
}) {
  const router = useRouter();
  const locked = useRef(false);
  const submissionId = useRef<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string>();

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (locked.current) return;
    locked.current = true;
    const data = new FormData(event.currentTarget);
    if (publish) {
      submissionId.current ??= crypto.randomUUID();
      data.set("submissionId", submissionId.current);
    }
    setError(undefined);
    startTransition(async () => {
      try {
        const result = await action(data);
        if (result.error) { setError(result.error); locked.current = false; }
        else if (result.redirectTo) { router.push(result.redirectTo); }
      } catch {
        setError("Something went wrong. Please try again.");
        locked.current = false;
      }
    });
  }

  return (
    <form onSubmit={submit} className={className} aria-busy={pending}>
      {children}
      <button type="submit" disabled={pending} className={`${buttonClassName} disabled:cursor-wait disabled:opacity-60`}>
        {pending ? pendingLabel : label}
      </button>
      {error ? <p role="alert" className="text-sm text-[#bd6a4c]">{error}</p> : null}
    </form>
  );
}
