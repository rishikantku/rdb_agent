const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');

app.disableHardwareAcceleration();

app.whenReady().then(async () => {
  const win = new BrowserWindow({
    width: 512,
    height: 512,
    show: false,
    transparent: true,
    frame: false,
    webPreferences: {
      offscreen: true,
    },
  });

  const svgPath = path.resolve(__dirname, '../public/favicon.svg');
  const svgContent = fs.readFileSync(svgPath, 'utf8');

  // Wrap SVG in a zero-margin, full-bleed transparent page
  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          html, body {
            width: 512px;
            height: 512px;
            background: transparent;
            overflow: hidden;
            display: flex;
            align-items: center;
            justify-content: center;
          }
          svg {
            width: 512px;
            height: 512px;
            display: block;
          }
        </style>
      </head>
      <body>
        ${svgContent}
      </body>
    </html>
  `;

  await win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);

  // Wait a moment for rendering
  await new Promise(r => setTimeout(r, 400));

  const image = await win.webContents.capturePage({ x: 0, y: 0, width: 512, height: 512 });
  const pngBuffer = image.toPNG();

  fs.writeFileSync(path.resolve(__dirname, '../build/icon.png'), pngBuffer);
  fs.writeFileSync(path.resolve(__dirname, '../public/icon.png'), pngBuffer);

  console.log('✅ Rendered pixel-perfect transparent 512x512 icon.png');
  app.exit(0);
});
