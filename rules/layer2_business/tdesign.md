# TDesign Usage Guidelines

> Layer: Business
> Context: UI Component Library Usage

## 1. The Rule
*   **Always** use `tdesign-vue-next` components over raw HTML elements.
*   **Do not** override TDesign styles with `!important` unless absolutely necessary. use Design Tokens or CSS Variables instead.

## 2. Common Patterns

### Buttons
All primary actions must use `<t-button theme="primary">`.

### Forms
Use `<t-form>` with `rules` prop for validation. Do not write manual validation headers.

### Layout
Use `<t-row>` and `<t-col>` for grids. Avoid custom flexbox if the grid system suffices.
