import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryPhoto } from "./MemoryPhoto";

const sdk = vi.hoisted(() => ({ startup: vi.fn(), photo: vi.fn(), callable: vi.fn() }));
vi.mock("../../lib/firebase", () => ({ getFirebaseServices: sdk.startup }));
vi.mock("../../lib/guestSession", () => ({ guestPhotoUrl: (id: string, index: number) => `/public-photo/${id}/${index}` }));
vi.mock("firebase/functions", () => ({ httpsCallable: sdk.callable }));

beforeEach(() => {
  vi.clearAllMocks();
  sdk.startup.mockResolvedValue({ functions: { ownerSession: true } });
  sdk.callable.mockReturnValue(sdk.photo);
  sdk.photo.mockResolvedValue({ data: { base64: "cGhvdG8=" } });
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

it("uses the authenticated owner reader for a closed-wall preview", async () => {
  render(<MemoryPhoto postId="memory-1" index={0} ownerPropertyId="property-1" sessionUid="owner" />);
  expect(await screen.findByRole("img")).toHaveAttribute("src", "data:image/webp;base64,cGhvdG8=");
  expect(sdk.callable).toHaveBeenCalledWith({ ownerSession: true }, "readHostExportPhoto", { timeout: 15000 });
  expect(sdk.photo).toHaveBeenCalledWith({ propertyId: "property-1", postId: "memory-1", index: 0 });
});

it("keeps an open guest wall on its lazy public photo URL", () => {
  render(<MemoryPhoto postId="memory-1" index={1} />);
  expect(screen.getByRole("img")).toHaveAttribute("src", "/public-photo/memory-1/1");
  expect(screen.getByRole("img")).toHaveAttribute("loading", "lazy");
  expect(sdk.startup).not.toHaveBeenCalled();
});

it("offers a retry when the owner photo read fails", async () => {
  sdk.photo.mockRejectedValueOnce(new Error("Unavailable"));
  render(<MemoryPhoto postId="memory-1" index={0} ownerPropertyId="property-1" sessionUid="owner" />);
  fireEvent.click(await screen.findByRole("button", { name: "Retry photo 1" }));
  expect(await screen.findByRole("img")).toHaveAttribute("src", "data:image/webp;base64,cGhvdG8=");
  expect(sdk.photo).toHaveBeenCalledTimes(2);
});

it("bounds stalled service startup and ignores its late result", async () => {
  vi.useFakeTimers();
  let finish!: (value: unknown) => void;
  sdk.startup.mockReturnValueOnce(new Promise(resolve => { finish = resolve; }));
  render(<MemoryPhoto postId="memory-1" index={0} ownerPropertyId="property-1" sessionUid="owner" />);
  await act(async () => { await vi.advanceTimersByTimeAsync(15000); });
  expect(screen.getByRole("button", { name: "Retry photo 1" })).toBeInTheDocument();
  await act(async () => { finish({ functions: {} }); });
  expect(sdk.photo).not.toHaveBeenCalled();
});

it("discards the previous account's in-flight photo after an account switch", async () => {
  let finish!: (value: unknown) => void;
  sdk.photo.mockReturnValueOnce(new Promise(resolve => { finish = resolve; }));
  const view = render(<MemoryPhoto postId="memory-1" index={0} ownerPropertyId="property-1" sessionUid="owner" />);
  await waitFor(() => expect(sdk.photo).toHaveBeenCalledTimes(1));
  sdk.photo.mockRejectedValueOnce(new Error("Different account"));
  view.rerender(<MemoryPhoto postId="memory-1" index={0} ownerPropertyId="property-1" sessionUid="other-owner" />);
  await screen.findByRole("button", { name: "Retry photo 1" });
  await act(async () => { finish({ data: { base64: "cHJpdmF0ZQ==" } }); });
  expect(screen.queryByRole("img")).not.toBeInTheDocument();
});

it("waits until a photo approaches the viewport before fetching its bytes", async () => {
  let intersect!: IntersectionObserverCallback;
  const disconnect = vi.fn();
  vi.stubGlobal("IntersectionObserver", class {
    constructor(callback: IntersectionObserverCallback) { intersect = callback; }
    observe() {}
    disconnect = disconnect;
  });
  render(<MemoryPhoto postId="memory-1" index={0} ownerPropertyId="property-1" sessionUid="owner" />);
  expect(sdk.startup).not.toHaveBeenCalled();
  await act(async () => { intersect([{ isIntersecting: true } as IntersectionObserverEntry], {} as IntersectionObserver); });
  expect(await screen.findByRole("img")).toBeInTheDocument();
  expect(disconnect).toHaveBeenCalled();
});
