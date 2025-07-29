import type { CrawlSearchResult } from './types';

export function parseTiktokResults(data: any): CrawlSearchResult[] {
  // TODO: Implement actual parsing logic for TikTok results
  // Dummy implementation
  return [
    {
      link: 'https://tiktok.com/dummy',
      snippet: 'TikTok dummy snippet',
      title: 'TikTok dummy title',
      likeCount: 789,
      username: 'tiktok-user',
      caption: 'TikTok dummy caption',
      thumbnail: 'https://tiktok.com/dummy-thumb.jpg',
    },
  ];
}
