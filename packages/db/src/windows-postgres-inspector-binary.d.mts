/** TypeScript contract for the fail-closed Windows test-only OS inspector resolver. */
export declare function resolveWindowsPostgresInspectorBinary(options?: {
  platform?: string;
  systemRoot?: string;
  statPath?: (path: string) => {
    isDirectory(): boolean;
    isFile(): boolean;
    isSymbolicLink(): boolean;
  };
}): string;
