
ALTER TABLE public.products
ADD COLUMN image_position_x integer NOT NULL DEFAULT 50,
ADD COLUMN image_position_y integer NOT NULL DEFAULT 50;

COMMENT ON COLUMN public.products.image_position_x IS 'Horizontal focal point 0-100 (left to right)';
COMMENT ON COLUMN public.products.image_position_y IS 'Vertical focal point 0-100 (top to bottom)';
