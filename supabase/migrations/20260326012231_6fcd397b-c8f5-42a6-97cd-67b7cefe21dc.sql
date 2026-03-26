
-- Rename existing Adhesive Application items to Skin Unit Instructions
UPDATE dynamic_todo_items SET section_title = 'Skin Unit Instructions' WHERE list_id = 'b0a7264d-1184-4a24-a6ed-f3352d916e49' AND section_title = 'Adhesive Application';

-- Shift order_index for items at 14+ to make room for 3 new lace items
UPDATE dynamic_todo_items SET order_index = order_index + 3 WHERE list_id = 'b0a7264d-1184-4a24-a6ed-f3352d916e49' AND order_index >= 14;

-- Insert Lace Unit Instructions items
INSERT INTO dynamic_todo_items (list_id, title, section_title, order_index, is_important) VALUES
('b0a7264d-1184-4a24-a6ed-f3352d916e49', 'Apply Tape Around the entire Perimeter', 'Lace Unit Instructions', 14, false),
('b0a7264d-1184-4a24-a6ed-f3352d916e49', 'Use 1 coat of adhesive on the scalp', 'Lace Unit Instructions', 15, false),
('b0a7264d-1184-4a24-a6ed-f3352d916e49', 'Allow to cure clearly fully', 'Lace Unit Instructions', 16, false);
