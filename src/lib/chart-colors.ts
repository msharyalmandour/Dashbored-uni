"use client";

import { useTheme } from "next-themes";
import * as React from "react";

// Validated categorical palette (see dataviz skill `references/palette.md`).
// Fixed hue order — never cycled, never reassigned by rank.
// Orange leads rather than blue: most charts here draw one series, and that one
// series should be the app's accent. Same eight validated colours, same fixed
// order from the second entry on — only the first two are swapped.
const CATEGORICAL = {
  light: ["#eb6834", "#2a78d6", "#1baf7a", "#eda100", "#e87ba4", "#008300", "#4a3aa7", "#e34948"],
  dark: ["#d95926", "#3987e5", "#199e70", "#c98500", "#d55181", "#008300", "#9085e9", "#e66767"],
};

const STATUS = {
  light: { good: "#0ca30c", warning: "#fab219", serious: "#ec835a", critical: "#d03b3b" },
  dark: { good: "#0ca30c", warning: "#fab219", serious: "#ec835a", critical: "#d03b3b" },
};

const CHROME = {
  light: { text: "#0b0b0b", muted: "#898781", grid: "#e1e0d9" },
  dark: { text: "#ffffff", muted: "#898781", grid: "#2c2c2a" },
};

// Single-hue sequential ramp (orange), light -> dark, for magnitude encodings.
// A sequential ramp only has to step monotonically in lightness; the hue is free,
// so it is the accent's.
const SEQUENTIAL_ORANGE = {
  light: ["#fde3cf", "#f9c199", "#f0965c", "#e0722a", "#a8511a", "#63300f"],
  dark: ["#fde3cf", "#f9c199", "#f0965c", "#d95926", "#a8511a", "#63300f"],
};

export function useChartTheme() {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => {
    // Hydration-safe mount flag — render the light-mode default first, then
    // switch to the resolved theme once mounted on the client.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);
  const mode: "light" | "dark" = mounted && resolvedTheme === "dark" ? "dark" : "light";

  return {
    mode,
    categorical: CATEGORICAL[mode],
    status: STATUS[mode],
    chrome: CHROME[mode],
    sequential: SEQUENTIAL_ORANGE[mode],
  };
}
