import { getFirebaseServices } from "../../lib/firebase";
import type { StoreOutcome } from "./propertyStore";

export type PreviewMemory = {
  id: string;
  message: string;
  displayName: string;
  photoCount?: number;
};

export type PreviewMemoriesPage = { posts: PreviewMemory[]; nextCursor: string | null };

/** Read the same published memories, order and photos as the guest wall.
 * The owner's session also permits previewing a wall before it opens. */
export async function loadPreviewMemories(
  slug: string,
  view: "public" | "stay",
  token: string | null,
  cursor?: string
): Promise<StoreOutcome<PreviewMemoriesPage>> {
  try {
    const services = await getFirebaseServices();
    if (!services) throw new Error("Unavailable");
    const { httpsCallable } = await import("firebase/functions");
    const response = await httpsCallable<
      { slug: string; view: "public" | "stay"; token?: string; cursor?: string },
      ({ status: "open" | "preview" } & PreviewMemoriesPage) | { status: "unavailable" }
    >(services.functions, "getPublicWall", { timeout: 15000 })({
      slug, view, ...(token ? { token } : {}), ...(cursor ? { cursor } : {})
    });
    if (response.data.status === "unavailable") throw new Error("Unavailable");
    return { status: "ok", value: { posts: response.data.posts, nextCursor: response.data.nextCursor } };
  } catch {
    return { status: "error", message: "We couldn’t load the memories in this preview. Please try again." };
  }
}
