import type { NextConfig } from "next"

// Static export: the site is plain files served by Workers static assets (LANDING-SPEC 2.2, option A).
const config: NextConfig = {
  output: "export",
  trailingSlash: true,
  images: { unoptimized: true },
}

export default config
