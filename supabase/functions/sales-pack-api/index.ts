import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const url = new URL(req.url);
  const path = url.pathname.split("/sales-pack-api")[1] || "/";

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const anonKey = req.headers.get("apikey") || Deno.env.get("SUPABASE_ANON_KEY")!;

  // Auth
  const authHeader = req.headers.get("authorization") || "";
  const token = authHeader.replace("Bearer ", "");
  const supabase = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const adminDb = createClient(supabaseUrl, serviceKey);

  const { data: { user } } = await supabase.auth.getUser(token);

  // POST /generate - Generate sales pack for a product
  if (path === "/generate" && req.method === "POST") {
    if (!user) return json({ success: false, error: "Unauthorized" }, 401);

    const body = await req.json();
    const { productId, storeId } = body;

    if (!productId || !storeId) {
      return json({ success: false, error: "productId and storeId required" }, 400);
    }

    // Fetch product details
    const { data: product, error: pErr } = await adminDb
      .from("products")
      .select("*")
      .eq("id", productId)
      .single();

    if (pErr || !product) {
      return json({ success: false, error: "Product not found" }, 404);
    }

    // Fetch store details for branding
    const { data: store } = await adminDb
      .from("stores")
      .select("name, slug, bio")
      .eq("id", storeId)
      .single();

    const storeName = store?.name || "My Store";
    const storeSlug = store?.slug || "";
    const productUrl = `${Deno.env.get("FRONTEND_URL") || "https://payloom.app"}/store/${storeSlug}/product/${product.id}`;
    const price = product.price || 0;
    const currency = product.currency || "KES";
    const name = product.name;
    const desc = product.description || "";
    const quantity = product.quantity ?? 0;

    // Generate content using templates (no external AI API needed for MVP)
    const stockStatus = quantity <= 0 ? "🔴 SOLD OUT" : quantity <= 3 ? `🔥 Only ${quantity} left!` : `✅ In stock`;

    const whatsappLaunch = `🆕 NEW ARRIVAL at ${storeName}!\n\n` +
      `${name}\n` +
      `💰 ${currency} ${price.toLocaleString()}\n` +
      `${desc ? `\n📝 ${desc}\n` : ""}` +
      `${stockStatus}\n\n` +
      `🛒 Order now: ${productUrl}\n\n` +
      `✅ Secure payment via M-Pesa\n📦 Fast delivery\n🛡️ Buyer protection included`;

    const whatsappFollowup = `Hey! 👋 Still thinking about the ${name}?\n\n` +
      `💰 Just ${currency} ${price.toLocaleString()}\n` +
      `${quantity <= 3 && quantity > 0 ? `⚡ Hurry — only ${quantity} left!\n` : ""}` +
      `\n🛒 Grab yours: ${productUrl}\n\n` +
      `Questions? Reply here — happy to help! 😊`;

    const whatsappUrgency = `⚡ FLASH UPDATE from ${storeName}\n\n` +
      `${name} is selling fast! 🔥\n` +
      `💰 ${currency} ${price.toLocaleString()}\n` +
      `${quantity <= 5 && quantity > 0 ? `⏰ Only ${quantity} remaining — don't miss out!\n` : ""}` +
      `\n🛒 Order before it's gone: ${productUrl}`;

    const hashtags = [
      `#${storeName.replace(/\s+/g, "")}`,
      "#OnlineShopping", "#Kenya", "#NairobiShopping",
      "#ShopOnline", "#MadeInKenya", "#PayLoom",
      `#${name.replace(/\s+/g, "").slice(0, 20)}`,
    ];

    const instagramCaption = `✨ ${name}\n\n` +
      `${desc || "Quality you can trust!"}\n\n` +
      `💰 ${currency} ${price.toLocaleString()}\n` +
      `🛒 Link in bio to order\n` +
      `📦 Delivery across Kenya\n` +
      `💳 Secure M-Pesa payment\n\n` +
      `${hashtags.join(" ")}`;

    // Save to database
    const { data: pack, error: saveErr } = await adminDb
      .from("sales_packs")
      .upsert({
        product_id: productId,
        store_id: storeId,
        seller_id: user.id,
        whatsapp_launch_message: whatsappLaunch,
        whatsapp_followup_message: whatsappFollowup,
        whatsapp_urgency_message: whatsappUrgency,
        instagram_caption: instagramCaption,
        instagram_hashtags: hashtags,
        status: "generated",
        generated_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }, { onConflict: "product_id,seller_id" })
      .select()
      .single();

    if (saveErr) {
      // If upsert fails due to no unique constraint, do insert
      const { data: pack2, error: saveErr2 } = await adminDb
        .from("sales_packs")
        .insert({
          product_id: productId,
          store_id: storeId,
          seller_id: user.id,
          whatsapp_launch_message: whatsappLaunch,
          whatsapp_followup_message: whatsappFollowup,
          whatsapp_urgency_message: whatsappUrgency,
          instagram_caption: instagramCaption,
          instagram_hashtags: hashtags,
          status: "generated",
          generated_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (saveErr2) {
        return json({ success: false, error: saveErr2.message }, 500);
      }

      // Also generate default quick replies
      await generateQuickReplies(adminDb, productId, storeId, user.id, product, productUrl, currency);

      return json({ success: true, data: pack2 });
    }

    // Generate default quick replies
    await generateQuickReplies(adminDb, productId, storeId, user.id, product, productUrl, currency);

    return json({ success: true, data: pack });
  }

  // GET /pack/:productId - Get sales pack for a product
  if (path.startsWith("/pack/") && req.method === "GET") {
    if (!user) return json({ success: false, error: "Unauthorized" }, 401);
    const productId = path.split("/pack/")[1];

    const { data, error } = await supabase
      .from("sales_packs")
      .select("*")
      .eq("product_id", productId)
      .eq("seller_id", user.id)
      .maybeSingle();

    if (error) return json({ success: false, error: error.message }, 500);
    return json({ success: true, data });
  }

  // GET /quick-replies/:productId - Get quick replies
  if (path.startsWith("/quick-replies/") && req.method === "GET") {
    if (!user) return json({ success: false, error: "Unauthorized" }, 401);
    const productId = path.split("/quick-replies/")[1];

    const { data, error } = await supabase
      .from("quick_replies")
      .select("*")
      .eq("product_id", productId)
      .eq("seller_id", user.id)
      .order("created_at");

    if (error) return json({ success: false, error: error.message }, 500);
    return json({ success: true, data });
  }

  // GET /quick-replies - Get all quick replies for seller
  if (path === "/quick-replies" && req.method === "GET") {
    if (!user) return json({ success: false, error: "Unauthorized" }, 401);

    const { data, error } = await supabase
      .from("quick_replies")
      .select("*, products(name, price, images)")
      .eq("seller_id", user.id)
      .order("created_at");

    if (error) return json({ success: false, error: error.message }, 500);
    return json({ success: true, data });
  }

  // POST /track - Track link analytics (public)
  if (path === "/track" && req.method === "POST") {
    const body = await req.json();
    const { transactionId, productId, storeId, eventType, source, referrer } = body;

    const { error } = await adminDb.from("link_analytics").insert({
      transaction_id: transactionId || null,
      product_id: productId || null,
      store_id: storeId || null,
      event_type: eventType || "view",
      source: source || "direct",
      referrer: referrer || null,
      user_agent: req.headers.get("user-agent") || null,
    });

    if (error) return json({ success: false, error: error.message }, 500);
    return json({ success: true });
  }

  // GET /analytics/:storeId - Get link analytics summary
  if (path.startsWith("/analytics/") && req.method === "GET") {
    if (!user) return json({ success: false, error: "Unauthorized" }, 401);
    const storeId = path.split("/analytics/")[1];

    const { data, error } = await supabase
      .from("link_analytics")
      .select("event_type, source, created_at, product_id")
      .eq("store_id", storeId)
      .order("created_at", { ascending: false })
      .limit(1000);

    if (error) return json({ success: false, error: error.message }, 500);

    // Aggregate
    const totalViews = data?.filter(d => d.event_type === "view").length || 0;
    const totalClicks = data?.filter(d => d.event_type === "click").length || 0;
    const totalCheckouts = data?.filter(d => d.event_type === "checkout").length || 0;

    const sources: Record<string, number> = {};
    data?.forEach(d => {
      sources[d.source || "direct"] = (sources[d.source || "direct"] || 0) + 1;
    });

    return json({
      success: true,
      data: {
        totalViews,
        totalClicks,
        totalCheckouts,
        conversionRate: totalViews > 0 ? ((totalCheckouts / totalViews) * 100).toFixed(1) : "0",
        sources,
        recentEvents: data?.slice(0, 20),
      },
    });
  }

  return json({ success: false, error: "Not found" }, 404);
});

