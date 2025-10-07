# Payload Schema Audit & Gap Analysis
**Generated**: 2025-10-07  
**Purpose**: Systematic comparison of Current Payload, Active TypeScript Types, and Target Schema.org structure

---

## 📊 Executive Summary

| Aspect | Status | Action Required |
|--------|--------|-----------------|
| **Core Hotel Fields** | ✅ Complete | Maintain |
| **Room Structure** | ✅ Complete | Maintain |
| **AI-Critical Fields** | ❌ Missing | **ADD PRIORITY 1** |
| **Inclusivity/Accessibility** | ⚠️ Partial | **ENHANCE PRIORITY 2** |
| **Schema.org Compliance** | ⚠️ Internal Only | **TRANSFORM LAYER** |

---

## 🗂️ Part 1: Current State Inventory

### A. Payload CMS Collection Definition
**Source**: `selves-payload/src/collections/Hotels.ts`

#### Hotel-Level Fields (Tab: "Hotel Info")

| Field Name | Type | Description | Status |
|------------|------|-------------|--------|
| `slug` | text | URL-friendly identifier | ✅ Core |
| `name` | text | Hotel display name | ✅ Core |
| `selves_id` | text | Our unique contextual ID | ✅ Core |
| `contentLastUpdated` | date | Last content modification | ✅ Metadata |
| `booking_ids` | json | External booking platform IDs | ✅ Integrations |
| `identity` | json | name, starRating, priceTier, hotelType, brandAffiliation, descriptionShort | ✅ Core |
| `contact` | json | phone, email, websiteUrl | ✅ Core |
| `location` | json | Country, Region, City, address, coordinates, neighborhood, walkabilityScore, pointsOfInterest | ✅ Core |
| `marketPosition` | json | similarHotels, uniqueSellingPoints | ✅ Business |
| `reviews` | json | aggregate scores, scoresByCategory | ✅ Social Proof |
| `media` | json | primaryImage, gallery, photoCount | ✅ Content |
| `facilities` | json | hotelFacilities, parking, concierge, spa, businessAndEvents | ✅ Features |
| `foodAndBeverage` | json | restaurants, breakfast, dietaryOptions | ✅ Features |
| `policies` | json | checkIn/Out, cancellation, deposit, pet policy | ✅ Operations |
| `security` | json | staffed247, inRoomSafe, fireSafety | ✅ Operations |
| `sustainability` | json | certifications, practices | ✅ ESG |
| `sources` | json | Data sources and references | ✅ Metadata |

#### Room-Level Fields (Tab: "Rooms", Array)

| Field Name | Type | Description | Status |
|------------|------|-------------|--------|
| `roomName` | text | Display name | ✅ Core |
| `roomId` | text | Unique registry ID | ✅ Core |
| `roomSlug` | text | URL-friendly identifier | ✅ Core |
| `identity` | json | name, roomType, sizeSqMeters, capacity, bedConfiguration, viewType, descriptionShort | ✅ Core |
| `hierarchy` | json | tier, upgradeFromRoomId, upgradeToRoomId | ✅ Business |
| `pricingContext` | json | avgNightlyRate, rateVsStandardRoom | ✅ Business |
| `wouldMatch` | json | tags, idealFor, notIdealFor | ✅ Matching |
| `media` | json | primaryImageUrl, virtualTourUrl, gallery, photoCount | ✅ Content |
| `features` | json | amenities, bathroomType, uniqueFeatures, accessibility | ✅ Features |
| `reviewSnippets` | json | text, source, date, travelerType | ✅ Social Proof |
| `policyOverrides` | json | Room-specific policy exceptions | ✅ Operations |

---

### B. Active TypeScript Types
**Source**: `services/venue-enrichment/src/types/hotel.ts`

#### Fields in TypeScript BUT NOT in Payload Collection:

| Field Name | Type | Purpose | Gap Reason |
|------------|------|---------|------------|
| `externalIds` | HotelExternalIds | Provider IDs (hotelston, hbx, roibos) | ❌ **MISSING FROM PAYLOAD** |
| `references` | HotelReferences | Links to perspectives/other collections | ❌ **MISSING FROM PAYLOAD** |

**🚨 Critical Gap**: The enrichment service adds `externalIds` and `references` but Payload doesn't have fields for them!

---

### C. Schema.org Target Structure
**Source**: User-provided Schema.org JSON-LD example

#### NEW Fields Required for Schema.org (Not in Current Payload):

**Hotel Level:**
| Field Name | Schema.org Type | Purpose | Priority |
|------------|-----------------|---------|----------|
| `accessibilityFeatures` | Object | wheelchairAccessible, accessibleRooms, accessibleRoomIds, features, limitations | 🔥 High |
| `inclusivitySignals` | Object | lgbtqWelcoming, dietaryAccommodations, languagesSpoken, culturalSensitivity, familyFriendly | 🔥 High |
| `sustainabilityPractices` | Object (Enhanced) | certifications with issuer/year, evidencedPractices | 🟡 Medium |
| `accessInformation` | Object | parking details, publicTransport, airports | 🟢 Low |
| `containedInPlace` | TouristDestination | Neighborhood context | 🟢 Low |
| `nearbyAttraction` | Array | Structured attractions with distance | 🟢 Low |
| `additionalProperty` | Array | Market position, ideal experience, USPs | 🟢 Low |
| `potentialAction` | ReserveAction | Booking action schema | 🟢 Low |
| `relatedLink` | Array | External resource links | 🟢 Low |

