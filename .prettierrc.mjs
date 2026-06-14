// Root Prettier config — re-export the shared Shipyard preset.
// Keeping this a thin re-export means formatting stays defined in exactly one
// place (`@shipyard/config/prettier`) for the whole monorepo.
export { default } from '@shipyard/config/prettier';
