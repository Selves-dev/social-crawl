# Database Configuration

## Environment Variables

The application uses multiple MongoDB databases for different purposes:

### Configuration (.env)

```bash
# Main working database for crawler operations
db-name=ta_crawler

# Hotels database with completed/enriched hotels
hotels-db-name=s_payload
```

## Database Usage

### 1. **ta_crawler** (Main Database)
- **Purpose**: Primary working database for crawler operations
- **Collections**: 
  - `workflows` - Workflow tracking
  - `queue_status` - Queue monitoring
  - Other operational data
- **Configured by**: `db-name` environment variable
- **Access via**: `db.getDatabase()`

### 2. **s_payload** (Hotels Database)
- **Purpose**: Storage for completed and enriched hotel documents
- **Collections**:
  - `hotels` - Main hotel documents with rooms and enrichment data
  - `room_research_registry` - Room research tracking
- **Configured by**: `hotels-db-name` environment variable
- **Access via**: `db.getSpecificDatabase(process.env['hotels-db-name'] || 's_payload')`

### 3. **hotelston** (Static Data)
- **Purpose**: Static venue data from external provider
- **Collections**:
  - `all-hotels` - Static hotel information for matching
- **Hardcoded**: Always uses 'hotelston' database name
- **Access via**: `db.getSpecificDatabase('hotelston')`

## Handler Files Updated

All handler files now use the environment variable for the hotels database:

1. ✅ `handleRankRoomResponse.ts` (lines 129, 166)
2. ✅ `handleResearchRoomResponse.ts` (line 105)
3. ✅ `handleEnrichRoomResponse.ts` (line 110)
4. ✅ `handleEnrichHotelResponse.ts` (line 173)
5. ℹ️  `handleEnrichStatic.ts` (line 94) - Uses 'hotelston' for static data

## Migration Complete

- Previous hardcoded references to 'groundry' have been replaced
- All dynamic hotel operations now point to 's_payload' database
- Static data operations continue using 'hotelston' database
- Fallback value 's_payload' provided in case environment variable is not set

## Next Steps for Typesense Integration

Now that database configuration is corrected:

1. **Count hotels** in s_payload database
2. **Create transform function** to extract 60 fields from hotel documents
3. **Backfill Typesense** with existing hotels
4. **Set up Change Streams** for real-time sync
