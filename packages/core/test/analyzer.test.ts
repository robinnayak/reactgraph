import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { analyze, findApis, findComponents, findHooks, findPages, generateFileTree } from "../src/index.js";

const tempDirs: string[] = [];
const fixturesDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "fixtures");

function makeProject(files: Record<string, string>): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "reactgraph-"));
  tempDirs.push(root);
  for (const [relativePath, contents] of Object.entries(files)) {
    const fullPath = path.join(root, relativePath);
    fs.mkdirSync(path.dirname(fullPath), { recursive: true });
    fs.writeFileSync(fullPath, contents, "utf8");
  }
  return root;
}

function readFixture(relativePath: string): string {
  return fs.readFileSync(path.join(fixturesDir, relativePath), "utf8");
}

function makeProjectFromFixtures(fixtures: string[]): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "reactgraph-"));
  tempDirs.push(root);

  for (const fixture of fixtures) {
    const fullPath = path.join(root, fixture);
    fs.mkdirSync(path.dirname(fullPath), { recursive: true });
    fs.writeFileSync(fullPath, readFixture(fixture), "utf8");
  }

  return root;
}

afterEach(() => {
  for (const dir of tempDirs.splice(0, tempDirs.length)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

describe("core analyzer", () => {
  it("finds pages in Next pages and app routers", () => {
    const root = makeProject({
      "pages/index.tsx": "export default function Home() { return <div />; }",
      "app/dashboard/page.tsx": "export default function DashboardPage() { return <main />; }"
    });

    const pages = findPages(root);
    expect(pages).toHaveLength(2);
    expect(pages.map((page) => page.filePath)).toContain("pages/index.tsx");
    expect(pages.map((page) => page.filePath)).toContain("app/dashboard/page.tsx");
  });

  it("extracts component props, hooks, apis, and edges", async () => {
    const root = makeProject({
      "pages/dashboard.tsx": `
        import { DashboardLayout } from "../components/DashboardLayout";
        import { StatsWidget } from "../components/StatsWidget";
        export default function DashboardPage() {
          return <DashboardLayout><StatsWidget initialData={[]} /></DashboardLayout>;
        }
      `,
      "components/DashboardLayout.tsx": `
        import type { ReactNode } from "react";
        import { useTheme } from "../hooks/useTheme";
        interface DashboardLayoutProps { children: ReactNode; }
        export function DashboardLayout({ children }: DashboardLayoutProps) {
          useTheme("dark");
          return <section>{children}</section>;
        }
      `,
      "components/StatsWidget.tsx": `
        type StatsWidgetProps = { initialData?: number[]; };
        export const StatsWidget = ({ initialData }: StatsWidgetProps) => <div>{initialData?.length}</div>;
      `,
      "hooks/useTheme.ts": `
        export function useTheme(defaultMode: "dark" | "light" = "dark") {
          return {
            mode: defaultMode,
            refresh: () => fetch("/api/theme", { method: "GET" })
          };
        }
      `
    });

    const components = findComponents(root);
    const hooks = findHooks(root);
    const apis = findApis(root);
    const graph = await analyze(root);

    expect(components).toHaveLength(2);
    expect(components.find((component) => component.name === "DashboardLayout")?.props).toEqual([
      { name: "children", type: "ReactNode", required: true }
    ]);
    expect(hooks[0]?.params[0]).toMatchObject({ name: "defaultMode", type: `"dark" | "light"` });
    expect(apis[0]).toMatchObject({ endpoint: "/api/theme", method: "GET" });
    expect(graph.edges.some((edge) => edge.relationshipType === "renders")).toBe(true);
    expect(graph.edges.some((edge) => edge.relationshipType === "uses")).toBe(true);
    expect(graph.edges.some((edge) => edge.relationshipType === "calls")).toBe(true);
    expect(fs.existsSync(path.join(root, "reactgraph.json"))).toBe(true);
  });

  it("finds components without props safely", () => {
    const root = makeProjectFromFixtures(["NoPropsComponent.tsx"]);

    expect(() => findComponents(root)).not.toThrow();
    expect(findComponents(root)).toEqual([
      expect.objectContaining({
        name: "NoPropsComponent",
        props: []
      })
    ]);
  });

  it("finds hooks without return type annotations", () => {
    const root = makeProjectFromFixtures(["useSimple.ts"]);

    expect(() => findHooks(root)).not.toThrow();
    expect(findHooks(root)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: "useSimple"
        })
      ])
    );
  });

  it("skips broken component files and continues scanning", () => {
    const root = makeProjectFromFixtures(["BrokenComponent.tsx", "NoPropsComponent.tsx"]);

    expect(() => findComponents(root)).not.toThrow();
    expect(findComponents(root)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: "NoPropsComponent"
        })
      ])
    );
  });

  it("ignores barrel re-exports without duplicating components", () => {
    const root = makeProjectFromFixtures(["index.ts", "MyButton.tsx", "MyCard.tsx"]);

    expect(() => findComponents(root)).not.toThrow();
    const components = findComponents(root);
    expect(components).toHaveLength(2);
    expect(components.map((component) => component.name).sort()).toEqual(["MyButton", "MyCard"]);
  });

  it("detects Next app router pages with exported page names", () => {
    const root = makeProjectFromFixtures(["app/dashboard/page.tsx"]);

    expect(findPages(root)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: "DashboardPage"
        })
      ])
    );
  });

  it("detects Next pages router pages with exported page names", () => {
    const root = makeProjectFromFixtures(["pages/index.tsx"]);

    expect(findPages(root)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: "HomePage"
        })
      ])
    );
  });

  it("detects api calls inside hooks", () => {
    const root = makeProjectFromFixtures(["useProducts.ts"]);

    expect(findApis(root)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          endpoint: "/api/products",
          method: "GET"
        })
      ])
    );
  });

  it("marks a component used by two pages as shared with usage count", async () => {
    const root = makeProject({
      "pages/home.tsx": `
        import { SharedWidget } from "../components/SharedWidget";
        export default function HomePage() {
          return <SharedWidget />;
        }
      `,
      "pages/about.tsx": `
        import { SharedWidget } from "../components/SharedWidget";
        export default function AboutPage() {
          return <SharedWidget />;
        }
      `,
      "components/SharedWidget.tsx": `
        export function SharedWidget() {
          return <div>Shared</div>;
        }
      `
    });

    const graph = await analyze(root, { writeJson: false });
    const component = graph.components.find((entry) => entry.name === "SharedWidget");

    expect(component).toMatchObject({
      isShared: true,
      usageCount: 2,
      shouldMoveToShared: true,
      isUnused: false
    });
    expect(component?.usedInPages).toHaveLength(2);
  });

  it("marks an unreferenced component as unused", async () => {
    const root = makeProject({
      "pages/index.tsx": `
        export default function HomePage() {
          return <main>Home</main>;
        }
      `,
      "components/UnusedWidget.tsx": `
        export function UnusedWidget() {
          return <aside>Unused</aside>;
        }
      `
    });

    const graph = await analyze(root, { writeJson: false });
    const component = graph.components.find((entry) => entry.name === "UnusedWidget");

    expect(component).toMatchObject({
      usageCount: 0,
      isUnused: true,
      unusedReason: "Not referenced by any page or component tree",
      shouldMoveToShared: false
    });
    expect(component?.usedInPages).toEqual([]);
  });

  it("generates a sorted file tree with exclusions and empty folders", async () => {
    const root = makeProject({
      "src/components/Button.tsx": "export const Button = () => null;",
      "src/components/forms/Field.tsx": "export const Field = () => null;",
      "src/utils/api.ts": "export const api = {};",
      "src/index.ts": "export * from './components/Button';",
      "empty/.gitkeep": "",
      ".env.example": "EXAMPLE=true",
      "package.json": "{\"name\":\"tree-test\"}",
      "archive.tgz": "skip me",
      "extension.vsix": "skip me",
      "node_modules/pkg/index.js": "skip me",
      "dist/output.js": "skip me"
    });

    const tree = await generateFileTree(root);
    const projectName = path.basename(root);

    expect(tree).toBe(
      [
        `${projectName}/`,
        "├── empty/",
        "│   └── .gitkeep",
        "├── src/",
        "│   ├── components/",
        "│   │   ├── forms/",
        "│   │   │   └── Field.tsx",
        "│   │   └── Button.tsx",
        "│   ├── utils/",
        "│   │   └── api.ts",
        "│   └── index.ts",
        "├── .env.example",
        "└── package.json"
      ].join("\n")
    );
  });

  it("caps file tree recursion at six levels", async () => {
    const root = makeProject({
      "one/two/three/four/five/six/seven/deep.ts": "export const deep = true;"
    });

    const tree = await generateFileTree(root);

    expect(tree).toContain("└── six/");
    expect(tree).not.toContain("seven/");
    expect(tree).not.toContain("deep.ts");
  });
});
