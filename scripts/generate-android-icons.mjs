import sharp from 'sharp';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
const root='android/app/src/main/res';
const icon=await readFile('assets/brand-icon.svg');
const sizes={mdpi:48,hdpi:72,xhdpi:96,xxhdpi:144,xxxhdpi:192};
for(const [density,size] of Object.entries(sizes)){
 const target=join(root,'mipmap-'+density);
 await mkdir(target,{recursive:true});
 const png=await sharp(icon).resize(size,size).png().toBuffer();
 await writeFile(join(target,'ic_launcher.png'),png);
 // Circular legacy icon: use circular clip around the same approved artwork.
 const circle=Buffer.from('<svg width="'+size+'" height="'+size+'"><circle cx="'+size/2+'" cy="'+size/2+'" r="'+size/2+'" fill="white"/></svg>');
 await writeFile(join(target,'ic_launcher_round.png'),await sharp(png).composite([{input:circle,blend:'dest-in'}]).png().toBuffer());
}
const anydpi=join(root,'mipmap-anydpi-v26');
const nodpi=join(root,'drawable-nodpi');
await mkdir(anydpi,{recursive:true});
await mkdir(nodpi,{recursive:true});
// Adaptive foreground: put full icon in central 2/3 safe zone; Android may mask outer margins.
const layer=await sharp(icon).resize(288,288).png().toBuffer();
await writeFile(join(nodpi,'eu_biologo_foreground.png'),await sharp({create:{width:432,height:432,channels:4,background:{r:0,g:0,b:0,alpha:0}}}).composite([{input:layer,top:72,left:72}]).png().toBuffer());
await writeFile(join(nodpi,'eu_biologo_background.png'),await sharp({create:{width:432,height:432,channels:4,background:'#006b12'}}).png().toBuffer());
const xml='<?xml version="1.0" encoding="utf-8"?>\n<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">\n  <background android:drawable="@drawable/eu_biologo_background" />\n  <foreground android:drawable="@drawable/eu_biologo_foreground" />\n</adaptive-icon>\n';
await writeFile(join(anydpi,'ic_launcher.xml'),xml);
await writeFile(join(anydpi,'ic_launcher_round.xml'),xml);
console.log('Ícones gerados: 5 densidades + adaptive icon (EU SEREI BIOLOGO)');
