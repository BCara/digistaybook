import { essentialMarkName } from "./EssentialMark";
import { factSuggestions } from "../../domain/propertyProfile";

describe("essentials marks", () => {
  it("reads the mark off the label a host actually typed", () => {
    expect(essentialMarkName("Wi-Fi")).toBe("wifi");
    expect(essentialMarkName("wifi password")).toBe("wifi");
    expect(essentialMarkName("WI FI")).toBe("wifi");
    expect(essentialMarkName("Bin day")).toBe("bins");
    expect(essentialMarkName("Recycling")).toBe("bins");
    expect(essentialMarkName("Checkout time")).toBe("checkout");
    expect(essentialMarkName("Lock up")).toBe("checkout");
    expect(essentialMarkName("Door code")).toBe("keys");
  });

  it("settles the overlaps in the order the marks are listed", () => {
    expect(essentialMarkName("Water heater")).toBe("water");
    expect(essentialMarkName("Heating")).toBe("heating");
    expect(essentialMarkName("Car park")).toBe("parking");
  });

  it("gives an unrecognised or empty label the neutral mark", () => {
    expect(essentialMarkName("The blue gate")).toBe("note");
    expect(essentialMarkName("   ")).toBe("note");
  });

  it("draws every line the wizard suggests", () => {
    expect(factSuggestions.map((suggestion) => essentialMarkName(suggestion.term))).not.toContain("note");
  });
});
