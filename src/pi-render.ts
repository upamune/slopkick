import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

function resolveThemeModuleUrl(): string {
  const start = path.dirname(fileURLToPath(import.meta.url));
  let current = start;

  for (let i = 0; i < 8; i += 1) {
    const candidate = path.join(current, "node_modules", "@earendil-works", "pi-coding-agent", "dist", "modes", "interactive", "theme", "theme.js");
    if (existsSync(candidate)) return pathToFileURL(candidate).href;

    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }

  throw new Error("Could not resolve Pi theme module for slopchop rendering.");
}

const { getLanguageFromPath, highlightCode } = await import(resolveThemeModuleUrl()) as {
  getLanguageFromPath: (filePath: string) => string | undefined;
  highlightCode: (code: string, lang?: string) => string[];
};

export function detectPiLanguage(filePath: string): string | undefined {
  return getLanguageFromPath(filePath);
}

export function highlightCodeLineWithPi(text: string, language: string | undefined): string {
  if (text.length === 0) return "";
  return highlightCode(text, language)[0] ?? text;
}

function replaceTabs(text: string): string {
  return text.replace(/\t/g, "   ");
}

function tokenizeWords(text: string): string[] {
  return text.match(/\s+|[^\s]+/gu) ?? [];
}

function diffWordTokens(oldContent: string, newContent: string): Array<{ value: string; added?: boolean; removed?: boolean }> {
  const oldTokens = tokenizeWords(oldContent);
  const newTokens = tokenizeWords(newContent);
  const table = Array.from({ length: oldTokens.length + 1 }, () => new Uint16Array(newTokens.length + 1));

  for (let oldIndex = oldTokens.length - 1; oldIndex >= 0; oldIndex -= 1) {
    const current = table[oldIndex]!;
    const next = table[oldIndex + 1]!;
    for (let newIndex = newTokens.length - 1; newIndex >= 0; newIndex -= 1) {
      current[newIndex] = oldTokens[oldIndex] === newTokens[newIndex]
        ? next[newIndex + 1]! + 1
        : Math.max(next[newIndex]!, current[newIndex + 1]!);
    }
  }

  const parts: Array<{ value: string; added?: boolean; removed?: boolean }> = [];
  let oldIndex = 0;
  let newIndex = 0;

  while (oldIndex < oldTokens.length && newIndex < newTokens.length) {
    if (oldTokens[oldIndex] === newTokens[newIndex]) {
      parts.push({ value: oldTokens[oldIndex]! });
      oldIndex += 1;
      newIndex += 1;
      continue;
    }

    if (table[oldIndex + 1]![newIndex]! >= table[oldIndex]![newIndex + 1]!) {
      parts.push({ value: oldTokens[oldIndex]!, removed: true });
      oldIndex += 1;
      continue;
    }

    parts.push({ value: newTokens[newIndex]!, added: true });
    newIndex += 1;
  }

  while (oldIndex < oldTokens.length) {
    parts.push({ value: oldTokens[oldIndex]!, removed: true });
    oldIndex += 1;
  }

  while (newIndex < newTokens.length) {
    parts.push({ value: newTokens[newIndex]!, added: true });
    newIndex += 1;
  }

  return parts;
}

/**
 * Adapted from Pi's internal diff renderer so slopchop follows Pi's intra-line
 * diff highlighting behavior while still controlling its own gutters and
 * comment markers.
 */
export function renderPiIntraLineDiff(
  oldContent: string,
  newContent: string,
  inverse: (text: string) => string,
): { removedLine: string; addedLine: string } {
  const wordDiff = diffWordTokens(oldContent, newContent);

  let removedLine = "";
  let addedLine = "";
  let isFirstRemoved = true;
  let isFirstAdded = true;

  for (const part of wordDiff) {
    if (part.removed) {
      let value = replaceTabs(part.value);
      if (isFirstRemoved) {
        const leadingWs = value.match(/^(\s*)/)?.[1] ?? "";
        value = value.slice(leadingWs.length);
        removedLine += leadingWs;
        isFirstRemoved = false;
      }
      if (value) removedLine += inverse(value);
      continue;
    }

    if (part.added) {
      let value = replaceTabs(part.value);
      if (isFirstAdded) {
        const leadingWs = value.match(/^(\s*)/)?.[1] ?? "";
        value = value.slice(leadingWs.length);
        addedLine += leadingWs;
        isFirstAdded = false;
      }
      if (value) addedLine += inverse(value);
      continue;
    }

    const value = replaceTabs(part.value);
    removedLine += value;
    addedLine += value;
  }

  return { removedLine, addedLine };
}
