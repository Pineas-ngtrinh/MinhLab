const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

function sourceFiles(root) {
  const result = [];
  function walk(directory) {
    if (!fs.existsSync(directory)) return;
    for (const entry of fs.readdirSync(directory, {withFileTypes:true})) {
      const name = path.join(directory, entry.name);
      if (entry.isDirectory()) walk(name);
      else if (entry.isFile() && /\.[cm]?[jt]sx?$/.test(name) && !/\.d\.ts$/.test(name)
        && !/[/\\](test|__tests__)[/\\]|\.test\.[jt]sx?$/.test(name)) result.push(name);
    }
  }
  walk(path.join(root, 'app'));
  walk(path.join(root, 'src'));
  if (fs.existsSync(path.join(root, 'proxy.ts'))) result.push(path.join(root, 'proxy.ts'));
  return result.sort();
}

function importsOf(source) {
  const dependencies = [];
  function add(literal, typeOnly = false) {
    if (literal && ts.isStringLiteralLike(literal)) dependencies.push({name:literal.text, typeOnly});
  }
  function visit(node) {
    if (ts.isImportDeclaration(node)) {
      const clause = node.importClause;
      const bindings = clause?.namedBindings;
      const typeOnly = clause?.isTypeOnly || (!clause?.name && bindings && ts.isNamedImports(bindings)
        && bindings.elements.length > 0 && bindings.elements.every(item => item.isTypeOnly));
      add(node.moduleSpecifier, Boolean(typeOnly));
    } else if (ts.isExportDeclaration(node)) {
      const typeOnly = node.isTypeOnly || (node.exportClause && ts.isNamedExports(node.exportClause)
        && node.exportClause.elements.length > 0 && node.exportClause.elements.every(item => item.isTypeOnly));
      add(node.moduleSpecifier, Boolean(typeOnly));
    } else if (ts.isImportEqualsDeclaration(node) && ts.isExternalModuleReference(node.moduleReference)) {
      add(node.moduleReference.expression, node.isTypeOnly);
    } else if (ts.isImportTypeNode(node) && ts.isLiteralTypeNode(node.argument)) {
      add(node.argument.literal, true);
    } else if (ts.isCallExpression(node) && (node.expression.kind === ts.SyntaxKind.ImportKeyword
      || (ts.isIdentifier(node.expression) && node.expression.text === 'require'))) {
      add(node.arguments[0]);
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
  return dependencies;
}

function analyzeArchitecture(root, {includeGraph = false} = {}) {
  const configPath = path.join(root, 'tsconfig.json');
  const config = fs.existsSync(configPath) ? ts.readConfigFile(configPath, ts.sys.readFile).config : {};
  const options = ts.convertCompilerOptionsFromJson(config.compilerOptions || {}, root).options;
  const relative = name => path.relative(root, name).split(path.sep).join('/');
  const nodes = new Map();
  const violations = [];
  const add = (file, rule, detail) => violations.push({file:relative(file), rule, detail});
  for (const file of sourceFiles(root)) {
    const source = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true);
    nodes.set(file, {source, dependencies:importsOf(source), client:source.statements.some(statement =>
      ts.isExpressionStatement(statement) && ts.isStringLiteral(statement.expression)
      && statement.expression.text === 'use client')});
  }
  const serverPath = name => /^src\/(server|services|repositories|integrations)\//.test(name)
    || /^src\/lib\/(db|auth-session)\.ts$/.test(name);
  const purePath = name => /^src\/(domain|contracts)\//.test(name)
    || name === 'src/lib/auth-roles.ts'
    || (name.startsWith('src/lib/quote/') && !/\/(cli|ml)\//.test(name));
  const edges = new Map();
  for (const [file, node] of nodes) {
    const name = relative(file);
    const pure = purePath(name);
    const application = /^src\/services\/[^/]+\//.test(name);
    const route = name.startsWith('app/api/');
    const dependencies = [];
    for (const dependency of node.dependencies) {
      const resolved = ts.resolveModuleName(dependency.name, file, options, ts.sys).resolvedModule;
      const target = resolved ? path.resolve(resolved.resolvedFileName) : undefined;
      const targetName = target ? relative(target) : dependency.name;
      if (target && nodes.has(target)) dependencies.push({...dependency, target});
      if (pure && ((targetName.startsWith('src/') || targetName.startsWith('app/')) && !purePath(targetName)
        || !dependency.name.startsWith('.') && !dependency.name.startsWith('@/') && !nodes.has(target))) {
        add(file, 'pure-dependency', dependency.name);
      }
      if (application && ((targetName.startsWith('src/') || targetName.startsWith('app/'))
        && !targetName.startsWith(`src/services/${name.split('/')[2]}/`) && !purePath(targetName) && targetName !== 'src/lib/errors.ts'
        || dependency.name.startsWith('node:') && dependency.name !== 'node:crypto'
        || /^(pg|react|next)(\/|$)|^@aws-sdk\/|^@payos\//.test(dependency.name))) {
        add(file, 'application-adapter', dependency.name);
      }
      if (route && (targetName.startsWith('src/repositories/') || targetName === 'src/lib/db.ts')
        && name !== 'app/api/health/route.ts') add(file, 'route-persistence', dependency.name);
      const fromModule = name.match(/^src\/services\/([^/]+)\//)?.[1];
      const toModule = targetName.match(/^src\/services\/([^/]+)\//)?.[1];
      if (fromModule && toModule && fromModule !== toModule && !targetName.endsWith('/index.ts')) {
        add(file, 'module-private-import', dependency.name);
      }
      if (node.client && serverPath(targetName)) add(file, 'client-server-import', dependency.name);
      if (node.client && /^(node:|pg$|next\/(headers|server)$|@aws-sdk\/|@payos\/)/.test(dependency.name)) {
        add(file, 'client-server-import', dependency.name);
      }
      if (name.startsWith('src/repositories/') && targetName.startsWith('src/services/') && !dependency.typeOnly) {
        add(file, 'repository-application', dependency.name);
      }
    }
    edges.set(file, dependencies);
    function inspect(ast) {
      if ((pure || application) && ts.isPropertyAccessExpression(ast) && ast.getText(node.source) === 'process.env') {
        add(file, 'ambient-config', 'Pass configuration explicitly.');
      }
      if (pure && ts.isCallExpression(ast) && ts.isIdentifier(ast.expression)
        && ['fetch', 'require', 'eval'].includes(ast.expression.text)) add(file, 'pure-io', ast.expression.text);
      if (application && ts.isCallExpression(ast) && ts.isIdentifier(ast.expression)
        && ast.expression.text === 'fetch') add(file, 'application-network', 'Use an injected adapter.');
      const moduleCall = ts.isCallExpression(ast) && (ast.expression.kind === ts.SyntaxKind.ImportKeyword
        || ts.isIdentifier(ast.expression) && ast.expression.text === 'require');
      if (moduleCall && (!ast.arguments[0] || !ts.isStringLiteralLike(ast.arguments[0]))) {
        add(file, 'nonliteral-import', 'Dependency paths must be statically inspectable.');
      }
      if ((route || application) && (ts.isStringLiteralLike(ast) || ts.isTemplateExpression(ast))
        && /^\s*(SELECT\b|INSERT\s+INTO\b|UPDATE\s+\w+\s+SET\b|DELETE\s+FROM\b|ALTER\s+TABLE\b|CREATE\s+TABLE\b)/i.test(
          ts.isTemplateExpression(ast) ? ast.head.text : ast.text)
        && name !== 'app/api/health/route.ts') add(file, 'inline-sql', 'SQL belongs in a repository.');
      ts.forEachChild(ast, inspect);
    }
    inspect(node.source);
  }
  // Detect transitive imports too: a UI barrel cannot hide a server dependency.
  for (const [entry, node] of nodes) {
    if (!node.client) continue;
    const visited = new Set([entry]);
    function visit(file, chain) {
      for (const edge of edges.get(file) || []) {
        if (visited.has(edge.target)) continue;
        visited.add(edge.target);
        const next = [...chain, relative(edge.target)];
        if (serverPath(relative(edge.target)) || relative(edge.target) === 'src/lib/db.ts') {
          add(entry, 'client-server-path', next.join(' -> '));
        } else visit(edge.target, next);
      }
      const dependency = nodes.get(file)?.dependencies.find(edge =>
        /^(node:|pg$|next\/(headers|server)$|@aws-sdk\/|@payos\/)/.test(edge.name));
      if (dependency) add(entry, 'client-server-package', [...chain, dependency.name].join(' -> '));
    }
    visit(entry, [relative(entry)]);
  }
  const active = new Set();
  const complete = new Set();
  function cycles(file, chain) {
    if (complete.has(file)) return;
    if (active.has(file)) {
      add(file, 'import-cycle', [...chain.slice(chain.indexOf(file)), file].map(relative).join(' -> '));
      return;
    }
    active.add(file);
    for (const edge of edges.get(file) || []) if (!edge.typeOnly) cycles(edge.target, [...chain, file]);
    active.delete(file);
    complete.add(file);
  }
  for (const file of nodes.keys()) cycles(file, []);
  const result = {files:nodes.size, violations};
  if (includeGraph) result.graph = [...nodes].map(([file, node]) => ({
    file: relative(file),
    lines: node.source.text.trimEnd().split(/\r?\n/).length,
    client: node.client,
    dependencies: (edges.get(file) || []).map(edge => ({
      file: relative(edge.target), typeOnly: Boolean(edge.typeOnly),
    })),
  }));
  return result;
}

module.exports = {analyzeArchitecture};
