/**
 * Tiny line-based syntax highlighter for the Enclave IDE. Good enough to make
 * Python / SQL / R / Markdown readable; not a parser.
 */

export type Lang = "python" | "sql" | "r" | "markdown" | "text";

export type TokenType =
  | "plain"
  | "comment"
  | "string"
  | "number"
  | "keyword"
  | "builtin"
  | "func"
  | "constant"
  | "operator"
  | "decorator"
  | "heading"
  | "punct";

export interface Token {
  t: TokenType;
  v: string;
}

export function langFor(fileName: string): Lang {
  const ext = fileName.split(".").pop()?.toLowerCase();
  if (ext === "py") return "python";
  if (ext === "sql") return "sql";
  if (ext === "r") return "r";
  if (ext === "md") return "markdown";
  return "text";
}

export const LANG_LABEL: Record<Lang, string> = {
  python: "Python",
  sql: "SQL",
  r: "R",
  markdown: "Markdown",
  text: "Plain text",
};

const PY_KW = "and|as|assert|async|await|break|class|continue|def|del|elif|else|except|finally|for|from|global|if|import|in|is|lambda|nonlocal|not|or|pass|raise|return|try|while|with|yield";
const PY_BUILTIN = "print|len|range|sum|min|max|round|sorted|list|dict|set|tuple|str|int|float|bool|enumerate|zip|map|filter|abs|any|all|open|type|isinstance";
const SQL_KW =
  "select|from|where|group|by|order|having|join|left|right|inner|outer|on|using|as|and|or|not|in|is|null|limit|with|case|when|then|else|end|distinct|union|all|asc|desc|between|like";
const SQL_FN = "count|avg|sum|min|max|round|coalesce|percentile_cont|stddev|median";
const R_KW = "function|if|else|for|while|repeat|in|next|break|return|library|require";

interface Rule {
  re: RegExp;
  t: TokenType | ((m: string) => TokenType);
}

function rules(lang: Lang): Rule[] {
  switch (lang) {
    case "python":
      return [
        { re: /#.*/y, t: "comment" },
        { re: /[rRbBfF]{0,2}("""[^]*?("""|$)|'''[^]*?('''|$)|"(?:\\.|[^"\\])*"?|'(?:\\.|[^'\\])*'?)/y, t: "string" },
        { re: /@[A-Za-z_][\w.]*/y, t: "decorator" },
        { re: /\b(?:\d+\.?\d*(?:e[+-]?\d+)?|\.\d+)\b/iy, t: "number" },
        { re: new RegExp(`\\b(?:True|False|None)\\b`, "y"), t: "constant" },
        { re: new RegExp(`\\b(?:${PY_KW})\\b`, "y"), t: "keyword" },
        { re: new RegExp(`\\b(?:${PY_BUILTIN})\\b(?=\\s*\\()`, "y"), t: "builtin" },
        { re: /\b[A-Za-z_]\w*(?=\s*\()/y, t: "func" },
        { re: /[A-Za-z_]\w*/y, t: "plain" },
        { re: /[=+\-*/%<>!&|^~]+/y, t: "operator" },
        { re: /[()[\]{}.,:;]/y, t: "punct" },
      ];
    case "sql":
      return [
        { re: /--.*/y, t: "comment" },
        { re: /'(?:''|[^'])*'?/y, t: "string" },
        { re: /\b\d+\.?\d*\b/y, t: "number" },
        { re: new RegExp(`\\b(?:${SQL_FN})\\b(?=\\s*\\()`, "iy"), t: "func" },
        { re: new RegExp(`\\b(?:${SQL_KW})\\b`, "iy"), t: "keyword" },
        { re: /[A-Za-z_]\w*/y, t: "plain" },
        { re: /[=<>!*+\-/%]+/y, t: "operator" },
        { re: /[(),.;]/y, t: "punct" },
      ];
    case "r":
      return [
        { re: /#.*/y, t: "comment" },
        { re: /"(?:\\.|[^"\\])*"?|'(?:\\.|[^'\\])*'?/y, t: "string" },
        { re: /\b\d+\.?\d*L?\b/y, t: "number" },
        { re: /\b(?:TRUE|FALSE|NULL|NA|Inf)\b/y, t: "constant" },
        { re: new RegExp(`\\b(?:${R_KW})\\b`, "y"), t: "keyword" },
        { re: /\b[A-Za-z_.][\w.]*(?=\s*\()/y, t: "func" },
        { re: /[A-Za-z_.][\w.]*/y, t: "plain" },
        { re: /<-|->|%>%|\|>|[=+\-*/<>!&|$~^]+/y, t: "operator" },
        { re: /[()[\]{},;]/y, t: "punct" },
      ];
    case "markdown":
      return [
        { re: /^#{1,6} .*/y, t: "heading" },
        { re: /`[^`]*`?/y, t: "string" },
        { re: /\*\*[^*]+\*\*/y, t: "keyword" },
        { re: /^\s*(?:[-*+]|\d+\.)(?= )/y, t: "operator" },
        { re: /\[[^\]]*\]\([^)]*\)/y, t: "func" },
      ];
    default:
      return [];
  }
}

const CACHE = new Map<Lang, Rule[]>();

/** Tokenize one line. Anything no rule matches is emitted as plain text. */
export function tokenizeLine(line: string, lang: Lang): Token[] {
  let rs = CACHE.get(lang);
  if (!rs) {
    rs = rules(lang);
    CACHE.set(lang, rs);
  }
  if (rs.length === 0 || line.length === 0) return [{ t: "plain", v: line }];
  const out: Token[] = [];
  let i = 0;
  let plain = "";
  const flush = () => {
    if (plain) {
      out.push({ t: "plain", v: plain });
      plain = "";
    }
  };
  while (i < line.length) {
    let matched = false;
    for (const r of rs) {
      r.re.lastIndex = i;
      const m = r.re.exec(line);
      if (m && m[0].length > 0) {
        const t = typeof r.t === "function" ? r.t(m[0]) : r.t;
        if (t === "plain") plain += m[0];
        else {
          flush();
          out.push({ t, v: m[0] });
        }
        i += m[0].length;
        matched = true;
        break;
      }
    }
    if (!matched) {
      plain += line[i];
      i++;
    }
  }
  flush();
  return out;
}
