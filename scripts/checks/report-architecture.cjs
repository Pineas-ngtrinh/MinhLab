const path = require('node:path');
const {analyzeArchitecture} = require('../lib/architecture.cjs');

const result = analyzeArchitecture(path.resolve(__dirname, '../..'), {includeGraph: true});
if (process.argv.includes('--json')) {
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
} else {
  const groups = new Map();
  const incoming = new Map();
  const groupOf = file => file.startsWith('app/api/') ? 'app/api'
    : file.startsWith('app/') ? 'app/pages'
      : file.startsWith('src/') ? file.split('/').slice(0, 2).join('/') : file;
  const connections = new Map();
  for (const node of result.graph) {
    const group = groupOf(node.file);
    groups.set(group, (groups.get(group) || 0) + 1);
    for (const target of new Set(node.dependencies.filter(edge => !edge.typeOnly).map(edge => edge.file))) {
      if (!incoming.has(target)) incoming.set(target, new Set());
      incoming.get(target).add(node.file);
      const other = groupOf(target);
      if (group !== other) {
        const key = `${group} → ${other}`;
        connections.set(key, (connections.get(key) || 0) + 1);
      }
    }
  }
  const output = [
    '# Báo cáo cấu trúc từ code', '',
    'Sinh bằng `npm run --silent architecture:report`. Chạy lại sau khi đổi code; đây là snapshot, không phải tài liệu quyết định.', '',
    `Phạm vi: ${result.files} file JS/TS trong app/, src/ và proxy.ts; ${result.violations.length} vi phạm guard.`, '',
    'Không quét test, declaration, CSS, asset, scripts hay docs. Quan hệ là import nội bộ tĩnh (kể cả dynamic import có đường dẫn literal), không phải call graph, HTTP hay luồng dữ liệu. Import type-only được giữ trong JSON và loại khỏi thống kê phụ thuộc runtime. File không có caller chưa chắc là mã thừa: Next.js, worker và entry point có thể tải chúng.', '',
    '## Nhóm mã nguồn', '', '| Nhóm | Số file |', '| --- | ---: |',
    ...[...groups].sort(([a], [b]) => a.localeCompare(b)).map(([name, count]) => `| ${name} | ${count} |`), '',
    '## Quan hệ giữa các nhóm', '', '| Nhóm import → nhóm được import | Số cặp file runtime |', '| --- | ---: |',
    ...[...connections].sort(([a], [b]) => a.localeCompare(b)).map(([name, count]) => `| ${name} | ${count} |`), '',
    '## 10 file dài nhất cần đọc trước khi tách', '', '| File | Số dòng |', '| --- | ---: |',
    ...[...result.graph].sort((a, b) => b.lines - a.lines || a.file.localeCompare(b.file)).slice(0, 10)
      .map(node => `| ${node.file} | ${node.lines} |`), '',
    'Độ dài tệp giúp chọn nơi cần đọc trước khi cân nhắc tách mã.', '',
    '## 10 file có nhiều caller runtime nhất', '', '| File | Số file import trực tiếp |', '| --- | ---: |',
    ...[...incoming].sort(([a, x], [b, y]) => y.size - x.size || a.localeCompare(b)).slice(0, 10)
      .map(([file, callers]) => `| ${file} | ${callers.size} |`), '',
    '## Vi phạm guard', '',
    ...(result.violations.length ? result.violations.map(issue => `- ${issue.file}: [${issue.rule}] ${issue.detail}`) : ['Không phát hiện vi phạm trong phạm vi guard.']), '',
  ];
  process.stdout.write(output.join('\n'));
}
process.exitCode = result.violations.length ? 1 : 0;
