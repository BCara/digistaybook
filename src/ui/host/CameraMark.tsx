/**
 * The mark on an empty photograph frame.
 *
 * It is drawn rather than lettered because the frame is a place a photograph
 * goes, and a camera says that in the one glance a "?" spends asking a
 * question the Host did not ask. It is the same mark on the wall canvas and in
 * the property form, so an empty frame reads the same wherever one is met.
 */
export function CameraMark() {
  return (
    <svg
      className="camera-mark"
      viewBox="0 0 20 20"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M7.3 5.6 8.5 3.5h3l1.2 2.1" />
      <rect x="2.3" y="5.6" width="15.4" height="10.9" rx="1.9" />
      <circle cx="10" cy="11.1" r="3" />
    </svg>
  );
}
