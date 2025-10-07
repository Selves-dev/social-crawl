# Payload Schema Audit & Migration Checklist

**Started**: [ ] Date: _______  
**Target Completion**: [ ] Date: _______

---

## Phase 0: Discovery (Today)

### Audit Execution
- [ ] Run audit script: `node scripts/audit-payload-schema.js`
- [ ] Save output: `node scripts/audit-payload-schema.js > audit-results-$(date +%Y%m%d).txt`
- [ ] Review output file
- [ ] Read detailed audit: `docs/PAYLOAD-SCHEMA-AUDIT.md`
- [ ] Read quick guide: `docs/PAYLOAD-AUDIT-QUICK-GUIDE.md`

### Key Questions to Answer
- [ ] How many hotels in MongoDB? _______
- [ ] Average rooms per hotel? _______
- [ ] Core field completeness %? (identity, location, contact, facilities, policies)
  - identity: ______%
  - location: ______%
  - contact: ______%
  - facilities: ______%
  - policies: ______%
- [ ] Hotels with `externalIds` field: _______ (should match Payload schema!)
- [ ] Hotels with `references` field: _______ (should match Payload schema!)
- [ ] Hotels with ANY new AI fields: _______ (probably 0)

### Decision Points
- [ ] **Priority Level**: Choose one:
  - [ ] Priority 1 only (critical gaps, 1 week)
  - [ ] Priority 1+2 (critical + inclusivity, 2-3 weeks)
  - [ ] All phases (everything, 1 month)
- [ ] **Tab restructuring**: Keep 2-tab or move to 6-tab layout?
  - [ ] Keep simple 2-tab (Hotel Info + Rooms)
  - [ ] Restructure to 6 tabs (Core, Features, Business, Media, Integrations, Rooms)
- [ ] **Backfill strategy**: Backfill existing hotels or only new ones?
  - [ ] Backfill all (manual or AI)
  - [ ] Only new hotels going forward
  - [ ] Backfill top N priority hotels

---

## Phase 1: Critical Gaps (Week 1)

### Payload Schema Updates
File: `selves-payload/src/collections/Hotels.ts`

#### Hotel-Level Fields
- [ ] Add `externalIds` field (type: json)
- [ ] Add `references` field (type: json)
- [ ] Add `accessibilityFeatures` field (type: json)
- [ ] Add `inclusivitySignals` field (type: json)
- [ ] Verify fields in admin UI after restart

#### Room-Level Fields
- [ ] Add `decisionDimensions` field (type: json) 🔥 CRITICAL
- [ ] Add `tradeOffs` field (type: json) 🔥 CRITICAL
- [ ] Add `requirements` field (type: json) 🔥 CRITICAL
- [ ] Add `satisfactionPredictors` field (type: json)
- [ ] Add `comparableRooms` field (type: json)
- [ ] Verify fields in admin UI after restart

### Testing
- [ ] Restart Payload CMS: `cd selves-payload && npm run dev`
- [ ] Open admin UI: http://localhost:3000/admin
- [ ] Edit existing hotel
- [ ] Verify new fields appear
- [ ] Manually populate new fields for 1 test hotel
- [ ] Save successfully
- [ ] Query MongoDB to confirm fields saved: 
  ```bash
  # Add your query command here
  ```

### TypeScript Type Updates
Files to update:
- [ ] `services/venue-enrichment/src/types/hotel.ts`
  - [ ] Add `HotelAccessibilityFeatures` interface
  - [ ] Add `HotelInclusivitySignals` interface
  - [ ] Add `HotelExternalIds` interface (if not present)
  - [ ] Add `HotelReferences` interface (if not present)
  - [ ] Add `RoomDecisionDimensions` interface
  - [ ] Add `RoomTradeOffs` interface
  - [ ] Add `RoomRequirements` interface
  - [ ] Add `RoomSatisfactionPredictors` interface
  - [ ] Add `RoomComparableRooms` interface
  - [ ] Update `HotelDocument` to include new fields
  - [ ] Update `HotelRoom` to include new fields

- [ ] `services/main-crawler/src/types/hotel.ts` (if different)
  - [ ] Sync with venue-enrichment types

### Enrichment Service Updates
Files to update:
- [ ] `services/venue-enrichment/src/utils/enrich-static/handlers/handleEnrichHotelResponse.ts`
  - [ ] Ensure `externalIds` is preserved in mapping
  - [ ] Ensure `references` is preserved in mapping
  - [ ] Ensure `accessibilityFeatures` is preserved
  - [ ] Ensure `inclusivitySignals` is preserved

- [ ] `services/venue-enrichment/src/utils/enrich-static/handlers/handleEnrichRoomResponse.ts` (if exists)
  - [ ] Ensure new room fields are preserved

### AI Prompt Updates
- [ ] Update hotel enrichment prompt to generate:
  - [ ] `accessibilityFeatures`
  - [ ] `inclusivitySignals`
- [ ] Update room enrichment prompt to generate:
  - [ ] `decisionDimensions` (with quantified 1-10 values)
  - [ ] `tradeOffs` (chooseFor, mustAccept, alternativeIf)
  - [ ] `requirements` (guestMustAccept, notSuitableIf)
  - [ ] `satisfactionPredictors`
  - [ ] `comparableRooms` (with relationship types)

### Validation
- [ ] Enrich 1 test hotel end-to-end
- [ ] Verify all new fields populated in MongoDB
- [ ] Verify fields visible in Payload admin UI
- [ ] Check TypeScript types have no errors: `npm run typecheck`

---

## Phase 2: Schema.org Transformer (Week 2)

### Create Transformer Utility
File: `selves-marketing/server/utils/schemaOrgTransformer.ts`

