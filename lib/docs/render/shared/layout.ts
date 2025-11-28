// lib/docs/render/shared/layout.ts
import { baseDocStyles } from "./styles";

type RenderBaseHtmlOptions = {
  title: string;
  body: string;       // markup interno (es. <div class="page">...</div>)
  extraStyles?: string;
};

export function renderBaseHtml(opts: RenderBaseHtmlOptions): string {
  const { title, body, extraStyles } = opts;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>${title}</title>
  <style>
${baseDocStyles}
${extraStyles || ""}
  </style>
</head>
<body>
${body}
</body>
</html>`;
}
