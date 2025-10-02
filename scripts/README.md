# Quick Start Guide: Typesense Setup

## ✅ What You Have

- **Typesense Cluster**: `5i1q8hfruw7lnjezp-1.a1.typesense.net`
- **Admin API Key**: `9P80UXCzFeM4nyHvvhZCWXmbzgWAVeXV` (for indexing)
- **Search API Key**: `qUemXvR9k0uNNJU5tXy84Dq1uMKWYMBf` (for queries)

## 🚀 Next Steps (10 minutes)

### Step 1: Install Dependencies (2 mins)

```bash
cd /Users/merry/Documents/projects/social-crawl/scripts
npm install
```

### Step 2: Create Collection Schema (1 min)

```bash
# This creates the "hotels" collection with 60 fields
node create-typesense-collection.js
```

**Expected output:**
```
🔍 Checking Typesense connection...
✅ Typesense is healthy: { ok: true }

📦 Creating hotels collection...
✅ Collection "hotels" created successfully!

📊 Collection Details:
   Name: hotels
   Fields: 60
   Documents: 0
   Default sort: reviewScore

✨ Ready for indexing!
```

### Step 3: Test Connection (1 min)

```bash
node test-typesense-search.js
```

**Expected output:**
```
🔍 Testing Typesense connection...
✅ Server Health: { ok: true }

📊 Collection Info:
   Name: hotels
   Fields: 60
   Documents: 0

⚠️  No documents yet. Run backfill script to index hotels.
```

### Step 4: Create Transform Function (Next task)

We need to create a script that:
1. Fetches hotels from MongoDB
2. Transforms them to Typesense format (60 fields)
3. Indexes them into Typesense

Would you like me to create the transform + backfill script next?

---

## 🔧 Troubleshooting

### If you see "Collection already exists"

```bash
# Delete and recreate (WARNING: loses data)
node create-typesense-collection.js --force
```

### If you see connection errors

Check that your API keys are correct in `/config/.env.typesense`

### If you see "Module not found"

```bash
cd scripts
npm install
```

---

## 📁 Files Created

```
/config/
  └── .env.typesense          # Your Typesense credentials

/scripts/
  ├── package.json            # Dependencies
  ├── create-typesense-collection.js  # Schema creation
  └── test-typesense-search.js        # Connection test

/docs/
  ├── TYPESENSE-SCHEMA.md             # Schema documentation
  └── TYPESENSE-IMPLEMENTATION-PLAN.md # Full plan
```

---

## 🎯 What's Next?

After creating the collection:

1. **Create transform function** → Extracts 60 fields from hotel docs
2. **Backfill existing hotels** → Index your current 47+ hotels
3. **Set up change stream sync** → Real-time updates
4. **Create search API** → Query endpoint for frontend

Ready to proceed with Step 1? 🚀
