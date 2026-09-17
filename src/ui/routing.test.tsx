import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { navigate, useLinkNavigation, useLocation } from "./routing";

/**
 * The router exists so a Host does not pay a document load per click. These
 * tests are about which clicks it takes and which it leaves alone: taking one
 * it should not would silence `hashchange`, break a new-tab click or swallow a
 * link off the site.
 */
function Harness() {
  const location = useLocation();
  useLinkNavigation(location);

  return (
    <>
      <main id="main" tabIndex={-1}>
        <span data-testid="path">{location.pathname}</span>
        <span data-testid="hash">{location.hash}</span>
      </main>
      <a href="/privacy-safety">Privacy</a>
      <a href="/#pricing">Pricing</a>
      <a href="#main">Skip</a>
      <a href="/terms" target="_blank" rel="noreferrer">Terms in a tab</a>
      <a href="https://example.com/elsewhere">Off site</a>
    </>
  );
}

const at = () => screen.getByTestId("path").textContent;

beforeEach(() => {
  window.history.replaceState(null, "", "/");
  // jsdom has no scrolling; the router's is not what these tests are about.
  vi.spyOn(window, "scrollTo").mockImplementation(() => {});
});

describe("client-side routing", () => {
  it("keeps the scroll position when switching between a property's wall editors", () => {
    window.history.replaceState(null, "", "/host/property/cottage");
    vi.spyOn(window, "scrollY", "get").mockReturnValue(280);
    vi.spyOn(window, "scrollX", "get").mockReturnValue(0);
    render(<Harness />);

    act(() => navigate("/host/property/cottage/public"));
    expect(at()).toBe("/host/property/cottage/public");
    expect(window.scrollTo).toHaveBeenLastCalledWith({ top: 280, left: 0, behavior: "instant" });

    act(() => navigate("/host/property/cottage"));
    expect(window.scrollTo).toHaveBeenLastCalledWith({ top: 280, left: 0, behavior: "instant" });
    expect(document.activeElement).toBe(screen.getByRole("main"));
  });

  it("still starts at the top when leaving the wall editor or changing properties", () => {
    window.history.replaceState(null, "", "/host/property/cottage");
    render(<Harness />);

    for (const href of ["/host/property/another/public", "/host/property/another/moderation", "/wall/another"]) {
      vi.mocked(window.scrollTo).mockClear();
      act(() => navigate(href));
      expect(window.scrollTo).toHaveBeenCalledWith({ top: 0, left: 0, behavior: "instant" });
    }
  });

  it("turns an in-app link into a history push, with no document load", () => {
    render(<Harness />);
    expect(at()).toBe("/");

    fireEvent.click(screen.getByRole("link", { name: "Privacy" }));

    expect(window.location.pathname).toBe("/privacy-safety");
    expect(at()).toBe("/privacy-safety");
  });

  it("follows the back button", async () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole("link", { name: "Privacy" }));
    expect(at()).toBe("/privacy-safety");

    act(() => window.history.back());

    await waitFor(() => expect(at()).toBe("/"));
  });

  it("carries a fragment from another page, so the destination can act on it", () => {
    window.history.replaceState(null, "", "/privacy-safety");
    render(<Harness />);

    fireEvent.click(screen.getByRole("link", { name: "Pricing" }));

    expect(at()).toBe("/");
    expect(screen.getByTestId("hash").textContent).toBe("#pricing");
  });

  it("leaves a jump within the current page to the browser, so hashchange still fires", () => {
    render(<Harness />);

    const jump = screen.getByRole("link", { name: "Pricing" });
    const handled = fireEvent.click(jump);

    // Not intercepted: the default action stands, and the path is unchanged.
    expect(handled).toBe(true);
    expect(at()).toBe("/");
  });

  it("leaves the skip link, a new tab and an off-site link alone", () => {
    render(<Harness />);

    for (const name of ["Skip", "Terms in a tab", "Off site"]) {
      const event = createClick();
      screen.getByRole("link", { name }).dispatchEvent(event);
      expect(event.defaultPrevented).toBe(false);
    }
    expect(at()).toBe("/");
  });

  it("leaves a modified click alone, so ctrl-click still opens a tab", () => {
    render(<Harness />);

    const event = createClick({ ctrlKey: true });
    screen.getByRole("link", { name: "Privacy" }).dispatchEvent(event);

    expect(event.defaultPrevented).toBe(false);
    expect(at()).toBe("/");
  });

  it("sends an off-site navigate out of the app rather than pushing it", () => {
    const assign = vi.fn();
    Object.defineProperty(window, "location", {
      configurable: true,
      value: { ...window.location, assign }
    });

    navigate("https://example.com/elsewhere");

    expect(assign).toHaveBeenCalledWith("https://example.com/elsewhere");
  });
});

function createClick(init: MouseEventInit = {}) {
  return new MouseEvent("click", { bubbles: true, cancelable: true, button: 0, ...init });
}
