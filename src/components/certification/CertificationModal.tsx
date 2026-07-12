import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Download, Loader2, Award, Sparkles, ChevronDown, ChevronUp, MapPin, Building2, CheckCircle } from 'lucide-react';
import { useMarkCertificateDownloaded } from '@/hooks/useCertification';
import { cn } from '@/lib/utils';

export interface CertificateShippingAddress {
  recipientName: string;
  phone: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  postalCode: string;
  countryCode: string;
}

export interface CertificateBusinessLocation {
  businessName: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  postalCode: string;
  countryCode: string;
}

export interface CertificationSubmissionPayload {
  certificateName: string;
  shippingAddress: CertificateShippingAddress;
  businessLocation: CertificateBusinessLocation;
}

interface CertificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (payload: CertificationSubmissionPayload) => Promise<void>;
  certificateUrl?: string | null;
  isGenerating: boolean;
  defaultName?: string;
  defaultShippingAddress?: CertificateShippingAddress | null;
  defaultBusinessLocation?: CertificateBusinessLocation | null;
  isEditing?: boolean;
  /** Open the shipping and business address sections when entering edit mode. */
  openAddressSections?: boolean;
  courseId?: string;
  certificationId?: string | null;
}

type Step = 'analyzing' | 'name-entry' | 'complete';

const emptyAddress = (recipient = ''): CertificateShippingAddress => ({
  recipientName: recipient,
  phone: '',
  addressLine1: '',
  addressLine2: '',
  city: '',
  state: '',
  postalCode: '',
  countryCode: 'US',
});

const emptyBusiness = (): CertificateBusinessLocation => ({
  businessName: '',
  addressLine1: '',
  addressLine2: '',
  city: '',
  state: '',
  postalCode: '',
  countryCode: 'US',
});


