import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ContactPage, customEnquiryMessage } from "./ContactPage";
const call = vi.hoisted(() => vi.fn());
vi.mock("../help/helpApi", async original => ({ ...await original<typeof import("../help/helpApi")>(), callHelp: call }));
beforeEach(() => { call.mockReset(); window.history.replaceState(null, "", "/contact"); });

it("sends an ordinary question as a general message", async () => {
  call.mockResolvedValue({ ok: true });
  render(<ContactPage />);
  expect(screen.getByLabelText("A question, or help with my account")).toBeChecked();
  expect(screen.queryByLabelText(/Business or organization/)).not.toBeInTheDocument();
  fireEvent.change(screen.getByLabelText("Email"), { target: { value: "host@example.com" } });
  fireEvent.change(screen.getByLabelText("How can we help?"), { target: { value: "Where is my QR kit?" } });
  fireEvent.click(screen.getByRole("button", { name: "Send message" }));
  await waitFor(() => expect(call).toHaveBeenCalledOnce());
  expect(call.mock.calls[0][1]).toMatchObject({ topic: "general", email: "host@example.com", message: "Where is my QR kit?" });
});

it("opens on custom options from the pricing link and folds the details into the message", async () => {
  call.mockResolvedValue({ ok: true });
  window.history.replaceState(null, "", "/contact?topic=custom#custom-options");
  render(<ContactPage />);
  expect(screen.getByLabelText("Custom options for a hotel, resort or larger portfolio")).toBeChecked();
  fireEvent.change(screen.getByLabelText("Email"), { target: { value: "gm@example.com" } });
  fireEvent.change(screen.getByLabelText(/Business or organization/), { target: { value: "Harbor Resort" } });
  fireEvent.change(screen.getByLabelText(/How many properties or rooms/), { target: { value: "40 rooms" } });
  fireEvent.change(screen.getByLabelText("What would you like guests to see?"), { target: { value: "Kids' club times" } });
  fireEvent.click(screen.getByRole("button", { name: "Send enquiry" }));
  await waitFor(() => expect(call).toHaveBeenCalledOnce());
  expect(call.mock.calls[0][1]).toMatchObject({
    topic: "custom",
    message: "Business or organization: Harbor Resort\nProperties or rooms: 40 rooms\n\nKids' club times"
  });
  expect(await screen.findByRole("status")).toHaveTextContent("Thanks for your message.");
});

it("switches to custom options from the section's button", () => {
  render(<ContactPage />);
  fireEvent.click(screen.getByRole("button", { name: "Ask about custom options" }));
  expect(screen.getByLabelText("Custom options for a hotel, resort or larger portfolio")).toBeChecked();
  expect(screen.queryByRole("button", { name: "Ask about custom options" })).not.toBeInTheDocument();
});

it("leaves a custom message untouched when no details were given", () => {
  expect(customEnquiryMessage(" ", "", " Menus please ")).toBe("Menus please");
});
