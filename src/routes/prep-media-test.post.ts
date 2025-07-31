import { defineEventHandler, readBody } from 'h3';
import { handlePrepareMedia } from '../utils/prep-media/handlers/handlePrepareMedia';

// Example mappedObject for testing
const exampleMappedObject = {
  id: '7473698080701893918',
  link: 'https://www.tiktok.com/@hotel_wishlist/video/7473698080701893918',
  username: 'hotel_wishlist',
  title: '',
  caption: "I‘ve found the most amazing hotel to visit in Norway! . 📍 REINEFJORD SJØHUS,Lofoten Islands,Norway . Escape to REINEFJORD SJØHUS, where the rugged beauty of Lofoten Islands surrounds you. Enjoy panoramic views of the Reinefjorden fjord right from your room. An ideal retreat for those seeking peace, adventure, and awe-inspiring nature! . . #norway #norwayhotel #lofotenislands #visitnorway #reine #beautifulhotels",
  viewCount: 255600,
  likeCount: 13300,
  thumbnail: 'https://p19-pu-sign-useast8.tiktokcdn-us.com/tos-useast8-p-0068-tx2/ooxztxoHYAM3BI7XAEiY26qB4vBstOfiiCAm3I~tplv-tiktokx-origin.image?dr=9636&x-expires=1754049600&x-signature=cGybsMH7ZLFH4VykGsvbLbWCtEg%3D&t=4d5b0474&ps=13740610&shp=81f88b70&shcp=43f4a2f9&idc=useast8'
};

export default defineEventHandler(async (event) => {
  const body = await readBody(event);
  const mediaUrl = body?.blobUrl || 'https://socialcrawlstorage.blob.core.windows.net/media/tiktok/json/7406384787121802528/1753900675711.json';
  const workflow = body?.workflow || { batchId: 'test-batch', stage: 'prep-media', timestamp: new Date().toISOString() };
  // Call the actual handler
  await handlePrepareMedia({ workflow, blobUrl: mediaUrl, mediaUrl });
  return { status: 'ok', message: 'prep-media test run complete', mediaUrl };
});
