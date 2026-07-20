const fs = require('fs');
const path = require('path');

function scan(dir) {
  fs.readdirSync(dir).forEach(f => {
    const p = path.join(dir, f);
    if (fs.statSync(p).isDirectory()) {
      scan(p);
    } else if (p.endsWith('.tsx') || p.endsWith('.ts')) {
      const content = fs.readFileSync(p, 'utf8');
      content.split('\n').forEach((line, i) => {
        if (line.includes('lucide-react')) {
          console.log(`[LUCIDE] ${p}:${i+1} -> ${line.trim()}`);
        }
        if (line.includes('คุณ') && (line.includes('name:') || line.includes('DEFAULT') || line.includes('placeholder'))) {
          console.log(`[PLACEHOLDER_NAME] ${p}:${i+1} -> ${line.trim()}`);
        }
        if (line.includes('ใช้งาน Tirak Chat อยู่')) {
          console.log(`[PLACEHOLDER_ABOUT] ${p}:${i+1} -> ${line.trim()}`);
        }
        if (line.includes('setTimeout') && !line.includes('clearTimeout')) {
          console.log(`[SETTIMEOUT] ${p}:${i+1} -> ${line.trim()}`);
        }
        // Match emoji
        const emojiMatch = line.match(/[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F000}-\u{1F02F}\u{1F0A0}-\u{1F0FF}\u{1F100}-\u{1F64F}\u{1F680}-\u{1F6FF}\u{1F910}-\u{1F96B}\u{1F980}-\u{1F9E0}]/u);
        if (emojiMatch) {
          console.log(`[EMOJI] ${p}:${i+1} -> ${line.trim()}`);
        }
      });
    }
  });
}

scan(path.join(__dirname, '../../src'));
