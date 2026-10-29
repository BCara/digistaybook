import { render, screen } from "@testing-library/react";
import { MemoryWall } from "./MemoryWall";
import { demoPosts } from "./demoWall";

it("omits author names and avatars for unsigned memories, as the served wall does", () => {
  render(<MemoryWall heading="Guest memories" posts={[
    { ...demoPosts[0]!, id: "named", displayName: "Mia & Sam" },
    { ...demoPosts[1]!, id: "unnamed", displayName: undefined },
    { ...demoPosts[2]!, id: "spaces", displayName: "   " }
  ]} />);
  expect(screen.getByText("Mia & Sam")).toBeInTheDocument();
  expect(screen.queryByText("A guest")).not.toBeInTheDocument();
  expect(document.querySelectorAll(".avatar")).toHaveLength(1);
  expect(document.querySelectorAll(".note-sign")).toHaveLength(1);
});

it("marks a memory the Host pinned as their favorite", () => {
  render(<MemoryWall heading="Guest memories" posts={[{ ...demoPosts[0]!, pinned: true }, demoPosts[1]!]} />);
  expect(screen.getAllByText("Host favorite")).toHaveLength(1);
  expect(document.querySelectorAll(".note-pinned")).toHaveLength(1);
});
