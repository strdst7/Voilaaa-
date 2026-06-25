import fs from 'fs';
const stats = fs.statSync('/public/data/examples.json');
const buffer = Buffer.alloc(500);
const fd = fs.openSync('/public/data/examples.json', 'r');
fs.readSync(fd, buffer, 0, 500, Math.max(0, stats.size - 500));
fs.closeSync(fd);
console.log(buffer.toString());
