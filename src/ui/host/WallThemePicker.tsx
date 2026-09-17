import { useState, useRef, useEffect } from "react";
import { wallTheme, wallThemes, type WallThemeId } from "../../domain/wallTheme";

/**
 * The paper the wall is printed on, chosen from the wall.
 *
 * It stands in the controls row above the canvas, so the choice is made a few
 * centimetres from the thing it changes: picking one repaints the sheet and
 * the phone beside it as they are read, rather than describing a colour and
 * asking a Host to imagine it.
 *
 * Each swatch carries `data-wall-theme` and is painted by that theme's own
 * declaration in the stylesheet. Nothing here knows a colour, so a theme
 * cannot be changed in the stylesheet and shown stale in the picker.
 *
 * The choice is part of the draft, not a separate write: it saves with the
 * words on the same Save changes button, because a theme is one more thing
 * about the wall a Host is composing.
 */
export function WallThemePicker({
  value,
  disabled,
  onChange
}: {
  value: WallThemeId;
  disabled?: boolean;
  onChange: (theme: WallThemeId) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLFieldSetElement>(null);
  const selectedTheme = wallTheme(value);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <fieldset className="theme-picker" ref={containerRef}>
      <legend>Wall theme</legend>
      <div className="theme-dropdown">
        <button
          type="button"
          className="theme-dropdown-trigger"
          disabled={disabled}
          onClick={() => setIsOpen(!isOpen)}
          aria-expanded={isOpen}
        >
          <span className="theme-swatch" data-wall-theme={selectedTheme.id} aria-hidden="true">
            <span className="theme-swatch-note">
              <i />
              <i />
            </span>
          </span>
          <span className="theme-name">{selectedTheme.name}</span>
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg" className="theme-dropdown-icon" aria-hidden="true">
            <path d="M2.5 4.5L6 8L9.5 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>

        {isOpen && (
          <div className="theme-options theme-dropdown-menu">
            {wallThemes.map((theme) => (
              <label className="theme-option" key={theme.id}>
                <input
                  type="radio"
                  name="wall-theme"
                  value={theme.id}
                  checked={value === theme.id}
                  disabled={disabled}
                  onChange={() => {
                    onChange(theme.id);
                    setIsOpen(false);
                  }}
                />
                <span>
                  {/* A wall the size of a stamp: the theme's own stock, with one
                      memory drawn on it by the same declaration that draws a real
                      one. Stripes of colour could not have shown that a theme
                      rounds its corners, flattens its notes or drops them. */}
                  <span className="theme-swatch" data-wall-theme={theme.id} aria-hidden="true">
                    <span className="theme-swatch-note">
                      <i />
                      <i />
                    </span>
                  </span>
                  {theme.name}
                </span>
              </label>
            ))}
          </div>
        )}
      </div>
      {/* One line about the theme that is on, rather than four lines about
          four themes: the swatches say the rest, and the wall below says it
          properly. */}
      <p className="theme-note">{selectedTheme.note} Both walls use it.</p>
    </fieldset>
  );
}
