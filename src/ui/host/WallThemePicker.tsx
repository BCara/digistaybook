import { useEffect, useRef, useState } from "react";
import { wallTheme, wallThemes, type WallThemeId, type WallColourId } from "../../domain/wallTheme";

function ThemeSwatch({ theme, colour }: { theme: WallThemeId; colour: WallColourId }) {
  return <span className="theme-swatch" data-wall-theme={theme} data-wall-colour={colour} aria-hidden="true">
    <span className="theme-swatch-title">Aa</span>
    <span className="theme-swatch-note"><i /><i /></span>
  </span>;
}

export function WallThemePicker({ value, colour, disabled, compact = false, gallery = false, onChange, onColourChange }: {
  value: WallThemeId;
  colour: WallColourId;
  disabled?: boolean;
  compact?: boolean;
  /** The phone sheet has the screen to itself, so every theme shows at once with its description. */
  gallery?: boolean;
  onChange: (theme: WallThemeId) => void;
  onColourChange: (colour: WallColourId) => void;
}) {
  // Only the chosen theme shows until the host asks to change it, so the
  // column stays short; the canvas beside it already shows what each looks like.
  const [open, setOpen] = useState(false);
  const picker = useRef<HTMLDivElement>(null);
  const toggle = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!compact || !open) return;
    function dismiss(event: MouseEvent) {
      if (event.target instanceof Node && !picker.current?.contains(event.target)) setOpen(false);
    }
    function escape(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      setOpen(false);
      toggle.current?.focus();
    }
    document.addEventListener("click", dismiss);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("click", dismiss);
      document.removeEventListener("keydown", escape);
    };
  }, [compact, open]);
  const current = wallTheme(value);
  const currentColour = current.colourways.find(option => option.id === colour) ?? current.colourways[0]!;

  return <div className={gallery ? "wall-appearance-picker wall-appearance-gallery" : "wall-appearance-picker"} ref={picker}>
    <fieldset className="theme-picker">
      <legend>Wall theme</legend>
      {!gallery && <button type="button" className="theme-current" ref={toggle} title={current.name} aria-expanded={open} aria-controls="wall-theme-options"
        disabled={disabled} onClick={() => setOpen(was => !was)}>
        <ThemeSwatch theme={value} colour={colour} />
        <span className="theme-current-name">{current.name}</span>
        <span className="theme-current-action">{open ? "Close" : "Change"}</span>
      </button>}
      <div className="theme-options" id="wall-theme-options" hidden={!gallery && !open}>
        {wallThemes.map(theme => <label className="theme-option" key={theme.id} title={gallery ? undefined : theme.note}>
          <input type="radio" name="wall-theme" value={theme.id} checked={value === theme.id}
            aria-label={theme.name} disabled={disabled} onChange={() => { onChange(theme.id); setOpen(false); }} />
          <span>
            <ThemeSwatch theme={theme.id} colour={colour} />
            <span className="theme-option-name">{theme.name}</span>
            {gallery && <span className="theme-option-note">{theme.note}</span>}
          </span>
        </label>)}
      </div>
    </fieldset>
    {/* Each theme names its own three colourways; the choice is kept by
        position, so switching theme keeps the first, second or third. */}
    <fieldset className="theme-picker colour-picker">
      <legend>Colourway {!gallery && <span className="colour-current">· {currentColour.name}</span>}</legend>
      <div className="colour-options">
        {current.colourways.map(option => <label className="colour-option" key={option.id} title={option.name}>
          <input type="radio" name="wall-colour" value={option.id} checked={colour === option.id}
            aria-label={option.name} disabled={disabled} onChange={() => onColourChange(option.id)} />
          <span><i data-wall-theme={value} data-wall-colour={option.id} aria-hidden="true" />
            {gallery && <b className="colour-option-name">{option.name}</b>}</span>
        </label>)}
      </div>
    </fieldset>
  </div>;
}
