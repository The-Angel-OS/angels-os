/**
 * Mock @payload-config for Storybook.
 *
 * Components that transitively import '@payload-config' would pull in
 * server-side Node.js modules (pg, sharp, etc.) that break in the
 * browser-based Storybook webpack bundle.
 *
 * This stub exports an empty config so those imports resolve cleanly.
 */
export default {}
