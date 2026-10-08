import { hostNoteStyle, hostNoteStyles, type HostNoteStyle } from "../../domain/propertyProfile";
import type { WallThemeId, WallColourId } from "../../domain/wallTheme";

/**
 * How one of the hosts' notes is fixed to the wall.
 *
 * Two varieties, shown rather than described: each swatch is a note the size
 * of a stamp, carrying the property's own theme and the variety it stands for,
 * and it is painted by the same declarations that paint the note itself. A
 * Host picking "Pinned" on Studio sees Studio's pushpin, because nothing here
 * knows a colour or a corner — the stylesheet does, in one place.
 *
 * The choice saves with the words rather than on its own: it is one more thing
 * about a note a Host is composing, like the note's photograph or its
 * paragraph breaks.
 */
export function HostNoteStylePicker({
  name,
  theme,
  colour,
  value,
  disabled,
  compact = false,
  onChange
}: {
  /** Radios are grouped per note, so each picker is given its own name. */
  name: string;
  /** The paper the property's walls are printed on, so a swatch is on it too. */
  theme: WallThemeId;
  colour?: WallColourId;
  value: HostNoteStyle;
  disabled?: boolean;
  compact?: boolean;
  onChange: (style: HostNoteStyle) => void;
}) {
  return (
    <fieldset className={`note-style-picker${compact ? " note-style-picker-compact" : ""}`}>
      <legend>How it sits on the wall</legend>
      <div className="note-style-options">
        {hostNoteStyles.map((style) => (
          <label className="note-style-option" key={style.id} title={style.note}>
            <input
              type="radio"
              name={name}
              value={style.id}
              checked={value === style.id}
              disabled={disabled}
              onChange={() => onChange(style.id)}
            />
            <span>
              <span className="note-style-swatch" data-wall-theme={theme} data-wall-colour={colour} aria-hidden="true">
                <span className="host-note-swatch" data-note-style={style.id}>
                  <i />
                  <i />
                </span>
              </span>
              {style.name}
            </span>
          </label>
        ))}
      </div>
      {/* One line about the variety that is on, rather than two lines about
          two: the swatches say the rest, and the wall says it properly. */}
      {!compact && <p className="field-hint">{hostNoteStyle(value).note}</p>}
    </fieldset>
  );
}
