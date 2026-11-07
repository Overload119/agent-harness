export function indentLines(text: string, start: number, end: number, outdent: boolean) {
  const lineStart = start === 0 ? 0 : text.lastIndexOf("\n", start - 1) + 1;
  // A selection ending at the next line's start does not include that line.
  const lastSelected = end > start && text[end - 1] === "\n" ? end - 1 : end;
  const nextNewline = text.indexOf("\n", lastSelected);
  const lineEnd = nextNewline === -1 ? text.length : nextNewline;
  let offset = lineStart;
  let nextStart = start;
  let nextEnd = end;
  const replacement = text.slice(lineStart, lineEnd).split("\n").map(line => {
    const removed = outdent ? Math.min(2, line.match(/^ */)![0].length) : 0;
    const delta = outdent ? -removed : 2;
    if (offset <= start) nextStart += outdent ? -Math.min(removed, start - offset) : delta;
    if (offset <= end) nextEnd += outdent ? -Math.min(removed, end - offset) : delta;
    offset += line.length + 1;
    return outdent ? line.slice(removed) : `  ${line}`;
  }).join("\n");
  return { text: text.slice(0, lineStart) + replacement + text.slice(lineEnd), start: nextStart, end: nextEnd };
}