async function generateQuickReplies(
  db: any,
  productId: string,
  storeId: string,
  sellerId: string,
  product: any,
  productUrl: string,
  currency: string
) {
  const price = product.price || 0;
  const name = product.name;

  const defaultReplies = [
    { trigger: "Is it available?", reply: `Yes! ✅ ${name} is in stock. Order here: ${productUrl}`, category: "availability" },
    { trigger: "How much?", reply: `${name} is ${currency} ${price.toLocaleString()}. Order securely here: ${productUrl} 😊`, category: "pricing" },
    { trigger: "How much is delivery?", reply: `Free delivery in Nairobi! Outside Nairobi: KES 200 extra. Order: ${productUrl}`, category: "shipping" },
    { trigger: "Can I pay on delivery?", reply: `We do M-Pesa only — it's safer for both of us! 😊 Order: ${productUrl}`, category: "payment" },
    { trigger: "When will I get it?", reply: `Nairobi deliveries within 24 hours of payment. Outside: 2-3 days. Order: ${productUrl}`, category: "shipping" },
    { trigger: "Can I see more photos?", reply: `Of course! Check out all the photos and details here: ${productUrl} 📸`, category: "general" },
    { trigger: "Do you do bulk orders?", reply: `Yes! For 5+ pieces we offer discounts. How many do you need? 😊`, category: "pricing" },
    { trigger: "Is this quality?", reply: `100% genuine quality! Check our store reviews and order with buyer protection: ${productUrl} 🌟`, category: "trust" },
  ];

  // Delete existing quick replies for this product
  await db.from("quick_replies").delete().eq("product_id", productId).eq("seller_id", sellerId);

  // Insert new ones
  const rows = defaultReplies.map(r => ({
    product_id: productId,
    store_id: storeId,
    seller_id: sellerId,
    trigger_question: r.trigger,
    reply_template: r.reply,
    category: r.category,
  }));

  await db.from("quick_replies").insert(rows);
}
