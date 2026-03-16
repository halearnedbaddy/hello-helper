import { useState, useEffect } from 'react';
import { CameraIcon, SaveIcon, LoaderIcon, CheckIcon, AlertTriangleIcon, GlobeIcon, LockIcon } from '@/components/icons';
import { api } from '@/services/api';
import { useToast } from '@/hooks/use-toast';

interface StoreSettingsProps {
  store: {
    id?: string;
    name: string;
    slug: string;
    logo?: string | null;
    bio?: string | null;
    visibility?: string;
    status?: string;
  };
  onUpdate: (data: Partial<StoreSettingsProps['store']>) => void;
}

export function StoreSettings({ store, onUpdate }: StoreSettingsProps) {
  const { toast } = useToast();
  const [formData, setFormData] = useState({
    name: store.name || '',
    slug: store.slug || '',
    bio: store.bio || '',
    visibility: store.visibility || 'PRIVATE',
    logo: store.logo || null as string | null,
  });
  const [isSaving, setIsSaving] = useState(false);
  const [isActivating, setIsActivating] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [slugError, setSlugError] = useState('');

  useEffect(() => {
    // Check for changes
    const changed = 
      formData.name !== (store.name || '') ||
      formData.slug !== (store.slug || '') ||
      formData.bio !== (store.bio || '') ||
      formData.visibility !== (store.visibility || 'PRIVATE') ||
      formData.logo !== (store.logo || null);
    setHasChanges(changed);
  }, [formData, store]);

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        toast({ title: 'Image too large', description: 'Please upload an image under 2MB', variant: 'destructive' });
        return;
      }
      const reader = new FileReader();
      reader.onload = (event) => {
        setFormData(prev => ({ ...prev, logo: event.target?.result as string }));
      };
      reader.readAsDataURL(file);
    }
  };

  const validateSlug = (slug: string) => {
    if (!slug) {
      setSlugError('Slug is required');
      return false;
    }
    if (!/^[a-z0-9-]+$/.test(slug)) {
      setSlugError('Slug can only contain lowercase letters, numbers, and hyphens');
      return false;
    }
    if (slug.length < 3) {
      setSlugError('Slug must be at least 3 characters');
      return false;
    }
    setSlugError('');
    return true;
  };

  const handleSave = async () => {
    if (!validateSlug(formData.slug)) return;
    if (!formData.name.trim()) {
      toast({ title: 'Store name is required', variant: 'destructive' });
      return;
    }

    setIsSaving(true);
    
    const res = await api.updateStore({
      name: formData.name,
      slug: formData.slug,
      bio: formData.bio || undefined,
      visibility: formData.visibility as 'PRIVATE' | 'PUBLIC',
      logo: formData.logo || undefined,
    });
    
    if (res.success) {
      onUpdate(formData);
      toast({ title: 'Settings saved successfully!' });
      setHasChanges(false);
    } else {
      toast({ title: 'Failed to save settings', description: res.error, variant: 'destructive' });
    }
    
    setIsSaving(false);
  };

  const handleActivateStore = async () => {
    setIsActivating(true);
    
    const res = await api.updateStoreStatus('ACTIVE');
    
    if (res.success) {
      onUpdate({ status: 'active' });
      toast({ title: 'Store activated!', description: 'Your store is now live' });
    } else {
      toast({ 
        title: 'Cannot activate store', 
        description: res.error || 'Please ensure you have connected a social account and added a payout method',
        variant: 'destructive' 
      });
    }
    
    setIsActivating(false);
  };

  const handleDeactivateStore = async () => {
    setIsActivating(true);
    
    const res = await api.updateStoreStatus('INACTIVE');
    
    if (res.success) {
      onUpdate({ status: 'inactive' });
      toast({ title: 'Store deactivated' });
    } else {
      toast({ title: 'Failed to deactivate store', description: res.error, variant: 'destructive' });
    }
    
    setIsActivating(false);
  };

  const status = (store.status || '').toString().toLowerCase();
  const isActive = status === 'active';
  const isFrozen = status === 'frozen';

  return (
    <div className="space-y-4 sm:space-y-6 w-full min-w-0 overflow-hidden">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
        <h2 className="text-xl sm:text-2xl font-bold text-foreground">Settings</h2>
        {hasChanges && (
          <span className="text-sm text-amber-600 bg-amber-50 dark:bg-amber-900/20 px-3 py-1 rounded-full">
            Unsaved changes
          </span>
        )}
      </div>

      {/* Store Status Card */}
      <div className={`bg-card border rounded-xl p-4 sm:p-6 ${
        isFrozen ? 'border-red-300 bg-red-50 dark:bg-red-950/20' : 
        isActive ? 'border-green-300 bg-green-50 dark:bg-green-950/20' : 
        'border-border'
      }`}>
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center flex-shrink-0 ${
              isFrozen ? 'bg-red-100 dark:bg-red-900' :
              isActive ? 'bg-green-100 dark:bg-green-900' : 
              'bg-muted'
            }`}>
              {isFrozen ? (
                <AlertTriangleIcon className="text-red-600" size={20} />
              ) : isActive ? (
                <CheckIcon className="text-green-600" size={20} />
              ) : (
                <GlobeIcon className="text-muted-foreground" size={20} />
              )}
            </div>
            <div className="min-w-0">
              <h3 className="font-bold text-foreground text-sm sm:text-base">
                {isFrozen ? 'Store Frozen' : isActive ? 'Store Active' : 'Store Inactive'}
              </h3>
              <p className="text-xs sm:text-sm text-muted-foreground">
                {isFrozen 
                  ? 'Store frozen by admin. Contact support.'
                  : isActive 
                    ? 'Your store is live and accepting orders'
                    : 'Activate to start receiving orders'}
              </p>
            </div>
          </div>
          {!isFrozen && (
            <button
              onClick={isActive ? handleDeactivateStore : handleActivateStore}
              disabled={isActivating}
              className={`px-4 py-2 rounded-lg font-medium transition flex items-center gap-2 text-sm w-full sm:w-auto justify-center ${
                isActive 
                  ? 'bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-900 dark:text-red-100'
                  : 'bg-green-600 text-white hover:bg-green-700'
              }`}
            >
              {isActivating && <LoaderIcon size={16} className="animate-spin" />}
              {isActive ? 'Deactivate' : 'Activate Store'}
            </button>
          )}
        </div>
      </div>

      {/* Store Logo */}
      <div className="bg-card border border-border rounded-xl p-4 sm:p-6">
        <h3 className="font-bold text-foreground mb-4">Store Logo</h3>
        <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-6">
          <div className="relative group flex-shrink-0">
            {formData.logo ? (
              <img 
                src={formData.logo} 
                alt="Store logo" 
                className="w-20 h-20 sm:w-24 sm:h-24 object-cover rounded-xl ring-2 ring-border"
              />
            ) : (
              <div className="w-20 h-20 sm:w-24 sm:h-24 bg-muted rounded-xl flex items-center justify-center ring-2 ring-border">
                <CameraIcon size={28} className="text-muted-foreground" />
              </div>
            )}
            <label className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-xl cursor-pointer">
              <input type="file" accept="image/*" onChange={handleLogoUpload} className="hidden" />
              <CameraIcon className="text-white" size={24} />
            </label>
          </div>
          <div>
            <label className="block">
              <input type="file" accept="image/*" onChange={handleLogoUpload} className="hidden" />
              <span className="px-4 py-2 rounded-lg bg-primary text-primary-foreground cursor-pointer hover:bg-primary/90 transition inline-block font-medium text-sm">
                Upload Logo
              </span>
            </label>
            <p className="text-xs text-muted-foreground mt-2">Recommended: 200x200px, PNG or JPG (max 2MB)</p>
          </div>
        </div>
      </div>

      {/* Store Details */}
      <div className="bg-card border border-border rounded-xl p-4 sm:p-6 space-y-4">
        <h3 className="font-bold text-foreground mb-2">Store Information</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">Store Name *</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              className="w-full px-3 sm:px-4 py-2.5 sm:py-3 rounded-lg border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 text-sm"
              placeholder="My Awesome Store"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">Store Slug (URL) *</label>
            <input
              type="text"
              value={formData.slug}
              onChange={(e) => {
                const slug = e.target.value.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
                setFormData(prev => ({ ...prev, slug }));
                validateSlug(slug);
              }}
              className={`w-full px-3 sm:px-4 py-2.5 sm:py-3 rounded-lg border bg-background text-foreground focus:outline-none focus:ring-2 text-sm ${
                slugError ? 'border-red-500 focus:ring-red-500/20' : 'border-input focus:ring-primary/20'
              }`}
              placeholder="my-awesome-store"
            />
            {slugError ? (
              <p className="text-xs text-red-500 mt-1">{slugError}</p>
            ) : (
              <p className="text-xs text-muted-foreground mt-1 break-all">Your store URL: /store/{formData.slug || 'your-slug'}</p>
            )}
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-foreground mb-2">Store Bio</label>
          <textarea
            value={formData.bio}
            onChange={(e) => setFormData(prev => ({ ...prev, bio: e.target.value }))}
            className="w-full px-3 sm:px-4 py-2.5 sm:py-3 rounded-lg border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none text-sm"
            rows={3}
            placeholder="Tell customers about your store..."
            maxLength={500}
          />
          <p className="text-xs text-muted-foreground mt-1">{formData.bio.length}/500 characters</p>
        </div>
      </div>

      {/* Visibility Settings */}
      <div className="bg-card border border-border rounded-xl p-4 sm:p-6">
        <h3 className="font-bold text-foreground mb-4">Store Visibility</h3>
        <div className="space-y-3">
          <label className="flex items-start gap-3 sm:gap-4 p-3 sm:p-4 border border-input rounded-lg cursor-pointer hover:bg-muted/50 transition">
            <input
              type="radio"
              name="visibility"
              value="PRIVATE"
              checked={formData.visibility === 'PRIVATE'}
              onChange={(e) => setFormData(prev => ({ ...prev, visibility: e.target.value }))}
              className="w-4 h-4 sm:w-5 sm:h-5 mt-0.5 text-primary flex-shrink-0"
            />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <LockIcon size={16} className="text-muted-foreground flex-shrink-0" />
                <p className="font-semibold text-foreground text-sm">Private</p>
              </div>
              <p className="text-xs sm:text-sm text-muted-foreground mt-1">Only accessible via direct link.</p>
            </div>
          </label>
          <label className="flex items-start gap-3 sm:gap-4 p-3 sm:p-4 border border-input rounded-lg cursor-pointer hover:bg-muted/50 transition">
            <input
              type="radio"
              name="visibility"
              value="PUBLIC"
              checked={formData.visibility === 'PUBLIC'}
              onChange={(e) => setFormData(prev => ({ ...prev, visibility: e.target.value }))}
              className="w-4 h-4 sm:w-5 sm:h-5 mt-0.5 text-primary flex-shrink-0"
            />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <GlobeIcon size={16} className="text-muted-foreground flex-shrink-0" />
                <p className="font-semibold text-foreground text-sm">Public</p>
              </div>
              <p className="text-xs sm:text-sm text-muted-foreground mt-1">Store can be discovered by anyone.</p>
            </div>
          </label>
        </div>
      </div>

      {/* Save Button */}
      <div className="flex flex-col sm:flex-row justify-end gap-3">
        {hasChanges && (
          <button
            onClick={() => {
              setFormData({
                name: store.name || '',
                slug: store.slug || '',
                bio: store.bio || '',
                visibility: store.visibility || 'PRIVATE',
                logo: store.logo || null,
              });
              setHasChanges(false);
            }}
            className="px-4 sm:px-6 py-2.5 sm:py-3 border border-input rounded-lg hover:bg-muted transition font-medium text-foreground text-sm"
          >
            Discard Changes
          </button>
        )}
        <button
          onClick={handleSave}
          disabled={isSaving || !hasChanges}
          className="px-4 sm:px-6 py-2.5 sm:py-3 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition font-medium flex items-center gap-2 disabled:opacity-50 justify-center text-sm"
        >
          {isSaving ? (
            <>
              <LoaderIcon className="animate-spin" size={18} />
              Saving...
            </>
          ) : (
            <>
              <SaveIcon size={18} />
              Save Changes
            </>
          )}
        </button>
      </div>
    </div>
  );
}
