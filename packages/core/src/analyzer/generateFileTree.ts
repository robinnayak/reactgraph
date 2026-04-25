import fs from "node:fs/promises";
import path from "node:path";

const EXCLUDED_DIRECTORY_NAMES = new Set([
  "node_modules",
  ".next",
  ".expo",
  ".git",
  ".turbo",
  ".cache",
  "dist",
  "build",
  "android",
  "ios",
  ".vercel",
  "coverage"
]);

const EXCLUDED_FILE_PATTERNS = [/\.vsix$/i, /\.tgz$/i];
const MAX_DEPTH = 6;

interface TreeEntry {
  name: string;
  displayName: string;
  isDirectory: boolean;
  children: TreeEntry[];
}

function shouldExclude(name: string, isDirectory: boolean): boolean {
  if (isDirectory && EXCLUDED_DIRECTORY_NAMES.has(name)) {
    return true;
  }

  return EXCLUDED_FILE_PATTERNS.some((pattern) => pattern.test(name));
}

async function readTreeEntries(directoryPath: string, depth: number): Promise<TreeEntry[]> {
  if (depth >= MAX_DEPTH) {
    return [];
  }

  const dirents = await fs.readdir(directoryPath, { withFileTypes: true });
  const directories: TreeEntry[] = [];
  const files: TreeEntry[] = [];

  for (const dirent of dirents) {
    const isDirectory = dirent.isDirectory();
    if (!isDirectory && !dirent.isFile()) {
      continue;
    }

    if (shouldExclude(dirent.name, isDirectory)) {
      continue;
    }

    const entryPath = path.join(directoryPath, dirent.name);
    const entry: TreeEntry = {
      name: dirent.name,
      displayName: isDirectory ? `${dirent.name}/` : dirent.name,
      isDirectory,
      children: isDirectory ? await readTreeEntries(entryPath, depth + 1) : []
    };

    if (isDirectory) {
      directories.push(entry);
    } else {
      files.push(entry);
    }
  }

  const compareEntries = (left: TreeEntry, right: TreeEntry) => left.name.localeCompare(right.name);
  directories.sort(compareEntries);
  files.sort(compareEntries);

  return [...directories, ...files];
}

function formatTree(entries: TreeEntry[], prefix = ""): string[] {
  return entries.flatMap((entry, index) => {
    const isLast = index === entries.length - 1;
    const connector = isLast ? "└── " : "├── ";
    const lines = [`${prefix}${connector}${entry.displayName}`];

    if (entry.isDirectory && entry.children.length > 0) {
      const childPrefix = `${prefix}${isLast ? "    " : "│   "}`;
      lines.push(...formatTree(entry.children, childPrefix));
    }

    return lines;
  });
}

export async function generateFileTree(projectRoot: string): Promise<string> {
  const resolvedRoot = path.resolve(projectRoot);
  const rootStats = await fs.stat(resolvedRoot);
  if (!rootStats.isDirectory()) {
    throw new Error(`Project root is not a directory: ${resolvedRoot}`);
  }

  const rootName = path.basename(resolvedRoot);
  const entries = await readTreeEntries(resolvedRoot, 0);

  return [`${rootName}/`, ...formatTree(entries)].join("\n");
}
