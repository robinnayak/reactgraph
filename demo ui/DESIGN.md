# The Design System: Technical Elegance & Tonal Precision

## 1. Overview & Creative North Star: "The Logical Architect"
This design system is built for the high-performance developer who demands both density and beauty. Our Creative North Star is **The Logical Architect**. Unlike standard dashboard templates that feel "flat" or "blocked-in," this system treats the UI as a living codebase—structured, layered, and intentionally deep.

We move beyond the "standard blue box" by embracing **Tonal Layering** and **Editorial Precision**. By utilizing high-contrast typography scales and varying surface depths, we create a tool that feels less like a utility and more like a premium workstation. We break the rigid grid through intentional asymmetry in sidebars and overlapping node connections, ensuring the visualization feels organic yet mathematically precise.

---

## 2. Colors & Surface Philosophy
The palette is rooted in a deep, nocturnal spectrum. We use color not just for decoration, but as a functional primitive for semantic meaning.

### Surface Hierarchy & Nesting
To achieve a premium feel, we abandon the flat UI approach. We treat the interface as a series of physical layers.
- **The "No-Line" Rule:** Do not use `outline` or 1px borders to separate major sections. Use background shifts instead. For example, a `surface_container_low` sidebar should sit directly against a `surface` background. The change in tone is the boundary.
- **The Tiers:**
    - `surface_container_lowest` (#0a0e14): Used for the canvas or "void" where the graph lives.
    - `surface` (#10141a): The primary application background.
    - `surface_container_high` (#262a31): Used for active panels and interactive inspector elements.

### The "Glass & Gradient" Rule
While the tool is high-density, we avoid visual "heaviness." 
- **Floating Elements:** Modals and context menus must use **Glassmorphism**. Apply `surface_variant` at 70% opacity with a `20px` backdrop-blur. 
- **Signature Textures:** Nodes and primary CTAs should not be flat. Apply a subtle linear gradient from `primary` (#b4c5ff) to `primary_container` (#2563eb) at a 135-degree angle to give components a "machined" look.

---

## 3. Typography
We use **Inter** for its neutral, high-legibility character. The hierarchy is designed to mirror a code editor's logic: high-level headings provide context, while dense labels provide data.

*   **Display/Headline:** Use `headline-sm` (1.5rem) for main view titles. Keep tracking at -0.02em for a tighter, editorial feel.
*   **The Data Tier:** Most of the interface will live in `label-md` (0.75rem) and `body-sm` (0.75rem). This high-density approach allows for complex visualizations without overwhelming the user.
*   **Semantic Weights:** Use `Inter-SemiBold` for component names and `Inter-Regular` for properties. This contrast ensures that even at small sizes, the hierarchy is immediate.

---

## 4. Elevation & Depth
Depth is the difference between a "web page" and a "professional tool."

- **The Layering Principle:** Avoid shadows on static elements. Instead, "stack" tiers. Place a `surface_container_high` card on top of a `surface_container_low` background. This creates a natural, soft lift.
- **Ambient Shadows:** When an element must float (e.g., a node being dragged), use a shadow with a `40px` blur and `8%` opacity, tinted with the `primary` color (#b4c5ff). This mimics a glow rather than a dark drop shadow.
- **The Ghost Border Fallback:** If accessibility requires a border, use the **Ghost Border**: `outline_variant` (#434655) at 20% opacity. Never use 100% opaque borders for interior containers.

---

## 5. Components

### The Node (Custom Primitive)
The core of this system. Nodes are **Rounded Rectangles** with a `DEFAULT` radius (0.5rem/8px to 10px).
- **Page Nodes:** Primary Blue (`primary_container`).
- **Component Nodes:** Success Green (`tertiary_container`).
- **Hook Nodes:** Warning Orange (`#ea580c`).
- **Interactive State:** On hover, nodes should trigger a "subtle glow" using a 1px inner-border of the node's semantic color and an outer ambient shadow.

### Buttons
- **Primary:** Gradient-filled (Primary to Primary Container), `sm` radius (0.25rem).
- **Secondary/Tertiary:** Ghost style. No background, no border. Only a color shift on hover to `surface_container_highest`.

### Chips & Badges
- **Shared Badge:** Gold (`#f59e0b`). Use `label-sm` (0.6875rem) all-caps with 0.05em tracking for an "authoritative" metadata look.

### Input Fields
- **Design:** No bottom border or full border. Use a solid `surface_container_highest` background with a `sm` (4px) radius. On focus, transition the background to `surface_bright`.

### Lists & Cards
- **The Divider Ban:** Strictly forbid `1px` divider lines between list items. Use vertical whitespace (spacing scale) or a 1-step tonal shift in the background on hover to define rows.

---

## 6. Do’s and Don’ts

### Do:
- **Use Intentional Asymmetry:** Align the main graph to the left and keep inspectors on the right to create a "working canvas" feel.
- **Embrace High Density:** It is okay to have small text if the hierarchy is clear. Professional users prefer seeing more data at once.
- **Use Tonal Shifts:** Always ask: "Can I define this area with a background color change instead of a line?"

### Don’t:
- **No Pure Black:** Never use `#000000`. Use `surface_container_lowest` (#0a0e14) to maintain depth and prevent "crushed" blacks on OLED screens.
- **No High-Contrast Borders:** Avoid the "bootstrap look." Standard `#30363d` borders should be used sparingly, mostly for the outermost layout shells.
- **No Default Shadows:** Standard "Drop Shadows" are forbidden. Use "Ambient Glows" or Tonal Layering.

---

*Director's Note: This system is about the "invisible" details. The way a surface subtly brightens on hover or the way a label sits exactly 12px from a node edge is what defines the premium experience. Precision is our signature.*