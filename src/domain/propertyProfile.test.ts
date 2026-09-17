import {
  emptyProfile,
  exampleNote,
  factExample,
  factSuggestions,
  hostInitials,
  normalizeProfile,
  profileLimits,
  readProfile,
  sameProfileText,
  setupProgress,
  setupSteps,
  unusedFactSuggestions,
  validatePhotoFile,
  validateProfile,
  welcomeParagraphs,
  writtenHostNotes,
  type HostNote,
  type PropertyProfile
} from "./propertyProfile";

const profile = (overrides: Partial<PropertyProfile> = {}): PropertyProfile => ({
  ...emptyProfile(),
  ...overrides
});

const photo = {
  path: "properties/prop-1/media/cover-1.jpg",
  url: "https://example.test/cover.jpg",
  alt: "The front of the cottage",
  width: 1500,
  height: 660
};

describe("reading a stored profile", () => {
  it("returns an empty profile for a property that has never been set up", () => {
    expect(readProfile(undefined)).toEqual(emptyProfile());
    expect(readProfile("not a map")).toEqual(emptyProfile());
  });

  it("keeps the fields it recognises and drops the shapes it does not", () => {
    const read = readProfile({
      location: "Cornwall",
      welcome: "A short welcome",
      facts: [{ term: "Wi-Fi", detail: "SEABREEZE-5G", note: "On the fridge" }, "nonsense"],
      cover: photo,
      hostPhoto: { alt: "No URL, so not a photo" },
      unexpected: "ignored"
    });

    expect(read.location).toBe("Cornwall");
    expect(read.facts[0]).toEqual({ term: "Wi-Fi", detail: "SEABREEZE-5G", note: "On the fridge" });
    expect(read.facts[1]).toEqual({ term: "", detail: "", note: "" });
    expect(read.cover).toEqual(photo);
    // A record with no URL cannot render, so it reads as no photograph at all.
    expect(read.hostPhoto).toBeNull();
    expect(Object.keys(read)).not.toContain("unexpected");
  });

  it("caps a field that is longer than the form would ever allow", () => {
    const read = readProfile({ location: "x".repeat(500) });
    expect(read.location).toHaveLength(profileLimits.locationMax);
  });
});

describe("normalising before a write", () => {
  it("trims, drops blank guidance rows and keeps paragraph breaks", () => {
    const normalized = normalizeProfile(
      profile({
        location: "  Cornwall  ",
        stayWelcome: "\n\nFirst paragraph.\n\n\n\nSecond paragraph.\n\n",
        facts: [
          { term: " Wi-Fi ", detail: " SEABREEZE-5G ", note: "" },
          { term: "", detail: "", note: "" }
        ]
      })
    );

    expect(normalized.location).toBe("Cornwall");
    expect(normalized.stayWelcome).toBe("First paragraph.\n\nSecond paragraph.");
    expect(normalized.facts).toEqual([{ term: "Wi-Fi", detail: "SEABREEZE-5G", note: "" }]);
  });

  it("leaves photographs alone, because they are written by their own path", () => {
    expect(normalizeProfile(profile({ cover: photo })).cover).toEqual(photo);
  });
});

describe("validating a profile", () => {
  it("accepts an entirely empty profile, because setup happens over days", () => {
    expect(validateProfile(emptyProfile())).toEqual([]);
  });

  it("rejects a guidance line that would render as a dangling label", () => {
    const problems = validateProfile(
      profile({ facts: [{ term: "Wi-Fi", detail: "", note: "On the fridge" }] })
    );
    expect(problems).toEqual([{ field: "facts", index: 0, message: "Add the answer guests need for Wi-Fi." }]);
  });

  it("rejects an answer with nothing labelling it", () => {
    const problems = validateProfile(profile({ facts: [{ term: "", detail: "SEABREEZE-5G", note: "" }] }));
    expect(problems[0]?.message).toMatch(/Give this line a label/);
  });

  it("counts only the filled rows against the guidance limit", () => {
    const filled = Array.from({ length: profileLimits.factsMax }, (_, index) => ({
      term: `Term ${index}`,
      detail: "Answer",
      note: ""
    }));
    expect(validateProfile(profile({ facts: [...filled, { term: "", detail: "", note: "" }] }))).toEqual([]);
    const overLimit = validateProfile(
      profile({ facts: [...filled, { term: "One too many", detail: "Answer", note: "" }] })
    );
    // A limit problem belongs to the list, not to one row, so it carries no index.
    expect(overLimit).toEqual([{ field: "facts", message: expect.stringMatching(/Keep house guidance to 8 lines/) }]);
  });
});

