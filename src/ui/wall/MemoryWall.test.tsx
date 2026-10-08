import { render, screen } from "@testing-library/react";
import { MemoryWall } from "./MemoryWall";
import { demoPosts } from "./demoWall";

it("keeps dates but omits author names and avatars for unsigned memories", () => {
  render(<MemoryWall heading="Guest memories" posts={[
    { ...demoPosts[0]!, id: "named", displayName: "Mia & Sam" },
    { ...demoPosts[1]!, id: "unnamed", displayName: undefined },
    { ...demoPosts[2]!, id: "spaces", displayName: "   " }
  ]} />);
  expect(screen.getByText("Mia & Sam")).toBeInTheDocument();
  expect(screen.queryByText("A guest")).not.toBeInTheDocument();
  expect(document.querySelectorAll(".avatar")).toHaveLength(1);
  expect(document.querySelectorAll("time")).toHaveLength(3);
});
