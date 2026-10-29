import {
  displayWebAddress,
  normalizeStayAgainLinks,
  readWebAddress,
  stayAgainProblems,
  wallStayAgainLinks
} from "./stayAgain";

describe("a Host's stay-again links", () => {
  it("reads an address the way a Host types it", () => {
    expect(readWebAddress("seabreezecottage.com.au/book")).toBe("https://seabreezecottage.com.au/book");
    expect(readWebAddress("  https://www.seabreeze.com.au  ")).toBe("https://www.seabreeze.com.au/");
    expect(readWebAddress("HTTPS://Seabreeze.com.au/Stay?ref=wall")).toBe("https://seabreeze.com.au/Stay?ref=wall");
  });

  it("refuses anything a guest's phone should not be sent to", () => {
    for (const bad of [
      "", "book", "https://book", "http://seabreeze.com.au", "javascript:alert(1)", "data:text/html,hi",
      "ftp://seabreeze.com.au", "https://host:pw@seabreeze.com.au", "seabreeze .com.au", `https://a.com/${"x".repeat(300)}`
    ]) expect(readWebAddress(bad)).toBeNull();
  });

  it("shows the address without its scheme", () => {
    expect(displayWebAddress("https://www.seabreeze.com.au/")).toBe("seabreeze.com.au");
    expect(displayWebAddress("https://seabreeze.com.au/book")).toBe("seabreeze.com.au/book");
  });

  it("keeps two labelled rows, stores a valid address in full and keeps a bad one as typed", () => {
    expect(normalizeStayAgainLinks([
      { label: "  ", url: " " },
      { label: " Book again ", url: "seabreeze.com.au" },
      { label: "Join our list", url: "not a site" },
      { label: "Third", url: "third.com" }
    ])).toEqual([
      { label: "Book again", url: "https://seabreeze.com.au/" },
      { label: "Join our list", url: "not a site" }
    ]);
  });

  it("says what is wrong with each row", () => {
    expect(stayAgainProblems([
      { label: "", url: "seabreeze.com.au" },
      { label: "Book", url: "" }
    ]).map((problem) => problem.index)).toEqual([0, 1]);
    expect(stayAgainProblems([{ label: "Book", url: "http://seabreeze.com.au" }])[0]?.message).toMatch(/https/);
    expect(stayAgainProblems([{ label: "Book", url: "seabreeze" }])[0]?.message).toMatch(/full web address/);
    expect(stayAgainProblems([{ label: "Book", url: "seabreeze.com.au" }, { label: "", url: "" }])).toEqual([]);
  });

  it("draws only rows a guest can follow", () => {
    expect(wallStayAgainLinks([
      { label: "Book", url: "seabreeze.com.au" },
      { label: "", url: "list.com" },
      { label: "Broken", url: "javascript:alert(1)" }
    ])).toEqual([{ label: "Book", url: "https://seabreeze.com.au/" }]);
  });
});
