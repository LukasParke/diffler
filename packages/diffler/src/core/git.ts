import { execFileSync } from "node:child_process";

export const README_PATH = "README.md";

export function hasChanges(path = README_PATH): boolean {
  try {
    execFileSync("git", ["diff", "--quiet", path], { stdio: "pipe" });
    return false;
  } catch {
    return true;
  }
}

export function commitAndPush(message: string, path = README_PATH): void {
  // execFileSync avoids interpolating the message (or path) into a shell
  // command; quotes or $(...) in a configured commit message must stay inert.
  execFileSync("git", ["add", path], { stdio: "inherit" });
  execFileSync("git", ["commit", "-m", message], { stdio: "inherit" });
  execFileSync("git", ["push"], { stdio: "inherit" });
}
