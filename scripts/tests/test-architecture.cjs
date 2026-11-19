const assert = require('node:assert/strict');
const {test} = require('node:test');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {analyzeArchitecture} = require('../lib/architecture.cjs');

function inspect(files, options) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'minhlab-architecture-'));
  try {
    fs.writeFileSync(path.join(root, 'tsconfig.json'), JSON.stringify({compilerOptions:{
      baseUrl:'.', paths:{'@/*':['src/*']}, moduleResolution:'bundler', module:'esnext',
    }}));
    for (const [name, content] of Object.entries(files)) {
      const target = path.join(root, name);
      fs.mkdirSync(path.dirname(target), {recursive:true});
      fs.writeFileSync(target, content);
    }
    const result = analyzeArchitecture(root, options);
    return options?.includeGraph ? result : result.violations;
  } finally { fs.rmSync(root, {recursive:true, force:true}); }
}

test('optional graph resolves aliases, re-exports and literal dynamic imports, preserving type edges', () => {
  const result = inspect({
    'src/components/View.tsx': "'use client'; import type {ID} from '@/contracts/id'; import('../lib/lazy');",
    'src/contracts/id.ts': 'export type ID=string;',
    'src/lib/lazy.ts': "export {value} from './value';",
    'src/lib/value.ts': 'export const value=1;',
    'src/lib/test/ignored.test.ts': 'export const ignored=true;',
  }, {includeGraph: true});
  assert.equal(result.files, 4);
  assert.deepEqual(result.violations, []);
  assert.deepEqual(result.graph.find(node => node.file === 'src/components/View.tsx'), {
    file: 'src/components/View.tsx', lines: 1, client: true,
    dependencies: [{file: 'src/contracts/id.ts', typeOnly: true}, {file: 'src/lib/lazy.ts', typeOnly: false}],
  });
  assert.deepEqual(result.graph.find(node => node.file === 'src/lib/lazy.ts').dependencies,
    [{file: 'src/lib/value.ts', typeOnly: false}]);
});

test('allowed client contracts, domain rules and server composition pass', () => {
  assert.deepEqual(inspect({
    'src/components/View.tsx': "'use client'; import type {ID} from '@/contracts/orders'; export const value:ID='ok';",
    'src/contracts/orders.ts': 'export type ID=string;',
    'src/domain/orders/order.ts': 'export const allowed=true;',
    'src/server/orders.ts': "import {db} from '../repositories/orders'; export const value=db;",
    'src/repositories/orders.ts': 'export const db=1;',
  }), []);
});
test('client import through a neutral barrel cannot expose server code', () => {
  const issues = inspect({
    'src/components/View.tsx': "'use client'; import {db} from '@/lib/barrel';",
    'src/lib/barrel.ts': "export {db} from '../server/orders';",
    'src/server/orders.ts': 'export const db=1;',
  });
  assert(issues.some(issue => issue.rule === 'client-server-path'));
});
test('type-only server import is rejected while type-only cycles are allowed', () => {
  assert(inspect({'src/components/View.tsx':"'use client'; import type {ID} from '../server/orders';",
    'src/server/orders.ts':'export type ID=string;'}).some(issue => issue.rule === 'client-server-import'));
  assert.deepEqual(inspect({'src/contracts/a.ts':"import type {B} from './b'; export type A={b:B};",
    'src/contracts/b.ts':"import type {A} from './a'; export type B={a:A};"}), []);
});
test('alias, dynamic imports and CommonJS cannot hide server code', () => {
  for (const expression of ["import('@/server/orders')", "require('@/server/orders')"]) {
    assert(inspect({'src/components/View.tsx':`'use client'; const dependency=${expression};`,
      'src/server/orders.ts':'export const value=1;'}).some(issue => issue.rule === 'client-server-path'));
  }
});
test('pure modules reject IO, configuration and package dependencies', () => {
  const issues = inspect({'src/domain/orders/order.ts':"import pg from 'pg'; const config=process.env; fetch('/api');"});
  for (const rule of ['pure-dependency','ambient-config','pure-io']) assert(issues.some(issue => issue.rule === rule));
});
test('use cases and API routes reject inline SQL and repository coupling', () => {
  const issues = inspect({
    'src/services/orders/create.ts':"import {db} from '../../lib/db'; db.query(`INSERT INTO orders VALUES (1)`);",
    'src/lib/db.ts':'export const db={query:()=>{}};',
    'app/api/orders/route.ts':"export function GET(){return `SELECT * FROM orders`;}",
  });
  assert(issues.some(issue => issue.rule === 'application-adapter'));
  assert.equal(issues.filter(issue => issue.rule === 'inline-sql').length, 2);
});
test('every feature use case rejects infrastructure, ambient configuration and network calls', () => {
  for (const feature of ['auth', 'catalog', 'orders', 'future-feature']) {
    const issues = inspect({
      [`src/services/${feature}/use.ts`]: "import {db} from '../../lib/db'; const secret=process.env.SECRET; fetch('/external'); db.query('SELECT * FROM users');",
      'src/lib/db.ts': 'export const db={query:()=>{}};',
    });
    for (const rule of ['application-adapter', 'ambient-config', 'application-network', 'inline-sql']) {
      assert(issues.some(issue => issue.rule === rule), `${feature}: missing ${rule}`);
    }
  }
});
test('runtime cycles are rejected, including re-exports', () => {
  assert(inspect({'src/lib/a.ts':"export * from './b';",
    'src/lib/b.ts':"export * from './a';"}).some(issue => issue.rule === 'import-cycle'));
});
test('cross-module access uses the public entry point', () => {
  assert(inspect({'src/services/orders/use.ts':"import {pay} from '../payments/internal';",
    'src/services/payments/internal.ts':'export const pay=1;'}).some(issue => issue.rule === 'module-private-import'));
});
test('pure modules cannot hide adapters behind an unclassified helper', () => {
  assert(inspect({'src/domain/orders/order.ts':"import {value} from '../../lib/helper';",
    'src/lib/helper.ts':"export const value=process.env.DATABASE_URL;"})
    .some(issue => issue.rule === 'pure-dependency'));
});
test('inline import types and nonliteral imports cannot bypass the boundary', () => {
  assert(inspect({'src/components/View.tsx':"'use client'; type ID=import('../server/orders').ID;",
    'src/server/orders.ts':'export type ID=string;'}).some(issue => issue.rule === 'client-server-import'));
  assert(inspect({'src/components/View.tsx':"'use client'; const target='pg'; import(target);"})
    .some(issue => issue.rule === 'nonliteral-import'));
  assert(inspect({'src/components/View.tsx':"'use client'; import type {ID} from '../lib/barrel';",
    'src/lib/barrel.ts':"export type {ID} from '../server/orders';",
    'src/server/orders.ts':'export type ID=string;'}).some(issue => issue.rule === 'client-server-path'));
});
