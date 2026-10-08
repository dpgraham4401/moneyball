import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  // Project payroll CSVs are read from disk by path, so ship them with every project route.
  outputFileTracingIncludes: {
    "/projects/**": ["./data/**/*.csv"],
  },
  // Pre-project URLs redirect to the default project.
  async redirects() {
    return [
      { source: "/payroll", destination: "/projects/my-project/payroll", permanent: false },
      {
        source: "/payroll/employees/:employeeId",
        destination: "/projects/my-project/payroll/employees/:employeeId",
        permanent: false,
      },
    ];
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