describe("a note from the hosts that has been taken off the wall", () => {
  it("is on by default, and a document written before the flag existed keeps it", () => {
    expect(emptyProfile().stayNoteOff).toBe(false);
    expect(readProfile({ location: "Cornwall" }).stayNoteOff).toBe(false);
    // Only an explicit true turns it off; a truthy string is not a decision.
    expect(readProfile({ stayNoteOff: "yes" }).stayNoteOff).toBe(false);
    expect(readProfile({ stayNoteOff: true }).stayNoteOff).toBe(true);
  });

  it("keeps the words that were written, so putting it back costs nothing", () => {
    const normalized = normalizeProfile(profile({ stayNoteOff: true, stayWelcome: " The kettle is on. " }));
    expect(normalized.stayNoteOff).toBe(true);
    expect(normalized.stayWelcome).toBe("The kettle is on.");
  });

  it("counts as decided rather than as missing on the setup list", () => {
    const steps = setupSteps(profile({ stayNoteOff: true, stayWelcome: "" }));
    expect(steps.find((step) => step.id === "stayWelcome")?.done).toBe(true);
  });
});

describe("the hosts' own notes on the wall", () => {
  const note = (over: Partial<HostNote> = {}): HostNote => ({
    id: "n1",
    message: "",
    style: "bordered",
    photo: null,
    ...over
  });

  it("are absent until one is written, so they need no flag to say they are off", () => {
    expect(emptyProfile().hostNotes).toEqual([]);
    expect(writtenHostNotes(emptyProfile())).toEqual([]);
    // Whitespace is not a note, and a document that has never carried one
    // reads as a property whose hosts have written nothing.
    expect(writtenHostNotes(profile({ hostNotes: [note({ message: "   " })] }))).toEqual([]);
    expect(readProfile({ location: "Cornwall" }).hostNotes).toEqual([]);
  });

  it("counts a photograph on its own as a note, because that is what the wall draws", () => {
    expect(writtenHostNotes(profile({ hostNotes: [note({ photo })] }))).toHaveLength(1);
    expect(writtenHostNotes(profile({ hostNotes: [note({ message: "We lay the fire." })] }))).toHaveLength(1);
  });

  it("carry their own words, photograph and how each is fixed to the wall", () => {
    const read = readProfile({
      hostNotes: [
        { id: "fire", message: "We lay the fire.", style: "pinned", photo: { url: "https://x.test/f.jpg" } },
        { id: "bench", message: "The bench gets the sun.", style: "nonsense" }
      ]
    });
    expect(read.hostNotes.map((entry) => [entry.id, entry.style])).toEqual([
      ["fire", "pinned"],
      // A variety this build does not know is a card, never nothing.
      ["bench", "bordered"]
    ]);
    expect(read.hostNotes[0]?.photo?.url).toBe("https://x.test/f.jpg");
    // A document carrying more than a wall should is read down to the limit.
    expect(
      readProfile({ hostNotes: Array.from({ length: 9 }, (_, index) => ({ id: `n${index}`, message: "x" })) }).hostNotes
    ).toHaveLength(profileLimits.hostNotesMax);
  });

  it("reads a property written before there were several as its first note", () => {
    const read = readProfile({ hostNote: "We lay the fire.", hostNotePhoto: { url: "https://x.test/f.jpg" } });
    expect(read.hostNotes).toHaveLength(1);
    expect(read.hostNotes[0]?.message).toBe("We lay the fire.");
    expect(read.hostNotes[0]?.style).toBe("bordered");
    expect(read.hostNotes[0]?.photo?.url).toBe("https://x.test/f.jpg");
    // A stored list is what the property says, old fields or not.
    expect(readProfile({ hostNote: "Ignored.", hostNotes: [] }).hostNotes).toEqual([]);
  });

  it("are trimmed and capped like the prose they sit beside", () => {
    const normalized = normalizeProfile(
      profile({ hostNotes: [note({ message: "  We lay the fire.\n\n\n\nThe kindling is in the bucket.  " })] })
    );
    expect(normalized.hostNotes[0]?.message).toBe("We lay the fire.\n\nThe kindling is in the bucket.");
    expect(
      normalizeProfile(profile({ hostNotes: [note({ message: "x".repeat(2000) })] })).hostNotes[0]?.message
    ).toHaveLength(profileLimits.hostNoteMax);
    expect(readProfile({ hostNotes: [{ id: "n1", message: "x".repeat(2000) }] }).hostNotes[0]?.message)
      .toHaveLength(profileLimits.hostNoteMax);
  });

  it("drops a note with neither words nor a photograph, which is how an opened one starts", () => {
    expect(normalizeProfile(profile({ hostNotes: [note(), note({ id: "n2", message: "Kept." })] })).hostNotes)
      .toEqual([note({ id: "n2", message: "Kept." })]);
  });

  it("keeps their photographs out of the comparison that offers a save", () => {
    // A photograph is already stored by the time it reaches the draft, so a
    // Host must not be shown an unsaved change they cannot save.
    expect(sameProfileText(
      profile({ hostNotes: [note({ message: "We lay the fire.", photo })] }),
      profile({ hostNotes: [note({ message: "We lay the fire." })] })
    )).toBe(true);
    expect(sameProfileText(profile({ hostNotes: [note({ message: "We lay the fire." })] }), profile())).toBe(false);
    // How a note is fixed to the wall is a decision, not a picture: it saves.
    expect(sameProfileText(
      profile({ hostNotes: [note({ message: "We lay the fire.", style: "pinned" })] }),
      profile({ hostNotes: [note({ message: "We lay the fire." })] })
    )).toBe(false);
  });
});

