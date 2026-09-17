import { forgetProperties } from "./src/ui/host/propertyCache";
import "@testing-library/jest-dom/vitest";

// jsdom has no layout, so it never implemented scrollIntoView. Pages that
// scroll a section into view call it; a no-op keeps that out of every test.
if (typeof Element !== "undefined" && !Element.prototype.scrollIntoView) Element.prototype.scrollIntoView = () => {};

// Model native dialog visibility in jsdom; browser focus behaviour is tested
// separately in browser acceptance checks.
if (typeof HTMLDialogElement !== "undefined" && !HTMLDialogElement.prototype.showModal) {
  HTMLDialogElement.prototype.showModal = function () { this.open = true; };
  HTMLDialogElement.prototype.close = function () { this.open = false; };
}

// jsdom implements neither half of the object-URL API. The add-property wizard
// previews a chosen photograph with one before it is uploaded.
if (!URL.createObjectURL) URL.createObjectURL = () => "blob:preview";
if (!URL.revokeObjectURL) URL.revokeObjectURL = () => {};

// The host screens keep properties read this session in a module-level cache,
// so one test's property must not still be there for the next one.
beforeEach(() => forgetProperties());
