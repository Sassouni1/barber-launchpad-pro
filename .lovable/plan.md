

## Shorten Calendar Bottom Space

The iframe height is set to 1800px which is creating excessive empty space below the calendar content. Reduce it to a more appropriate size.

### Change

**File: `src/pages/ScheduleCall.tsx`**

Reduce the iframe height from `1800px` to `1000px`. The calendar widget content typically fits within this height, and since `scrolling="yes"` is already enabled, users can scroll within the iframe if needed.

### Technical Detail

```text
Before: style={{ width: "100%", border: "none", height: "1800px" }}
After:  style={{ width: "100%", border: "none", height: "1000px" }}
```

This removes the large empty gap below the calendar while keeping the iframe scrollable for the booking button at the bottom.

