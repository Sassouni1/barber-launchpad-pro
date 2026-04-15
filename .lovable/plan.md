

## Plan: Move Today's Call to Sunday 8:00 PM EST

Update the existing group call record in the database to change the day from **Wednesday** to **Sunday**. The time (8:00 PM) and timezone (EST) stay the same.

### Change
- **Database migration**: Update the `group_calls` table row to set `day_of_week` to `'Sunday'`
- The dashboard countdown widget and Live Calls page will automatically reflect "Sunday at 8:00 PM EST"

No code changes needed — just a single database update.

