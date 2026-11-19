const path = require('node:path');
const {analyzeArchitecture} = require('../lib/architecture.cjs');
const result = analyzeArchitecture(path.resolve(__dirname, '../..'));
for (const issue of result.violations) process.stderr.write(`${issue.file}: [${issue.rule}] ${issue.detail}\n`);
process.stdout.write(`Architecture: ${result.files} files, ${result.violations.length} violations.\n`);
process.exitCode = result.violations.length ? 1 : 0;
