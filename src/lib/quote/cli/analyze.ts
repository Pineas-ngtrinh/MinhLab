import { readFile } from 'node:fs/promises';
import { analyzeStl } from '../stl/analyze';

async function main(): Promise<void> {
  const [command, filePath, ...options] = process.argv.slice(2);
  if (command !== 'analyze' || !filePath) {
    process.stderr.write('Cách dùng: analyze <file.stl> [--json]\n');
    process.exitCode = 2;
    return;
  }

  try {
    const file = await readFile(filePath);
    const features = analyzeStl(new Uint8Array(file.buffer, file.byteOffset, file.byteLength));
    const output = options.includes('--json')
      ? JSON.stringify(features)
      : JSON.stringify(features, null, 2);
    process.stdout.write(output + '\n');
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Không thể phân tích STL.';
    process.stderr.write(message + '\n');
    process.exitCode = 1;
  }
}

void main();
