import type { UploadTask } from "firebase/storage";

/**
 * Before the first byte is counted the SDK is still fetching the auth and App
 * Check tokens and opening the upload, and a photo of 256 KB or less goes up in
 * a single request that reports nothing until it is done. None of that shows
 * as progress, so it gets a longer allowance than the gap between two chunks.
 */
const START_ALLOWANCE_MS = 60_000;
const STALL_ALLOWANCE_MS = 20_000;

/** Stop stalled SDK retries so the host can retry without a background upload. */
export function transferPhoto(task: UploadTask, onProgress?: (fraction: number) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    let bytes = 0;
    let timer: ReturnType<typeof setTimeout>;
    const arm = (allowance: number) => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        reject(Object.assign(new Error("Photo upload stalled"), { code: "storage/upload-stalled" }));
        task.cancel();
      }, allowance);
    };
    arm(START_ALLOWANCE_MS);
    task.on("state_changed", snapshot => {
      if (snapshot.bytesTransferred > bytes) {
        bytes = snapshot.bytesTransferred;
        arm(STALL_ALLOWANCE_MS);
      }
      if (snapshot.totalBytes > 0) onProgress?.(snapshot.bytesTransferred / snapshot.totalBytes);
    }, error => {
      clearTimeout(timer);
      reject(error);
    }, () => {
      clearTimeout(timer);
      resolve();
    });
  });
}
