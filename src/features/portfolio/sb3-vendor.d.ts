declare module "scratchblocks" {
  const scratchblocks: {
    renderMatching: (selector?: string, options?: Record<string, unknown>) => void;
  };
  export default scratchblocks;
}

declare module "parse-sb3-blocks" {
  export function toScratchblocks(
    scriptId: string,
    project: unknown,
    targetName?: string,
    options?: Record<string, unknown>,
  ): string;
}
