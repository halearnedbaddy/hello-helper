
-- Sales Packs: AI-generated content kits for products
CREATE TABLE public.sales_packs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  seller_id uuid NOT NULL,
  
  -- Generated content
  whatsapp_launch_message text,
  whatsapp_followup_message text,
  whatsapp_urgency_message text,
  instagram_caption text,
  instagram_hashtags text[],
  
  -- Metadata
  status text DEFAULT 'generated',
  generated_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.sales_packs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can manage own sales packs"
  ON public.sales_packs FOR ALL
  USING (auth.uid() = seller_id)
  WITH CHECK (auth.uid() = seller_id);

-- Quick Reply Templates per product
CREATE TABLE public.quick_replies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid REFERENCES public.products(id) ON DELETE CASCADE,
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  seller_id uuid NOT NULL,
  
  trigger_question text NOT NULL,
  reply_template text NOT NULL,
  category text DEFAULT 'general',
  usage_count integer DEFAULT 0,
  
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.quick_replies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can manage own quick replies"
  ON public.quick_replies FOR ALL
  USING (auth.uid() = seller_id)
  WITH CHECK (auth.uid() = seller_id);

-- Link Analytics: Track views/clicks per payment link
CREATE TABLE public.link_analytics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id text REFERENCES public.transactions(id) ON DELETE CASCADE,
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  store_id uuid REFERENCES public.stores(id) ON DELETE SET NULL,
  
  event_type text NOT NULL DEFAULT 'view',
  source text DEFAULT 'direct',
  referrer text,
  user_agent text,
  ip_hash text,
  
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.link_analytics ENABLE ROW LEVEL SECURITY;

-- Public can insert analytics events (tracking pixels)
CREATE POLICY "Anyone can insert analytics"
  ON public.link_analytics FOR INSERT
  WITH CHECK (true);

-- Store owners can view their analytics
CREATE POLICY "Store owners can view analytics"
  ON public.link_analytics FOR SELECT
  USING (store_id IN (SELECT id FROM public.stores WHERE seller_id = auth.uid()));

-- Add low_stock_threshold to products
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS low_stock_threshold integer DEFAULT 5;
-- Add discount fields to products  
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS discount_type text;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS discount_value numeric;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS discount_min_qty integer;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS promo_code text;
