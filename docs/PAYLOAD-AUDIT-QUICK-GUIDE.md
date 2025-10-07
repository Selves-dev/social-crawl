# Systematic Payload Schema Audit - Quick Guide

## 🎯 The Approach

We've created a **3-step systematic audit process** to check Payload schema health:

### **Step 1: Documentation Review** ✅
- Created: `/docs/PAYLOAD-SCHEMA-AUDIT.md`
- Compares: Payload schema vs TypeScript types vs Schema.org target
- Identifies: Missing fields, gaps, priorities

### **Step 2: Live Data Validation** 
- Script: `/scripts/audit-payload-schema.js`
- Checks actual MongoDB data against expected schema
- Finds: Fields in DB but not in Payload, completeness %

### **Step 3: Gap Analysis & Action Plan**
- Prioritized field additions (Phase 1, 2, 3)
- Migration strategy
- Schema.org transformer approach

---

## 🚀 Run the Audit

```bash
cd /Users/merry/Documents/projects/social-crawl

# Check what MongoDB connection you're using
grep MONGODB_URI selves-payload/.env

# Run the audit script
MONGODB_URI="mongodb://localhost:27017" \
DB_NAME="s_payload" \
node scripts/audit-payload-schema.js
```

**What it checks:**
1. ✅ Which expected fields are present in actual hotels
2. ⚠️ Which TypeScript fields exist in DB but NOT in Payload schema
3. 🎯 Which Schema.org target fields are missing
4. 📊 Data quality (completeness %, hotels without rooms, etc.)
5. 📝 Sample hotel structure

---

## 🔍 Key Findings (Pre-Run Expectations)

### Critical Gap 1: TypeScript vs Payload Mismatch
**Issue**: Enrichment service uses fields that Payload doesn't define:
- `externalIds` (hotel level)
- `references` (hotel level)

**Impact**: Data saved to MongoDB won't show in Payload CMS editor

**Action**: Add these fields to Payload schema ASAP

---

### Critical Gap 2: Missing AI-Critical Fields
**Issue**: Cannot do intelligent room matching without:
- `decisionDimensions` (room level) - THE MOST IMPORTANT
- `tradeOffs` (room level)
- `requirements` (room level)

**Impact**: Your AI-powered search won't work properly

**Action**: Add these 3 fields immediately (Phase 1)

---

### Critical Gap 3: Inclusivity/Accessibility
**Issue**: Limited support for:
- LGBTQ+ welcoming signals
- Language support
- Consolidated accessibility with room cross-refs

**Impact**: Cannot surface inclusive/accessible hotels

**Action**: Add `accessibilityFeatures` and `inclusivitySignals` (Phase 2)

---

## ✅ Immediate Actions

### 1. Run the audit script
```bash
node scripts/audit-payload-schema.js > audit-results.txt
cat audit-results.txt
```

### 2. Review the detailed audit doc
```bash
open docs/PAYLOAD-SCHEMA-AUDIT.md
```

### 3. Decide on priority
- **Option A**: Phase 1 only (critical gaps) - 1 week
- **Option B**: Phase 1 + 2 (critical + inclusivity) - 2-3 weeks
- **Option C**: All phases (everything) - 1 month

### 4. Update Payload schema
See Phase 1 code snippets in `/docs/PAYLOAD-SCHEMA-AUDIT.md`

### 5. Build Schema.org transformer
Create API layer to output Schema.org JSON-LD

---

## 📋 Phase 1 - Critical Fields to Add

**Copy-paste ready code** for `selves-payload/src/collections/Hotels.ts`:

```typescript
// HOTEL LEVEL - Add to "Hotel Info" tab fields array:

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
},
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

// ROOM LEVEL - Add to rooms array fields:

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
    description: 'Trade-offs: { chooseFor: [], mustAccept: [], alternativeIf: { needQuiet: "room-id", ... } }'
  }
},
{
  name: 'requirements',
  type: 'json',
  admin: {
    description: 'Requirements: { guestMustAccept: [], notSuitableIf: [] }'
  }
},
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
```

---

## 🔧 After Adding Fields

### Update TypeScript Types
```bash
# Update these files to match new Payload schema:
services/venue-enrichment/src/types/hotel.ts
services/main-crawler/src/types/hotel.ts
```

### Test in Payload CMS
```bash
cd selves-payload
npm run dev
# Visit http://localhost:3000/admin
# Check that new fields appear when editing a hotel
```

### Update AI Prompts
Update your AI enrichment prompts to generate these new fields

### Build Schema.org Transformer
Create API endpoints that transform Payload → Schema.org JSON-LD

---

## 📊 Questions to Answer After Audit

1. **How many hotels currently have `externalIds` or `references` in MongoDB?**
   - If > 0, they're being saved but not showing in Payload UI

2. **What's the core field completeness %?**
   - identity, location, contact, facilities, policies
   - Should be > 80% for production readiness

3. **How many rooms per hotel on average?**
   - Affects whether room-level changes are high effort

4. **Do any hotels already have the new AI fields?**
   - Unlikely, but check if someone manually added them

---

## 🎯 Success Criteria

**After completing Phase 1, you should have:**
- ✅ All TypeScript-used fields visible in Payload CMS
- ✅ AI-critical fields (decisionDimensions, tradeOffs, requirements) available
- ✅ Inclusivity and accessibility fields ready
- ✅ Schema.org transformer API endpoints working
- ✅ Test hotel with all new fields populated
- ✅ Google Rich Results Test passing

---

## 🤔 Next Steps

**Right now:**
1. Run `node scripts/audit-payload-schema.js`
2. Review output and decide on priorities
3. Share findings with team

**Tomorrow:**
1. Add Phase 1 fields to Payload schema
2. Test with one hotel
3. Start building Schema.org transformer

**This week:**
1. Complete Phase 1 implementation
2. Update AI prompts to generate new fields
3. Build and test API endpoints

---

**Need help?** The audit script will show exactly what's in your DB right now.
