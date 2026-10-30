import { describe, expect, it } from "vitest";
import { defaultNotificationSettings, hostDigestContent, readNotificationSettings, TOPIC_OF } from "./hostNotifications";

describe("host notification settings", () => {
  it("defaults every topic on, hourly, to the sign-in address", () => {
    expect(readNotificationSettings(undefined)).toEqual(defaultNotificationSettings);
  });
  it("keeps a Host's choices and drops an address that is not one", () => {
    expect(readNotificationSettings({ needsYou: true, newMemories: false, feedback: false, frequency: "daily", email: "not-an-address" }))
      .toEqual({ needsYou: true, newMemories: false, feedback: false, frequency: "daily", email: "" });
  });
  it("files every outbox kind the guest flows write under a topic", () => {
    for (const kind of ["memory_held_for_host_review", "post_hidden", "memory_with_safety_team", "memory_published", "private_feedback"]) {
      expect(TOPIC_OF[kind]).toBeDefined();
    }
  });
});

describe("host digest email", () => {
  it("leads with what needs the Host and counts without quoting guests", () => {
    const content = hostDigestContent([
      { property: "Seabreeze", topic: "newMemories", count: 3 },
      { property: "Seabreeze", topic: "needsYou", count: 1 },
      { property: "Hilltop", topic: "feedback", count: 2 }
    ]);
    expect(content.subject).toMatch(/needs a look/);
    const lines = content.text.split("\n").filter(line => line.startsWith("- "));
    expect(lines).toEqual(["- Seabreeze: 1 memory needs a look", "- Hilltop: 2 private feedback messages", "- Seabreeze: 3 new memories on the wall"]);
    expect(content.text).toContain("/host/account#account-notifications");
  });
  it("escapes property names in the HTML", () => {
    expect(hostDigestContent([{ property: "<b>Cabin</b>", topic: "feedback", count: 1 }]).html).toContain("&lt;b&gt;Cabin&lt;/b&gt;");
  });
});
