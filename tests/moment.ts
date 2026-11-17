import { createRequire } from "node:module";
import type { MomentFactory } from "../src/dateNotes/paths.ts";

export const moment: MomentFactory = createRequire(import.meta.url)("moment");
