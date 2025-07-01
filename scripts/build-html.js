const fs = require('fs');
const path = require('path');

function buildHTML() {
  console.log('Building HTML with inlined JavaScript...');
  
  // Read the HTML template
  const templatePath = path.join(__dirname, '../src/ui/template.html');
  const template = fs.readFileSync(templatePath, 'utf8');
  
  // Read the bundled JavaScript
  const jsPath = path.join(__dirname, '../dist/ui-bundle.js');
  const bundledJS = fs.readFileSync(jsPath, 'utf8');
  
  // Read the CSS
  const cssPath = path.join(__dirname, '../src/ui/styles/main.css');
  const css = fs.readFileSync(cssPath, 'utf8');
  
  // Replace the CSS link and JS script with inline content
  let html = template.replace('<link rel="stylesheet" href="styles/main.css">', `<style>\n${css}\n</style>`);
  html = html.replace('<script src="index.js"></script>', `<script>\n${bundledJS}\n</script>`);
  
  // Write the final HTML
  const outputPath = path.join(__dirname, '../dist/ui/index.html');
  fs.writeFileSync(outputPath, html);
  
  console.log('HTML build completed successfully');
}

if (require.main === module) {
  buildHTML();
}

module.exports = buildHTML;
