### **Comprehensive Plan for Advanced Shape Support in Liquid Glass Plugin**

#### **1. Project Goal**

To evolve the Liquid Glass plugin to support a wider variety of shapes, including ellipses, rotated objects, and complex vectors, while retaining the fast, non-destructive workflow for standard rectangles. This will be achieved through a hybrid approach that intelligently selects the appropriate rendering method based on the user's selection.

#### **2. Core Principles**

*   **Preserve Editability:** The default workflow for simple, un-rotated shapes (rectangles, ellipses) will remain non-destructive. The original shape will be preserved.
*   **Graceful Degradation:** For complex shapes or rotated simple shapes where the non-destructive method is not possible, the plugin will use a more robust (but destructive) flattening method. The user will be implicitly notified of this by the change in the layer structure.
*   **Intelligent Detection:** The plugin's core logic will automatically detect the type of selection and choose the correct rendering path without requiring user intervention.

#### **3. Implementation Phases**

This project will be broken down into four distinct phases:

**Phase 1: Build Process and Code Refactoring**

The UI logic will become significantly more complex. To ensure maintainability, the first step is to refactor the UI code into a modern TypeScript build process.

1.  **Create `src/ui/index.ts`:** Move all existing JavaScript and shader code from `index.html` into this new file.
2.  **Install Bundler:** Add a lightweight bundler like `esbuild` to the project's `devDependencies` to process the UI code.
3.  **Update `package.json`:** Modify the `build` and `watch` scripts to compile both `src/code.ts` (the plugin's main logic) and `src/ui/index.ts` (the UI logic).
4.  **Update `index.html`:** Replace the large inline `<script>` with a single `<script src="./index.js"></script>` tag that loads the compiled UI bundle.

**Phase 2: Enhancing the Simple Shape Workflow**

This phase extends the current, non-destructive method to support ellipses and circles and updates the UI to handle dynamic actions.

1.  **Update UI (`index.html` & `ui.ts`):**
    *   The main action button will be dynamic.
        *   By default, it will be labeled "**Create New**" and will create a new rounded rectangle LG element.
        *   When a user selects one or more non-LG shapes on the canvas, the button label will change to "**Apply Effect**".

2.  **Update WebGL Shader (`ui.ts`):**
    *   Add a new Signed Distance Function (SDF) for ellipses, `sdEllipse`, to the fragment shader.
    *   Introduce a new `uniform` (e.g., `int u_shapeType`) to tell the shader whether to use the `sdRoundedBox` (for rectangles) or `sdEllipse` (for ellipses) function.

3.  **Update Figma Logic (`code.ts`):**
    *   Modify the `onSelectionChange` and `onDocumentChange` handlers to detect if the selected node is a `RECTANGLE` or an `ELLIPSE`.
    *   When sending data to the UI for a simple shape, include the new `shapeType` parameter so the shader can select the correct SDF function.

**Phase 3: Implementing the Complex Shape Workflow**

This phase introduces the new, more robust method for handling complex or rotated shapes.

1.  **Add SDF Generation Library (`ui.ts`):**
    *   Install a lightweight SDF generation library (e.g., `tiny-sdf`) as a dependency for the UI.

2.  **Update Figma Logic (`code.ts`):**
    *   Create a new function, `createOrUpdateLgFromSelection(params)`. This function will be the new entry point for applying the effect to an *existing* selection.
    *   **Detection Logic:** Inside this function, check for the following conditions on the selected node(s):
        *   Is it something other than a non-rotated `RECTANGLE` or `ELLIPSE`? (e.g., `VECTOR`, `TEXT`, `GROUP`, `BOOLEAN_OPERATION`).
        *   Is it a `RECTANGLE` or `ELLIPSE` with `rotation !== 0`?
    *   **Flattening:** If any of the above conditions are met, the plugin will:
        1.  Use `figma.flatten(figma.currentPage.selection)` to create a new `VectorNode`.
        2.  Replace the user's original selection with this new vector node.
        3.  This flattened vector will become the new "Refraction Layer".
    *   **SVG Export:** Export the flattened `VectorNode` as an SVG string using `node.exportAsync({ format: 'SVG' })`.
    *   **Data Transfer:** Send the captured background image, the SVG data string, and the node's dimensions to the UI.

3.  **Update UI Logic (`ui.ts`):**
    *   **SDF Texture Generation:** When the UI receives SVG data, it will:
        1.  Use an offscreen 2D canvas to draw the SVG path, creating a black-and-white mask.
        2.  Use the `tiny-sdf` library to process the canvas's pixel data into a distance field.
        3.  Load this distance field data into a new WebGL texture (`u_sdfTexture`).
    *   **Update Shader:** Modify the fragment shader to read from `u_sdfTexture` instead of calculating the SDF mathematically. The distance value from the texture will drive the rest of the distortion and blur effects.

**Phase 4: Final Integration**

This phase ties everything together into a seamless user experience.

1.  **Update `onSelectionChange`:** When a new object is selected, the plugin will check if it's an existing LG element.
    *   If it is, it will load its parameters into the UI for editing.
    *   If it is not, it will change the main button's text to "**Apply Effect**".
    *   If the selection is cleared, the button will revert to "**Create New**".

2.  **Implement "Apply Effect" Logic:** Clicking the "Apply Effect" button will trigger the `createOrUpdateLgFromSelection` function. This function will intelligently decide which workflow to use:
    *   **Simple Path (Non-destructive):** If the selection is an un-rotated `RECTANGLE` or `ELLIPSE`, the plugin will apply the effect directly without altering the original shape.
    *   **Complex Path (Flattening):** For any other shape type (vectors, groups, rotated simple shapes), the plugin will use the flattening workflow described in Phase 3.

3.  **Refine `updateLgElement`:** The existing update logic will now primarily handle parameter changes for already-created LG elements, delegating the initial creation/application logic to the new function.

By following this plan, the plugin will become significantly more powerful and versatile, providing a robust solution for a wide range of design use cases.