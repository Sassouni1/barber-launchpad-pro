I’m sorry. What’s going on is I fixed the border state without properly verifying the full card after the earlier badge change, so the screen now has a confusing mismatch: the selected/complete/fail outlines are present, but the visible completion notifications are not obvious enough in the exact viewport you’re looking at. That’s on me.

Plan:
1. Restore the status badge visibility on every course-list item:
   - Passed/completed: green badge with “Completed · 100%” or “Completed · X%”.
   - Failed attempt: red/orange badge with “Retake · 0%” or “Retake · X%”.
   - Not attempted: no completion badge, neutral card.

2. Make the outside card state match the badge:
   - Completed = green outline/background accent.
   - Failed/not passed = red or orange outline/background accent, stronger when score is 0%.
   - Selected but not completed/failed = gold outline only, so selection is separate from status.

3. Keep this consistent on both desktop and mobile course lists.

4. Verify visually against the current course screen after implementation so “Terms of the Industry” and “The Color Ring” cannot look randomly highlighted or status-less.