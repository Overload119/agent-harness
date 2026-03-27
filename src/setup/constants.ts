import { HARNESS_DIR_NAME } from "../harness/paths";
import path from "path";

export const HARNESS_PATH = HARNESS_DIR_NAME;

export const TEMPLATE_VARIABLES = {
  path: HARNESS_PATH,
  bin_path: path.join(HARNESS_PATH, "bin"),
};
