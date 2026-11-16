import { describe, expect, it } from "vitest";
import { defaultNotificationSettings, digestAddress, hostDigestContent, notificationConfirmationContent, readNotificationSettings, TOPIC_OF } from "./hostNotifications";

describe("host notification settings", () => {
  it("defaults every topic on, hourly, to the sign-in address", () => {
    expect(readNotificationSettings(undefined)).toEqual(defaultNotificationSettings);
  });
  it("keeps a Host's choices and drops an address that is not one", () => {
    expect(readNotificationSettings({ needsYou: true, newMemories: false, feedback: false, frequency: "daily", email: "not-an-address" }))
      .toEqual({ needsYou: true, newMemories: false, feedback: false, frequency: "daily", email: "", emailConfirmed: false });
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

describe("where a digest is sent", () => {
  const custom = "manager@example.test", signIn = "host@example.test";
  it("uses the sign-in email until a custom address is confirmed", () => {
    const settings = readNotificationSettings({ email: custom });
    expect(settings.emailConfirmed).toBe(false);
    expect(digestAddress(settings, signIn)).toBe(signIn);
  });
  it("uses the custom address once its owner has confirmed it", () => {
    const settings = readNotificationSettings({ email: custom, confirmedEmail: custom });
    expect(settings.emailConfirmed).toBe(true);
    expect(digestAddress(settings, signIn)).toBe(custom);
  });
  it("does not carry a confirmation over to a different address", () => {
    const settings = readNotificationSettings({ email: "someone-else@example.test", confirmedEmail: custom });
    expect(settings.emailConfirmed).toBe(false);
    expect(digestAddress(settings, signIn)).toBe(signIn);
  });
  it("treats an address saved before confirmation existed as unconfirmed", () => {
    expect(digestAddress(readNotificationSettings({ email: custom, needsYou: true }), signIn)).toBe(signIn);
  });
  it("sends nowhere when there is neither", () => {
    expect(digestAddress(readNotificationSettings({ email: custom }), "")).toBe("");
  });
});

describe("the address confirmation email", () => {
  it("carries the link and nothing a Host wrote", () => {
    const token = "t".repeat(43);
    const content = notificationConfirmationContent(token);
    expect(content.text).toContain(`https://digistaybook.com/confirm-notification-email?token=${token}`);
    expect(content.html).toContain(`confirm-notification-email?token=${token}`);
    // The function takes a token and a site: there is no property or Host name to put in.
    expect(notificationConfirmationContent.length).toBeLessThanOrEqual(2);
    expect(content.text).toMatch(/ignore it/);
  });
});
