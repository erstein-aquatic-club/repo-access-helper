import React from "react";
import assert from "node:assert/strict";
import { test } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { ProgressBar } from "@/pages/Progress";

test("ProgressBar renders with correct label and value", () => {
  const markup = renderToStaticMarkup(
    <ProgressBar label="Difficulté" value={3.2} max={5} />,
  );

  assert.ok(markup.includes("Difficulté"));
  assert.ok(markup.includes("3.2"));
});

test("ProgressBar handles null value", () => {
  const markup = renderToStaticMarkup(
    <ProgressBar label="Performance" value={null} max={5} />,
  );

  assert.ok(markup.includes("Performance"));
  assert.ok(markup.includes("-"));
});
