import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { analyze, detectProjectType, findApis, findComponents, findHooks, findPages, generateFileTree } from "../src/index.js";

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

  it("does not classify app router utility or framework support files as pages", () => {
    const root = makeProject({
      "app/(dashboard)/dashboard/page.tsx": "export default function DashboardPage() { return <main />; }",
      "app/(dashboard)/dashboard/utils/dashboard.utils.ts": "export const formatDashboard = () => 'ok';",
      "app/(dashboard)/dashboard/layout.tsx": "export default function Layout({ children }: { children: React.ReactNode }) { return <>{children}</>; }",
      "app/(dashboard)/dashboard/loading.tsx": "export default function Loading() { return <div />; }",
      "app/(dashboard)/dashboard/error.tsx": "export default function ErrorBoundary() { return <div />; }",
      "app/(dashboard)/dashboard/route.ts": "export async function GET() { return Response.json({ ok: true }); }"
    });

    const pages = findPages(root);

    expect(pages).toHaveLength(1);
    expect(pages[0]).toMatchObject({
      name: "DashboardPage",
      filePath: "app/(dashboard)/dashboard/page.tsx"
    });
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

  it("preserves dependency traversal for app router pages", async () => {
    const root = makeProject({
      "app/dashboard/page.tsx": `
        import { DashboardShell } from "../../components/DashboardShell";
        export default function DashboardPage() {
          return <DashboardShell />;
        }
      `,
      "components/DashboardShell.tsx": `
        import { StatsGrid } from "./StatsGrid";
        import { useDashboard } from "../hooks/useDashboard";
        export function DashboardShell() {
          useDashboard();
          return <StatsGrid />;
        }
      `,
      "components/StatsGrid.tsx": `
        export function StatsGrid() {
          return <section>Stats</section>;
        }
      `,
      "hooks/useDashboard.ts": `
        export function useDashboard() {
          return fetch("/api/dashboard");
        }
      `
    });

    const graph = await analyze(root, { writeJson: false });
    const page = graph.pages.find((entry) => entry.filePath === "app/dashboard/page.tsx");

    expect(page).toBeDefined();
    expect(graph.edges.some((edge) => edge.source === page?.id && edge.relationshipType === "renders")).toBe(true);
    expect(graph.edges.some((edge) => edge.relationshipType === "uses")).toBe(true);
    expect(graph.edges.some((edge) => edge.relationshipType === "calls")).toBe(true);
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

  it("detects Expo projects from package.json", () => {
    const root = makeProject({
      "package.json": JSON.stringify({
        dependencies: {
          expo: "^52.0.0"
        }
      })
    });

    expect(detectProjectType(root)).toBe("expo");
  });

  it("detects React Native screens as pages", () => {
    const root = makeProject({
      "src/screens/DashboardScreen.tsx": `
        export default function DashboardScreen() {
          return <View />;
        }
      `
    });

    expect(findPages(root)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: "DashboardScreen",
          filePath: "src/screens/DashboardScreen.tsx"
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

  it("does not mark a navigation-registered screen as unused", async () => {
    const root = makeProject({
      "App.tsx": `
        import { createNativeStackNavigator } from "@react-navigation/native-stack";
        import HomeScreen from "./screens/HomeScreen";

        const Stack = createNativeStackNavigator();

        export default function App() {
          return (
            <Stack.Navigator>
              <Stack.Screen name="Home" component={HomeScreen} />
            </Stack.Navigator>
          );
        }
      `,
      "screens/HomeScreen.tsx": `
        export default function HomeScreen() {
          return <View />;
        }
      `
    });

    const graph = await analyze(root, { writeJson: false });
    const homeScreen = graph.components.find((entry) => entry.filePath === "screens/HomeScreen.tsx");

    expect(homeScreen).toMatchObject({
      isUnused: false
    });
  });

  it("does not mark a barrel re-exported provider as unused", async () => {
    const root = makeProject({
      "App.tsx": `
        import { AdsProvider } from "./src/ads";

        export default function App() {
          return <AdsProvider />;
        }
      `,
      "src/ads/index.ts": `
        export { AdsProvider } from "./AdsContext";
      `,
      "src/ads/AdsContext.tsx": `
        export function AdsProvider() {
          return <View />;
        }
      `
    });

    const graph = await analyze(root, { writeJson: false });
    const adsProvider = graph.components.find((entry) => entry.filePath === "src/ads/AdsContext.tsx");

    expect(adsProvider).toMatchObject({
      isUnused: false
    });
  });

  it("does not mark a provider rendered from App.tsx as unused", async () => {
    const root = makeProject({
      "App.tsx": `
        import { InterviewProvider } from "./contexts/InterviewContext";

        export default function App() {
          return (
            <InterviewProvider>
              <View />
            </InterviewProvider>
          );
        }
      `,
      "contexts/InterviewContext.tsx": `
        export function InterviewProvider({ children }: { children?: React.ReactNode }) {
          return <>{children}</>;
        }
      `,
      "components/UnusedWidget.tsx": `
        export function UnusedWidget() {
          return <aside>Unused</aside>;
        }
      `
    });

    const graph = await analyze(root, { writeJson: false });
    const provider = graph.components.find((entry) => entry.filePath === "contexts/InterviewContext.tsx");
    const unusedWidget = graph.components.find((entry) => entry.filePath === "components/UnusedWidget.tsx");

    expect(provider).toMatchObject({
      isUnused: false
    });
    expect(unusedWidget).toMatchObject({
      isUnused: true
    });
  });

  it("detects a circular dependency between two components", async () => {
    const root = makeProject({
      "components/ComponentA.tsx": `
        import { ComponentB } from "./ComponentB";
        export function ComponentA() {
          return <ComponentB />;
        }
      `,
      "components/ComponentB.tsx": `
        import { ComponentA } from "./ComponentA";
        export function ComponentB() {
          return <ComponentA />;
        }
      `
    });

    const graph = await analyze(root, { writeJson: false });
    const componentA = graph.components.find((entry) => entry.name === "ComponentA");
    const componentB = graph.components.find((entry) => entry.name === "ComponentB");

    expect(componentA?.hasCircularDependency).toBe(true);
    expect(componentB?.hasCircularDependency).toBe(true);
    expect(componentA?.circularDependencyChain).toEqual(["ComponentA", "ComponentB", "ComponentA"]);
    expect(componentB?.circularDependencyChain).toEqual(["ComponentA", "ComponentB", "ComponentA"]);
  });

  it("detects a prop passed through four components as prop drilling", async () => {
    const root = makeProject({
      "pages/index.tsx": `
        import { ComponentA } from "../components/ComponentA";
        export default function HomePage() {
          return <ComponentA userId="123" />;
        }
      `,
      "components/ComponentA.tsx": `
        import { ComponentB } from "./ComponentB";
        export function ComponentA() {
          return <ComponentB userId="123" />;
        }
      `,
      "components/ComponentB.tsx": `
        import { ComponentC } from "./ComponentC";
        export function ComponentB() {
          return <ComponentC userId="123" />;
        }
      `,
      "components/ComponentC.tsx": `
        import { ComponentD } from "./ComponentD";
        export function ComponentC() {
          return <ComponentD userId="123" />;
        }
      `,
      "components/ComponentD.tsx": `
        export function ComponentD() {
          return <div />;
        }
      `
    });

    const graph = await analyze(root, { writeJson: false });

    for (const componentName of ["ComponentA", "ComponentB", "ComponentC", "ComponentD"]) {
      const component = graph.components.find((entry) => entry.name === componentName);
      expect(component?.hasPropDrilling).toBe(true);
      expect(component?.propDrillingDetails).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            propName: "userId",
            chain: ["ComponentA", "ComponentB", "ComponentC", "ComponentD"],
            depth: 4
          })
        ])
      );
    }
  });

  it("does not flag a prop passed through only two components as prop drilling", async () => {
    const root = makeProject({
      "pages/index.tsx": `
        import { ComponentA } from "../components/ComponentA";
        export default function HomePage() {
          return <ComponentA userId="123" />;
        }
      `,
      "components/ComponentA.tsx": `
        import { ComponentB } from "./ComponentB";
        export function ComponentA() {
          return <ComponentB userId="123" />;
        }
      `,
      "components/ComponentB.tsx": `
        export function ComponentB() {
          return <div />;
        }
      `
    });

    const graph = await analyze(root, { writeJson: false });

    expect(graph.components.every((component) => component.hasPropDrilling === false)).toBe(true);
    expect(graph.components.every((component) => component.propDrillingDetails === undefined)).toBe(true);
  });

  it("does not mark Expo layout files as unused", async () => {
    const root = makeProject({
      "package.json": JSON.stringify({
        dependencies: {
          expo: "^52.0.0"
        }
      }),
      "src/app/_layout.tsx": `
        export default function RootLayout() {
          return <Stack />;
        }
      `,
      "src/app/dashboard.tsx": `
        export default function DashboardScreen() {
          return <View />;
        }
      `
    });

    const graph = await analyze(root, { writeJson: false });
    const layout = graph.components.find((component) => component.filePath === "src/app/_layout.tsx");

    expect(graph.projectType).toBe("expo");
    expect(layout).toMatchObject({
      isUnused: false
    });
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
