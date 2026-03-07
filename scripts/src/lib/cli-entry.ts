import * as path from 'path';

export function isDirectCliEntry(expectedFileNames: string | string[]): boolean {
  const argvPath = process.argv[1];
  if (!argvPath) return false;

  const actual = path.basename(argvPath).toLowerCase();
  const expected = Array.isArray(expectedFileNames) ? expectedFileNames : [expectedFileNames];
  return expected.some(name => actual === name.toLowerCase());
}