- [ ] Create base file structure
- [ ] Implement `hotelToSchemaOrg()` function
- [ ] Implement `roomToOffer()` function
- [ ] Implement helper transformers:
  - [ ] `transformAddress()`
  - [ ] `transformAmenities()`
  - [ ] `transformAccessibilityFeatures()`
  - [ ] `transformAccessibilityHazards()`
  - [ ] `transformInclusivity()`
  - [ ] `transformSustainability()`
  - [ ] `transformBedConfig()`
  - [ ] `transformRoomFeatures()`
  - [ ] `transformDecisionDimensions()`
  - [ ] `transformReviews()`
  - [ ] `transformPricing()`

### Create API Endpoints
- [ ] Create: `selves-marketing/server/api/schema/hotel/[slug].get.ts`
  - [ ] Fetch hotel from Payload
  - [ ] Transform to Schema.org
  - [ ] Return JSON-LD with proper headers
  - [ ] Add caching (3600s)
- [ ] Create: `selves-marketing/server/api/schema/room/[hotelSlug]/[roomSlug].get.ts`
  - [ ] Fetch hotel and room from Payload
  - [ ] Transform to Schema.org Offer
  - [ ] Return JSON-LD
  - [ ] Add caching
- [ ] Create: `selves-marketing/server/api/schema/embed/[slug].get.ts`
  - [ ] Return `<script type="application/ld+json">` for HTML embedding

### Testing
- [ ] Test hotel endpoint: `curl http://localhost:3000/api/schema/hotel/test-hotel | jq .`
- [ ] Test room endpoint: `curl http://localhost:3000/api/schema/room/test-hotel/test-room | jq .`
- [ ] Validate with Schema.org validator: https://validator.schema.org/
- [ ] Validate with Google Rich Results Test: https://search.google.com/test/rich-results
- [ ] Check for required @type, @id, @context fields
- [ ] Verify all nested objects have proper types

### Integration
- [ ] Add Schema.org script to hotel detail page
  - File: `selves-marketing/app/pages/hotel/[slug].vue`
  - [ ] Fetch Schema.org JSON-LD
  - [ ] Inject into page `<head>` using `useHead()`
- [ ] Test in production/staging
- [ ] Verify Google can crawl: Use Google Search Console URL Inspection

---

## Phase 3: Backfill & Enhancement (Week 3-4)

### Backfill Strategy
- [ ] **Option chosen**: ___________________
- [ ] Create backfill script (if needed)
- [ ] Test backfill on 1 hotel
- [ ] Run backfill on all hotels (or subset)
- [ ] Verify data quality after backfill

### Optional: Phase 2 Fields (If time allows)
- [ ] Add `usagePatterns` field (room level) - requires analytics data
- [ ] Add `accessInformation` field (hotel level)
- [ ] Add `nearbyAttraction` field (hotel level)
- [ ] Update transformer to handle new fields

### Documentation
- [ ] Update README with new schema fields
- [ ] Document Schema.org API endpoints
- [ ] Create examples of API usage
- [ ] Update TypeScript type documentation

---

## Phase 4: Production Deployment

### Pre-Deployment Checklist
- [ ] All tests passing
- [ ] TypeScript compilation clean
- [ ] Payload CMS fields verified in staging
- [ ] Schema.org endpoints tested in staging
- [ ] Google Rich Results validation passing
- [ ] Cache invalidation working
- [ ] Backup MongoDB before deployment

### Deployment
- [ ] Deploy Payload CMS changes
- [ ] Deploy marketing site changes (Schema.org endpoints)
- [ ] Deploy enrichment service changes (AI prompts)
- [ ] Monitor logs for errors
- [ ] Test in production

### Post-Deployment Validation
- [ ] Check 5 random hotels in Payload admin
- [ ] Verify new fields visible and editable
- [ ] Test Schema.org endpoints in production
- [ ] Submit sitemap to Google (if changed)
- [ ] Monitor Google Search Console for schema errors
- [ ] Check analytics for any issues

---

## Success Metrics

### Week 1 (Post Phase 1)
- [ ] 100% of expected fields visible in Payload CMS
- [ ] 1+ test hotel fully populated with new fields
- [ ] TypeScript types updated and no compilation errors
- [ ] Enrichment service saving all new fields

### Week 2 (Post Phase 2)
- [ ] Schema.org endpoints returning valid JSON-LD
- [ ] Google Rich Results Test showing 0 errors
- [ ] Hotel pages have Schema.org embedded
- [ ] Cache hit rate > 80%

### Week 3-4 (Post Phase 3)
- [ ] X% of hotels have new fields populated (target: ____%)
- [ ] Schema.org validator shows 0 warnings
- [ ] Google Search Console shows schema enhancements

---

## Issues & Blockers

| Date | Issue | Impact | Resolution | Resolved? |
|------|-------|--------|------------|-----------|
| | | | | [ ] |
| | | | | [ ] |
| | | | | [ ] |

---

## Notes & Decisions

### Key Decisions Made
1. **Priority level**: _______________________
2. **Tab structure**: _______________________
3. **Backfill strategy**: _______________________
4. **Timeline**: _______________________

### Changes from Original Plan
- 
- 
- 

### Lessons Learned
- 
- 
- 

---

## Sign-Off

- [ ] **Developer**: All code changes complete and tested
  - Name: ______________ Date: __________
  
- [ ] **QA**: All validation tests passing
  - Name: ______________ Date: __________
  
- [ ] **Product**: Features meet requirements
  - Name: ______________ Date: __________

---

**📊 Final Stats**

- Hotels in database: _______
- Hotels with new fields: _______
- Coverage %: _______%
- Schema.org endpoints: _______
- Google Rich Results: [ ] Passing / [ ] Errors
- Time spent: _______ days
