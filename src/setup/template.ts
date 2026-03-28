import { Liquid } from "liquidjs";
import path from "node:path";

export async function renderTemplateFile(filePath: string, variables: Record<string, string>): Promise<string> {
  const template = await Bun.file(filePath).text();
  const fileDir = path.dirname(filePath);
  const liquid = new Liquid({
    root: fileDir,
    fs: {
      dirname: (file: string) => path.dirname(file),
      sep: path.sep,
      resolve: (root: string, id: string) => (path.isAbsolute(id) ? id : path.join(root, id)),
      read: async (filepath: string) => {
        const { readFile } = await import("node:fs/promises");
        return readFile(filepath, "utf8");
      },
      readFile: async (filepath: string) => {
        const { readFile } = await import("node:fs/promises");
        return readFile(filepath, "utf8");
      },
      exists: async (filepath: string) => {
        const { access } = await import("node:fs/promises");
        try {
          await access(filepath);
          return true;
        } catch {
          return false;
        }
      },
    },
  });
  return liquid.parseAndRender(template, variables);
}
