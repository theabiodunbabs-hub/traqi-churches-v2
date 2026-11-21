/** @type {import('next').NextConfig} */
export default {
  reactStrictMode: true,
  // The service worker must never be cached, so every visitor picks up fixes to it straight away
  async headers() {
    return [{ source: "/sw.js", headers: [{ key: "Cache-Control", value: "no-cache, no-store, must-revalidate" }, { key: "Service-Worker-Allowed", value: "/" }] }];
  },
};
