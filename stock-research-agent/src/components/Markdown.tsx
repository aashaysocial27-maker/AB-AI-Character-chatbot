import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

/** Renders model output as GitHub-flavoured Markdown. Raw HTML is not rendered. */
export function Markdown({ text }: { text: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        a: ({ children, href }) => (
          <a href={href} target="_blank" rel="noreferrer noopener">
            {children}
          </a>
        ),
      }}
    >
      {text}
    </ReactMarkdown>
  );
}
