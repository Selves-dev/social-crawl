

const { writeFileSync, readFileSync } = require('fs');



const url = process.argv[2];
const outFile = process.argv[3] || 'src/utils/shared/crawlSearch/google-search.html';


if (!url) {
  console.error('Usage: node fetch-and-save-html.js <url> [outputFile]');
  process.exit(1);
}



(async () => {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0',
        'Accept': 'text/html',
      },
    });
    const html = await response.text();
    writeFileSync(outFile, html);
    console.log(`Saved HTML to ${outFile}`);

// Parse and print extracted URLs
// Use static import for googleParser
const { parseHtml } = require('../dist/crawlSearch/googleParser');
const results = parseHtml(html);
console.log('Extracted URLs:', results.map(r => r.link));
  } catch (err) {
    console.error('Error fetching or saving HTML:', err);
    process.exit(1);
  }
})();
