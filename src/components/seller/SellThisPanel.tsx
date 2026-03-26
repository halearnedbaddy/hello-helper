import { useState, useCallback } from "react";
import { X, Copy, Check, MessageCircle, Share2, Link2, ExternalLink } from "lucide-react";
import { useCurrency } from "@/hooks/useCurrency";
import { useToast } from "@/hooks/use-toast";

interface Product {
  id: string;
  name: string;
  price: number;
  images?: string[];
  store_id: string;
  currency?: string;
  description?: string;
}

interface SellThisPanelProps {
  product: Product;
  storeSlug: string;
  storeName: string;
  onClose: () => void;
}

export function SellThisPanel({ product, storeSlug, storeName, onClose }: SellThisPanelProps) {
  const { formatPrice } = useCurrency();
  const { toast } = useToast();
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const productUrl = `${window.location.origin}/store/${storeSlug}/product/${product.id}`;
  const currency = product.currency || "KES";
  const price = product.price || 0;

  const messages = [
    {
      id: "new-arrival",
      label: "🆕 New Arrival",
      text: `🆕 NEW at ${storeName}!\n\n${product.name}\n💰 ${currency} ${price.toLocaleString()}\n\n🛒 Order now: ${productUrl}\n\n✅ Secure M-Pesa payment\n📦 Fast delivery`,
    },
    {
      id: "flash-sale",
      label: "⚡ Flash Sale",
      text: `⚡ FLASH SALE!\n\n${product.name}\n💰 Only ${currency} ${price.toLocaleString()}\n\n⏰ Limited time offer!\n🛒 Grab yours: ${productUrl}`,
    },
    {
      id: "low-stock",
      label: "🔥 Low Stock",
      text: `🔥 Almost SOLD OUT!\n\n${product.name} — ${currency} ${price.toLocaleString()}\n\nDon't miss out!\n🛒 Order: ${productUrl}`,
    },
    {
      id: "followup",
      label: "🔄 Follow-up",
      text: `Hey! 👋 Still thinking about the ${product.name}?\n\nJust ${currency} ${price.toLocaleString()}\n\n🛒 Order here: ${productUrl}\n\nQuestions? Reply here! 😊`,
    },
  ];

  const copyText = useCallback(async (text: string, fieldId: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(fieldId);
      setTimeout(() => setCopiedField(null), 2000);
    } catch {
      toast({ title: "Failed to copy", variant: "destructive" });
    }
  }, [toast]);

  const shareToWhatsApp = useCallback((text: string) => {
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
  }, []);


  const copyLink = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(productUrl);
      setCopiedField("link");
      toast({ title: "Link copied!" });
      setTimeout(() => setCopiedField(null), 2000);
    } catch {
      toast({ title: "Failed to copy", variant: "destructive" });
    }
  }, [productUrl, toast]);

  const nativeShare = useCallback(async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: product.name,
          text: `Check out ${product.name} — ${currency} ${price.toLocaleString()}`,
          url: productUrl,
        });
      } catch {}
    }
  }, [product.name, currency, price, productUrl]);

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center">
      <div className="bg-card w-full max-w-lg max-h-[90vh] rounded-t-2xl sm:rounded-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-border flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            {product.images?.[0] && (
              <img src={product.images[0]} alt="" className="w-10 h-10 rounded-lg object-cover" />
            )}
            <div>
              <h3 className="font-bold text-foreground text-sm">Sell This Product</h3>
              <p className="text-xs text-muted-foreground">{product.name} • {formatPrice(price, currency)}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-muted rounded-full transition">
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto flex-1 p-4 space-y-4">
          {/* Quick Share Actions */}
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">Quick Share</p>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={copyLink}
                className="flex items-center gap-2 p-3 bg-muted/50 hover:bg-muted rounded-lg transition text-sm"
              >
                {copiedField === "link" ? <Check size={18} className="text-primary" /> : <Link2 size={18} />}
                {copiedField === "link" ? "Copied!" : "Copy Link"}
              </button>
              <button
                onClick={() => shareToWhatsApp(`Check out ${product.name}! ${productUrl}`)}
                className="flex items-center gap-2 p-3 bg-[#25D366]/10 hover:bg-[#25D366]/20 text-[#25D366] rounded-lg transition text-sm font-medium"
              >
                <MessageCircle size={18} />
                WhatsApp
              </button>
              {"share" in navigator && (
                <button
                  onClick={nativeShare}
                  className="flex items-center gap-2 p-3 bg-muted/50 hover:bg-muted rounded-lg transition text-sm col-span-2"
                >
                  <Share2 size={18} />
                  Share via...
                </button>
              )}
            </div>
          </div>

          {/* Pre-written Messages */}
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">Ready-Made Messages</p>
            <div className="space-y-3">
              {messages.map((msg) => (
                <div key={msg.id} className="bg-muted/50 rounded-lg p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-foreground">{msg.label}</span>
                  </div>
                  <pre className="text-xs text-muted-foreground whitespace-pre-wrap font-sans leading-relaxed mb-2 line-clamp-4">
                    {msg.text}
                  </pre>
                  <div className="flex gap-2">
                    <button
                      onClick={() => copyText(msg.text, msg.id)}
                      className="flex items-center gap-1 px-2.5 py-1 bg-card border border-border rounded text-xs hover:bg-muted transition"
                    >
                      {copiedField === msg.id ? <Check size={12} className="text-primary" /> : <Copy size={12} />}
                      {copiedField === msg.id ? "Copied" : "Copy"}
                    </button>
                    <button
                      onClick={() => shareToWhatsApp(msg.text)}
                      className="flex items-center gap-1 px-2.5 py-1 bg-[#25D366] text-white rounded text-xs hover:bg-[#20BD5A] transition"
                    >
                      <MessageCircle size={12} />
                      Send
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Product Link */}
          <div className="bg-primary/5 border border-primary/20 rounded-lg p-3">
            <p className="text-xs font-bold text-foreground mb-1">🔗 Product Link</p>
            <p className="text-xs text-muted-foreground break-all mb-2">{productUrl}</p>
            <a href={productUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs text-primary hover:underline">
              <ExternalLink size={12} /> Preview product page
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
