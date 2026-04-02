import fs from 'fs';
import path from 'path';

const src = "C:\\Users\\rafae\\.gemini\\antigravity\\brain\\89a3d5de-135d-47ef-8e65-977694abcd48\\priscila_caricature_icon_1775171117570.png";
const dests = [
  "public/icon-512x512.png",
  "public/icon-192x192.png",
  "public/apple-icon.png"
];

try {
  dests.forEach(dest => {
    fs.copyFileSync(src, path.resolve(dest));
    console.log(`Copiado para ${dest}`);
  });
} catch (err) {
  console.error("Erro na cópia:", err);
}