describe("house guidance a Host has taken off the wall", () => {
  it("is on by default, and a document written before the flag existed keeps it", () => {
    expect(emptyProfile().factsOff).toBe(false);
    expect(readProfile({ location: "Cornwall" }).factsOff).toBe(false);
    // Only an explicit true turns it off; a truthy string is not a decision.
    expect(readProfile({ factsOff: "yes" }).factsOff).toBe(false);
    expect(readProfile({ factsOff: true }).factsOff).toBe(true);
  });

  it("keeps the lines that were written, so putting it back costs nothing", () => {
    const normalized = normalizeProfile(
      profile({ factsOff: true, facts: [{ term: " Wi-Fi ", detail: " SEABREEZE-5G ", note: "" }] })
    );
    expect(normalized.factsOff).toBe(true);
    expect(normalized.facts).toEqual([{ term: "Wi-Fi", detail: "SEABREEZE-5G", note: "" }]);
  });

  it("does not hold a half-written line against a Host once it is off the wall", () => {
    const half = profile({ facts: [{ term: "Wi-Fi", detail: "", note: "" }] });
    expect(validateProfile(half)).toHaveLength(1);
    expect(validateProfile({ ...half, factsOff: true })).toEqual([]);
  });

  it("counts as decided rather than as missing on the setup list", () => {
    const steps = setupSteps(profile({ factsOff: true }));
    expect(steps.find((step) => step.id === "facts")?.done).toBe(true);
  });
});

describe("the theme both walls are printed on", () => {
  it("starts on the default, so a property that has never chosen still has paper", () => {
    expect(emptyProfile().theme).toBe("linen");
    expect(readProfile({}).theme).toBe("linen");
  });

  it("keeps a theme this build knows and falls back for one it does not", () => {
    expect(readProfile({ theme: "harbour" }).theme).toBe("harbour");
    // An older name, a newer one, or a corrupted field renders as the default
    // rather than as an unstyled wall.
    expect(readProfile({ theme: "midnight" }).theme).toBe("linen");
    expect(readProfile({ theme: 7 }).theme).toBe("linen");
  });

  it("survives a write, and counts as a change worth saving", () => {
    expect(normalizeProfile(profile({ theme: "sage" })).theme).toBe("sage");
    expect(sameProfileText(profile({ theme: "sage" }), profile({ theme: "studio" }))).toBe(false);
    expect(sameProfileText(profile({ theme: "sage" }), profile({ theme: "sage" }))).toBe(true);
  });
});

