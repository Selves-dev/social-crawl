
// Build prompt for find-info
export async function buildFindInfoPrompt(venueName: string, venueLocation: string): Promise<string> {
  return `You are an expert local research assistant. Your primary goal is to generate a single, comprehensive list of highly effective Google search queries to find detailed information about a specific venue.

You will accomplish this in two steps:
1.  **Identify Local Sources:** First, you must determine the most influential local publications for the venue's location.
2.  **Construct Final Query List:** Second, you will use those discovered local sources, along with major publications and UGC platforms, to create a single, flat list of queries for the specific venue.

# CONTEXT
- **Venue Name:** "${venueName}"
- **Venue Location:** "${venueLocation}"

# STEP 1: IDENTIFY KEY LOCAL PUBLICATIONS
Based on the **Venue Location** ("${venueLocation}"), identify 2-3 of the most important local media sources. Think about the main local newspaper, a popular "what's on" guide, or a well-known local food blog.

# STEP 2: CONSTRUCT FINAL QUERY LIST
Now, generate a single, comprehensive list of Google search queries. This list should be a flat array and include queries to find:
-   **Official Information** (official website, menus, booking pages).
-   **General Reviews** (on platforms like TripAdvisor and Google).
-   **Articles & Features** (in the local publications from Step 1 and in major national/global ones like The Guardian or Condé Nast Traveller).
-   **User-Generated Content (UGC)** from visual platforms like Instagram, TikTok, and **YouTube**.

# OUTPUT FORMAT (JSON object ONLY)
-   Return a single, clean JSON object.
-   The JSON object must contain the following keys: "venueName", "venueLocation", "discoveredLocalSources", and "queries".
-   "discoveredLocalSources": An array of strings with the names of the key local publications you identified.
-   "queries": A single flat array of strings containing all generated search queries.

## Example Output for a venue in Norwich:
{
  "venueName": "The Waffle House",
  "venueLocation": "Norwich",
  "discoveredLocalSources": [
    "Eastern Daily Press",
    "Norwich Evening News"
  ],
  "queries": [
    "The Waffle House Norwich official website",
    "The Waffle House Norwich menu",
    "The Waffle House Norwich reviews",
    "TripAdvisor The Waffle House Norwich",
    "\"The Waffle House Norwich\" \"Eastern Daily Press\"",
    "\"The Waffle House Norwich\" \"The Guardian\"",
    "site:instagram.com \"The Waffle House Norwich\"",
    "site:tiktok.com The Waffle House Norwich",
    "site:youtube.com \"The Waffle House Norwich\" vlog"
  ]
}
`;
}
