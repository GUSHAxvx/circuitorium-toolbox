// 把 browser-check 报告里捕获的 .ecp（base64）还原成真实文件
// 用法：node tools/report-to-ecp.cjs <报告.json> <输出.ecp>

const fs = require('fs');

const [, , reportPath, outPath] = process.argv;
if (!reportPath || !outPath) {
  console.error('用法：node tools/report-to-ecp.cjs <报告.json> <输出.ecp>');
  process.exit(1);
}

// PowerShell 的 > 重定向在 Windows 上默认写 UTF-16LE，这里两种编码都认，并去掉 BOM
function readText(file) {
  const buf = fs.readFileSync(file);
  let text;
  if (buf.length >= 2 && buf[0] === 0xff && buf[1] === 0xfe) text = buf.toString('utf16le');
  else text = buf.toString('utf8');
  return text.replace(/^\uFEFF/, '');
}

const report = JSON.parse(readText(reportPath));
const hit = (report.evals || []).find((e) => typeof e.value === 'string' && e.value.includes('"b64"'));
if (!hit) {
  console.error('报告里没有找到带 b64 的结果');
  process.exit(1);
}
const parsed = JSON.parse(hit.value);
if (!parsed.b64) {
  console.error('结果里没有 b64 字段');
  process.exit(1);
}
fs.writeFileSync(outPath, Buffer.from(parsed.b64, 'base64'));
console.log(`已还原：${outPath}（${fs.statSync(outPath).size} 字节，页面里报的是 ${parsed.bytes} 字节）`);
