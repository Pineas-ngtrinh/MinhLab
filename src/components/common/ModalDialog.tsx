'use client';

import { useEffect, useRef, type ReactNode } from 'react';

interface ModalDialogProps {
  title: string;
  onDismiss: () => void;
  children: ReactNode;
  className?: string;
  testId?: string;
}

export function ModalDialog({ title, onDismiss, children, className, testId }: ModalDialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    const previousOverflow = document.body.style.overflow;
    dialog?.showModal();
    document.body.style.overflow = 'hidden';
    return () => {
      dialog?.close();
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  return (
    <dialog ref={ref} aria-label={title} data-testid={testId}
      onCancel={event => { event.preventDefault(); onDismiss(); }}
      onClick={event => { if (event.target === event.currentTarget) onDismiss(); }}
      className={`fixed inset-0 m-0 h-dvh max-h-none w-full max-w-none justify-center overflow-y-auto bg-black/80 text-[#F4F1EA] backdrop-blur-sm open:flex ${className ?? 'items-center p-4'}`}>
      {children}
    </dialog>
  );
}
