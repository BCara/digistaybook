import { readWifiLine, wifiQrPayload } from "./wifi";

describe("reading a Host's Wi-Fi line", () => {
  it.each([
    ["cottage-guest / seaside42", "cottage-guest", "seaside42"],
    ["cottage-guest | seaside42", "cottage-guest", "seaside42"],
    ["Network: Seabreeze, password: sandcastle", "Seabreeze", "sandcastle"],
    ["Seabreeze-5G password sandcastle", "Seabreeze-5G", "sandcastle"],
    ["SSID: Seabreeze / Key: s4nd,castle", "Seabreeze", "s4nd,castle"],
    ["Network name: Sea Breeze; PW: a b c", "Sea Breeze", "a b c"]
  ])("finds the network and password in %j", (line, network, password) => {
    expect(readWifiLine(line)).toEqual({ network, password });
  });

  it("keeps a password that comes without a network", () => {
    expect(readWifiLine("Password: sandcastle")).toEqual({ network: null, password: "sandcastle" });
  });

  // A network name alone is the suggestion's example, and a guess at which
  // half is the password would put the wrong one on the clipboard.
  it.each(["SEABREEZE-5G", "On the fridge magnet", "a / b / c", "Password:", "Password is on the router", "", "cottage-guest/seaside42"])(
    "reads nothing from %j", line => {
      expect(readWifiLine(line)).toBeNull();
    });
});

describe("the Wi-Fi QR payload", () => {
  it("is the standard format phone cameras offer to join", () => {
    expect(wifiQrPayload({ network: "Seabreeze", password: "sandcastle" })).toBe("WIFI:T:WPA;S:Seabreeze;P:sandcastle;;");
  });

  it("escapes the characters the format reserves", () => {
    expect(wifiQrPayload({ network: "Sea;Breeze", password: 'a\\b,c:"d' })).toBe('WIFI:T:WPA;S:Sea\\;Breeze;P:a\\\\b\\,c\\:\\"d;;');
  });
});
