/**
 * The writing surfaces of the guest-view editor.
 *
 * A field here is not a labelled box under a heading: it is the guest's own
 * line, made typeable. It carries the type, size and colour the wall will use,
 * and it shows no border until it is hovered or focused, so the page reads as
 * the finished wall until a Host reaches for it.
 *
 * That costs the visible label, so every field carries an `aria-label` and
 * writes its prompt into the placeholder — the empty state is the instruction,
 * the way a blank line in a guestbook is.
 *
 * The wall as a guest reads it is never these fields with their writing taken
 * away: it is the phone beside them, which renders the draft itself.
 */

type FieldProps = {
  /** What this line is, for anyone who cannot see where it sits. */
  label: string;
  value: string;
  placeholder: string;
  onChange: (value: string) => void;
  /** The wall's own class for this line, so the field looks like the result. */
  className?: string;
  maxLength?: number;
  disabled?: boolean;
  invalid?: boolean;
};

export function CanvasLine({
  label,
  value,
  placeholder,
  onChange,
  className = "",
  maxLength,
  disabled,
  invalid
}: FieldProps) {
  return (
    <input
      className={`canvas-field canvas-line ${className}`.trim()}
      aria-label={label}
      value={value}
      placeholder={placeholder}
      maxLength={maxLength}
      disabled={disabled}
      aria-invalid={invalid ? true : undefined}
      autoComplete="off"
      onChange={(event) => onChange(event.target.value)}
    />
  );
}

/**
 * A field that grows with what is typed into it, so a welcome three lines long
 * reads as three lines rather than as a scrolling box. The height comes from a
 * copy of the text under the textarea in the same grid cell; nothing is
 * measured in JavaScript, so it is right on first paint.
 */
export function CanvasParagraph({
  label,
  value,
  placeholder,
  onChange,
  className = "",
  maxLength,
  disabled,
  invalid
}: FieldProps) {
  return (
    <div className={`canvas-field canvas-grow ${className}`.trim()} data-value={value || placeholder}>
      <textarea
        className="canvas-area"
        aria-label={label}
        value={value}
        placeholder={placeholder}
        maxLength={maxLength}
        disabled={disabled}
        aria-invalid={invalid ? true : undefined}
        rows={1}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}
