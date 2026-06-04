import { execSync } from "node:child_process";

export const README_PATH = "README.md";

export function hasChanges(path = README_PATH): boolean {
  try {
    execSync(`git diff --quiet ${path}`, { stdio: "pipe" });
    return false;
  } catch {
    return true;
  }
}

export function commitAndPush(message: string, path = README_PATH): void {
  execSync(`git add ${path}`, { stdio: "inherit" });
  execSync(`git commit -m "${message}"`, { stdio: "inherit" });
  execSync("git push", { stdio: "inherit" });
}
