import { Liquid } from "liquidjs";

const liquid = new Liquid({
  strictVariables: true,
});

export async function renderTemplateFile(filePath: string, variables: Record<string, string>): Promise<string> {
  const template = await Bun.file(filePath).text();
  return liquid.parseAndRender(template, variables);
}
