import {
  helpCtaHref,
  helpCtaOpensProduct,
  type HelpBlock,
} from "@/lib/help/catalog";
import { PublicLink } from "../public-link";

export function ArticleBlocks({ blocks }: { blocks: HelpBlock[] }) {
  return (
    <>
      {blocks.map((block, i) => (
        <BlockView key={i} block={block} />
      ))}
    </>
  );
}

function BlockView({ block }: { block: HelpBlock }) {
  if (block.t === "p") return <p>{block.v}</p>;
  if (block.t === "h") return <h3>{block.v}</h3>;
  if (block.t === "note") return <p className="help-doc-note">{block.v}</p>;
  if (block.t === "ul") {
    return (
      <ul>
        {block.v.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    );
  }
  if (block.t === "ol") {
    return (
      <ol>
        {block.v.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ol>
    );
  }
  if (block.t === "table") {
    return (
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              {block.h.map((h) => (
                <th key={h}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {block.r.map((row, i) => (
              <tr key={i}>
                {row.map((cell, j) => (
                  <td key={j}>{cell}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }
  return (
    <p className="help-doc-cta">
      {block.v.map((c) =>
        helpCtaOpensProduct(c) ? (
          <a key={c.label} href={helpCtaHref(c)} target="_blank" rel="noreferrer">
            {c.label}
          </a>
        ) : (
          <PublicLink key={c.label} href={helpCtaHref(c)}>
            {c.label}
          </PublicLink>
        ),
      )}
    </p>
  );
}
