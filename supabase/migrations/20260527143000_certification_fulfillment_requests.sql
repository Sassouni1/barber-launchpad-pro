CREATE TABLE public.certification_fulfillment_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  certification_id UUID REFERENCES public.certifications(id) ON DELETE SET NULL,
  certification_photo_id UUID REFERENCES public.certification_photos(id) ON DELETE SET NULL,
  certificate_name TEXT NOT NULL,
  certificate_url TEXT,
  recipient_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  address_line1 TEXT NOT NULL,
  address_line2 TEXT,
  city TEXT NOT NULL,
  state TEXT NOT NULL,
  postal_code TEXT NOT NULL,
  country_code TEXT NOT NULL DEFAULT 'US',
  status TEXT NOT NULL DEFAULT 'pending_review',
  provider TEXT,
  provider_variant_id TEXT,
  provider_order_id TEXT,
  provider_order_status TEXT,
  estimated_base_cost NUMERIC,
  estimated_shipping_cost NUMERIC,
  estimated_tax NUMERIC,
  actual_total_cost NUMERIC,
  tracking_url TEXT,
  admin_note TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, course_id),
  CONSTRAINT certification_fulfillment_status_check CHECK (
    status IN (
      'pending_review',
      'approved_ready_to_order',
      'draft_order_created',
      'ordered',
      'shipped',
      'delivered',
      'blocked',
      'cancelled'
    )
  )
);

ALTER TABLE public.certification_fulfillment_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own certification fulfillment requests"
ON public.certification_fulfillment_requests
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own certification fulfillment requests"
ON public.certification_fulfillment_requests
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own pending certification fulfillment requests"
ON public.certification_fulfillment_requests
FOR UPDATE
USING (auth.uid() = user_id AND status IN ('pending_review', 'blocked'))
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all certification fulfillment requests"
ON public.certification_fulfillment_requests
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update all certification fulfillment requests"
ON public.certification_fulfillment_requests
FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX idx_certification_fulfillment_status
ON public.certification_fulfillment_requests(status, created_at DESC);

CREATE INDEX idx_certification_fulfillment_user_course
ON public.certification_fulfillment_requests(user_id, course_id);

CREATE TRIGGER update_certification_fulfillment_requests_updated_at
BEFORE UPDATE ON public.certification_fulfillment_requests
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
