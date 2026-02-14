import React from "react";
import assert from "node:assert/strict";
import { test, beforeEach } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { InstallPrompt } from "@/components/shared/InstallPrompt";

beforeEach(() => {
  // Clear localStorage before each test
  if (typeof localStorage !== "undefined") {
    localStorage.clear();
  }
});

test("InstallPrompt renders nothing when no prompt event", () => {
  const markup = renderToStaticMarkup(<InstallPrompt />);

  // Should render empty since no beforeinstallprompt event
  assert.ok(markup === "");
});

test("InstallPrompt component is defined", () => {
  // Validate that the component exists and is a function
  assert.equal(typeof InstallPrompt, "function");
  assert.ok(InstallPrompt.name === "InstallPrompt");
});
