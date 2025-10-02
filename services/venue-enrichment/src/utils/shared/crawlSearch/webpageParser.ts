
import TurndownService from 'turndown';

// Converts HTML to Markdown using turndown
export function webpageParser(html: string, url: string) {
  const turndownService = new TurndownService();
  const markdown = turndownService.turndown(html);
  return [{
    success: true,
    url,
    markdown,
    platform: 'web'
  }];
// ...existing code...


}