**Room Level (in `makesOffer[].itemOffered`):**
| Field Name | Schema.org Type | Purpose | Priority |
|------------|-----------------|---------|----------|
| `decisionDimensions` | Object | Quantified characteristics (1-10) | 🔥 **CRITICAL** |
| `tradeOffs` | Object | chooseFor, mustAccept, alternativeIf | 🔥 **CRITICAL** |
| `requirements` | Object | guestMustAccept, notSuitableIf | 🔥 **CRITICAL** |
| `satisfactionPredictors` | Object | highSatisfactionWhen, disappointmentRiskWhen | 🔥 High |
| `usagePatterns` | Object | typicalStayLength, peakDemand, demographics | 🟡 Medium |
| `comparableRooms` | Array | Upgrade/downgrade/lateral options with relationships | 🟡 Medium |
| `review` | Array (Enhanced) | Structured Review schema with reviewAspect | 🟢 Low |

---

## 🚨 Part 2: Critical Gaps Identified

### Gap 1: Missing Payload Fields That TypeScript Uses
**Impact**: Data saved to MongoDB won't show in Payload CMS editor

**Missing Fields:**
1. `externalIds` (hotel level) - Provider IDs like hotelston, hbx, roibos
2. `references` (hotel level) - Links to perspectives collection

**Action**: Add to Payload schema immediately

---

### Gap 2: AI-Critical Fields for Intelligent Matching
**Impact**: Cannot do AI-powered room recommendation without these

**Missing Fields (Room Level):**
1. ✅ `decisionDimensions` - **THE MOST IMPORTANT** - quantified room characteristics
2. ✅ `tradeOffs` - Transparent expectation setting
3. ✅ `requirements` - Explicit "must accept" and "not suitable if"
4. ⚠️ `satisfactionPredictors` - Proactive disappointment prevention
5. ⚠️ `usagePatterns` - Data-driven insights (requires analytics)
6. ⚠️ `comparableRooms` - Enhanced hierarchy beyond simple upgrade path

**Action**: Add fields 1-3 immediately (Phase 1), 4-6 in Phase 2

---

### Gap 3: Inclusivity & Accessibility Enhancement
**Impact**: Cannot surface inclusive/accessible hotels properly

**Current State:**
- ⚠️ `foodAndBeverage.dietaryOptions` exists but limited
- ⚠️ `features.accessibility` exists at room level but not hotel-level overview
- ❌ No LGBTQ+ welcoming signal
- ❌ No languages spoken
- ❌ No cultural sensitivity info
- ❌ No consolidated accessibility with room cross-references

**Action**: Add hotel-level `inclusivitySignals` and `accessibilityFeatures` objects

---

### Gap 4: Room Hierarchy Limited
**Current**: Only upgrade path (upgradeFrom/upgradeTo)
**Needed**: Downgrade, lateral alternatives, relationship types

**Action**: Enhance `hierarchy` field or add new `comparableRooms` array

---

## ✅ Part 3: What's Already Good

| Feature | Status | Notes |
|---------|--------|-------|
| Core hotel data | ✅ Complete | name, location, contact, facilities |
| Room nesting | ✅ Correct | Rooms as array within hotel |
| Media management | ✅ Good | Gallery with metadata |
| Reviews | ✅ Good | Aggregate + snippets |
| Basic matching | ✅ Good | wouldMatch.tags/idealFor/notIdealFor |
| Pricing context | ✅ Good | Tier + rate comparisons |
| Policies | ✅ Complete | Check-in/out, cancellation, deposits |
| Sustainability | ✅ Present | Needs enhancement but exists |

---

## 🎯 Part 4: Recommended Action Plan

### **Phase 1: Fix Critical Gaps (Week 1) - MUST DO**

#### Add to Payload Hotels.ts:

```typescript
// Hotel Level - Add to "Hotel Info" tab
{
  name: 'externalIds',
  type: 'json',
  admin: {
    description: 'External provider IDs (hotelston, hbx, roibos, etc.)'
  }
},
{
  name: 'references',
  type: 'json',
  admin: {
    description: 'References to other collections (perspectives, etc.)'
  }
},
{
  name: 'accessibilityFeatures',
  type: 'json',
  admin: {
    description: 'Hotel-level accessibility: wheelchairAccessible, accessibleRooms, accessibleRoomIds, features, limitations'
  }
},
{
  name: 'inclusivitySignals',
  type: 'json',
  admin: {
    description: 'Inclusivity info: lgbtqWelcoming, dietaryAccommodations, languagesSpoken, culturalSensitivity, familyFriendly'
  }
}

// Room Level - Add to "Rooms" array fields
{
  name: 'decisionDimensions',
  type: 'json',
  admin: {
    description: 'Quantified characteristics (1-10): romanticAtmosphere, quietness, modernComfort, historicAuthenticity, spaciousness, accessibility, valuePerception, viewQuality, uniqueCharacter'
  }
},
{
  name: 'tradeOffs',
  type: 'json',
  admin: {
    description: 'Trade-off analysis: { chooseFor: [], mustAccept: [], alternativeIf: {} }'
  }
},
{
  name: 'requirements',
  type: 'json',
  admin: {
    description: 'Guest requirements: { guestMustAccept: [], notSuitableIf: [] }'
  }
}
```

