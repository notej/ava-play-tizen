/**
 * Network helpers. On a Tizen TV requests go straight to the provider. In a desktop browser they are
 * routed through the dev proxy in vite.config.js (CORS, custom User-Agent, HLS segment rewriting).
 */
export const isTizen = () => typeof window !== 'undefined' && typeof window.tizen !== 'undefined';

// True when served by the Vite dev server (any address), false in the packaged TV app
const isLocalDev = () => typeof location !== 'undefined' && Boolean(import.meta.env && import.meta.env.DEV);

export function viaProxy(url, userAgent = '') {
  if (!url || isTizen() || !isLocalDev() || !/^https?:/i.test(url)) return url;
  return `/__proxy?url=${encodeURIComponent(url)}${userAgent ? `&ua=${encodeURIComponent(userAgent)}` : ''}`;
}
