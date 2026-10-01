import { render, screen } from "@testing-library/react";
import { LegalDraftPage } from "./LegalDraftPage";

it("publishes the Guest Terms as a versioned draft, with private feedback and the review points", () => {
  render(<LegalDraftPage kind="guest-terms" />);
  expect(screen.getByRole("heading", { name: "Guest Terms" })).toBeInTheDocument();
  expect(screen.getByText("Draft — not yet approved.")).toBeInTheDocument();
  expect(screen.getByText(/Version draft-2026-10-01/)).toBeInTheDocument();
  expect(screen.getByText(/not monitored in real time and your host cannot reply/)).toBeInTheDocument();
  expect(screen.getByRole("complementary", { name: "Open points for legal review" })).toBeInTheDocument();
});

it("carries private feedback and Google screening in the draft Privacy Policy", () => {
  render(<LegalDraftPage kind="privacy" />);
  expect(screen.getByRole("heading", { name: /Private feedback and automated screening/ })).toBeInTheDocument();
  expect(screen.getByText(/Google Cloud’s content moderation services/)).toBeInTheDocument();
});
