# Payload Schema Audit Results - 2025-10-07

**Database**: s_payload (MongoDB Atlas)  
**Hotels**: 10  
**Rooms**: 73 (avg 7.3 per hotel)  
**Core Data Quality**: 100% ✅

---

## 🚨 CRITICAL FINDINGS

### 1. Hidden Fields in Database (NOT in Payload Schema)

**These fields exist in MongoDB but are INVISIBLE in Payload CMS:**

#### Hotel Level:
| Field | Presence | Example Value | Action Required |
|-------|----------|---------------|-----------------|
| `externalIds` | 100% (10/10) | `{ "hotelston": "34268927" }` | 🔥 **ADD TO PAYLOAD IMMEDIATELY** |
| `references` | 100% (10/10) | `{ "perspectives": ["7522181191982714134"] }` | 🔥 **ADD TO PAYLOAD IMMEDIATELY** |

#### Room Level:
| Field | Presence | Example Value | Action Required |
|-------|----------|---------------|-----------------|
| `dataConfidence` | 100% (73/73) | `{ verified: [], estimated: [], assumptions: [] }` | 🔥 **ADD TO PAYLOAD IMMEDIATELY** |

**Impact**: 
- ❌ Editors can't see or modify these fields in Payload admin
- ❌ Data exists but is "ghost data"
- ❌ Enrichment service is saving fields that disappear from UI
- ✅ Data is preserved in MongoDB (good!)
- ⚠️ Risk: If someone saves hotel in Payload, might lose these fields

---

### 2. AI-Critical Fields Missing (Expected)

All new Schema.org fields are at 0% (as expected):

**Room Level - CRITICAL for AI:**
- `decisionDimensions` - 0/73 (0%) - 🔥 **CRITICAL**
- `tradeOffs` - 0/73 (0%) - 🔥 **CRITICAL**
- `requirements` - 0/73 (0%) - 🔥 **CRITICAL**
- `satisfactionPredictors` - 0/73 (0%) - 🟡 HIGH
- `comparableRooms` - 0/73 (0%) - 🟡 HIGH
- `usagePatterns` - 0/73 (0%) - 🟢 MEDIUM

**Hotel Level - HIGH for Inclusivity:**
- `accessibilityFeatures` - 0/10 (0%) - 🔥 HIGH
- `inclusivitySignals` - 0/10 (0%) - 🔥 HIGH

---

## ✅ What's Working Well

### Payload Schema Fields (100% coverage):

**Hotel Level:**
- ✅ name, slug, selves_id, contentLastUpdated
- ✅ identity, contact, location
- ✅ marketPosition, reviews, media
- ✅ facilities, foodAndBeverage, policies
- ✅ sustainability, sources

**Room Level:**
- ✅ roomName, roomId, roomSlug
- ✅ identity, hierarchy, pricingContext
- ✅ wouldMatch, features, reviewSnippets

**Data Quality Scores:**
- identity: 100% (10/10)
- location: 100% (10/10)
- contact: 100% (10/10)
- facilities: 100% (10/10)
- policies: 100% (10/10)

---

## ⚠️ Unused Fields in Payload Schema

These fields are DEFINED in Payload but NOT USED in database:

**Hotel Level:**
- `booking_ids` - 0/10 (replaced by `externalIds`)
- `security` - 0/10 (not populated)