describe("suggested house guidance", () => {
  it("offers the lines nearly every property answers, and drops the ones already used", () => {
    const terms = factSuggestions.map((suggestion) => suggestion.term);
    expect(terms).toContain("Wi-Fi");
    expect(terms).toContain("Bins");
    expect(terms).toContain("Checkout");
    // Never more than a property is allowed to carry.
    expect(factSuggestions.length).toBeLessThanOrEqual(profileLimits.factsMax);

    const left = unusedFactSuggestions([{ term: " wi-fi ", detail: "SEABREEZE-5G", note: "" }]);
    expect(left.map((suggestion) => suggestion.term)).not.toContain("Wi-Fi");
    expect(left.length).toBe(factSuggestions.length - 1);
  });

  it("prompts a known label with the kind of answer that belongs under it", () => {
    expect(factExample("Bins").detail).toBe("Thursday morning");
    // A label of their own still gets a shape to copy.
    expect(factExample("Sauna").detail).toBeTruthy();
  });
});

describe("validating a photograph before it is uploaded", () => {
  it("accepts the formats a phone browser reliably renders", () => {
    expect(validatePhotoFile({ type: "image/jpeg", size: 1024 })).toBeNull();
    expect(validatePhotoFile({ type: "image/webp", size: 1024 })).toBeNull();
  });

  it("refuses a file that is not an image, whatever it is called", () => {
    expect(validatePhotoFile({ type: "application/pdf", size: 1024 })).toMatch(/JPEG, PNG or WebP/);
  });

  it("refuses an image too large to load on a phone", () => {
    expect(validatePhotoFile({ type: "image/jpeg", size: profileLimits.photoBytesMax + 1 })).toMatch(/8MB/);
  });
});

describe("setup readiness", () => {
  it("starts with nothing done, so a new property explains itself", () => {
    const progress = setupProgress(emptyProfile());
    expect(progress.done).toBe(0);
    expect(progress.complete).toBe(false);
    expect(setupSteps(emptyProfile()).every((step) => !step.done)).toBe(true);
  });

  it("does not count a guidance line that has no answer on it", () => {
    const steps = setupSteps(profile({ facts: [{ term: "Wi-Fi", detail: "", note: "" }] }));
    expect(steps.find((step) => step.id === "facts")?.done).toBe(false);
  });

  it("is complete once every wall has something to render", () => {
    const progress = setupProgress(
      profile({
        location: "Cornwall",
        welcome: "A welcome",
        hosts: "Ana & Tom",
        stayWelcome: "The kettle is on the side.",
        facts: [{ term: "Wi-Fi", detail: "SEABREEZE-5G", note: "" }],
        cover: photo
      })
    );
    expect(progress).toEqual({ done: 6, total: 6, complete: true });
  });
});

describe("wall presentation helpers", () => {
  it("splits the arrival note on blank lines only", () => {
    expect(welcomeParagraphs("One.\nStill one.\n\nTwo.")).toEqual(["One.\nStill one.", "Two."]);
    expect(welcomeParagraphs("   ")).toEqual([]);
  });

  it("reads initials from the names guests use, not from joining words", () => {
    expect(hostInitials("Ana & Tom")).toBe("AT");
    expect(hostInitials("Ana and Tom")).toBe("AT");
    expect(hostInitials("")).toBe("•");
  });
});

describe("the arrival note offered as an example", () => {
  it("is an example and nothing else: a new property starts blank", () => {
    const started = emptyProfile();

    // Nothing is written for a Host. What a guest reads is only ever what a
    // Host typed, so a property nobody wrote a note on has no note on it.
    expect(started.stayHeading).toBe("");
    expect(started.stayWelcome).toBe("");
    expect(started.stayNoteOff).toBe(false);
  });

  it("shows a heading and more than one paragraph, so it reads as a note", () => {
    // The example exists to save a Host from a blank sheet, which it only does
    // if it looks like the thing they are being asked to write.
    expect(exampleNote.heading).not.toBe("");
    expect(welcomeParagraphs(exampleNote.welcome).length).toBeGreaterThan(1);
  });

  it("fits the limits the fields enforce", () => {
    // An example longer than the field allows is a suggestion a Host cannot
    // take, and typing it out would be cut off halfway.
    expect(exampleNote.heading.length).toBeLessThanOrEqual(profileLimits.stayHeadingMax);
    expect(exampleNote.welcome.length).toBeLessThanOrEqual(profileLimits.stayWelcomeMax);
  });
});
