/**
 * Handles the search part of media crawling
 * Queues URLs for scraping
 */
import { crawlMediaQueue, CrawlMediaJob } from '../throttleQueue';

export async function handleSearchCrawl(event: any) {
  // 1. Get the search query from the event
  const { query } = event;

  // 2. Search Google Video Index for Instagram, TikTok, YouTube
  const platforms = ['instagram', 'tiktok', 'youtube'];
  const searchResults: Record<string, string[]> = {};
  for (const platform of platforms) {
    // Simulate 15 search results for each platform
    searchResults[platform] = Array.from({ length: 15 }, (_, i) => `https://${platform}.com/video${i + 1}`);
  }

  // 3. Add each URL as a job to the throttle queue
  const jobsQueued: CrawlMediaJob[] = [];
  for (const platform of platforms) {
    for (const url of searchResults[platform]) {
      const job = { platform, url, query };
      crawlMediaQueue.addJob(job);
      jobsQueued.push(job);
    }
  }

  // Return the list of jobs added
  return {
    status: 'success',
    query,
    jobsQueued
  };
}