**Room Level:**
- `media` - 0/73 (hotel has media, rooms don't have separate media yet)
- `policyOverrides` - 0/73 (not using room-specific policy overrides)

**Decision**: Keep or remove from Payload schema?

---

## 📋 Immediate Action Items

### PRIORITY 1 - Add Hidden Fields to Payload Schema (TODAY)

**File**: `selves-payload/src/collections/Hotels.ts`

#### Hotel Level - Add to "Hotel Info" tab:

```typescript
{
  name: 'externalIds',
  type: 'json',
  admin: {
    description: 'External provider IDs: { hotelston: "...", hbx: "...", roibos: "..." }'
  }
},
{
  name: 'references',
  type: 'json',
  admin: {
    description: 'References to other collections: { perspectives: ["id1", "id2"] }'
  }
}
```

#### Room Level - Add to rooms array:

```typescript
{
  name: 'dataConfidence',
  type: 'json',
  admin: {
    description: 'Data confidence levels: { verified: [], estimated: [], assumptions: [], hierarchyBasis: "..." }'
  }
}
```

**Why Critical**: 
- These fields already exist in ALL hotels/rooms
- Editors need to see them
- Without adding to Payload, data might be lost on edits

---

### PRIORITY 2 - Add AI-Critical Fields (THIS WEEK)

#### Room Level:

```typescript
{
  name: 'decisionDimensions',
  type: 'json',
  admin: {
    description: 'Quantified characteristics (1-10): { romanticAtmosphere, quietness, modernComfort, historicAuthenticity, spaciousness, accessibility, valuePerception, viewQuality, uniqueCharacter }'
  }
},
{
  name: 'tradeOffs',
  type: 'json',
  admin: {
    description: 'Trade-offs: { chooseFor: [], mustAccept: [], alternativeIf: {} }'
  }
},
{
  name: 'requirements',
  type: 'json',
  admin: {
    description: 'Requirements: { guestMustAccept: [], notSuitableIf: [] }'
  }
}
```

#### Hotel Level:

```typescript
{
  name: 'accessibilityFeatures',
  type: 'json',
  admin: {
    description: 'Hotel accessibility: { wheelchairAccessible, accessibleRooms, accessibleRoomIds, features, limitations, assistanceAvailable }'
  }
},
{
  name: 'inclusivitySignals',
  type: 'json',
  admin: {
    description: 'Inclusivity: { lgbtqWelcoming, dietaryAccommodations, languagesSpoken, culturalSensitivity, familyFriendly }'
  }
}
```

---

### PRIORITY 3 - Optional Enhancements (NEXT WEEK)

#### Room Level:

```typescript
{
  name: 'satisfactionPredictors',
  type: 'json',
  admin: {
    description: 'Satisfaction predictors: { highSatisfactionWhen: [], disappointmentRiskWhen: [], keyDecisionFactors: [] }'
  }
},
{
  name: 'comparableRooms',
  type: 'json',
  admin: {
    description: 'Comparable rooms: [{ roomId, relationship, keyDifferences, whenToRecommend }]'
  }
}
```

---

## 🔍 Sample Hotel Analysis

**Hotel**: Millennium Hotel London Knightsbridge  
**Slug**: millennium-hotel-london-knightsbridge-london-k3r4  
**Rooms**: 5

### External IDs:
```json
{
  "hotelston": "34268927"
}
```

### References:
```json
{
  "perspectives": ["7522181191982714134"]
}
```

### Room Data Confidence (Example):
```json
{
  "verified": ["name"],
  "estimated": [
    "bedConfiguration",
    "viewType",
    "sizeSqMeters",
    "maxOccupancy",
    "priceTier",
    "rateVsStandardRoom"
  ],
  "assumptions": [
    "tier classification",
    "description details"
  ],
  "hierarchyBasis": "Compared against all room types."
}
```

---

## 📊 Statistics Summary

### Database:
- Total hotels: 10
- Total rooms: 73
- Avg rooms per hotel: 7.3

### Field Coverage:
- Core Payload fields: 100%
- Hidden fields: 3 (externalIds, references, dataConfidence)
- AI-critical fields needed: 8 (5 room + 3 hotel level)
- Optional enhancement fields: 4

### Data Quality:
- Hotels with complete identity: 100%
- Hotels with complete location: 100%
- Hotels with complete contact: 100%
- Hotels with complete facilities: 100%
- Hotels with complete policies: 100%
- Hotels without rooms: 0%

---

## 🎯 Success Metrics

### After Adding Hidden Fields:
- [ ] All 10 hotels show `externalIds` in Payload admin
- [ ] All 10 hotels show `references` in Payload admin
- [ ] All 73 rooms show `dataConfidence` in Payload admin
- [ ] Can edit and save these fields in Payload UI
- [ ] MongoDB data preserved after Payload edits

### After Adding AI Fields:
- [ ] Can manually populate new fields for test hotel
- [ ] AI enrichment prompt updated to generate new fields
- [ ] Test hotel enrichment includes all new fields
- [ ] Schema.org transformer handles new fields

---

## ⚠️ Risks

### If we DON'T add hidden fields to Payload:
1. **Data Loss Risk**: If someone edits a hotel in Payload and saves, the hidden fields might be overwritten/lost
2. **Editor Confusion**: Editors can't see important data (external IDs, perspective references)
3. **Integration Issues**: External systems expect these fields but editors can't manage them

### Mitigation:
- **Immediate**: Add fields to Payload schema TODAY
- **Testing**: Test that existing data appears correctly
- **Validation**: Verify no data loss after adding fields

---

## 📝 Next Steps

1. **Today** (30 mins):
   - [ ] Add `externalIds`, `references`, `dataConfidence` to Payload schema
   - [ ] Restart Payload CMS
   - [ ] Verify fields appear in admin for one hotel
   - [ ] Test editing and saving

2. **This Week** (2-3 days):
   - [ ] Add AI-critical fields (decisionDimensions, tradeOffs, requirements)
   - [ ] Add inclusivity fields (accessibilityFeatures, inclusivitySignals)
   - [ ] Update TypeScript types to match
   - [ ] Manually populate one test hotel with new fields

3. **Next Week** (3-4 days):
   - [ ] Add optional enhancement fields
   - [ ] Update AI prompts to generate new fields
   - [ ] Test end-to-end enrichment
   - [ ] Build Schema.org transformer API

---

**Audit Complete**: ✅  
**Action Required**: 🔥 **ADD HIDDEN FIELDS TO PAYLOAD SCHEMA IMMEDIATELY**
