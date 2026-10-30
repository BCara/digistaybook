import { fireEvent, render, screen, within } from "@testing-library/react";
import { QrSignMakerPage } from "./QrSignMakerPage";
import { signStyles } from "../../domain/signStyles";

const preview = () => document.querySelector<HTMLElement>(".sign-stage")!;

function chooseStyle(name: string) {
  fireEvent.click(screen.getByRole("button", { name: /^Style:/ }));
  fireEvent.click(screen.getByRole("button", { name }));
}

describe("QR sign maker", () => {
  afterEach(() => window.history.replaceState(null, "", "/"));

  it("opens on the style a link names, and records a new choice in the address", () => {
    window.history.replaceState(null, "", "/qr-sign-maker?style=chalkboard");
    render(<QrSignMakerPage />);
    expect(screen.getByRole("button", { name: "Style: Chalkboard" })).toHaveAttribute("aria-expanded", "false");
    expect(preview().querySelector(".sign-chalkboard")).not.toBeNull();

    chooseStyle("Boho arch");
    expect(preview().querySelector(".sign-boho-arch")).not.toBeNull();
    expect(window.location.search).toBe("?style=boho-arch");
    // Choosing closes the list and shows the choice on the dropdown itself.
    expect(screen.queryByRole("button", { name: "Chalkboard" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Style: Boho arch" })).toHaveAttribute("aria-expanded", "false");
  });

  it("offers every style in the dropdown, and closes it on Escape", () => {
    render(<QrSignMakerPage />);
    fireEvent.click(screen.getByRole("button", { name: /^Style:/ }));
    for (const style of signStyles) expect(screen.getByRole("button", { name: style.name })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Coastal" })).toHaveAttribute("aria-pressed", "true");
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("button", { name: "Coastal" })).not.toBeInTheDocument();
  });

  it("puts the visitor's name, link and Wi-Fi on the sign", () => {
    render(<QrSignMakerPage />);
    fireEvent.change(screen.getByLabelText("Name of your place"), { target: { value: "Pine Hollow" } });
    fireEvent.change(screen.getByLabelText("Link the code opens"), { target: { value: "pinehollow.com/guide" } });
    fireEvent.change(screen.getByLabelText("Network name"), { target: { value: "PineHollow-Guest" } });

    const sign = within(preview());
    expect(sign.getByText("Pine Hollow")).toBeInTheDocument();
    expect(sign.getByText("pinehollow.com/guide")).toBeInTheDocument();
    expect(sign.getByRole("img", { name: "QR code for pinehollow.com/guide" })).toBeInTheDocument();
    expect(sign.getByRole("img", { name: "QR code to join the Wi-Fi network PineHollow-Guest" })).toBeInTheDocument();
  });

  it("keeps the last good code while the link is not an address, and says why", () => {
    render(<QrSignMakerPage />);
    fireEvent.change(screen.getByLabelText("Link the code opens"), { target: { value: "not a link" } });
    expect(screen.getByLabelText("Link the code opens")).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByText(/Enter a web address/)).toBeInTheDocument();
    expect(within(preview()).getByText("digistaybook.com/stay/demo-cottage")).toBeInTheDocument();
  });

  it("adds the Wi-Fi code only while it is switched on, and keeps what was typed", () => {
    render(<QrSignMakerPage />);
    expect(within(preview()).getByText("Join the Wi-Fi")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("checkbox", { name: "Add a Wi-Fi code" }));
    expect(within(preview()).queryByText("Join the Wi-Fi")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Network name")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("checkbox", { name: "Add a Wi-Fi code" }));
    expect(screen.getByLabelText("Network name")).toHaveValue("SEABREEZE-5G");
    fireEvent.change(screen.getByLabelText("Network name"), { target: { value: "" } });
    expect(within(preview()).queryByText("Join the Wi-Fi")).not.toBeInTheDocument();
  });

  it("asks for a photo only on the photo styles", () => {
    render(<QrSignMakerPage />);
    expect(screen.queryByLabelText("Photo")).not.toBeInTheDocument();
    chooseStyle("Polaroid");
    expect(screen.getByLabelText("Photo")).toHaveAttribute("accept", "image/*");
  });
});
