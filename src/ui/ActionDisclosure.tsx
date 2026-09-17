import { useEffect, useRef, type ReactNode } from 'react';

/** A small disclosure that closes after an action, an outside tap or Escape. */
export function ActionDisclosure({ label, className, children }: { label: string; className: string; children: ReactNode }) {
  const panel = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    function dismiss(event: MouseEvent) {
      if (!panel.current?.open || !(event.target instanceof Element)) return;
      if (!panel.current.contains(event.target) || event.target.closest('a, button')) panel.current.open = false;
    }
    function escape(event: KeyboardEvent) {
      if (event.key === 'Escape' && panel.current?.open) {
        panel.current.open = false;
        panel.current.querySelector('summary')?.focus();
      }
    }
    document.addEventListener('click', dismiss);
    document.addEventListener('keydown', escape);
    return () => { document.removeEventListener('click', dismiss); document.removeEventListener('keydown', escape); };
  }, []);
  return <details ref={panel} className={className}><summary>{label}</summary>{children}</details>;
}
