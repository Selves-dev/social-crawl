const { readFileSync } = require('fs');
const { parseHtml } = require('../src/utils/shared/crawlSearch/googleParser');

const htmlFile = process.argv[2] || 'src/utils/shared/crawlSearch/google-search.html';

const html = readFileSync(htmlFile, 'utf8');
const results = parseHtml(html);
console.log('Extracted URLs:', results.map(r => r.link));
