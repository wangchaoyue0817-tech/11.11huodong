import {cp, lstat, mkdir, mkdtemp, readdir, readFile, rename, rm, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const projectDir = fileURLToPath(new URL('.', import.meta.url));
const manifestName = '.build-manifest.json';
const owner = 'jianx-static-build-v1';

async function filesIn(directory, prefix = '') {
  const files = [];
  for (const entry of await readdir(directory, {withFileTypes: true})) {
    const relative = path.posix.join(prefix, entry.name);
    if (entry.isSymbolicLink()) throw new Error(`Build does not accept symbolic links: ${relative}`);
    if (entry.isDirectory()) files.push(...await filesIn(path.join(directory, entry.name), relative));
    else if (entry.isFile()) files.push(relative);
    else throw new Error(`Unsupported build entry: ${relative}`);
  }
  return files.sort();
}

export async function buildSite({
  sourceDir = path.join(projectDir, 'public'),
  outDir = path.join(projectDir, 'dist')
} = {}) {
  sourceDir = path.resolve(sourceDir);
  outDir = path.resolve(outDir);
  const relation = path.relative(sourceDir, outDir);
  const reverse = path.relative(outDir, sourceDir);
  const isOutside = relative => relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative);
  if (!isOutside(relation) || !isOutside(reverse)) {
    throw new Error('Source and output must be separate directories');
  }
  const files = await filesIn(sourceDir);
  if (!files.includes('index.html')) throw new Error('public/index.html is required');
  let replace = false;
  try {
    if (!(await lstat(outDir)).isDirectory()) throw new Error('Build output is not a regular directory');
    const current = await filesIn(outDir);
    if (current.length) {
      let manifest;
      try {
        manifest = JSON.parse(await readFile(path.join(outDir, manifestName), 'utf8'));
      } catch {
        throw new Error('Existing output is not owned by this build; choose an empty output directory');
      }
      if (manifest.owner !== owner || !Array.isArray(manifest.files) ||
          current.some(file => file !== manifestName && !manifest.files.includes(file))) {
        throw new Error('Output contains unrelated files; no files were removed');
      }
    }
    replace = true;
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  await mkdir(path.dirname(outDir), {recursive: true});
  const staging = await mkdtemp(path.join(path.dirname(outDir), '.build-'));
  try {
    await cp(sourceDir, staging, {recursive: true, dereference: false});
    await writeFile(path.join(staging, manifestName), JSON.stringify({owner, files}, null, 2) + '\n');
    // Only the validated, generated output directory can be replaced.
    if (replace) await rm(outDir, {recursive: true});
    await rename(staging, outDir);
  } catch (error) {
    await rm(staging, {recursive: true, force: true});
    throw error;
  }
  return {outDir, files};
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const result = await buildSite();
    console.log(`Built ${result.files.length} files to ${result.outDir}`);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
