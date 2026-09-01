import { fireEvent, render, screen } from "@testing-library/react";
import { GuestWallPage } from "./GuestWallPage";
import { StayWallPage } from "./StayWallPage";
import { HostDashboardPage } from "./HostDashboardPage";
import { PrivacySafetyPage } from "./PrivacySafetyPage";
import { demoPosts, houseEssentials, wallPhotos } from "../wall/demoWall";

describe("first UI slices", () => {
  it("keeps Guest contribution blocked until consent is provided", () => {
    render(<StayWallPage propertySlug="demo-cottage" />);
    fireEvent.change(screen.getByLabelText("Your message"), { target: { value: "A lovely stay" } });
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    expect(screen.getByRole("status")).toHaveTextContent(/accept the content consent/i);
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    expect(screen.getByRole("status")).toHaveTextContent(/validated locally/i);
    expect(screen.getByRole("status")).toHaveTextContent(/demo wall/i);
  });

  it("keeps house guidance off the public wall and on the in-stay wall", () => {
    const wifi = houseEssentials[0]!.detail;
    const { unmount } = render(<GuestWallPage propertySlug="demo-cottage" />);
    expect(screen.queryByText(wifi)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Continue" })).not.toBeInTheDocument();
    unmount();

    render(<StayWallPage propertySlug="demo-cottage" />);
    expect(screen.getByText(wifi)).toBeInTheDocument();
  });

  it("shows the same guest memories on both walls", () => {
    const { unmount } = render(<GuestWallPage propertySlug="demo-cottage" />);
    const publicNotes = screen.getAllByText(/Stayed \w+ \d{4}/).length;
    expect(publicNotes).toBeGreaterThan(1);
    unmount();

    render(<StayWallPage propertySlug="demo-cottage" />);
    expect(screen.getAllByText(/Stayed \w+ \d{4}/)).toHaveLength(publicNotes);
  });

  it("gives every wall photo a described image rather than a decorative placeholder", () => {
    render(<GuestWallPage propertySlug="demo-cottage" />);

    const cover = screen.getByRole("img", { name: /granite front of Seabreeze Cottage/i });
    expect(cover).toHaveAttribute("src", "/wall/cover.webp");

    // Every memory carries a photo, and every photo carries real alt text.
    // (the in-stay wall is covered separately below)
    expect(demoPosts.every((post) => post.photo)).toBe(true);
    for (const post of demoPosts) {
      const photo = wallPhotos[post.photo!];
      expect(screen.getByRole("img", { name: photo.alt })).toHaveAttribute("src", photo.src);
    }
  });

  it("shows the property cover and every memory photo on the in-stay wall too", () => {
    render(<StayWallPage propertySlug="demo-cottage" />);

    expect(screen.getByRole("img", { name: /granite front of Seabreeze Cottage/i }))
      .toHaveAttribute("src", "/wall/cover.webp");

    for (const post of demoPosts) {
      expect(screen.getByRole("img", { name: wallPhotos[post.photo!].alt })).toBeInTheDocument();
    }
  });

  it("provides discreet Guest Wall attribution back to the main landing page", () => {
    render(<GuestWallPage propertySlug="demo-cottage" />);
    const attribution = screen.getByRole("link", { name: /Powered by DigiStayBook/i });
    expect(attribution).toHaveAttribute("href", "/");
    expect(screen.getByLabelText("About DigiStayBook")).toContainElement(attribution);
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
