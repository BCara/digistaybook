import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { HelpWidget } from "./HelpWidget";
import { recentHelp } from "./helpApi";
const call = vi.hoisted(() => vi.fn());
vi.mock("./helpApi", async original => ({ ...await original<typeof import("./helpApi")>(), callHelp: call }));
beforeEach(() => call.mockReset());
const open = () => { render(<HelpWidget />); fireEvent.click(screen.getByRole("button", { name: "Questions? Ask us" })); };

it("answers suggestions, preserves chat on close and restores launcher focus", async () => {
  call.mockResolvedValue({ reply: "Guests use their browser." });
  open();
  fireEvent.click(screen.getByRole("button", { name: "Do guests need an app?" }));
  await screen.findByText("Guests use their browser.");
  expect(call).toHaveBeenCalledWith("helpChat", { messages: [{ role: "user", text: "Do guests need an app?" }] });
  fireEvent.keyDown(document, { key: "Escape" });
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Questions? Ask us" })).toHaveFocus();
  fireEvent.click(screen.getByRole("button", { name: "Questions? Ask us" }));
  expect(screen.getByText("Guests use their browser.")).toBeInTheDocument();
});
it("restores failed questions so retry does not duplicate the user turn", async () => {
  call.mockRejectedValueOnce(new Error("Our helper is busy."));
  open();
  fireEvent.click(screen.getByRole("button", { name: "How do I get started?" }));
  await screen.findByRole("alert");
  expect(screen.getByRole("textbox", { name: "Your question" })).toHaveValue("How do I get started?");
  call.mockResolvedValueOnce({ reply: "Create an account." });
  fireEvent.click(screen.getByRole("button", { name: "Send" }));
  await screen.findByText("Create an account.");
  expect(call.mock.calls[1][1].messages).toHaveLength(1);
});
it("lets visitors omit chat and keeps the request id on support retries", async () => {
  call.mockResolvedValueOnce({ reply: "Use the dashboard." });
  open();
  fireEvent.click(screen.getByRole("button", { name: "How do I get started?" }));
  await screen.findByText("Use the dashboard.");
  fireEvent.click(screen.getByRole("button", { name: /Rather talk/ }));
  fireEvent.change(screen.getByLabelText("Email"), { target: { value: "visitor@example.com" } });
  fireEvent.change(screen.getByLabelText("How can we help?"), { target: { value: "Need help" } });
  fireEvent.click(screen.getByLabelText("Include recent chat with my message"));
  call.mockRejectedValueOnce(new Error("Email unavailable"));
  fireEvent.click(screen.getByRole("button", { name: "Send message" }));
  await screen.findByRole("alert");
  const first = call.mock.calls[1][1];
  expect(first.transcript).toEqual([]);
  call.mockResolvedValueOnce({ ok: true });
  fireEvent.click(screen.getByRole("button", { name: "Send message" }));
  await waitFor(() => expect(screen.getByText("Thanks for your message.")).toBeInTheDocument());
  expect(call.mock.calls[2][1].requestId).toBe(first.requestId);
});
it("bounds recent context including long assistant answers", () => {
  const recent = recentHelp(Array.from({ length: 20 }, (_, i) => ({ role: i % 2 ? "assistant" : "user", text: "a".repeat(3000) })));
  expect(recent[0].role).toBe("user");
  expect(recent.reduce((n, m) => n + m.text.length, 0)).toBeLessThanOrEqual(6000);
  expect(recent.every(m => m.text.length <= 1000)).toBe(true);
});
