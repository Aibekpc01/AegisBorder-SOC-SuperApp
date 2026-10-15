import { expect, it } from "vitest";
import { explainers } from "./explainers";
import { learningExamples } from "./learning-examples";

it("provides a practical example for every page in the platform guide", () => {
  expect(
    Object.keys(explainers).filter((path) => !learningExamples[path]),
  ).toEqual([]);
  expect(learningExamples.team).toContain("задачах");
  expect(learningExamples["security-analytics"]).toContain("500");
});
