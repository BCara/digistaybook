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
    fireEvent.click(screen.getByRole("button", { name: "Add to guestbook" }));
    fireEvent.change(screen.getByLabelText("Your message"), { target: { value: "A lovely stay" } });
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    expect(screen.getByRole("status")).toHaveTextContent(/accept the content consent/i);
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    expect(screen.getByRole("status")).toHaveTextContent(/validated locally/i);
    expect(screen.getByRole("status")).toHaveTextContent(/demo wall/i);
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

    // Every photograph on the wall carries real alt text, the hosts' own
    // included. Not every note has one: a wall where they all did would not be
    // a wall anybody had kept.
    // (the in-stay wall is covered separately below)
    expect(demoPosts.some((post) => post.photo)).toBe(true);
    for (const post of demoPosts.filter((entry) => entry.photo)) {
      const photo = wallPhotos[post.photo!];
      expect(screen.getByRole("img", { name: photo.alt })).toHaveAttribute("src", photo.src);
    }
    for (const note of hostWallNotes.filter((entry) => entry.photo)) {
      const hostPhoto = wallPhotos[note.photo!];
      expect(screen.getByRole("img", { name: hostPhoto.alt })).toHaveAttribute("src", hostPhoto.src);
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

  it("stands the hosts' own notes above the memories rather than among them", () => {
    // It is not a memory, and it is not counted as one: the heading counts
    // what guests left.
    const heading = `${demoPosts.length} memories left here`;

    const { unmount } = render(<GuestWallPage propertySlug="demo-cottage" />);
    const memories = screen.getByRole("region", { name: heading });
    const onPublic = screen.getByRole("complementary", { name: /More from Ana & Tom/i });
    for (const note of hostWallNotes) expect(onPublic).toHaveTextContent(note.message);
    // Each is fixed to the wall the way its author chose, and the wall says
    // which so the stylesheet can draw the difference.
    expect([...onPublic.querySelectorAll(".host-note")].map((note) => note.getAttribute("data-note-style")))
      .toEqual(hostWallNotes.map((note) => note.style));
    // They say whose they are in words, once over the stack, and each signs
    // with the hosts' names.
    expect(onPublic).toHaveTextContent(/More from your hosts/i);
    // Every note is signed, because each is read on its own.
    expect(within(onPublic).getAllByText(demoProperty.hosts)).toHaveLength(hostWallNotes.length);
    // Out of the memories entirely, and above them on the page.
    expect(memories).not.toContainElement(onPublic);
    expect(onPublic.compareDocumentPosition(memories)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    unmount();

    render(<StayWallPage propertySlug="demo-cottage" />);
    const onStay = screen.getByRole("complementary", { name: /More from Ana & Tom/i });
    for (const note of hostWallNotes) expect(onStay).toHaveTextContent(note.message);
    expect(screen.getByRole("region", { name: heading })).not.toContainElement(onStay);
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
