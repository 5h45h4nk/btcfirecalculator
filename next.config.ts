import type { NextConfig } from "next";

const isGithubActions = process.env.GITHUB_ACTIONS === "true";
const repo = process.env.GITHUB_REPOSITORY?.replace(/.*\//, "") ?? "";
const owner = process.env.GITHUB_REPOSITORY_OWNER?.toLowerCase() ?? "";
const isUserPage = repo.toLowerCase() === `${owner}.github.io`;
const basePath = isGithubActions && !isUserPage ? `/${repo}` : "";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  output: "export",
  images: { unoptimized: true },
  basePath,
  assetPrefix: basePath ? `${basePath}/` : undefined
};

export default nextConfig;
