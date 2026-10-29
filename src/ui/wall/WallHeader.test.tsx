import { fireEvent, render, screen, within } from "@testing-library/react";
import { WallHeader } from "./WallHeader";

const property = {
  name: "Real cottage", location: "Coast", welcome: "", hosts: "Ana",
  houseInformation: { heading: "", welcome: "", tip: "", facts: [
    { term: "Wi-Fi", detail: "cottage-guest / seaside42", note: "Router is under the stairs" },
    { term: "Checkout", detail: "10am", note: "" }
  ] }
};

describe("the in-stay essentials", () => {
  it("opens a tapped essential in front of the page rather than jumping to it", () => {
    render(<div data-wall-theme="classic"><WallHeader property={property} view="stay" /></div>);
    const links = within(screen.getByRole("navigation", { name: "Your stay essentials" }));
    fireEvent.click(links.getByRole("button", { name: "Wi-Fi" }));
    const sheet = screen.getByRole("dialog", { name: "Wi-Fi" });
    expect(sheet).toHaveTextContent("cottage-guest / seaside42");
    expect(sheet).toHaveTextContent("Router is under the stairs");
    fireEvent.click(within(sheet).getByRole("button", { name: "Close" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("copies the Wi-Fi password alone and says which network to pick", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    render(<div data-wall-theme="classic"><WallHeader property={property} view="stay" /></div>);
    fireEvent.click(screen.getByRole("button", { name: "Wi-Fi" }));
    fireEvent.click(screen.getByRole("button", { name: "Copy Wi-Fi password" }));
    expect(writeText).toHaveBeenCalledWith("seaside42");
    expect(await screen.findByRole("status")).toHaveTextContent("choose cottage-guest and paste the password");
  });

  it("draws the essentials only as buttons, with no list of them in full further down", () => {
    render(<div data-wall-theme="classic"><WallHeader property={property} view="stay" /></div>);
    expect(within(screen.getByRole("navigation", { name: "Your stay essentials" })).getAllByRole("button").map(button => button.textContent))
      .toEqual(["Wi-Fi", "Checkout"]);
    expect(screen.queryByText("10am")).not.toBeInTheDocument();
  });
});

describe("the hosts' stay-again links", () => {
  const withLinks = (links: { label: string; url: string }[]) => ({ ...property, houseInformation: { ...property.houseInformation, links } });

  it("opens the hosts' own page in a new tab and shows where it goes", () => {
    render(<div data-wall-theme="classic"><WallHeader property={withLinks([{ label: "Book your next stay with us", url: "https://seabreeze.com.au/book" }])} view="stay" /></div>);
    const again = within(screen.getByRole("navigation", { name: "Stay with us again" }));
    const link = again.getByRole("link", { name: /Book your next stay with us/ });
    expect(link).toHaveAttribute("href", "https://seabreeze.com.au/book");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link.getAttribute("rel")).toContain("noopener");
    expect(link).toHaveTextContent("seabreeze.com.au/book");
  });

  it("draws nothing for a wall with no links, or only links that go nowhere", () => {
    render(<div data-wall-theme="classic"><WallHeader property={withLinks([{ label: "Sneaky", url: "javascript:alert(1)" }])} view="stay" /></div>);
    expect(screen.queryByRole("navigation", { name: "Stay with us again" })).not.toBeInTheDocument();
  });
});
