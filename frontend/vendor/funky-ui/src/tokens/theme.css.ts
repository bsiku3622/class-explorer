/** `:root` 에 모든 `--fk-*` 변수를 씁니다 — fk.theme 레이어 */
import { globalStyle } from "@vanilla-extract/css";

import { theme } from "./layers.css";
import { ROOT_VALUES } from "./variables";

globalStyle(":root", { "@layer": { [theme]: { vars: { ...ROOT_VALUES } } } });
