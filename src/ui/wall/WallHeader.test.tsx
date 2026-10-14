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

  it("draws the essentials only as buttons, with no list of them in full further down", () => {
    render(<div data-wall-theme="classic"><WallHeader property={property} view="stay" /></div>);
    expect(within(screen.getByRole("navigation", { name: "Your stay essentials" })).getAllByRole("button").map(button => button.textContent))
      .toEqual(["Wi-Fi", "Checkout"]);
    expect(screen.queryByText("10am")).not.toBeInTheDocument();
  });
});
