import * as React from "react";
import { createRoot } from "react-dom/client";

import Visualizer from "./visualizer";

const root = document.getElementById("app");

if (!root) {
  throw new Error("Missing #app mount node.");
}

createRoot(root).render(<Visualizer />);
