

## Add "Quick Wins" Todo Category

The existing `todos` table already has a `type` column (values: `course`, `daily`, `weekly`). We'll add a new type `quick_win` and display it as a distinct section.

### Database Changes

**Migration**: Add `quick_win` as a valid type (no schema change needed -- `type` is a text column, not an enum). Just insert the items:

```sql
INSERT INTO todos (title, type, order_index) VALUES
  ('Hang up hair system poster (Print)', 'quick_win', 0),
  ('Tell every client', 'quick_win', 1),
  ('Make 5 posts on your social media this week & post 3 stories', 'quick_win', 2),
  ('Bonus: Instagram DM 100 people or Facebook message', 'quick_win', 3);
```

### Frontend Changes

**`src/components/dashboard/TodoList.tsx`**:
- Add `quick_win` to the `groupedTodos` object
- Render a "Quick Wins This Week" section at the **top** of the TodoList, before daily/weekly -- with a distinct style (e.g. Zap icon, accent border) so it feels separate and action-oriented
- Quick wins are NOT locked behind dynamic todos -- they show always

**`src/pages/admin/TodosManager.tsx`**:
- Add `quick_win` to the type dropdown so admins can create/edit these items

**`src/hooks/useTodos.ts`**:
- No changes needed -- it already fetches all todos regardless of type

### Where It Shows

- **Dashboard**: Inside the existing `TodoList` component, as the first section
- **Todos page**: Same component, same position
- Not gated behind dynamic todo completion -- always visible as a motivational quick-action list

