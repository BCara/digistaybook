import { describe, expect, it } from "vitest";
import { strFromU8, unzipSync } from "fflate";
import { exportArchive } from "./exportArchive";

describe("offline guestbook export", () => {
  it("omits an author heading when the guest did not supply a name", () => {
    const files = unzipSync(exportArchive("Cottage", [{ id: "unsigned", displayName: "   ", message: "Lovely stay", createdAt: null, photoCount: 0, unsupportedPhotos: false }], {}));
    const html = strFromU8(files["index.html"]);
    expect(html).not.toContain("<h2>");
    expect(html).toContain("Lovely stay");
  });
  it("includes actual photo bytes and escapes untrusted messages in readable HTML", () => {
    const photo = new Uint8Array([1, 2, 3]);
    const files = unzipSync(exportArchive("Cottage <script>", [{ id: "memory-1", displayName: "<img onerror=alert(1)>", message: "Hello <script>alert(1)</script>", createdAt: null, photoCount: 1, unsupportedPhotos: false }], { "photos/memory-1-0.webp": photo }));
    expect(files["photos/memory-1-0.webp"]).toEqual(photo);
    const html = strFromU8(files["index.html"]);
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain('src="photos/memory-1-0.webp"');
    expect(JSON.parse(strFromU8(files["messages.json"])).posts[0].message).toBe("Hello <script>alert(1)</script>");
  });
});
