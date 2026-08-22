import React, { useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import rehypeKatex from 'rehype-katex';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import 'katex/dist/katex.min.css';
import { normalizeAiResponseMarkdown } from '../utils/aiResponseMarkdown';

interface AiResponseRendererProps {
  response: string;
}

export const AiResponseRenderer: React.FC<AiResponseRendererProps> = ({ response }) => {
  const normalizedResponse = useMemo(() => normalizeAiResponseMarkdown(response), [response]);

  return (
    <div className="ai-response-markdown select-text text-xs leading-relaxed">
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[[rehypeKatex, { strict: false, throwOnError: false }]]}
        components={{
          a: ({ children, ...props }) => (
            <a {...props} target="_blank" rel="noreferrer">
              {children}
            </a>
          ),
        }}
      >
        {normalizedResponse}
      </ReactMarkdown>
    </div>
  );
};