export function CertificationModal({
  isOpen,
  onClose,
  onSubmit,
  certificateUrl,
  isGenerating,
  defaultName,
  defaultShippingAddress,
  defaultBusinessLocation,
  isEditing = false,
  openAddressSections = false,
  courseId,
  certificationId,
}: CertificationModalProps) {
  const [step, setStep] = useState<Step>(isEditing ? 'name-entry' : 'analyzing');
  const [progress, setProgress] = useState(0);
  const [name, setName] = useState(defaultName || '');
  const [shippingAddress, setShippingAddress] = useState<CertificateShippingAddress>(
    defaultShippingAddress || emptyAddress(defaultName || '')
  );
  const [businessLocation, setBusinessLocation] = useState<CertificateBusinessLocation>(
    defaultBusinessLocation || emptyBusiness()
  );
  const [shipToBusiness, setShipToBusiness] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDownloaded, setIsDownloaded] = useState(false);
  const markDownloaded = useMarkCertificateDownloaded();
  // In edit mode, collapse the address sections by default so users can just
  // fix a typo in the name and hit save without touching anything else.
  const [showShipping, setShowShipping] = useState(openAddressSections || !isEditing);
  const [showBusiness, setShowBusiness] = useState(openAddressSections || !isEditing);

  useEffect(() => {
    if (isOpen) {
      if (defaultName) {
        setName(defaultName);
      }
      if (defaultShippingAddress) {
        setShippingAddress(defaultShippingAddress);
      }
      if (defaultBusinessLocation) {
        setBusinessLocation(defaultBusinessLocation);
      }
      setShowShipping(openAddressSections || !isEditing);
      setShowBusiness(openAddressSections || !isEditing);
    }
  }, [isOpen, defaultName, defaultShippingAddress, defaultBusinessLocation, isEditing, openAddressSections]);

  useEffect(() => {
    if (!isOpen) {
      setStep(isEditing ? 'name-entry' : 'analyzing');
      setProgress(0);
      setName(defaultName || '');
      setShippingAddress(defaultShippingAddress || emptyAddress(defaultName || ''));
      setBusinessLocation(defaultBusinessLocation || emptyBusiness());
      setShipToBusiness(false);
      setIsDownloaded(false);
      return;
    }

    if (step === 'analyzing') {
      const duration = 2000;
      const interval = 100;
      const increment = (interval / duration) * 100;

      const timer = setInterval(() => {
        setProgress(prev => {
          const next = prev + increment;
          if (next >= 100) {
            clearInterval(timer);
            setStep('name-entry');
            return 100;
          }
          return next;
        });
      }, interval);

      return () => clearInterval(timer);
    }
  }, [defaultName, defaultShippingAddress, defaultBusinessLocation, isEditing, isOpen, step]);

  useEffect(() => {
    if (certificateUrl && step === 'name-entry') {
      setStep('complete');
    }
  }, [certificateUrl, step]);

  const updateAddress = (key: keyof CertificateShippingAddress, value: string) => {
    setShippingAddress(prev => ({ ...prev, [key]: value }));
  };

  const updateBusiness = (key: keyof CertificateBusinessLocation, value: string) => {
    setBusinessLocation(prev => ({ ...prev, [key]: value }));
  };

  const normalizedBusiness: CertificateBusinessLocation = {
    businessName: businessLocation.businessName.trim(),
    addressLine1: businessLocation.addressLine1.trim(),
    addressLine2: businessLocation.addressLine2?.trim() || '',
    city: businessLocation.city.trim(),
    state: businessLocation.state.trim(),
    postalCode: businessLocation.postalCode.trim(),
    countryCode: (businessLocation.countryCode.trim() || 'US').toUpperCase(),
  };

  // Street address is optional here — a barber may just want their city/state/ZIP
  // shown in the directory. Business name + city + state + ZIP are required.
  const isBusinessComplete = Boolean(
    normalizedBusiness.businessName &&
      normalizedBusiness.city &&
      normalizedBusiness.state &&
      normalizedBusiness.postalCode &&
      normalizedBusiness.countryCode
  );

  const effectiveShipping: CertificateShippingAddress = {
    recipientName: shippingAddress.recipientName.trim(),
    phone: shippingAddress.phone.trim(),
    addressLine1: shippingAddress.addressLine1.trim(),
    addressLine2: shippingAddress.addressLine2?.trim() || '',
    city: shippingAddress.city.trim(),
    state: shippingAddress.state.trim(),
    postalCode: shippingAddress.postalCode.trim(),
    countryCode: (shippingAddress.countryCode.trim() || 'US').toUpperCase(),
  };

  const isShippingComplete = Boolean(
    effectiveShipping.recipientName &&
      effectiveShipping.phone &&
      effectiveShipping.addressLine1 &&
      effectiveShipping.city &&
      effectiveShipping.state &&
      effectiveShipping.postalCode &&
      effectiveShipping.countryCode
  );

  const isAddressComplete = isBusinessComplete && isShippingComplete;

  const handleSubmit = async () => {
    if (!name.trim() || !isAddressComplete) return;
    setIsSubmitting(true);
    try {
      await onSubmit({
        certificateName: name.trim(),
        shippingAddress: effectiveShipping,
        businessLocation: normalizedBusiness,
      });
    } finally {
      setIsSubmitting(false);
    }
  };


  const handleDownload = () => {
    if (certificateUrl) {
      window.open(certificateUrl, '_blank');
      setIsDownloaded(true);
      if (courseId && certificationId) {
        markDownloaded.mutate({ courseId, certificationId });
      }
    }
  };

  const analysisMessages = [
    'Reviewing your quiz scores...',
    'Analyzing your work photos...',
    'Evaluating technique quality...',
    'Checking completion requirements...',
    'Preparing your certification...',
  ];

  const currentMessage = analysisMessages[Math.floor((progress / 100) * (analysisMessages.length - 1))];

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Award className="w-5 h-5 text-primary" />
            {step === 'analyzing' && 'Analyzing Your Work'}
            {step === 'name-entry' && (isEditing ? 'Edit Certificate' : 'Enter Your Name')}
            {step === 'complete' && 'Certificate Ready!'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {step === 'analyzing' && (
            <div className="space-y-4">
              <div className="relative">
                <Progress value={progress} className="h-3" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <Sparkles className="w-4 h-4 text-primary animate-pulse" />
                </div>
              </div>
              <div className="text-center space-y-2">
                <p className="text-sm text-muted-foreground animate-pulse">{currentMessage}</p>
                <p className="text-xs text-muted-foreground">{Math.round(progress)}% complete</p>
              </div>
              <div className="flex justify-center">
                <div className="relative">
                  <div className="w-20 h-20 rounded-full border-4 border-primary/20 animate-spin border-t-primary" />
                  <Award className="w-8 h-8 text-primary absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
                </div>
              </div>
            </div>
          )}

          {step === 'name-entry' && (
            <div className="space-y-5">
              <p className="text-sm text-muted-foreground text-center">
                {isEditing
                  ? 'Fix a typo in your name, or click Edit on any section below to update it. Saving will regenerate your certificate.'
                  : 'Congratulations! Enter your certificate name, where to mail your printed certificate, and where clients can find you in our specialist directory.'}
              </p>

              <div className="space-y-2">
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your Full Name"
                  className="text-center text-lg font-certificate"
                  autoFocus
                />
                <p className="text-center font-certificate text-2xl text-primary mt-2">
                  {name || 'Your Name Here'}
                </p>
              </div>

              {/* 1. SHIPPING ADDRESS — asked for first because it's what the name is for. */}
              <div className="space-y-3 border-t border-border/40 pt-4">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2 min-w-0">
                    <MapPin className="w-4 h-4 text-primary shrink-0" />
                    <p className="text-sm font-semibold">Where should we ship your certificate?</p>
                  </div>
                  {isEditing && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-xs"
                      onClick={() => setShowShipping((v) => !v)}
                    >
                      {showShipping ? (<><ChevronUp className="w-3 h-3 mr-1" />Hide</>) : (<><ChevronDown className="w-3 h-3 mr-1" />Edit</>)}
                    </Button>
                  )}
                </div>
                {isEditing && !showShipping ? (
                  <div className="text-sm text-foreground/80 leading-snug">
                    {shippingAddress.addressLine1 ? (
                      <>
                        <div>{shippingAddress.recipientName}</div>
                        <div className="text-muted-foreground">
                          {shippingAddress.addressLine1}
                          {shippingAddress.addressLine2 ? `, ${shippingAddress.addressLine2}` : ''}
                          {' — '}
                          {shippingAddress.city}, {shippingAddress.state} {shippingAddress.postalCode}
                        </div>
                      </>
                    ) : (
                      <span className="text-muted-foreground">No shipping address on file. Click Edit to add.</span>
                    )}
                  </div>
                ) : (
                  <>
                    <p className="text-xs text-muted-foreground -mt-1">
                      We'll mail your printed certificate here.
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <Input
                        value={shippingAddress.recipientName}
                        onChange={(e) => updateAddress('recipientName', e.target.value)}
                        placeholder="Mailing name"
                      />
                      <Input
                        value={shippingAddress.phone}
                        onChange={(e) => updateAddress('phone', e.target.value)}
                        placeholder="Phone number"
                        inputMode="tel"
                      />
                    </div>
                    <Input
                      value={shippingAddress.addressLine1}
                      onChange={(e) => updateAddress('addressLine1', e.target.value)}
                      placeholder="Address line 1"
                      autoComplete="shipping address-line1"
                    />
                    <Input
                      value={shippingAddress.addressLine2}
                      onChange={(e) => updateAddress('addressLine2', e.target.value)}
                      placeholder="Address line 2 (optional)"
                      autoComplete="shipping address-line2"
                    />
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <Input
                        value={shippingAddress.city}
                        onChange={(e) => updateAddress('city', e.target.value)}
                        placeholder="City"
                        autoComplete="shipping address-level2"
                      />
                      <Input
                        value={shippingAddress.state}
                        onChange={(e) => updateAddress('state', e.target.value)}
                        placeholder="State"
                        autoComplete="shipping address-level1"
                      />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <Input
                        value={shippingAddress.postalCode}
                        onChange={(e) => updateAddress('postalCode', e.target.value)}
                        placeholder="ZIP"
                        autoComplete="shipping postal-code"
                      />
                      <Input
                        value={shippingAddress.countryCode}
                        onChange={(e) => updateAddress('countryCode', e.target.value)}
                        placeholder="Country"
                        autoComplete="shipping country"
                      />
                    </div>
                  </>
                )}
              </div>

              {/* 2. DIRECTORY LISTING — optional street address, city/state/ZIP required. */}
              <div className="space-y-3 border-t border-border/40 pt-4">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <Building2 className="w-4 h-4 text-primary shrink-0" />
                    <p className="text-sm font-semibold">Get listed in our specialist directory</p>
                  </div>
                  {isEditing && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-xs"
                      onClick={() => setShowBusiness((v) => !v)}
                    >
                      {showBusiness ? (<><ChevronUp className="w-3 h-3 mr-1" />Hide</>) : (<><ChevronDown className="w-3 h-3 mr-1" />Edit</>)}
                    </Button>
                  )}
                </div>
                {isEditing && !showBusiness ? (
                  <p className="text-sm text-foreground/80 truncate">
                    {businessLocation.businessName
                      ? `${businessLocation.businessName} — ${businessLocation.city}, ${businessLocation.state}`
                      : 'Not listed in the directory yet. Click Edit to add.'}
                  </p>
                ) : (
                  <>
                    <p className="text-xs text-muted-foreground -mt-1">
                      Where should we tell people that you work? We show certified barbers on find.menshairexpert.com so clients can book with you. A street address helps clients get directions — if you don't have an exact address, just enter your city, state, and ZIP.
                    </p>
                    <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
                      <input
                        type="checkbox"
                        checked={shipToBusiness}
                        onChange={(e) => {
                          setShipToBusiness(e.target.checked);
                          if (e.target.checked) {
                            // Copy the shipping street/city/state/zip into the business fields
                            setBusinessLocation((prev) => ({
                              ...prev,
                              addressLine1: shippingAddress.addressLine1,
                              addressLine2: shippingAddress.addressLine2 || '',
                              city: shippingAddress.city,
                              state: shippingAddress.state,
                              postalCode: shippingAddress.postalCode,
                              countryCode: shippingAddress.countryCode || 'US',
                            }));
                          }
                        }}
                        className="rounded"
                      />
                      Same address as shipping above
                    </label>
                    <Input
                      value={businessLocation.businessName}
                      onChange={(e) => updateBusiness('businessName', e.target.value)}
                      placeholder="Business / shop name (or your name if you work independently)"
                    />
                    <Input
                      value={businessLocation.addressLine1}
                      onChange={(e) => updateBusiness('addressLine1', e.target.value)}
                      placeholder="Street address (optional)"
                    />
                    <Input
                      value={businessLocation.addressLine2}
                      onChange={(e) => updateBusiness('addressLine2', e.target.value)}
                      placeholder="Suite / unit (optional)"
                    />
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <Input
                        value={businessLocation.city}
                        onChange={(e) => updateBusiness('city', e.target.value)}
                        placeholder="City"
                      />
                      <Input
                        value={businessLocation.state}
                        onChange={(e) => updateBusiness('state', e.target.value)}
                        placeholder="State"
                      />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <Input
                        value={businessLocation.postalCode}
                        onChange={(e) => updateBusiness('postalCode', e.target.value)}
                        placeholder="ZIP"
                      />
                      <Input
                        value={businessLocation.countryCode}
                        onChange={(e) => updateBusiness('countryCode', e.target.value)}
                        placeholder="Country"
                      />
                    </div>
                  </>
                )}
              </div>



              <Button
                className="w-full gold-gradient"
                onClick={handleSubmit}
                disabled={!name.trim() || !isAddressComplete || isSubmitting || isGenerating}
              >
                {isSubmitting || isGenerating ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Generating Certificate...
                  </>
                ) : (
                  <>
                    <Award className="w-4 h-4 mr-2" />
                    {isEditing ? 'Save & Regenerate' : 'Generate My Certificate'}
                  </>
                )}
              </Button>
              {!isAddressComplete && (
                <p className="text-xs text-center text-muted-foreground">
                  Please fill in your shipping address and your directory listing (city / state / ZIP at a minimum).
                </p>
              )}

              {(isSubmitting || isGenerating) && (
                <p className="text-xs text-center text-muted-foreground">
                  This may take a few seconds. Please don't close this window.
                </p>
              )}
            </div>
          )}

          {step === 'complete' && certificateUrl && (
            <div className="space-y-4">
              <div className="relative rounded-lg overflow-hidden border border-primary/30 shadow-lg">
                <img src={certificateUrl} alt="Your Certificate" className="w-full" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent pointer-events-none" />
              </div>
              <div className="flex gap-3">
                <Button
                  className={cn(
                    'flex-1',
                    isDownloaded ? 'bg-green-600 hover:bg-green-700 text-white' : 'gold-gradient'
                  )}
                  onClick={handleDownload}
                  disabled={markDownloaded.isPending}
                >
                  {markDownloaded.isPending ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : isDownloaded ? (
                    <CheckCircle className="w-4 h-4 mr-2" />
                  ) : (
                    <Download className="w-4 h-4 mr-2" />
                  )}
                  {isDownloaded ? 'Downloaded' : 'Download Certificate'}
                </Button>
                <Button variant="outline" onClick={onClose}>
                  Close
                </Button>
              </div>
              <p className="text-xs text-center text-muted-foreground">
                Congratulations on completing your Hair System Mastery certification!
              </p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
