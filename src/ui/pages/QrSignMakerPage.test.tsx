import { fireEvent, render, screen, within } from "@testing-library/react";
import { QrSignMakerPage } from "./QrSignMakerPage";
import { signStyles } from "../../domain/signStyles";

const preview = () => document.querySelector<HTMLElement>(".sign-stage")!;

describe("QR sign maker", () => {
  afterEach(() => window.history.replaceState(null, "", "/"));

  it("opens on the style a link names, and records a new choice in the address", () => {
    window.history.replaceState(null, "", "/qr-sign-maker?style=chalkboard");
    render(<QrSignMakerPage />);
    expect(screen.getByRole("button", { name: "Chalkboard" })).toHaveAttribute("aria-pressed", "true");
    expect(preview().querySelector(".sign-chalkboard")).not.toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Boho arch" }));
    expect(preview().querySelector(".sign-boho-arch")).not.toBeNull();
    expect(window.location.search).toBe("?style=boho-arch");
  });

  it("offers every style", () => {
    render(<QrSignMakerPage />);
    for (const style of signStyles) expect(screen.getByRole("button", { name: style.name })).toBeInTheDocument();
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

  it("drops the Wi-Fi code when the network is blank", () => {
    render(<QrSignMakerPage />);
    fireEvent.change(screen.getByLabelText("Network name"), { target: { value: "" } });
    expect(within(preview()).queryByText("Join the Wi-Fi")).not.toBeInTheDocument();
  });

  it("asks for a photo only on the photo styles", () => {
    render(<QrSignMakerPage />);
    expect(screen.queryByLabelText("Photo")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Polaroid" }));
    expect(screen.getByLabelText("Photo")).toHaveAttribute("accept", "image/*");
  });
});
