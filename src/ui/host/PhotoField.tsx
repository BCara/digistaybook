import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { profileLimits, validatePhotoFile, type PropertyPhoto } from "../../domain/propertyProfile";
import { CameraMark } from "./CameraMark";
import { removePropertyPhoto, uploadPropertyPhoto, type PhotoSlot } from "./propertyStore";

/**
 * An empty photograph slot: the frame itself asks for the file.
 *
 * A dashed box saying nothing is there, with a button under it saying what to
 * do about that, spends two elements and four lines of the form on one empty
 * optional field. The frame is the button instead — it is the size of the
 * thing being asked for, it is the obvious place to click, and the pill
 * painted inside it says so for anyone who does not find a dashed rectangle
 * obvious. The pill is not a control: the whole frame is, so a screen reader
 * is offered one thing to press rather than two that do the same.
 */
export function PhotoDropTarget({
  label,
  disabled,
  onChoose
}: {
  label: string;
  disabled?: boolean;
  onChoose: () => void;
}) {
  return (
    <button
      type="button"
      className="photo-drop"
      disabled={disabled}
      aria-label={`${label}: choose a photograph`}
      onClick={onChoose}
    >
      <CameraMark />
      <span className="photo-drop-line">No photograph yet.</span>
      <span className="btn btn-secondary btn-sm photo-drop-action" aria-hidden="true">
        Choose a photograph
      </span>
    </button>
  );
}

export type PhotoFieldProps = {
  propertyId: string;
  slot: PhotoSlot;
  photo: PropertyPhoto | null;
  label: string;
  hint?: string;
  onChange: (photo: PropertyPhoto | null) => void;
};

/**
 * One photograph slot on a property.
 *
 * A photograph is not saved with the rest of the form. A file has to leave the
 * device the moment it is chosen, and a Host who uploads a cover and then
 * closes the tab should not lose it, so the upload writes the property in the
 * same step and the surrounding form keeps its own save button for text.
 *
 * Nothing is asked for beyond the file. The description a screen reader is
 * read comes from the slot — see `photoAlt` — because the field that asked for
 * it stood between a Host and the photograph they were looking at, and was
 * left empty nearly every time it was shown.
 */
export function PhotoField({ propertyId, slot, photo, label, hint, onChange }: PhotoFieldProps) {
  const [chosen, setChosen] = useState<{ file: File; preview: string } | null>(null);
  const [busy, setBusy] = useState<"uploading" | "removing" | null>(null);
  // How much of the file has gone, so a Host on a slow connection can see the
  // difference between a slow upload and a stuck one.
  const [sent, setSent] = useState(0);
  const [problem, setProblem] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  // An object URL is a live handle on the file; releasing it keeps a Host who
  // tries several photographs from holding all of them in memory.
  useEffect(() => () => {
    if (chosen) URL.revokeObjectURL(chosen.preview);
  }, [chosen]);

  const inputId = `${slot}-file`;

  function pick(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    // Reset the control so choosing the same file twice still fires a change.
    event.target.value = "";
    if (!file) return;
    const rejected = validatePhotoFile(file);
    setProblem(rejected);
    if (rejected) return;
    if (chosen) URL.revokeObjectURL(chosen.preview);
    setChosen({ file, preview: URL.createObjectURL(file) });
  }

  function discard() {
    if (chosen) URL.revokeObjectURL(chosen.preview);
    setChosen(null);
    setProblem(null);
  }

  async function upload() {
    if (!chosen || busy) return;
    setProblem(null);
    setSent(0);
    setBusy("uploading");
    const outcome = await uploadPropertyPhoto(propertyId, slot, chosen.file, setSent);
    setBusy(null);
    if (outcome.status === "error") {
      setProblem(outcome.message);
      return;
    }
    discard();
    onChange(outcome.value);
  }

  async function remove() {
    if (!photo || busy) return;
    setProblem(null);
    setBusy("removing");
    const outcome = await removePropertyPhoto(propertyId, slot, photo.path);
    setBusy(null);
    if (outcome.status === "error") {
      setProblem(outcome.message);
      return;
    }
    onChange(null);
  }

  return (
    <div className="photo-field">
      <label htmlFor={inputId}>{label}</label>
      {hint && <p className="field-hint">{hint}</p>}

      {photo && !chosen && (
        <figure className="photo-preview">
          <img src={photo.url} alt={photo.alt} />
        </figure>
      )}

      {chosen && (
        <figure className="photo-preview">
          <img src={chosen.preview} alt="" />
          <figcaption>{chosen.file.name}</figcaption>
        </figure>
      )}

      {!photo && !chosen && (
        <PhotoDropTarget label={label} disabled={busy !== null} onChoose={() => fileInput.current?.click()} />
      )}

      <p className="field-hint">
        JPEG, PNG or WebP, up to {Math.round(profileLimits.photoBytesMax / (1024 * 1024))}MB.
      </p>

      {busy === "uploading" && (
        <p className="photo-progress">
          <progress value={sent} max={1} aria-label="Upload progress" />
        </p>
      )}

      {problem && <p className="form-feedback" role="alert">{problem}</p>}

      {(chosen || photo) && (
        <div className="actions">
          {chosen ? (
            <>
              <button type="button" className="btn btn-primary btn-sm" onClick={() => void upload()} disabled={busy !== null}>
                {busy === "uploading" ? `Uploading… ${Math.round(sent * 100)}%` : "Save photograph"}
              </button>
              <button type="button" className="btn btn-secondary btn-sm" onClick={discard} disabled={busy !== null}>
                Cancel
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => fileInput.current?.click()}
                disabled={busy !== null}
              >
                Replace photograph
              </button>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => void remove()} disabled={busy !== null}>
                {busy === "removing" ? "Removing…" : "Remove"}
              </button>
            </>
          )}
        </div>
      )}

      {/* Hidden because a bare file input cannot be styled or labelled well;
          the visible buttons above drive it. */}
      <input
        ref={fileInput}
        id={inputId}
        className="visually-hidden"
        type="file"
        accept={profileLimits.photoTypes.join(",")}
        aria-label={`${label}: choose an image file`}
        onChange={pick}
      />
    </div>
  );
}
