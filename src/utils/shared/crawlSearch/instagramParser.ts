import type { CrawlSearchResult } from './types';

export function parseInstagramResults(data: any): CrawlSearchResult[] {
  // TODO: Implement actual parsing logic for Instagram results
  // Dummy implementation
  return [
    {
      link: 'https://instagram.com/dummy',
      snippet: 'Instagram dummy snippet',
      title: 'Instagram dummy title',
      likeCount: 456,
      username: 'insta-user',
      caption: 'Instagram dummy caption',
      thumbnail: 'https://instagram.com/dummy-thumb.jpg',
    },
  ];
}
