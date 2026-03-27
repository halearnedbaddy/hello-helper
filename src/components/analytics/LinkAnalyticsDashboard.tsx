import { useState, useEffect } from "react";
import { Eye, MousePointer, ShoppingCart, TrendingUp, Clock, Loader2, RefreshCw } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar } from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

type TimePeriod = "7d" | "30d" | "90d";

interface AnalyticsMetrics {
  totalViews: number;
  totalClicks: number;
  totalConversions: number;
  conversionRate: number;
}

interface DailyData {
  date: string;
  views: number;
  clicks: number;
  conversions: number;
}

interface SourceData {
  name: string;
  value: number;
}

interface HourlyData {
  hour: string;
  count: number;
}

const COLORS = ["hsl(var(--primary))", "hsl(var(--accent))", "#f59e0b", "#10b981", "#8b5cf6", "#ec4899"];

export function LinkAnalyticsDashboard() {
  const [period, setPeriod] = useState<TimePeriod>("30d");
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState<AnalyticsMetrics>({ totalViews: 0, totalClicks: 0, totalConversions: 0, conversionRate: 0 });
  const [dailyData, setDailyData] = useState<DailyData[]>([]);
  const [sourceData, setSourceData] = useState<SourceData[]>([]);
  const [hourlyData, setHourlyData] = useState<HourlyData[]>([]);

  useEffect(() => {
    loadAnalytics();
  }, [period]);

  const loadAnalytics = async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      // Get user's store IDs
      const { data: stores } = await supabase.from("stores").select("id").eq("seller_id", session.user.id);
      if (!stores?.length) { setLoading(false); return; }
      const storeIds = stores.map(s => s.id);

      const days = period === "7d" ? 7 : period === "30d" ? 30 : 90;
      const since = new Date(Date.now() - days * 86400000).toISOString();

      const { data: events } = await supabase
        .from("link_analytics")
        .select("*")
        .in("store_id", storeIds)
        .gte("created_at", since)
        .order("created_at", { ascending: true });

      if (!events?.length) {
        setMetrics({ totalViews: 0, totalClicks: 0, totalConversions: 0, conversionRate: 0 });
        setDailyData([]);
        setSourceData([]);
        setHourlyData([]);
        setLoading(false);
        return;
      }

      // Calculate metrics
      const views = events.filter(e => e.event_type === "view").length;
      const clicks = events.filter(e => e.event_type === "click").length;
      const conversions = events.filter(e => e.event_type === "conversion").length;
      const rate = views > 0 ? (conversions / views) * 100 : 0;

      setMetrics({ totalViews: views, totalClicks: clicks, totalConversions: conversions, conversionRate: rate });

      // Daily breakdown
      const dailyMap: Record<string, DailyData> = {};
      events.forEach(e => {
        const day = e.created_at?.slice(0, 10) || "";
        if (!dailyMap[day]) dailyMap[day] = { date: day, views: 0, clicks: 0, conversions: 0 };
        if (e.event_type === "view") dailyMap[day].views++;
        else if (e.event_type === "click") dailyMap[day].clicks++;
        else if (e.event_type === "conversion") dailyMap[day].conversions++;
      });
      setDailyData(Object.values(dailyMap).sort((a, b) => a.date.localeCompare(b.date)));

      // Traffic sources
      const sourceMap: Record<string, number> = {};
      events.forEach(e => {
        const src = e.source || "direct";
        sourceMap[src] = (sourceMap[src] || 0) + 1;
      });
      setSourceData(Object.entries(sourceMap).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value));

      // Peak hours
      const hourMap: Record<number, number> = {};
      events.forEach(e => {
        const h = new Date(e.created_at || "").getHours();
        hourMap[h] = (hourMap[h] || 0) + 1;
      });
      setHourlyData(
        Array.from({ length: 24 }, (_, i) => ({
          hour: `${i.toString().padStart(2, "0")}:00`,
          count: hourMap[i] || 0,
        }))
      );
    } catch (err) {
      console.error("Analytics load error:", err);
    }
    setLoading(false);
  };

  const statCards = [
    { label: "Views", value: metrics.totalViews, icon: Eye, color: "text-blue-500" },
    { label: "Clicks", value: metrics.totalClicks, icon: MousePointer, color: "text-amber-500" },
    { label: "Conversions", value: metrics.totalConversions, icon: ShoppingCart, color: "text-green-500" },
    { label: "Conversion Rate", value: `${metrics.conversionRate.toFixed(1)}%`, icon: TrendingUp, color: "text-purple-500" },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="animate-spin text-primary" size={32} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold text-foreground">Link Analytics</h3>
        <div className="flex items-center gap-2">
          {(["7d", "30d", "90d"] as TimePeriod[]).map(p => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={cn(
                "px-3 py-1.5 rounded-lg text-sm font-medium transition",
                period === p ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"
              )}
            >
              {p === "7d" ? "7 Days" : p === "30d" ? "30 Days" : "90 Days"}
            </button>
          ))}
          <button onClick={loadAnalytics} className="p-2 rounded-lg bg-muted hover:bg-muted/80 transition">
            <RefreshCw size={16} className="text-muted-foreground" />
          </button>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {statCards.map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="bg-card border border-border rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <Icon size={18} className={color} />
              <span className="text-sm text-muted-foreground">{label}</span>
            </div>
            <p className="text-2xl font-bold text-foreground">{value}</p>
          </div>
        ))}
      </div>

      {/* Daily Trend Chart */}
      {dailyData.length > 0 && (
        <div className="bg-card border border-border rounded-xl p-6">
          <h4 className="text-sm font-semibold text-foreground mb-4">Daily Performance</h4>
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={dailyData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="date" tick={{ fontSize: 12 }} tickFormatter={d => d.slice(5)} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip />
              <Area type="monotone" dataKey="views" stroke="#3b82f6" fill="#3b82f680" name="Views" />
              <Area type="monotone" dataKey="clicks" stroke="#f59e0b" fill="#f59e0b80" name="Clicks" />
              <Area type="monotone" dataKey="conversions" stroke="#10b981" fill="#10b98180" name="Conversions" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Traffic Sources */}
        {sourceData.length > 0 && (
          <div className="bg-card border border-border rounded-xl p-6">
            <h4 className="text-sm font-semibold text-foreground mb-4">Traffic Sources</h4>
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={sourceData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}>
                  {sourceData.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
            <div className="mt-3 space-y-1">
              {sourceData.slice(0, 5).map((s, i) => (
                <div key={s.name} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                    <span className="text-muted-foreground capitalize">{s.name}</span>
                  </div>
                  <span className="font-medium text-foreground">{s.value}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Peak Hours */}
        {hourlyData.some(h => h.count > 0) && (
          <div className="bg-card border border-border rounded-xl p-6">
            <h4 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
              <Clock size={16} /> Peak Hours
            </h4>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={hourlyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="hour" tick={{ fontSize: 10 }} interval={2} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} name="Events" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Empty state */}
      {metrics.totalViews === 0 && (
        <div className="text-center py-12 bg-muted/30 rounded-xl border border-dashed border-border">
          <Eye size={40} className="mx-auto mb-3 text-muted-foreground/50" />
          <p className="text-muted-foreground font-medium">No analytics data yet</p>
          <p className="text-sm text-muted-foreground/70 mt-1">Share your payment links to start seeing analytics here.</p>
        </div>
      )}
    </div>
  );
}
