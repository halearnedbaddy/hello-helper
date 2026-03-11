import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useCurrency } from '@/hooks/useCurrency';
import { useCart } from '@/hooks/useCart';
import { useToast } from '@/hooks/use-toast';
import { 
  Search, ShoppingCart, Star, ChevronDown, Package, Shield, Clock, Heart, Share2,
  CheckCircle, AlertCircle, Store as StoreIcon, ArrowLeft
} from 'lucide-react';
import { StorefrontChatWidget } from '@/components/chat/StorefrontChatWidget';
import { CartDrawer, BuyerDetails } from '@/components/store/CartDrawer';
import { CartItem } from '@/hooks/useCart';

const SUPABASE_URL = "https://krkybhborwvcbjzjcghw.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imtya3liaGJvcnd2Y2JqempjZ2h3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE0OTYwNDksImV4cCI6MjA4NzA3MjA0OX0.mwm0aTd9ZBltJD5VgOFN7vZ6jibpKsF8dGdcSwOg1cw";

interface StorefrontProduct {
  id: string;
  name: string;
  description?: string;
  price?: number;
  images?: string[];
  currency?: string;
  is_available?: boolean;
  availability_note?: string;
  status?: string;
}

interface SellerProfile {
  rating?: number;
  total_reviews?: number;
  is_verified?: boolean;
  total_sales?: number;
}

interface StorefrontData {
  id: string;
  name: string;
  slug: string;
  status: string;
  bio?: string;
  logo?: string;
  products: StorefrontProduct[];
  seller?: {
    name: string;
    email?: string;
    phone?: string;
  };
  sellerProfile?: SellerProfile;
}

