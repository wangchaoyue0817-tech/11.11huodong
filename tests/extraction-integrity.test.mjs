import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile, readdir, stat} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root = fileURLToPath(new URL('../public/', import.meta.url));
async function filesIn(directory) {
  const files = [];
  for (const entry of await readdir(directory, {withFileTypes: true})) {
    const filename = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await filesIn(filename));
    else if (entry.isFile()) files.push(filename);
  }
  return files;
}

function staticReferences(source) {
  const refs = new Set();
  const patterns = [
    /\b(?:src|href|poster)\s*=\s*["'`]([^"'`]+)["'`]/g,
    /\burl\(\s*["']?([^"')]+)["']?\s*\)/g,
    /@import\s+["']([^"']+)["']/g,
    /\b(?:import|export)\s+(?:[^;\n]*?\s+from\s*)?["']([^"']+)["']/g,
    /\bimport\s*\(\s*["']([^"']+)["']\s*\)/g,
    /["'`](assets\/[^"'`]+)["'`]/g,
    /["'`]((?:\.\/|\.\.\/)?[\w./-]+\.(?:css|js|mjs|html)(?:[?#][^"'`]*)?)["'`]/g
  ];
  for (const pattern of patterns) {
    for (const match of source.matchAll(pattern)) refs.add(match[1].trim());
  }
  return [...refs].filter(ref => ref && !/^(?:[a-z][a-z\d+.-]*:|\/\/|#|\?)/i.test(ref));
}

test('HTML, CSS and JavaScript local resources and module imports all exist', async () => {
  const missing = [];
  for (const filename of await filesIn(root)) {
    if (!/\.(?:html|css|js|mjs)$/.test(filename)) continue;
    const source = await readFile(filename, 'utf8');
    for (const reference of staticReferences(source)) {
      const pathname = reference.split(/[?#]/)[0];
      if (!pathname || pathname.includes('${')) continue;
      const target = pathname.startsWith('/') ? path.resolve(root, `.${pathname}`) : path.resolve(path.dirname(filename), pathname);
      if (path.relative(root, target).startsWith('..')) {
        missing.push(`${path.relative(root, filename)} escapes public: ${reference}`);
        continue;
      }
      try {
        assert.ok((await stat(target)).isFile());
      } catch {
        missing.push(`${path.relative(root, filename)} → ${reference}`);
      }
    }
    // Dynamic icon helpers build their URL from these literal icon names.
    for (const match of source.matchAll(/\bglyph\(\s*['"]([\w-]+)['"]/g)) {
      try { await stat(path.join(root, 'assets/icons', `${match[1]}.svg`)); }
      catch { missing.push(`${path.relative(root, filename)} → icon ${match[1]}`); }
    }
    if (/icon-map\.js$|expert-catalog\.js$/.test(filename)) {
      for (const match of source.matchAll(/["']([\w-]+\.svg)["']/g)) {
        try { await stat(path.join(root, 'assets/icons', match[1])); }
        catch { missing.push(`${path.relative(root, filename)} → icon ${match[1]}`); }
      }
    }
  }
  assert.deepEqual(missing, [], missing.join('\n'));
});

test('extracted project contains only the requested modules and no React build dependency', async () => {
  const files = await filesIn(root);
  const paths = files.map(filename => path.relative(root, filename));
  assert.deepEqual(paths.filter(filename => /(?:^|\/)(?:skin(?:[-/.]|$)|skin-src|node_modules)|\.[jt]sx$/i.test(filename)), []);
  const packageJson = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
  assert.deepEqual(packageJson.dependencies || {}, {});
  assert.deepEqual(packageJson.devDependencies || {}, {});
  const forbidden = [];
  for (const filename of files.filter(filename => /\.(?:html|js|css)$/.test(filename))) {
    const source = await readFile(filename, 'utf8');
    if (/from\s*['"](?:react|react-dom)|skin-src\/|skin-alignment\.css|皮肤管理|AI\s*肌肤检测|鉴皮肤/.test(source)) {
      forbidden.push(path.relative(root, filename));
    }
  }
  assert.deepEqual(forbidden, [], `Excluded module content remains in: ${forbidden.join(', ')}`);
});

test('navigation exposes only home, expert, card, lottery and prizes', async () => {
  const expected = new Set(['home', 'expert', 'card', 'lottery', 'prizes']);
  const shell = await readFile(path.join(root, 'site-shell.js'), 'utf8');
  const routeMap = shell.match(/\broutes\s*=\s*\{([^}]+)\}/)?.[1];
  assert.ok(routeMap, 'The shell must declare its supported routes');
  const routes = [...routeMap.matchAll(/(?:['"]([\w-]+)['"]|([\w-]+))\s*:/g)].map(match => match[1] || match[2]);
  assert.deepEqual(new Set(routes), expected);
  for (const filename of (await filesIn(root)).filter(filename => /\.(?:html|js)$/.test(filename))) {
    const source = await readFile(filename, 'utf8');
    for (const match of source.matchAll(/\b(?:jianxNavigate|navigate|jianxRoute)\(\s*['"]([\w-]+)['"]/g)) {
      assert.ok(expected.has(match[1]), `${path.relative(root, filename)} navigates to excluded route ${match[1]}`);
    }
  }
});
