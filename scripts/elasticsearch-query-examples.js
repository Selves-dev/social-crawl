/**
 * Elasticsearch Query Examples for Hotels & Rooms
 * 
 * This file shows how to construct the AND + fuzzy search query
 */

// Example 1: Two-term AND search with fuzzy matching
// Query: "knightsbridge suite" 
// Should find: Suites in Knightsbridge hotels with typo tolerance
export const andSearchQuery = (searchTerms) => {
  return {
    query: {
      bool: {
        must: searchTerms.map(term => ({
          multi_match: {
            query: term,
            fields: [
              'room_name^10',
              'room_type^8',
              'hotel_name^8',
              'city^10',
              'neighborhood^8',
              'description^5',
              'amenities^5',
              'unique_features^5',
              'tags^4',
              'ideal_for^3',
              'bathroom_type^3',
              'tier^3'
            ],
            fuzziness: 'AUTO',
            prefix_length: 1,
            operator: 'or'
          }
        }))
      }
    },
    size: 20
  }
}

// Example 2: Typeahead search (fewer results, highlighting)
export const typeaheadQuery = (searchTerms) => {
  return {
    query: {
      bool: {
        must: searchTerms.map(term => ({
          multi_match: {
            query: term,
            fields: [
              'room_name^10',
              'room_type^8',
              'hotel_name^8',
              'city^10'
            ],
            fuzziness: 'AUTO',
            prefix_length: 1
          }
        }))
      }
    },
    size: 5,
    highlight: {
      fields: {
        'room_name': {},
        'room_type': {},
        'hotel_name': {},
        'city': {}
      },
      pre_tags: ['<mark>'],
      post_tags: ['</mark>']
    }
  }
}

// Example 3: Search across both indices with AND logic
export const multiIndexQuery = (searchTerms) => {
  return {
    query: {
      bool: {
        must: searchTerms.map(term => ({
          multi_match: {
            query: term,
            fields: [
              // Room fields
              'room_name^10',
              'room_type^8',
              'hotel_name^8',
              'city^10',
              'description^5',
              // Hotel fields (when searching hotels index)
              'name^10',
              'neighborhood^8',
              'amenities^5',
              'unique_selling_points^5'
            ],
            fuzziness: 'AUTO'
          }
        }))
      }
    }
  }
}

// Test queries you can run after migration:

// 1. "knightsbridge suite" - should find suites in Knightsbridge
const query1 = andSearchQuery(['knightsbridge', 'suite'])
console.log('Query 1:', JSON.stringify(query1, null, 2))

// 2. "knight suit" - should STILL find "knightsbridge suite" (fuzzy)
const query2 = andSearchQuery(['knight', 'suit'])
console.log('\nQuery 2:', JSON.stringify(query2, null, 2))

// 3. "queen camden london" - should find Queen rooms in Camden, London
const query3 = andSearchQuery(['queen', 'camden', 'london'])
console.log('\nQuery 3:', JSON.stringify(query3, null, 2))

// cURL examples:
console.log('\n\n=== cURL Examples ===\n')

console.log('# Search for "knightsbridge suite"')
console.log(`curl -X POST "ES_ENDPOINT/rooms/_search" \\
  -H "Authorization: ApiKey ES_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '${JSON.stringify(query1)}'
`)

console.log('\n# Search for "knight suit" (with typos)')
console.log(`curl -X POST "ES_ENDPOINT/rooms/_search" \\
  -H "Authorization: ApiKey ES_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '${JSON.stringify(query2)}'
`)
