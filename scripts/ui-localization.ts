import ts from "typescript";
import type { Plugin } from "vite";

/** Both development and Railway must use this exact source-only transform. */
export function uiLocalizationPlugin(): Plugin {
  return {
    name: "source-authored-ui-language",
    enforce: "pre",
    transform(code, id) {
      const filename = id.replace(/\\/g, "/").split("?")[0];
      if (filename.includes("node_modules") ||
          (!filename.includes("/client/src/") && !/\/shared\/account-summary(?:-format)?\.ts$/.test(filename))) return;
      const transformed = localizeUiSource(code, filename);
      return transformed === code ? undefined : { code: transformed, map: null };
    },
  };
}

const marathi = /[\u0900-\u097f]/;
const attributes = new Set(["placeholder", "title", "alt", "aria-label", "description", "label",
  "subtitle", "emptyText", "helperText", "emptyMessage", "loadingText", "availability",
  "confirmText", "cancelText", "tooltip", "unitLabel", "buttonText", "errorText", "textValue"]);
const labels = new Set(["label", "title", "subtitle", "header", "head", "headers", "placeholder", "emptyText", "helperText"]);
const messageKeys = new Set(["title", "description", "message"]);
const skipCalls = new Set(["includes", "indexOf", "startsWith", "endsWith", "replace", "match", "split", "test"]);
export function normalizeUiText(text: string) { return text.replace(/\s+/g, " ").trim(); }
function jsxText(text: string) {
  const lines = text.replace(/\r\n?/g, "\n").split("\n");
  const last = lines.reduce((index, line, current) => /\S/.test(line) ? current : index, 0);
  return lines.map((raw, index) => {
    let line = raw.replace(/\t/g, " ");
    if (index) line = line.replace(/^ +/, "");
    if (index < lines.length - 1) line = line.replace(/ +$/, "");
    return line ? line + (index < last ? " " : "") : "";
  }).join("");
}
export function templateUiKeys(text: string): string[] {
  const scriptMessages: string[] = [];
  const html = text.replace(/<(style|script)\b[^>]*>[\s\S]*?<\/\1>/gi, block => {
    if (/^<script/i.test(block)) {
      for (const match of Array.from(block.matchAll(/\b(?:alert|confirm|showDownloadNotification)\(\s*(['"])([^'"\r\n]*)\1/g))) {
        scriptMessages.push(match[2]);
      }
    }
    return "";
  });
  const attributeText = Array.from(html.matchAll(/\b(?:alt|title|aria-label)="([^"]*)"/g)).map(match => match[1]);
  return [...html.split(/<[^>]*>/g), ...attributeText, ...scriptMessages]
    .map(normalizeUiText).filter(value => marathi.test(value));
}

/**
 * Only source-authored presentation literals are localized. Never walk the DOM
 * or translate fetched values, input values, enum values, comparisons or writes.
 * This same transform is used by the coverage inventory and the production build.
 */
export function localizeUiSource(source: string, filename: string, collect?: (text: string) => void) {
  if (!/\.(tsx?|jsx?)$/.test(filename) || !marathi.test(source) ||
      /\/(i18n|ui-language|ui-catalog|ui-localization)\./.test(filename)) return source;
  const tree = ts.createSourceFile(filename, source, ts.ScriptTarget.Latest, true,
    filename.endsWith("tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const edits: { start: number; end: number; text: string }[] = [];
  const displayFile = /\/lib\/.*(?:print|pdf|pledge-forms)/.test(filename);
  function propertyName(node: ts.Node) {
    return ts.isPropertyAssignment(node) && (ts.isIdentifier(node.name) || ts.isStringLiteral(node.name))
      ? node.name.text : "";
  }
  function context(node: ts.Node, renderedFallback = false) {
    let current = node.parent;
    for (let depth = 0; current && depth < 9; depth++, current = current.parent) {
      if (ts.isJsxAttribute(current)) return attributes.has(current.name.getText(tree)) ||
        (current.name.getText(tree) === "name" &&
          ["Area", "Bar", "Line", "Pie", "Radar", "RadialBar", "Scatter", "Funnel"]
            .includes(current.parent.parent.tagName.getText(tree)));
      if (ts.isBinaryExpression(current) && [
        ts.SyntaxKind.EqualsEqualsEqualsToken, ts.SyntaxKind.ExclamationEqualsEqualsToken,
        ts.SyntaxKind.EqualsEqualsToken, ts.SyntaxKind.ExclamationEqualsToken,
      ].includes(current.operatorToken.kind)) return false;
      if (ts.isCaseClause(current) || ts.isLiteralTypeNode(current) ||
          ts.isElementAccessExpression(current)) return false;
      if (ts.isCallExpression(current)) {
        const name = ts.isPropertyAccessExpression(current.expression)
          ? current.expression.name.text : current.expression.getText(tree);
        if (skipCalls.has(name)) return false;
        if (name === "push" && /excel|sheet|export/i.test(current.expression.getText(tree)) &&
            ts.isArrayLiteralExpression(node.parent)) return true;
        if (["alert", "confirm", "toast", "text", "uiText"].includes(name)) return true;
        if (displayFile && ["line", "moneyLines", "signatures"].includes(name)) return true;
        if (["min", "max", "length", "regex"].includes(name) && current.arguments.indexOf(node as ts.Expression) > 0) return true;
      }
      if (ts.isNewExpression(current) && current.expression.getText(tree) === "Error") return true;
      if (ts.isPropertyAssignment(current)) {
        const key = propertyName(current);
        if (["value", "key", "id", "type", "category", "narration", "accountNumber"].includes(key)) return false;
        if (labels.has(key) || /(?:Label|Text|Title|Note|Heading|Caption)$/.test(key)) return true;
        if (messageKeys.has(key)) {
          const parentText = current.parent.parent?.getText(tree).slice(0, 35) || "";
          if (/toast|Error|safeParse/.test(parentText)) return true;
          const owner = current.parent.parent;
          if (key === "message" && ts.isCallExpression(owner)) {
            const method = ts.isPropertyAccessExpression(owner.expression) ? owner.expression.name.text : "";
            if (["refine", "superRefine", "addIssue"].includes(method)) return true;
          }
        }
      }
      if (ts.isJsxExpression(current)) return !ts.isJsxAttribute(current.parent) ||
        attributes.has(current.parent.name.getText(tree));
      if (ts.isReturnStatement(current)) {
        let fn: ts.Node | undefined = current.parent;
        while (fn && !ts.isFunctionLike(fn)) fn = fn.parent;
        const name = fn && (ts.isFunctionDeclaration(fn) || ts.isMethodDeclaration(fn))
          ? fn.name?.getText(tree) : fn && ts.isVariableDeclaration(fn.parent) ? fn.parent.name.getText(tree) : "";
        const inlineJsx = fn && ts.isCallExpression(fn.parent) &&
          ts.isJsxExpression(fn.parent.parent) && !ts.isJsxAttribute(fn.parent.parent.parent);
        return renderedFallback || displayFile || !!inlineJsx || /(?:Label|Display|Caption|Title|Text|Period|Duration)$/.test(name || "");
      }
      if (ts.isVariableDeclaration(current) && /(?:Label|Text|Title|Note|Heading|Caption)$/.test(current.name.getText(tree))) return true;
      if (ts.isStatement(current) && !ts.isReturnStatement(current)) break;
    }
    return renderedFallback;
  }
  function replace(node: ts.Node, text: string) {
    edits.push({ start: node.getStart(tree), end: node.end, text });
  }
  function visit(node: ts.Node, renderedValue = false) {
    // Navigation names are authored route metadata, not customer names. Keep
    // their source values canonical and translate only where the menu renders.
    if (ts.isStringLiteral(node) && marathi.test(node.text)) {
      const property = node.parent;
      if (ts.isPropertyAssignment(property) && propertyName(property) === "name") {
        const object = property.parent;
        if (ts.isObjectLiteralExpression(object) &&
            ["href", "icon"].every(key => object.properties.some(candidate => propertyName(candidate) === key))) {
          collect?.(normalizeUiText(node.text));
          return;
        }
      }
    }
    if (ts.isJsxExpression(node) && !ts.isJsxAttribute(node.parent) &&
        node.expression && ts.isPropertyAccessExpression(node.expression) &&
        ["loanType", "metalType", "status", "interestRateType", "transactionType"].includes(node.expression.name.text)) {
      replace(node.expression, `__uiEnum(${node.expression.getText(tree)})`);
      return;
    }
    if (ts.isJsxExpression(node) && node.expression && ts.isPropertyAccessExpression(node.expression) &&
        ["message", "statusLabel", "riskLabel", "metalLabel"].includes(node.expression.name.text)) {
      replace(node.expression, `__uiMessage(${node.expression.getText(tree)})`);
      return;
    }
    if (ts.isPropertyAccessExpression(node) && node.name.text === "message" && context(node, renderedValue)) {
      replace(node, `__uiMessage(${node.getText(tree)})`);
      return;
    }
    const cashbookFile = /\/(?:pages\/(?:mobile-cashbook|reports\/(?:cashbook|cashbook-ledger|working-cashbook|account-ledger|ledger|working-capital))|lib\/cashbook-narration)\.tsx?$/.test(filename);
    if ((renderedValue || context(node)) &&
        ((cashbookFile && ts.isPropertyAccessExpression(node) && ["description", "narration", "particulars", "creditNarration", "debitNarration"].includes(node.name.text)) ||
         (ts.isCallExpression(node) && ["displayNarration", "cashbookNarration"].includes(node.expression.getText(tree))))) {
      replace(node, `__uiNarration(${node.getText(tree)})`);
      return;
    }
    if (ts.isJsxText(node) && marathi.test(node.text)) {
      const text = normalizeUiText(node.text);
      collect?.(text);
      // Preserve intentional spacing beside inline values; indentation is not content.
      replace(node, `{__uiText(${JSON.stringify(jsxText(node.text))})}`);
      return;
    }
    if (ts.isStringLiteral(node) && marathi.test(node.text) && context(node, renderedValue)) {
      const text = normalizeUiText(node.text);
      collect?.(text);
      const expression = `__uiText(${JSON.stringify(node.text)})`;
      replace(node, ts.isJsxAttribute(node.parent) ? `{${expression}}` : expression);
      return;
    }
    if ((ts.isTemplateExpression(node) || ts.isNoSubstitutionTemplateLiteral(node)) &&
        marathi.test(node.getText(tree)) &&
        (context(node, renderedValue) || /<[a-z][\w:-]*(?:\s|>)/i.test(node.getText(tree))) &&
        !ts.isTaggedTemplateExpression(node.parent)) {
      const pieces = ts.isTemplateExpression(node)
        ? [node.head.text, ...node.templateSpans.map(span => span.literal.text)] : [node.text];
      const text = pieces.map((piece, index) => piece + (index < pieces.length - 1 ? `{#${index}}` : "")).join("");
      templateUiKeys(text).forEach(value => collect?.(value));
      // Insert a tag, not a replacement of the whole subtree: nested static
      // labels in HTML helper calls must also be localized.
      edits.push({ start: node.getStart(tree), end: node.getStart(tree), text: "__uiTemplate" });
      if (ts.isTemplateExpression(node)) node.templateSpans.forEach(span => visit(span.expression, true));
      return;
    }
    ts.forEachChild(node, child => visit(child, renderedValue));
  }
  visit(tree);
  if (!edits.length) return source;
  for (const edit of edits.sort((a, b) => b.start - a.start)) {
    source = source.slice(0, edit.start) + edit.text + source.slice(edit.end);
  }
  return `import { uiText as __uiText, uiTemplate as __uiTemplate, uiMessage as __uiMessage, uiNarration as __uiNarration, uiEnum as __uiEnum } from "@shared/ui-language";\n${source}`;
}
