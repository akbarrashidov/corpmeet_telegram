/**
 * @corpmeet/design — main entry.
 *
 * Re-exports the framework-agnostic layer (theme, animations, components).
 * Domain-heavy layer lives in "@corpmeet/design/complex" and is NOT re-exported here
 * to avoid pulling React Query / domain types into apps that only need design tokens.
 */

export * from "./theme";
export * from "./animations";
export * from "./components";
export * as tokens from "./tokens";
