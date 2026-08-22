/**
 * Converts the LaTeX delimiters models commonly emit into remark-math's
 * dollar delimiters without touching fenced or inline code.
 */
export function normalizeAiResponseMarkdown(markdown: string): string {
  const protectedCode = /(```[\s\S]*?```|~~~[\s\S]*?~~~|`[^`\n]*`)/g;

  return markdown
    .split(protectedCode)
    .map((part, index) => {
      if (index % 2 === 1) return part;

      return part
        .replace(/\\\[/g, () => '\n$$\n')
        .replace(/\\\]/g, () => '\n$$\n')
        .replace(/\\\(/g, () => '$')
        .replace(/\\\)/g, () => '$');
    })
    .join('');
}
