import { describe, expect, it } from "vitest";
import { retentionPolicy } from "../../src/domain/retention";
import { DELETED_PROPERTY_GRACE_DAYS, purgeDueAt, submissionPhotos } from "./propertyPurge";

const at = (ms: number) => ({ toMillis: () => ms });
const DAY = 86_400_000;

describe("when a deleted property is purged", () => {
  it("waits out the grace period from the deletion", () => {
    expect(purgeDueAt({ lifecycle: "deleted", deletedAt: at(1_000) })).toBe(1_000 + DELETED_PROPERTY_GRACE_DAYS * DAY);
  });
  it("falls back to the last write for a property deleted before deletions were dated", () => {
    expect(purgeDueAt({ lifecycle: "deleted", updatedAt: at(5_000) })).toBe(5_000 + DELETED_PROPERTY_GRACE_DAYS * DAY);
  });
  it("never purges a property that is not deleted, is already purged, or has no date to count from", () => {
    expect(purgeDueAt({ lifecycle: "active", deletedAt: at(1) })).toBeNull();
    expect(purgeDueAt({ lifecycle: "dormant", updatedAt: at(1) })).toBeNull();
    expect(purgeDueAt({ lifecycle: "deleted", deletedAt: at(1), purgedAt: at(2) })).toBeNull();
    expect(purgeDueAt({ lifecycle: "deleted" })).toBeNull();
  });
  it("leaves the photo worker its deadline inside the 30 days the schedule allows", () => {
    expect(DELETED_PROPERTY_GRACE_DAYS * 24 + retentionPolicy.activeDeletionDeadlineHours).toBeLessThanOrEqual(30 * 24);
  });
});

describe("a submission's photographs", () => {
  it("names both copies of each one, under the property", () => {
    expect(submissionPhotos("prop-1", "sub-1", { photoCount: 2, bucket: "quarantine", publishedBucket: "published" })).toEqual([
      { bucket: "quarantine", path: "properties/prop-1/quarantine/sub-1/0.webp" },
      { bucket: "published", path: "properties/prop-1/published/sub-1/0.webp" },
      { bucket: "quarantine", path: "properties/prop-1/quarantine/sub-1/1.webp" },
      { bucket: "published", path: "properties/prop-1/published/sub-1/1.webp" }
    ]);
  });
  it("queues nothing for a memory without photographs or a count it cannot trust", () => {
    expect(submissionPhotos("prop-1", "sub-1", { photoCount: 0, bucket: "quarantine" })).toEqual([]);
    expect(submissionPhotos("prop-1", "sub-1", { photoCount: "3", bucket: "quarantine" })).toEqual([]);
    expect(submissionPhotos("prop-1", "sub-1", { photoCount: 500, bucket: "quarantine" })).toHaveLength(10);
  });
});
