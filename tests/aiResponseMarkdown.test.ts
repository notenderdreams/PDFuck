import { describe, expect, test } from 'bun:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { AiResponseRenderer } from '../src/components/AiResponseRenderer';
import { normalizeAiResponseMarkdown } from '../src/utils/aiResponseMarkdown';

describe('normalizeAiResponseMarkdown', () => {
  test('normalizes inline and display LaTeX delimiters', () => {
    const source = String.raw`Mean \(\mu_X\) and density \[f_X(x)=e^{-x}\].`;
    expect(normalizeAiResponseMarkdown(source)).toBe('Mean $\\mu_X$ and density \n$$\nf_X(x)=e^{-x}\n$$\n.');
  });

  test('renders model Markdown as lists and accessible KaTeX markup', () => {
    const response = String.raw`This defines a Gaussian.

\[f_X(x)=\frac{1}{\sqrt{2\pi}}e^{-x^2/2}.\]

- \(\mu_X\) is the mean.
- \(C_X\) is the covariance matrix.`;
    const html = renderToStaticMarkup(React.createElement(AiResponseRenderer, { response }));

    expect(html).toContain('class="katex-display"');
    expect(html).toContain('<math');
    expect(html).toContain('<ul>');
    expect(html).toContain('<li>');
  });

  test('does not rewrite delimiters inside inline or fenced code', () => {
    const source = 'Use \\(x\\), not `\\(code\\)`.\n\n```tex\n\\[code block\\]\n```';
    const normalized = normalizeAiResponseMarkdown(source);
    expect(normalized).toContain('Use $x$');
    expect(normalized).toContain('`\\(code\\)`');
    expect(normalized).toContain(String.raw`\[code block\]`);
  });
});
