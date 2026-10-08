/**
 * THE DRAWING, AS THE BROWSER ACTUALLY RECEIVES IT.
 *
 * scripts/verify-summary.ts checks the geometry: where every box and arrow
 * goes. It cannot see the markup, and the markup is where this component
 * broke.
 *
 * Both layouts — the row and the stacked column — are rendered at once and one
 * is hidden by CSS. Each drew its arrowhead from a `<marker>` it defined
 * itself, and both called it `id="arrow"`. An `id` is unique to the DOCUMENT,
 * not to the `<svg>` it sits in, so `url(#arrow)` in the second drawing
 * resolved to the marker inside the first one, and Chrome drew nothing: on a
 * phone the chain came out as six boxes joined by bare lines, with the
 * direction of the causation — the only thing the diagram is for — silently
 * absent. It did not look broken. It looked like a design decision.
 *
 * No typechecker sees that, and no test of layout() sees it either, because
 * nothing about it is wrong until two drawings exist on one page. So this
 * renders the real component and checks the two rules that failure broke:
 * every id appears once, and every `url(#…)` reference resolves inside the
 * same `<svg>` that makes it.
 */
import assert from "node:assert/strict";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { LectureSummaryView } from "../src/components/lectures/lecture-summary";

let failures = 0;
function check(name: string, fn: () => void) {
  try {
    fn();
    console.log(`  ok  ${name}`);
  } catch (error) {
    failures += 1;
    console.log(`  FAIL  ${name}`);
    console.log(`        ${(error as Error).message.split("\n")[0]}`);
  }
}

console.log("The summary, as markup");
console.log("");

function render(chain: string[], rtl: boolean) {
  return renderToStaticMarkup(
    React.createElement(LectureSummaryView, {
      idea: "فشل التروية يسبق هبوط الضغط، ولذلك الضغط الطبيعي لا ينفي الصدمة.",
      chain,
      points: [{ heading: "مخرج البول", body: "أقل من 0.5 مل/كغ/ساعة علامة مبكرة." }],
      labels: { summary: "الملخص", chain: "تسلسل المحاضرة", mustKnow: "لازم تعرفها" },
      rtl,
    })
  );
}

/** Every `<svg>…</svg>` in the markup, as its own string. */
function svgs(html: string): string[] {
  return html.match(/<svg[\s\S]*?<\/svg>/g) ?? [];
}

const CHAIN = ["فقد سوائل", "نقص الحجم", "انخفاض الضغط", "نقص التروية"];

check("both layouts are rendered, so CSS has something to choose between", () => {
  const found = svgs(render(CHAIN, true));
  assert.equal(found.length, 2, `expected the row and the column, got ${found.length} svg(s)`);
});

check("NO ID APPEARS TWICE IN THE DOCUMENT", () => {
  for (const rtl of [true, false]) {
    const html = render(CHAIN, rtl);
    const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]);
    const seen = new Set<string>();
    for (const id of ids) {
      assert.ok(!seen.has(id), `id "${id}" is used twice — the second use is dead`);
      seen.add(id);
    }
    assert.ok(ids.length > 0, "no ids at all, so this check is testing nothing");
  }
});

check("every url(#…) resolves inside the same svg that asks for it", () => {
  for (const rtl of [true, false]) {
    for (const svg of svgs(render(CHAIN, rtl))) {
      const refs = [...svg.matchAll(/url\(#([^)]+)\)/g)].map((m) => m[1]);
      assert.ok(refs.length > 0, "a drawing referenced no marker, so it has no arrowheads");
      for (const ref of refs) {
        assert.ok(
          svg.includes(`id="${ref}"`),
          `this svg points at #${ref}, which is defined in a different svg — the browser draws nothing`
        );
      }
    }
  }
});

check("the chain is still readable without the picture", () => {
  const html = render(CHAIN, true);
  /* The caption, not the whole document: every step also appears inside its
     own box, so searching the markup would pass even with the caption empty —
     and an empty caption is exactly what a screen reader gets left with. */
  const caption = html.match(/<figcaption[^>]*>([\s\S]*?)<\/figcaption>/)?.[1];
  assert.ok(caption, "the diagram has no text alternative at all");
  for (const step of CHAIN) {
    assert.ok(caption.includes(step), `"${step}" is drawn but missing from the caption`);
  }
});

check("A CHAIN TOO SHORT TO DRAW LEAVES NO EMPTY FIGURE BEHIND", () => {
  const html = render([], true);
  assert.equal(svgs(html).length, 0, "an empty chain still drew an svg");
  assert.ok(!html.includes("<figure"), "an empty chain still left a figure element");
  assert.ok(html.includes("الملخص"), "the summary itself disappeared with the chain");
});

console.log("");
console.log(
  failures === 0
    ? "Two drawings, two markers, one document."
    : `${failures} check(s) failed.`
);
process.exit(failures === 0 ? 0 : 1);
