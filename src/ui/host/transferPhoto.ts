import type { UploadTask } from "firebase/storage";

/** Stop stalled SDK retries so the host can retry without a background upload. */
export function transferPhoto(task: UploadTask, onProgress?: (fraction: number) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    let bytes = 0;
    let timer: ReturnType<typeof setTimeout>;
    const arm = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        reject(Object.assign(new Error("Photo upload stalled"), { code: "storage/upload-stalled" }));
        task.cancel();
      }, 20_000);
    };
    arm();
    task.on("state_changed", snapshot => {
      if (snapshot.bytesTransferred > bytes) {
        bytes = snapshot.bytesTransferred;
        arm();
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
