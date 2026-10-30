import type { UploadTask } from "firebase/storage";
import { transferPhoto } from "./transferPhoto";

it("cancels an upload that never starts and returns a retryable error", async () => {
  vi.useFakeTimers();
  const cancel = vi.fn();
  try {
    const task = { on: vi.fn(), cancel } as unknown as UploadTask;
    const result = transferPhoto(task);
    const rejected = expect(result).rejects.toMatchObject({ code: "storage/upload-stalled" });
    await vi.advanceTimersByTimeAsync(59_000);
    expect(cancel).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1_000);
    await rejected;
    expect(cancel).toHaveBeenCalledOnce();
  } finally { vi.useRealTimers(); }
});

it("gives a slow start its full allowance before any byte is counted", async () => {
  vi.useFakeTimers();
  let complete!: () => void;
  const cancel = vi.fn();
  const task = { cancel, on: (_event: string, _next: unknown, _error: unknown, done: () => void) => {
    complete = done;
  } } as unknown as UploadTask;
  try {
    const result = transferPhoto(task);
    await vi.advanceTimersByTimeAsync(45_000);
    complete();
    await result;
    expect(cancel).not.toHaveBeenCalled();
  } finally { vi.useRealTimers(); }
});

it("cancels an upload that stops part-way", async () => {
  vi.useFakeTimers();
  let progress!: (snapshot: { bytesTransferred: number; totalBytes: number }) => void;
  const cancel = vi.fn();
  const task = { cancel, on: (_event: string, next: typeof progress) => { progress = next; } } as unknown as UploadTask;
  try {
    const result = transferPhoto(task);
    const rejected = expect(result).rejects.toMatchObject({ code: "storage/upload-stalled" });
    progress({ bytesTransferred: 50, totalBytes: 100 });
    await vi.advanceTimersByTimeAsync(20_000);
    await rejected;
    expect(cancel).toHaveBeenCalledOnce();
  } finally { vi.useRealTimers(); }
});

it("allows a progressing upload to finish and clears the stall timer", async () => {
  vi.useFakeTimers();
  let progress!: (snapshot: { bytesTransferred: number; totalBytes: number }) => void;
  let complete!: () => void;
  const cancel = vi.fn();
  const report = vi.fn();
  const task = { cancel, on: (_event: string, next: typeof progress, _error: unknown, done: () => void) => {
    progress = next;
    complete = done;
  } } as unknown as UploadTask;
  try {
    const result = transferPhoto(task, report);
    await vi.advanceTimersByTimeAsync(15_000);
    progress({ bytesTransferred: 50, totalBytes: 100 });
    await vi.advanceTimersByTimeAsync(15_000);
    progress({ bytesTransferred: 100, totalBytes: 100 });
    complete();
    await result;
    await vi.advanceTimersByTimeAsync(20_000);
    expect(report.mock.calls).toEqual([[0.5], [1]]);
    expect(cancel).not.toHaveBeenCalled();
  } finally { vi.useRealTimers(); }
});
