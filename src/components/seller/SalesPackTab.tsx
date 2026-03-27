import { useState, useEffect, useCallback } from "react";
import { Copy, Check, MessageCircle, Loader2, Sparkles, ChevronDown, ChevronUp } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "@/lib/supabaseProject";
import { useToast } from "@/hooks/use-toast";
import { useCurrency } from "@/hooks/useCurrency";

interface Product {
  id: string;
  name: string;
  price: number;
  images: string[];
  status: string;
  store_id: string;
  quantity?: number;
  currency?: string;
}

interface SalesPack {
  id: string;
  product_id: string;
  whatsapp_launch_message: string;
  whatsapp_followup_message: string;
  whatsapp_urgency_message: string;
  instagram_caption: string;
  instagram_hashtags: string[];
  generated_at: string;
}

interface QuickReply {
  id: string;
  trigger_question: string;
  reply_template: string;
  category: string;
}

async function getHeaders() {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    apikey: SUPABASE_ANON_KEY,
  };
  const { data: { session } } = await supabase.auth.getSession();
  if (session?.access_token) headers.Authorization = `Bearer ${session.access_token}`;
  return headers;
}

export function SalesPackTab() {
  const { toast } = useToast();
  const { formatPrice } = useCurrency();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [generatingId, setGeneratingId] = useState<string | null>(null);
  const [bulkGenerating, setBulkGenerating] = useState(false);
  const [bulkProgress, setBulkProgress] = useState({ done: 0, total: 0 });
  const [expandedProduct, setExpandedProduct] = useState<string | null>(null);
  const [packs, setPacks] = useState<Record<string, SalesPack>>({});
  const [quickReplies, setQuickReplies] = useState<Record<string, QuickReply[]>>({});
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [activeContentTab, setActiveContentTab] = useState<string>("whatsapp");

  useEffect(() => {
    loadProducts();
  }, []);

  const loadProducts = async () => {
    setLoading(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { setLoading(false); return; }

    // Get seller's store
    const { data: store } = await supabase
      .from("stores")
      .select("id")
      .eq("seller_id", session.user.id)
      .maybeSingle();

    if (!store) { setLoading(false); return; }

    // Get published products
    const { data: prods } = await supabase
      .from("products")
      .select("*")
      .eq("store_id", store.id)
      .eq("status", "published")
      .order("created_at", { ascending: false });

    setProducts((prods as Product[]) || []);
    setLoading(false);
  };

  const generatePack = useCallback(async (product: Product) => {
    setGeneratingId(product.id);
    try {
      const headers = await getHeaders();
      const res = await fetch(`${SUPABASE_URL}/functions/v1/sales-pack-api/generate`, {
        method: "POST",
        headers,
        body: JSON.stringify({ productId: product.id, storeId: product.store_id }),
      });
      const data = await res.json();
      if (data.success && data.data) {
        setPacks(prev => ({ ...prev, [product.id]: data.data }));
        setExpandedProduct(product.id);
        // Also load quick replies
        await loadQuickReplies(product.id);
        toast({ title: "🎉 Sales Pack Generated!", description: "Your content is ready to share" });
      } else {
        toast({ title: "Error", description: data.error || "Failed to generate", variant: "destructive" });
      }
    } catch (err) {
      toast({ title: "Error", description: "Network error", variant: "destructive" });
    } finally {
      setGeneratingId(null);
    }
  }, [toast]);

  const loadPack = useCallback(async (productId: string) => {
    const headers = await getHeaders();
    const res = await fetch(`${SUPABASE_URL}/functions/v1/sales-pack-api/pack/${productId}`, { headers });
    const data = await res.json();
    if (data.success && data.data) {
      setPacks(prev => ({ ...prev, [productId]: data.data }));
    }
  }, []);

  const loadQuickReplies = useCallback(async (productId: string) => {
    const headers = await getHeaders();
    const res = await fetch(`${SUPABASE_URL}/functions/v1/sales-pack-api/quick-replies/${productId}`, { headers });
    const data = await res.json();
    if (data.success && data.data) {
      setQuickReplies(prev => ({ ...prev, [productId]: data.data }));
    }
  }, []);

  const handleExpand = useCallback(async (productId: string) => {
    if (expandedProduct === productId) {
      setExpandedProduct(null);
      return;
    }
    setExpandedProduct(productId);
    if (!packs[productId]) await loadPack(productId);
    if (!quickReplies[productId]) await loadQuickReplies(productId);
  }, [expandedProduct, packs, quickReplies, loadPack, loadQuickReplies]);

  const copyToClipboard = useCallback(async (text: string, fieldId: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(fieldId);
      setTimeout(() => setCopiedField(null), 2000);
    } catch {
      toast({ title: "Failed to copy", variant: "destructive" });
    }
  }, [toast]);

  const shareToWhatsApp = useCallback((text: string) => {
    const encoded = encodeURIComponent(text);
    window.open(`https://wa.me/?text=${encoded}`, "_blank");
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">🎨 Auto-Sales Pack Generator</h2>
        <p className="text-muted-foreground mt-1">
          Generate ready-to-share WhatsApp messages, Instagram captions, and quick reply templates for each product — in seconds.
        </p>
      </div>

      {products.length === 0 ? (
        <div className="bg-card border border-border rounded-xl p-8 text-center">
          <Sparkles className="w-12 h-12 mx-auto mb-4 text-muted-foreground/50" />
          <p className="text-muted-foreground mb-2">No published products yet</p>
          <p className="text-sm text-muted-foreground">Publish products first, then generate sales packs for them.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {products.map((product) => {
            const pack = packs[product.id];
            const replies = quickReplies[product.id] || [];
            const isExpanded = expandedProduct === product.id;
            const isGenerating = generatingId === product.id;

            return (
              <div key={product.id} className="bg-card border border-border rounded-xl overflow-hidden">
                {/* Product Header */}
                <div className="p-4 flex items-center gap-4">
                  {product.images?.[0] ? (
                    <img src={product.images[0]} alt="" className="w-16 h-16 rounded-lg object-cover shrink-0" />
                  ) : (
                    <div className="w-16 h-16 rounded-lg bg-muted flex items-center justify-center shrink-0 text-2xl">📦</div>
                  )}
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-foreground truncate">{product.name}</h3>
                    <p className="text-sm text-primary font-semibold">
                      {formatPrice(product.price, product.currency || "KES")}
                    </p>
                    {product.quantity !== undefined && product.quantity <= 5 && product.quantity > 0 && (
                      <span className="text-xs px-2 py-0.5 bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300 rounded-full">
                        🔥 {product.quantity} left
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => generatePack(product)}
                      disabled={isGenerating}
                      className="px-4 py-2 bg-primary text-primary-foreground rounded-lg font-semibold text-sm hover:bg-primary/90 transition disabled:opacity-50 flex items-center gap-2"
                    >
                      {isGenerating ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
                      {pack ? "Regenerate" : "Generate Pack"}
                    </button>
                    {pack && (
                      <button
                        onClick={() => handleExpand(product.id)}
                        className="p-2 hover:bg-muted rounded-lg transition"
                      >
                        {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                      </button>
                    )}
                  </div>
                </div>

                {/* Expanded Content */}
                {isExpanded && pack && (
                  <div className="border-t border-border">
                    {/* Content Tabs */}
                    <div className="flex border-b border-border">
                      {[
                        { id: "whatsapp", label: "WhatsApp", icon: "💬" },
                        { id: "instagram", label: "Instagram", icon: "📸" },
                        { id: "quick-replies", label: "Quick Replies", icon: "⚡" },
                      ].map(tab => (
                        <button
                          key={tab.id}
                          onClick={() => setActiveContentTab(tab.id)}
                          className={`flex-1 px-4 py-3 text-sm font-medium transition border-b-2 ${
                            activeContentTab === tab.id
                              ? "border-primary text-primary"
                              : "border-transparent text-muted-foreground hover:text-foreground"
                          }`}
                        >
                          {tab.icon} {tab.label}
                        </button>
                      ))}
                    </div>

                    <div className="p-4 space-y-4">
                      {/* WhatsApp Messages */}
                      {activeContentTab === "whatsapp" && (
                        <div className="space-y-4">
                          {[
                            { label: "🚀 Product Launch", text: pack.whatsapp_launch_message, style: "New Arrival" },
                            { label: "🔄 Follow-up", text: pack.whatsapp_followup_message, style: "Re-engagement" },
                            { label: "⚡ Urgency", text: pack.whatsapp_urgency_message, style: "Flash Sale" },
                          ].map((msg, i) => (
                            <div key={i} className="bg-muted/50 rounded-lg p-4">
                              <div className="flex items-center justify-between mb-2">
                                <span className="text-sm font-bold text-foreground">{msg.label}</span>
                                <span className="text-xs px-2 py-0.5 bg-primary/10 text-primary rounded-full">{msg.style}</span>
                              </div>
                              <pre className="text-sm text-foreground whitespace-pre-wrap font-sans leading-relaxed mb-3">{msg.text}</pre>
                              <div className="flex gap-2">
                                <button
                                  onClick={() => copyToClipboard(msg.text, `wa-${i}-${product.id}`)}
                                  className="flex items-center gap-1.5 px-3 py-1.5 bg-card border border-border rounded-lg text-sm hover:bg-muted transition"
                                >
                                  {copiedField === `wa-${i}-${product.id}` ? <Check size={14} className="text-primary" /> : <Copy size={14} />}
                                  {copiedField === `wa-${i}-${product.id}` ? "Copied!" : "Copy"}
                                </button>
                                <button
                                  onClick={() => shareToWhatsApp(msg.text)}
                                  className="flex items-center gap-1.5 px-3 py-1.5 bg-[#25D366] text-white rounded-lg text-sm hover:bg-[#20BD5A] transition"
                                >
                                  <MessageCircle size={14} />
                                  Share to WhatsApp
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Instagram Caption */}
                      {activeContentTab === "instagram" && (
                        <div className="space-y-4">
                          <div className="bg-muted/50 rounded-lg p-4">
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-sm font-bold text-foreground">📸 Instagram Caption + Hashtags</span>
                            </div>
                            <pre className="text-sm text-foreground whitespace-pre-wrap font-sans leading-relaxed mb-3">{pack.instagram_caption}</pre>
                            <div className="flex gap-2">
                              <button
                                onClick={() => copyToClipboard(pack.instagram_caption, `ig-${product.id}`)}
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-card border border-border rounded-lg text-sm hover:bg-muted transition"
                              >
                                {copiedField === `ig-${product.id}` ? <Check size={14} className="text-primary" /> : <Copy size={14} />}
                                {copiedField === `ig-${product.id}` ? "Copied!" : "Copy Caption"}
                              </button>
                            </div>
                          </div>
                          {pack.instagram_hashtags && pack.instagram_hashtags.length > 0 && (
                            <div className="bg-muted/50 rounded-lg p-4">
                              <span className="text-sm font-bold text-foreground mb-2 block"># Hashtags</span>
                              <div className="flex flex-wrap gap-2 mb-3">
                                {pack.instagram_hashtags.map((tag, i) => (
                                  <span key={i} className="px-2 py-1 bg-primary/10 text-primary rounded-full text-xs font-medium">{tag}</span>
                                ))}
                              </div>
                              <button
                                onClick={() => copyToClipboard(pack.instagram_hashtags.join(" "), `tags-${product.id}`)}
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-card border border-border rounded-lg text-sm hover:bg-muted transition"
                              >
                                {copiedField === `tags-${product.id}` ? <Check size={14} className="text-primary" /> : <Copy size={14} />}
                                Copy All Hashtags
                              </button>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Quick Replies */}
                      {activeContentTab === "quick-replies" && (
                        <div className="space-y-3">
                          <p className="text-sm text-muted-foreground">
                            Pre-written answers for common customer questions. Copy and save as Quick Replies in WhatsApp Business.
                          </p>
                          {replies.length === 0 ? (
                            <p className="text-sm text-muted-foreground py-4 text-center">
                              Generate a sales pack first to create quick replies.
                            </p>
                          ) : (
                            replies.map((qr) => (
                              <div key={qr.id} className="bg-muted/50 rounded-lg p-4">
                                <div className="flex items-start gap-3">
                                  <div className="flex-1">
                                    <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1">
                                      Customer asks: "{qr.trigger_question}"
                                    </p>
                                    <p className="text-sm text-foreground">{qr.reply_template}</p>
                                  </div>
                                  <button
                                    onClick={() => copyToClipboard(qr.reply_template, `qr-${qr.id}`)}
                                    className="shrink-0 p-2 hover:bg-muted rounded-lg transition"
                                    title="Copy reply"
                                  >
                                    {copiedField === `qr-${qr.id}` ? <Check size={16} className="text-primary" /> : <Copy size={16} className="text-muted-foreground" />}
                                  </button>
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