---

### **Phase 2: Enhance for Advanced Features (Week 2-3) - SHOULD DO**

```typescript
// Room Level
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
    description: 'Comparable rooms: [{ roomId, relationship: "UpgradeOption"|"DowngradeOption"|"LateralAlternative", keyDifferences, whenToRecommend }]'
  }
}

// Hotel Level - Enhance existing sustainability
// (Keep existing field, just update description to indicate enhanced structure)
{
  name: 'sustainability',
  type: 'json',
  admin: {
    description: 'Sustainability info: { certifications: [{ name, year, issuedBy }], evidencedPractices: [] }' // ENHANCED
  }
}
```

---

### **Phase 3: Analytics-Driven Fields (When Data Available) - NICE TO HAVE**

```typescript
// Room Level - Only add when you have booking/analytics data
{
  name: 'usagePatterns',
  type: 'json',
  admin: {
    description: 'Usage analytics: { typicalStayLength, peakDemandPeriods, bookingLeadTime, guestDemographics, repeatBookingRate }'
  }
}
```

---

## 🔧 Part 5: Migration & Validation Plan

### Step 1: Update Payload Schema
1. Add Phase 1 fields to `Hotels.ts`
2. Restart Payload CMS
3. Verify fields appear in admin UI

### Step 2: Update TypeScript Types
1. Sync `services/venue-enrichment/src/types/hotel.ts` with new Payload fields
2. Add new interfaces:
   - `HotelAccessibilityFeatures`
   - `HotelInclusivitySignals`
   - `RoomDecisionDimensions`
   - `RoomTradeOffs`
   - `RoomRequirements`
   - etc.

### Step 3: Update Enrichment Handlers
1. Modify `handleEnrichHotelResponse.ts` to preserve new fields
2. Modify `handleEnrichRoomResponse.ts` (if exists) to handle new room fields
3. Update AI prompts to generate these new fields

### Step 4: Build Schema.org Transformer
1. Create `selves-marketing/server/utils/schemaOrgTransformer.ts`
2. Map Payload → Schema.org JSON-LD
3. Create API endpoints:
   - `/api/schema/hotel/[slug].get.ts`
   - `/api/schema/room/[hotelSlug]/[roomSlug].get.ts`

### Step 5: Validate
```bash
# Check a hotel has all new fields
curl http://localhost:3000/api/hotels/[id] | jq 'keys'

# Validate Schema.org output
curl http://localhost:3000/api/schema/hotel/maids-head-norwich | \
  curl -X POST -d @- https://validator.schema.org/validate
```

---

## 📋 Part 6: Field Grouping Analysis

### Current Payload Grouping (Tabs):
1. **Hotel Info** - All hotel-level fields (16 JSON fields)
2. **Rooms** - Room array (11 fields per room)

### Recommended Payload Grouping (Enhanced):

**Tab 1: Core Info**
- name, selves_id, slug, contentLastUpdated
- identity, contact, location

**Tab 2: Features & Facilities**
- facilities, foodAndBeverage, security
- accessibilityFeatures *(NEW)*
- inclusivitySignals *(NEW)*

**Tab 3: Business & Marketing**
- marketPosition, reviews, sustainability
- policies, sources

**Tab 4: Media & Content**
- media

**Tab 5: Integrations**
- booking_ids, externalIds *(NEW)*, references *(NEW)*

**Tab 6: Rooms** *(Keep as-is, just add new fields)*
- All room fields including new AI fields

---

## 🎬 Next Steps

### Immediate Actions:
1. ✅ **Review this audit** with team
2. ✅ **Decide priority** - Phase 1 only? Or Phase 1+2?
3. ✅ **Update Payload schema** - Add Phase 1 fields
4. ✅ **Update TypeScript types** - Keep in sync
5. ✅ **Test with one hotel** - Manually populate new fields
6. ✅ **Build transformer** - Create Schema.org API layer

### Discussion Points:
- **Tab restructuring?** Current 2-tab vs proposed 6-tab?
- **Field naming?** Keep JSON blob names or break out?
- **Migration strategy?** Backfill existing hotels or only new ones?
- **AI prompt updates?** Who updates prompts to generate new fields?

---

**Questions for Review:**
1. Should we backfill `externalIds` and `references` for existing hotels?
2. Do we have analytics data for `usagePatterns` or skip that field?
3. Manual curation or AI generation for `decisionDimensions`?
4. Tab restructuring - worth the effort or keep simple 2-tab?
