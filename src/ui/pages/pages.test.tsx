import { fireEvent, render, screen, within } from "@testing-library/react";
import { GuestWallPage } from "./GuestWallPage";
import { StayWallPage } from "./StayWallPage";
import { HostDashboardPage } from "./HostDashboardPage";
import { PrivacySafetyPage } from "./PrivacySafetyPage";
import { demoPosts, demoProperty, houseEssentials, hostWallNotes, wallPhotos } from "../wall/demoWall";

// One test here asserts the fail-closed Host dashboard, so the configuration is
// pinned off rather than inherited from whatever .env.local a developer has.
vi.mock("../../lib/firebaseConfig", () => ({ firebaseConfig: {}, firebaseConfigured: false }));

describe("first UI slices", () => {
  it("keeps Guest contribution blocked until consent is provided", () => {
    render(<StayWallPage propertySlug="demo-cottage" />);
    // The demo draws the served wall's own form, so it is checked the same way.
    fireEvent.click(screen.getByRole("button", { name: "Add to guestbook" }));
    fireEvent.change(screen.getByLabelText("Your message"), { target: { value: "A lovely stay" } });
    fireEvent.click(screen.getByRole("button", { name: "Submit memory" }));
    expect(screen.getByText(/accept the consent/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: "Submit memory" }));
    expect(screen.getByText(/demo wall, so nothing was sent/i)).toBeInTheDocument();
  });

  it("drops our own furniture from the wall a Host embeds, and keeps the attribution", () => {
    render(<GuestWallPage propertySlug="demo-cottage" embedded />);

    // The demo ribbon is ours, and inside a Host's page it is furniture in
    // someone else's room. The wall itself is unchanged.
    expect(screen.queryByText("Demo")).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1 })).toBeInTheDocument();
    // D-010: the attribution link is the point of an embed, so it stays.
    expect(screen.getByRole("link", { name: /Powered by DigiStayBook/i })).toHaveAttribute("href", "/");
  });

  it("keeps house guidance off the public wall and on the in-stay wall", () => {
    const wifi = houseEssentials[0]!.detail;
    const { unmount } = render(<GuestWallPage propertySlug="demo-cottage" />);
    expect(screen.queryByText(wifi)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Continue" })).not.toBeInTheDocument();
    unmount();

    render(<StayWallPage propertySlug="demo-cottage" />);
    // On the in-stay wall it is behind its button, opened over the page.
    expect(screen.queryByText(wifi)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: houseEssentials[0]!.term }));
    expect(screen.getByRole("dialog", { name: houseEssentials[0]!.term })).toHaveTextContent(wifi);
  });

  it("shows the same guest memories on both walls", () => {
    const { unmount } = render(<GuestWallPage propertySlug="demo-cottage" />);
    const notes = () => screen.getByRole("region", { name: "Guest memories" }).querySelectorAll(".note");
    const publicNotes = notes().length;
    expect(publicNotes).toBe(demoPosts.length);
    unmount();

    render(<StayWallPage propertySlug="demo-cottage" />);
    expect(notes()).toHaveLength(publicNotes);
  });

  it("gives every wall photo a described image rather than a decorative placeholder", () => {
    render(<GuestWallPage propertySlug="demo-cottage" />);

    const cover = screen.getByRole("img", { name: /granite front of Seabreeze Cottage/i });
    expect(cover).toHaveAttribute("src", "/wall/cover.webp");

    // Every photograph on the wall carries real alt text. Not every note has one: a wall where they all did would not be
    // a wall anybody had kept.
    // (the in-stay wall is covered separately below)
    expect(demoPosts.some((post) => post.photo)).toBe(true);
    for (const post of demoPosts.filter((entry) => entry.photo)) {
      const photo = wallPhotos[post.photo!];
      expect(screen.getByRole("img", { name: photo.alt })).toHaveAttribute("src", photo.src);
    }
  });

  it("shows the property cover and every memory photo on the in-stay wall too", () => {
    render(<StayWallPage propertySlug="demo-cottage" />);

    expect(screen.getByRole("img", { name: /granite front of Seabreeze Cottage/i }))
      .toHaveAttribute("src", "/wall/cover.webp");

    for (const post of demoPosts.filter((entry) => entry.photo)) {
      expect(screen.getByRole("img", { name: wallPhotos[post.photo!].alt })).toBeInTheDocument();
    }
  });

  it("keeps the hosts' own notes to the in-stay wall, above the memories rather than among them", () => {
    // It is not a memory, and it is not counted as one: the heading counts
    // what guests left.

    // The public wall is memories only.
    const { unmount } = render(<GuestWallPage propertySlug="demo-cottage" />);
    expect(screen.queryByRole("complementary", { name: /More from Ana & Tom/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/More from your hosts/i)).not.toBeInTheDocument();
    unmount();

    render(<StayWallPage propertySlug="demo-cottage" />);
    const onStay = screen.getByRole("complementary", { name: /More from Ana & Tom/i });
    for (const note of hostWallNotes) expect(onStay).toHaveTextContent(note.message);
    // Each is fixed to the wall the way its author chose, and every note is signed.
    expect([...onStay.querySelectorAll(".host-note")].map((note) => note.getAttribute("data-note-style")))
      .toEqual(hostWallNotes.map((note) => note.style));
    expect(within(onStay).getAllByText(demoProperty.hosts)).toHaveLength(hostWallNotes.length);
    expect(screen.getByRole("heading", { name: `${demoPosts.length} memories left here` })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Guest memories" })).not.toContainElement(onStay);
  });

  it("provides discreet Guest Wall attribution back to the main landing page", () => {
    render(<GuestWallPage propertySlug="demo-cottage" />);
    const attribution = screen.getByRole("link", { name: /Powered by DigiStayBook/i });
    expect(attribution).toHaveAttribute("href", "/");
    // The same footer the served wall ends on.
    expect(attribution.closest(".wall-footer")).not.toBeNull();
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
