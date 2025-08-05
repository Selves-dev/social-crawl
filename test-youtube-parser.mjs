import { extractYouTubeVideoId, testYouTubeUrlParsing } from './src/utils/shared/crawlSearch/youtubeParser.ts';

console.log('Testing YouTube URL parsing...');

// Test various YouTube URL formats
const testUrls = [
  'https://www.youtube.com/watch?v=dQw4w9WgXcQ&feature=youtu.be',
  'https://youtu.be/dQw4w9WgXcQ?t=42',
  'https://www.youtube.com/embed/dQw4w9WgXcQ',
  'https://www.youtube.com/shorts/dQw4w9WgXcQ',
  'https://m.youtube.com/watch?v=dQw4w9WgXcQ',
  'youtube.com/watch?v=dQw4w9WgXcQ&amp;list=PLxyz',
  'https://www.youtube.com/watch?v=dQw4w9WgXcQ&list=PLxyz&index=1',
  'https://img.youtube.com/vi/dQw4w9WgXcQ/maxresdefault.jpg'
];

testUrls.forEach(url => {
  try {
    const id = extractYouTubeVideoId(url);
    console.log(`✓ ${url} -> ${id || 'FAILED'}`);
  } catch (e) {
    console.log(`✗ ${url} -> ERROR: ${e.message}`);
  }
});

console.log('\nRunning built-in test function...');
testYouTubeUrlParsing();
