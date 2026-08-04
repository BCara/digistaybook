import { fireEvent, render, screen } from "@testing-library/react";
import { GuestWallPage } from "./GuestWallPage";
import { HostDashboardPage } from "./HostDashboardPage";
import { PrivacySafetyPage } from "./PrivacySafetyPage";

describe("first UI slices", () => {
  it("keeps Guest contribution blocked until consent is provided", () => {
    render(<GuestWallPage propertySlug="demo-cottage" />);
    fireEvent.change(screen.getByLabelText("Your message"), { target: { value: "A lovely stay" } });
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    expect(screen.getByRole("status")).toHaveTextContent(/accept the content consent/i);
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    expect(screen.getByRole("status")).toHaveTextContent(/validated locally/i);
  });

  it("fails the Host dashboard closed without Firebase configuration", () => {
    render(<HostDashboardPage />);
    expect(screen.getByRole("heading", { name: "Dashboard unavailable" })).toBeInTheDocument();
    expect(screen.getByText(/fails closed instead of providing a local authentication bypass/i)).toBeInTheDocument();
  });

  it("provides a public Privacy and Safety route separate from booking support", () => {
    render(<PrivacySafetyPage />);
    expect(screen.getByRole("heading", { name: "Privacy & Safety" })).toBeInTheDocument();
    expect(screen.getByText(/booking, property and in-stay support remain/i)).toBeInTheDocument();
  });
});
