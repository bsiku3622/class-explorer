import { style } from "@vanilla-extract/css";

import { utilities } from "../tokens/layers.css";

export const visuallyHidden = style({
  "@layer": {
    [utilities]: {
      position: "absolute",
      width: 1,
      height: 1,
      padding: 0,
      margin: -1,
      overflow: "hidden",
      clip: "rect(0, 0, 0, 0)",
      whiteSpace: "nowrap",
      border: 0,
    },
  },
});