export function StoreFrontPage() {
  const { storeSlug } = useParams();
  const { formatPrice } = useCurrency();
  const { cart, addToCart } = useCart();
  const { toast } = useToast();
  const [store, setStore] = useState<StorefrontData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'newest' | 'price-low' | 'price-high' | 'popular'>('newest');
  const [cartOpen, setCartOpen] = useState(false);

  const handlePlaceOrder = async (items: CartItem[], buyerDetails: BuyerDetails) => {
    if (!storeSlug) throw new Error('Store not found');
    // Create order for each item - sends to seller for confirmation
    for (const item of items) {
      const response = await fetch(
        `${SUPABASE_URL}/functions/v1/storefront-api/checkout/${encodeURIComponent(storeSlug)}/${encodeURIComponent(item.id)}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({
            buyerName: buyerDetails.name,
            buyerPhone: buyerDetails.phone,
            buyerEmail: buyerDetails.email || undefined,
            deliveryAddress: buyerDetails.address || undefined,
            paymentMethod: 'PENDING_CONFIRMATION',
            quantity: item.quantity,
          }),
        }
      );
      const data = await response.json();
      if (!response.ok || !data?.success) {
        throw new Error(data?.error || `Failed to place order for ${item.name}`);
      }
    }
    toast({
      title: "Order Placed! 🎉",
      description: "Your order has been sent to the seller for confirmation. You'll be notified when it's accepted.",
    });
  };

  const handleQuickAddToCart = (e: React.MouseEvent, product: StorefrontProduct) => {
    e.preventDefault();
    e.stopPropagation();
    if (!product.price) return;
    addToCart({
      id: product.id,
      name: product.name,
      price: product.price,
      image: product.images?.[0],
      quantity: 1,
      sellerId: store?.id || '',
      sellerName: store?.seller?.name || 'Seller',
    });
    toast({
      title: "Added to Cart",
      description: `${product.name} added to your cart`,
    });
  };

  useEffect(() => {
    let mounted = true;
    async function load() {
      if (!storeSlug) return;
      setLoading(true);
      
      try {
        const response = await fetch(`${SUPABASE_URL}/functions/v1/storefront-api/store/${encodeURIComponent(storeSlug)}`, {
          headers: {
            'Content-Type': 'application/json',
            'apikey': SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
          },
        });
        
        const res = await response.json();
        
        if (!mounted) return;
        if (res.success && res.data) {
          setStore(res.data as StorefrontData);
          setError(null);
        } else {
          setError(res.error || 'Failed to load store');
        }
      } catch (err) {
        if (mounted) {
          setError('Failed to connect to server');
        }
      }
      setLoading(false);
    }
    load();
    return () => {
      mounted = false;
    };
  }, [storeSlug]);

  // Filter and sort products
  const filteredProducts = store?.products?.filter(p => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return p.name?.toLowerCase().includes(query) || 
           p.description?.toLowerCase().includes(query);
  }) || [];

  const sortedProducts = [...filteredProducts].sort((a, b) => {
    switch (sortBy) {
      case 'price-low':
        return (a.price || 0) - (b.price || 0);
      case 'price-high':
        return (b.price || 0) - (a.price || 0);
      case 'popular':
        return 0; // Would need popularity data
      case 'newest':
      default:
        return 0;
    }
  });

  if (loading) {
    return (
      <div className="min-h-screen bg-background animate-pulse">
        <div className="border-b border-border bg-card px-4 py-6">
          <div className="max-w-7xl mx-auto flex items-center gap-4">
            <div className="h-16 w-16 bg-muted rounded-xl" />
            <div className="space-y-2">
              <div className="h-6 w-48 bg-muted rounded" />
              <div className="h-4 w-32 bg-muted rounded" />
            </div>
          </div>
        </div>
        <div className="max-w-7xl mx-auto p-4 md:p-6">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="space-y-2">
                <div className="aspect-square bg-muted rounded-xl" />
                <div className="h-4 w-3/4 bg-muted rounded" />
                <div className="h-4 w-16 bg-muted rounded" />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error || !store) {
    const isInactiveError = error?.toLowerCase().includes('inactive') || error?.toLowerCase().includes('activate');
    
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="bg-card border border-border rounded-xl p-8 text-center max-w-md shadow-lg">
          <div className="mb-6">
            <div className="w-20 h-20 bg-destructive/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="w-10 h-10 text-destructive" />
            </div>
            <h1 className="text-2xl font-bold text-foreground mb-2">
              {isInactiveError ? 'Store Not Active' : 'Store Unavailable'}
            </h1>
            <p className="text-muted-foreground mb-4">
              {error || 'The store could not be found or is currently unavailable.'}
            </p>
            {isInactiveError && (
              <div className="bg-primary/5 border border-primary/20 rounded-lg p-4 text-left text-sm text-primary mb-4">
                <p className="font-semibold mb-2">If you're the store owner:</p>
                <ul className="list-disc list-inside space-y-1 text-primary/80">
                  <li>Go to your Seller Dashboard</li>
                  <li>Navigate to Store Settings</li>
                  <li>Activate your store</li>
                </ul>
              </div>
            )}
          </div>
          <Link 
            to="/" 
            className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition font-medium"
          >
            <ArrowLeft size={18} />
            Return Home
          </Link>
        </div>
      </div>
    );
  }

  const sellerRating = store.sellerProfile?.rating || 0;
  const totalReviews = store.sellerProfile?.total_reviews || 0;
  const isVerified = store.sellerProfile?.is_verified || false;
  const totalSales = store.sellerProfile?.total_sales || 0;

  return (
    <div className="min-h-screen bg-background">
      {/* Store Header Banner */}
      <header className="bg-gradient-to-r from-primary to-primary/80 text-primary-foreground relative overflow-hidden">
        {/* Pattern overlay */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9ImdyaWQiIHdpZHRoPSI2MCIgaGVpZ2h0PSI2MCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHBhdGggZD0iTSAwIDYwIEwgNjAgMCIgc3Ryb2tlPSJyZ2JhKDI1NSwyNTUsMjU1LDAuMykiIHN0cm9rZS13aWR0aD0iMSIgZmlsbD0ibm9uZSIvPjwvcGF0dGVybj48L2RlZnM+PHJlY3Qgd2lkdGg9IjEwMCUiIGhlaWdodD0iMTAwJSIgZmlsbD0idXJsKCNncmlkKSIvPjwvc3ZnPg==')]" />
        </div>
        
        <div className="max-w-6xl mx-auto px-4 py-8 relative">
          {/* Top navigation */}
          <div className="flex items-center justify-between mb-6">
            <Link to="/" className="flex items-center gap-2 text-primary-foreground/80 hover:text-primary-foreground transition">
              <ArrowLeft size={20} />
              <span className="text-sm font-medium">Back to Home</span>
            </Link>
            <button 
              onClick={async () => {
                const url = window.location.href;
                if (navigator.share) {
                  try { await navigator.share({ title: store?.name, url }); } catch { /* cancelled */ }
                } else {
                  await navigator.clipboard.writeText(url);
                  toast({ title: "Store link copied!" });
                }
              }}
              className="p-2 hover:bg-primary-foreground/10 rounded-full transition"
            >
              <Share2 size={20} />
            </button>
          </div>

          {/* Store info */}
          <div className="flex flex-col md:flex-row items-start md:items-center gap-6">
            {/* Store logo */}
            {store.logo ? (
              <img 
                src={store.logo} 
                alt={store.name} 
                className="w-24 h-24 md:w-28 md:h-28 rounded-2xl object-cover ring-4 ring-primary-foreground/20 shadow-lg"
              />
            ) : (
              <div className="w-24 h-24 md:w-28 md:h-28 rounded-2xl bg-primary-foreground/20 flex items-center justify-center ring-4 ring-primary-foreground/20">
                <StoreIcon size={40} className="text-primary-foreground/60" />
              </div>
            )}

            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <h1 className="text-2xl md:text-3xl font-bold">{store.name}</h1>
                {isVerified && (
                  <span className="inline-flex items-center gap-1 px-2 py-1 bg-primary-foreground/20 rounded-full text-xs font-medium">
                    <CheckCircle size={14} />
                    Verified
                  </span>
                )}
              </div>
              
              {store.bio && (
                <p className="text-primary-foreground/80 mb-3 max-w-xl">{store.bio}</p>
              )}

              <div className="flex flex-wrap items-center gap-4 text-sm">
                {sellerRating > 0 && (
                  <div className="flex items-center gap-1">
                    <Star size={16} className="fill-primary text-primary" />
                    <span className="font-medium">{sellerRating.toFixed(1)}</span>
                    <span className="text-primary-foreground/60">({totalReviews} reviews)</span>
                  </div>
                )}
                <div className="flex items-center gap-1 text-primary-foreground/80">
                  <Package size={16} />
                  <span>{sortedProducts.length} Products</span>
                </div>
                {totalSales > 0 && (
                  <div className="flex items-center gap-1 text-primary-foreground/80">
                    <ShoppingCart size={16} />
                    <span>{totalSales} Sales</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Security badge */}
      <div className="bg-primary/5 border-b border-primary/10">
        <div className="max-w-6xl mx-auto px-4 py-3">
          <div className="flex items-center justify-center gap-6 text-sm text-primary">
            <div className="flex items-center gap-2">
              <Shield size={16} />
              <span>Secure Payments</span>
            </div>
            <div className="flex items-center gap-2">
              <Clock size={16} />
              <span>Money-back Guarantee</span>
            </div>
          </div>
        </div>
      </div>

      {/* Search and Filter Bar */}
      <div className="sticky top-0 z-20 bg-background border-b border-border shadow-sm">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex flex-col sm:flex-row gap-4">
            {/* Search */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={20} />
              <input
                type="text"
                placeholder="Search products..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 border border-input rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition"
              />
            </div>

            {/* Sort dropdown */}
            <div className="relative">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="appearance-none px-4 py-2.5 pr-10 border border-input rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition cursor-pointer"
              >
                <option value="newest">Newest First</option>
                <option value="price-low">Price: Low to High</option>
                <option value="price-high">Price: High to Low</option>
                <option value="popular">Most Popular</option>
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" size={18} />
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-4 py-8">
        {sortedProducts.length === 0 ? (
          <div className="bg-card border border-border rounded-xl p-12 text-center">
            <Package className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-foreground mb-2">
              {searchQuery ? 'No products found' : 'No products available'}
            </h2>
            <p className="text-muted-foreground">
              {searchQuery 
                ? `No products match "${searchQuery}". Try a different search term.`
                : 'This store hasn\'t added any products yet. Check back later!'}
            </p>
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="mt-4 px-4 py-2 text-primary hover:underline"
              >
                Clear search
              </button>
            )}
          </div>
        ) : (
          <>
            {/* Results count */}
            <div className="flex items-center justify-between mb-6">
              <p className="text-muted-foreground">
                Showing <span className="font-medium text-foreground">{sortedProducts.length}</span> products
              </p>
            </div>

            {/* Products Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {sortedProducts.map((product) => {
                const isUnavailable = product.is_available === false;
                
                return (
                  <Link
                    key={product.id}
                    to={`/store/${store.slug}/product/${product.id}`}
                    className="group bg-card border border-border rounded-xl overflow-hidden hover:shadow-lg hover:border-primary/30 transition-all duration-300"
                  >
                    {/* Product Image */}
                    <div className="aspect-square relative bg-muted overflow-hidden">
                      {product.images && product.images.length > 0 ? (
                        <img 
                          src={product.images[0]} 
                          alt={product.name} 
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Package size={48} className="text-muted-foreground/40" />
                        </div>
                      )}

                      {/* Unavailable overlay */}
                      {isUnavailable && (
                        <div className="absolute inset-0 bg-background/80 flex items-center justify-center">
                          <span className="px-4 py-2 bg-muted text-muted-foreground rounded-full font-medium text-sm">
                            Out of Stock
                          </span>
                        </div>
                      )}

                      {/* Quick actions */}
                      <div className="absolute top-3 right-3 flex flex-col gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button 
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            toast({ title: "Added to wishlist ❤️", description: product.name });
                          }}
                          className="p-2 bg-background/90 rounded-full hover:bg-background transition shadow-sm"
                        >
                          <Heart size={18} className="text-muted-foreground hover:text-red-500 transition-colors" />
                        </button>
                        {!isUnavailable && product.price && (
                          <button 
                            onClick={(e) => handleQuickAddToCart(e, product)}
                            className="p-2 bg-primary text-primary-foreground rounded-full hover:bg-primary/90 transition shadow-sm"
                          >
                            <ShoppingCart size={18} />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Product Info */}
                    <div className="p-4">
                      <h3 className="font-semibold text-foreground line-clamp-2 mb-2 group-hover:text-primary transition-colors">
                        {product.name}
                      </h3>
                      
                      {product.description && (
                        <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
                          {product.description}
                        </p>
                      )}

                      <div className="flex items-center justify-between">
                        <span className="text-lg font-bold text-primary">
                          {typeof product.price === 'number' 
                            ? formatPrice(product.price, product.currency || 'KES')
                            : 'Price on request'}
                        </span>
                        
                        {!isUnavailable && (
                          <span className="text-xs text-primary font-medium flex items-center gap-1">
                            <span className="w-1.5 h-1.5 bg-primary rounded-full" />
                            In Stock
                          </span>
                        )}
                      </div>

                      {product.availability_note && (
                        <p className="text-xs text-muted-foreground mt-2 italic">
                          {product.availability_note}
                        </p>
                      )}
                    </div>
                  </Link>
                );
              })}
            </div>
          </>
        )}
      </main>

      {/* Seller Info Section */}
      {store.seller && (
        <section className="bg-muted/50 border-t border-border">
          <div className="max-w-6xl mx-auto px-4 py-12">
            <h2 className="text-xl font-bold text-foreground mb-6">About the Seller</h2>
            <div className="bg-card border border-border rounded-xl p-6">
              <div className="flex items-start gap-4">
                <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-xl">
                  {store.seller.name?.charAt(0).toUpperCase() || 'S'}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-semibold text-foreground">{store.seller.name}</h3>
                    {isVerified && (
                      <CheckCircle size={16} className="text-primary" />
                    )}
                  </div>
                  {sellerRating > 0 && (
                    <div className="flex items-center gap-1 text-sm text-muted-foreground mb-3">
                      <Star size={14} className="fill-primary text-primary" />
                      <span>{sellerRating.toFixed(1)} rating</span>
                      <span>•</span>
                      <span>{totalReviews} reviews</span>
                      {totalSales > 0 && (
                        <>
                          <span>•</span>
                          <span>{totalSales} sales</span>
                        </>
                      )}
                    </div>
                  )}
                  <div className="flex flex-wrap gap-4 text-sm">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Shield size={16} className="text-primary" />
                      <span>PayLoom Protected</span>
                    </div>
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Clock size={16} className="text-primary" />
                      <span>Fast Response</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Footer */}
      <footer className="bg-card border-t border-border">
        <div className="max-w-6xl mx-auto px-4 py-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <Shield size={20} className="text-primary" />
              <span className="text-sm text-muted-foreground">
                Payments secured by <span className="font-medium text-foreground">PayLoom</span>
              </span>
            </div>
            <div className="flex items-center gap-6 text-sm text-muted-foreground">
              <Link to="/legal" className="hover:text-foreground transition">Terms</Link>
              <Link to="/legal" className="hover:text-foreground transition">Privacy</Link>
              <Link to="/" className="hover:text-foreground transition">Help</Link>
            </div>
          </div>
        </div>
      </footer>

      {storeSlug && (
        <StorefrontChatWidget storeSlug={storeSlug} storeName={store?.name} />
      )}

      {/* Floating Cart Button */}
      {cart.length > 0 && (
        <button
          onClick={() => setCartOpen(true)}
          className="fixed bottom-6 right-6 z-40 bg-primary text-primary-foreground p-4 rounded-full shadow-lg hover:bg-primary/90 transition flex items-center gap-2"
        >
          <ShoppingCart size={24} />
          <span className="bg-primary-foreground text-primary text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center">
            {cart.reduce((sum, i) => sum + i.quantity, 0)}
          </span>
        </button>
      )}

      {/* Cart Drawer */}
      {storeSlug && (
        <CartDrawer
          isOpen={cartOpen}
          onClose={() => setCartOpen(false)}
          storeSlug={storeSlug}
          onPlaceOrder={handlePlaceOrder}
        />
      )}
    </div>
  );
}

export default StoreFrontPage;
