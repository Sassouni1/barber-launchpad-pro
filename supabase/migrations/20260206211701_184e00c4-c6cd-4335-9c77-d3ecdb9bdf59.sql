
-- Create orders table
CREATE TABLE public.orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES public.profiles(id),
  customer_email text NOT NULL,
  customer_name text,
  order_details jsonb DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'pending',
  tracking_number text,
  tracking_url text,
  tracking_seen boolean NOT NULL DEFAULT false,
  order_date timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

-- Users can view their own orders
CREATE POLICY "Users can view own orders"
ON public.orders FOR SELECT
USING (auth.uid() = user_id);

-- Users can update tracking_seen on their own orders
CREATE POLICY "Users can update own order tracking_seen"
ON public.orders FOR UPDATE
USING (auth.uid() = user_id);

-- Admins can view all orders
CREATE POLICY "Admins can view all orders"
ON public.orders FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

-- Admins can update all orders
CREATE POLICY "Admins can update all orders"
ON public.orders FOR UPDATE
USING (public.has_role(auth.uid(), 'admin'));

-- Admins can delete orders
CREATE POLICY "Admins can delete orders"
ON public.orders FOR DELETE
USING (public.has_role(auth.uid(), 'admin'));

-- Manufacturer can view all orders
CREATE POLICY "Manufacturers can view all orders"
ON public.orders FOR SELECT
USING (public.has_role(auth.uid(), 'manufacturer'));

-- Manufacturer can update orders (tracking number)
CREATE POLICY "Manufacturers can update orders"
ON public.orders FOR UPDATE
USING (public.has_role(auth.uid(), 'manufacturer'));

-- Trigger for updated_at
CREATE TRIGGER update_orders_updated_at
BEFORE UPDATE ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
