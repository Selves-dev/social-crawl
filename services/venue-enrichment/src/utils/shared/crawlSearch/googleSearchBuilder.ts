// Builds Google search URLs/tasks for a given query and platform(s)

export function buildGoogleSearchTasks(query: string, platforms: string[] = ['tiktok', 'youtube', 'instagram'], cc?: string) {
  const qLower = query.toLowerCase();
  const isVideo = (
    qLower.includes('youtube') ||
    qLower.includes('tiktok') ||
    qLower.includes('instagram') ||
    qLower.includes('video')
  );

  if (isVideo) {
    // Social/video search logic
    return platforms.map(platform => {
      const url = buildGoogleSearchUrl(query, platform, cc);
      return { url, platform };
    });
  } else {
    // Web search logic with date filter
    const now = new Date();
    const oneYearAgo = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
    const cdMin = `${oneYearAgo.getMonth() + 1}/${oneYearAgo.getDate()}/${oneYearAgo.getFullYear()}`;
    const params = new URLSearchParams({
      q: query,
      tbs: `cdr:1,cd_min:${cdMin}`,
      num: '40'
    });
    const url = `https://www.google.com/search?${params.toString()}`;
    return [{ url, platform: 'web' }];
  }
}

export function buildGoogleSearchUrl(query: string, platform: string, cc?: string): string {
  const num = Math.floor(Math.random() * 16) + 35; // 35-50 results
  let q = `${query} ${platform}`;
  if (cc) q = `${q} ${cc}`;
  const params = new URLSearchParams({
    q,
    num: num.toString(),
    udm: '7',
  });
  return `https://www.google.com/search?${params.toString()}`;
}
