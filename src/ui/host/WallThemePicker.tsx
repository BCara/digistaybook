import { wallTheme, wallThemes, wallColours, type WallThemeId, type WallColourId } from "../../domain/wallTheme";

export function WallThemePicker({ value, colour, disabled, onChange, onColourChange }: {
  value: WallThemeId;
  colour: WallColourId;
  disabled?: boolean;
  onChange: (theme: WallThemeId) => void;
  onColourChange: (colour: WallColourId) => void;
}) {
  return <div className="wall-appearance-picker">
    <fieldset className="theme-picker">
      <legend>Wall theme</legend>
      <div className="theme-options">
        {wallThemes.map(theme => <label className="theme-option" key={theme.id}>
          <input type="radio" name="wall-theme" value={theme.id} checked={value === theme.id}
            disabled={disabled} onChange={() => onChange(theme.id)} />
          <span>
            <span className="theme-swatch" data-wall-theme={theme.id} data-wall-colour={colour} aria-hidden="true">
              <span className="theme-swatch-title">Aa</span>
              <span className="theme-swatch-note"><i /><i /></span>
            </span>
            {theme.name}
          </span>
        </label>)}
      </div>
      <p className="theme-note">{wallTheme(value).note}</p>
    </fieldset>
    <fieldset className="theme-picker colour-picker">
      <legend>Wall colour</legend>
      <div className="colour-options">
        {wallColours.map(option => <label className="colour-option" key={option.id}>
          <input type="radio" name="wall-colour" value={option.id} checked={colour === option.id}
            disabled={disabled} onChange={() => onColourChange(option.id)} />
          <span><i data-wall-theme={value} data-wall-colour={option.id} aria-hidden="true" />{option.name}</span>
        </label>)}
      </div>
    </fieldset>
    <p className="theme-note">The same look on both walls.</p>
  </div>;
}
