"use client";

/**
 * Scroll entrances are switched off: on a reference page, text must be there
 * the moment the reader scrolls to it (fast scrolling, find-in-page, anchors,
 * screenshots, print). The [data-reveal] attributes stay as harmless hooks;
 * the CSS only animates elements with .is-held, which nothing adds now.
 */
export function Reveal() {
  return null;
}
