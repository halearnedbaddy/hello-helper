import { useLocation, useNavigate } from 'react-router-dom';
import { HomeIcon, ShoppingBagIcon, StoreIcon, SettingsIcon } from '@/components/icons';

interface NavItem {
  path: string;
  label: string;
  icon: React.FC<{ size?: number; className?: string }>;
}

const navItems: NavItem[] = [
  { path: '/', label: 'Home', icon: HomeIcon },
  { path: '/buyer', label: 'Buy', icon: ShoppingBagIcon },
  { path: '/seller', label: 'Sell', icon: StoreIcon },
  { path: '/login', label: 'Account', icon: SettingsIcon },
];

export function BottomNavBar() {
  const location = useLocation();
  const navigate = useNavigate();

  // Hide on dashboard pages that have their own sidebar nav
  const hiddenPaths = ['/seller', '/buyer', '/admin'];
  if (hiddenPaths.some(p => location.pathname.startsWith(p))) return null;

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-border shadow-lg md:hidden"
         style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
      <div className="flex items-stretch justify-around">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          const Icon = item.icon;
          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={`flex flex-col items-center justify-center gap-0.5 flex-1 py-2 min-h-[56px] min-w-[48px] transition-colors ${
                isActive
                  ? 'text-primary'
                  : 'text-muted-foreground'
              }`}
            >
              <Icon size={22} className={isActive ? 'text-primary' : ''} />
              <span className="text-[10px] font-medium leading-tight">{item.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
