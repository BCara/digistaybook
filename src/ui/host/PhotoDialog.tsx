import { useEffect, useRef, type KeyboardEvent, type MouseEvent } from "react";
import { createPortal } from "react-dom";
import { PhotoField, type PhotoFieldProps } from "./PhotoField";

/**
 * Everything inside the panel a Tab can land on, in the order it lands. The
 * file input is skipped: it is the one control here that is deliberately
 * off-screen, driven by the buttons beside it.
 */
function focusable(panel: HTMLElement) {
  return Array.from(
    panel.querySelectorAll<HTMLElement>(
      "button:not(:disabled), [href], input:not(:disabled):not(.visually-hidden), [tabindex]:not([tabindex='-1'])"
    )
  );
}

/**
 * The photograph field, over the page rather than in it.
 *
 * On the wall canvas the upload used to open as a band wedged into the sheet,
 * which pushed the wall down the screen and asked a Host to lose their place
 * in the thing they were editing to change one picture. A photograph is a
 * short errand — choose, look, save — so it is done over the wall and handed
 * straight back, with the wall still where it was left.
 *
 * It is a modal in the full sense: the page behind it is inert to a screen
 * reader, Escape and the scrim close it, Tab stays inside, and the control
 * that opened it gets the focus back.
 */
export function PhotoDialog({ onClose, ...field }: PhotoFieldProps & { onClose: () => void }) {
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    panel.current?.focus();
    return () => opener?.focus?.();
  }, []);

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") {
      event.stopPropagation();
      onClose();
      return;
    }
    if (event.key !== "Tab" || !panel.current) return;
    // Without this a Tab off the last button lands on the page underneath,
    // which is the page this dialog has just told a screen reader to ignore.
    const stops = focusable(panel.current);
    if (stops.length === 0) return;
    const edge = event.shiftKey ? stops[0]! : stops[stops.length - 1]!;
    if (document.activeElement === edge || document.activeElement === panel.current) {
      event.preventDefault();
      (event.shiftKey ? stops[stops.length - 1]! : stops[0]!).focus();
    }
  }

  // The scrim closes on a press that both starts and ends on it, so a drag
  // that began inside the panel and finished on the backdrop does not.
  function onScrim(event: MouseEvent<HTMLDivElement>) {
    if (event.target === event.currentTarget) onClose();
  }

  return createPortal(
    <div className="photo-dialog-scrim" onMouseDown={onScrim}>
      <div
        className="photo-dialog"
        role="dialog"
        aria-modal="true"
        aria-label={field.label}
        tabIndex={-1}
        ref={panel}
        onKeyDown={onKeyDown}
      >
        <PhotoField {...field} />
        <button type="button" className="btn btn-ghost btn-sm photo-dialog-close" onClick={onClose}>
          Done
        </button>
      </div>
    </div>,
    document.body
  );
}
