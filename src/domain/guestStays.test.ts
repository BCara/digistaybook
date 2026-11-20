import { describe, expect, it } from "vitest";
import { currentStay, greetingFor, guestStayProblems, isDay, normalizeGuestStays, readGuestStays, stayState, type GuestStay } from "./guestStays";

const stay = (over: Partial<GuestStay> = {}): GuestStay => ({ id: "a", names: "Sarah & Tom", arrives: "2026-11-20", leaves: "2026-11-23", note: "", ...over });
const at = (day: string, hour: number) => new Date(`${day}T${String(hour).padStart(2, "0")}:30:00`);

describe("guest stays", () => {
  it("accepts only real calendar days", () => {
    expect(isDay("2026-11-20")).toBe(true);
    expect(isDay("2026-02-30")).toBe(false);
    expect(isDay("20/11/2026")).toBe(false);
    expect(isDay(null)).toBe(false);
  });

  it("greets from midday on arrival until midday on checkout, and never outside it", () => {
    const stays = [stay()];
    expect(currentStay(stays, at("2026-11-19", 18))).toBeNull();
    expect(currentStay(stays, at("2026-11-20", 9))).toBeNull();
    expect(currentStay(stays, at("2026-11-20", 12))?.names).toBe("Sarah & Tom");
    expect(currentStay(stays, at("2026-11-22", 3))?.names).toBe("Sarah & Tom");
    expect(currentStay(stays, at("2026-11-23", 11))?.names).toBe("Sarah & Tom");
    expect(currentStay(stays, at("2026-11-23", 12))).toBeNull();
    expect(currentStay(stays, at("2026-11-24", 9))).toBeNull();
  });

  it("hands over at midday on a shared changeover day", () => {
    const stays = [stay(), stay({ id: "b", names: "the Hendersons", arrives: "2026-11-23", leaves: "2026-11-27" })];
    expect(currentStay(stays, at("2026-11-23", 10))?.names).toBe("Sarah & Tom");
    expect(currentStay(stays, at("2026-11-23", 15))?.names).toBe("the Hendersons");
  });

  it("greets nobody from a row without names or with broken dates", () => {
    expect(currentStay([stay({ names: "  " })], at("2026-11-21", 14))).toBeNull();
    expect(currentStay([stay({ leaves: "" })], at("2026-11-21", 14))).toBeNull();
    expect(currentStay(null, at("2026-11-21", 14))).toBeNull();
  });

  it("drops blank rows and ended stays when saving, and orders by arrival", () => {
    const saved = normalizeGuestStays([
      stay({ id: "late", names: "  Mia  ", arrives: "2026-12-01", leaves: "2026-12-04" }),
      stay({ id: "gone", arrives: "2026-11-01", leaves: "2026-11-04" }),
      { id: "blank", names: " ", arrives: "", leaves: "", note: "" },
      stay({ id: "today", arrives: "2026-11-12", leaves: "2026-11-15" })
    ], "2026-11-15");
    expect(saved.map((entry) => entry.id)).toEqual(["today", "late"]);
    expect(saved[1]!.names).toBe("Mia");
  });

  it("reads a stored list defensively", () => {
    expect(readGuestStays("nope")).toEqual([]);
    expect(readGuestStays([{ names: 4, arrives: "2026-13-40", leaves: "2026-11-23", note: "Hi", extra: "x" }]))
      .toEqual([{ id: "stay1", names: "", arrives: "", leaves: "2026-11-23", note: "Hi" }]);
  });

  it("refuses a stay that would greet the wrong people", () => {
    expect(guestStayProblems([stay({ names: "" })])[0]?.field).toBe("names");
    expect(guestStayProblems([stay({ leaves: "2026-11-20" })])[0]?.message).toMatch(/after the day they arrive/);
    expect(guestStayProblems([stay(), stay({ id: "b", names: "Mia", arrives: "2026-11-22", leaves: "2026-11-25" })])[0]?.message).toMatch(/overlap with Sarah & Tom/);
    expect(guestStayProblems([stay(), stay({ id: "b", names: "Mia", arrives: "2026-11-23", leaves: "2026-11-25" })])).toEqual([]);
  });

  it("tells a Host where each stay stands", () => {
    expect(stayState(stay(), at("2026-11-21", 9))).toBe("now");
    expect(stayState(stay(), at("2026-11-20", 9))).toBe("upcoming");
    expect(stayState(stay(), at("2026-11-23", 13))).toBe("ended");
    expect(stayState(stay({ arrives: "" }), at("2026-11-21", 9))).toBe("unset");
  });

  it("words the greeting", () => {
    expect(greetingFor(" Sarah & Tom ")).toBe("Welcome, Sarah & Tom");
  });
});
