import { HostWallDesignPage } from "./HostWallDesignPage";

/**
 * The settings of one property.
 *
 * There is no settings *page* any more. What a property is — its name, where
 * it is, its photographs — and what its walls say used to be two screens that
 * asked overlapping questions in different words, and a Host who wanted to
 * change the place name had to guess which of them owned it.
 *
 * So the settings are the window the property is added through, opened again
 * over the property view. This route is what a bookmark, a browser Back and
 * the band's own Settings control all lead to, and it renders the wall with
 * that window standing in front of it: the wall behind shows each change as it
 * is typed, and closing the window puts the Host back on it rather than on a
 * page they have to navigate out of.
 */
export function HostPropertySettingsPage({ propertyId }: { propertyId: string }) {
  return <HostWallDesignPage propertyId={propertyId} settings />;
}
