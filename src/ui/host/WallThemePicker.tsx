import { useState } from "react";
import { wallTheme, wallThemes, type WallThemeId, type WallColourId } from "../../domain/wallTheme";

function ThemeSwatch({ theme, colour }: { theme: WallThemeId; colour: WallColourId }) {
  return <span className="theme-swatch" data-wall-theme={theme} data-wall-colour={colour} aria-hidden="true">
    <span className="theme-swatch-title">Aa</span>
    <span className="theme-swatch-note"><i /><i /></span>
  </span>;
}

export function WallThemePicker({ value, colour, disabled, onChange, onColourChange }: {
  value: WallThemeId;
  colour: WallColourId;
  disabled?: boolean;
  onChange: (theme: WallThemeId) => void;
  onColourChange: (colour: WallColourId) => void;
}) {
  // Only the chosen theme shows until the host asks to change it, so the
  // column stays short; the canvas beside it already shows what each looks like.
  const [open, setOpen] = useState(false);
  const current = wallTheme(value);
  const currentColour = current.colourways.find(option => option.id === colour) ?? current.colourways[0]!;

  return <div className="wall-appearance-picker">
    <fieldset className="theme-picker">
      <legend>Wall theme</legend>
      <button type="button" className="theme-current" aria-expanded={open} aria-controls="wall-theme-options"
        disabled={disabled} onClick={() => setOpen(was => !was)}>
        <ThemeSwatch theme={value} colour={colour} />
        <span className="theme-current-name">{current.name}</span>
        <span className="theme-current-action">{open ? "Close" : "Change"}</span>
      </button>
      <div className="theme-options" id="wall-theme-options" hidden={!open}>
        {wallThemes.map(theme => <label className="theme-option" key={theme.id} title={theme.note}>
          <input type="radio" name="wall-theme" value={theme.id} checked={value === theme.id}
            disabled={disabled} onChange={() => { onChange(theme.id); setOpen(false); }} />
          <span>
            <ThemeSwatch theme={theme.id} colour={colour} />
            <span className="theme-option-name">{theme.name}</span>
          </span>
        </label>)}
      </div>
    </fieldset>
    {/* Each theme names its own three colourways; the choice is kept by
        position, so switching theme keeps the first, second or third. */}
    <fieldset className="theme-picker colour-picker">
      <legend>Colourway <span className="colour-current">· {currentColour.name}</span></legend>
      <div className="colour-options">
        {current.colourways.map(option => <label className="colour-option" key={option.id} title={option.name}>
          <input type="radio" name="wall-colour" value={option.id} checked={colour === option.id}
            aria-label={option.name} disabled={disabled} onChange={() => onColourChange(option.id)} />
          <span><i data-wall-theme={value} data-wall-colour={option.id} aria-hidden="true" /></span>
        </label>)}
      </div>
    </fieldset>
  </div>;
}
