import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Download, Loader2, Award, Sparkles } from 'lucide-react';

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
}: CertificationModalProps) {
  const [step, setStep] = useState<Step>('name-entry');
  const [progress, setProgress] = useState(0);
  const [name, setName] = useState(defaultName || '');
  const [shippingAddress, setShippingAddress] = useState<CertificateShippingAddress>(
    emptyAddress(defaultName || '')
  );
  const [businessLocation, setBusinessLocation] = useState<CertificateBusinessLocation>(emptyBusiness());
  const [shipToBusiness, setShipToBusiness] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen && defaultName) {
      setName(defaultName);
      setShippingAddress(prev => ({
        ...prev,
        recipientName: prev.recipientName || defaultName,
      }));
    }
  }, [isOpen, defaultName]);

  useEffect(() => {
    if (!isOpen) {
      setStep('analyzing');
      setProgress(0);
      setName('');
      setShippingAddress(emptyAddress(defaultName || ''));
      setBusinessLocation(emptyBusiness());
      setShipToBusiness(false);
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
  }, [defaultName, isOpen, step]);

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

  const isBusinessComplete = Boolean(
    normalizedBusiness.businessName &&
      normalizedBusiness.addressLine1 &&
      normalizedBusiness.city &&
      normalizedBusiness.state &&
      normalizedBusiness.postalCode &&
      normalizedBusiness.countryCode
  );

  const effectiveShipping: CertificateShippingAddress = shipToBusiness
    ? {
        recipientName: shippingAddress.recipientName.trim() || name.trim(),
        phone: shippingAddress.phone.trim(),
        addressLine1: normalizedBusiness.addressLine1,
        addressLine2: normalizedBusiness.addressLine2 || '',
        city: normalizedBusiness.city,
        state: normalizedBusiness.state,
        postalCode: normalizedBusiness.postalCode,
        countryCode: normalizedBusiness.countryCode,
      }
    : {
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
            {step === 'name-entry' && 'Enter Your Name'}
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
                Congratulations! Enter your certificate name, your business location, and where to mail your printed certificate.
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

              <div className="space-y-3 border-t border-border/40 pt-4">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Business Location</p>
                <p className="text-xs text-muted-foreground -mt-1">
                  Where you operate. Saved to your profile and used for our directory.
                </p>
                <Input
                  value={businessLocation.businessName}
                  onChange={(e) => updateBusiness('businessName', e.target.value)}
                  placeholder="Business / shop name"
                />
                <Input
                  value={businessLocation.addressLine1}
                  onChange={(e) => updateBusiness('addressLine1', e.target.value)}
                  placeholder="Street address"
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
              </div>

              <div className="space-y-3 border-t border-border/40 pt-4">
                <div className="flex items-center justify-between">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Shipping Address</p>
                  <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
                    <input
                      type="checkbox"
                      checked={shipToBusiness}
                      onChange={(e) => setShipToBusiness(e.target.checked)}
                      className="rounded"
                    />
                    Ship to my business
                  </label>
                </div>
                <p className="text-xs text-muted-foreground -mt-1">
                  Where we'll mail your printed certificate.
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
                    Generate My Certificate
                  </>
                )}
              </Button>
              {!isAddressComplete && (
                <p className="text-xs text-center text-muted-foreground">
                  Mailing name, phone, street, city, state, ZIP, and country are required for physical certificate fulfillment.
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
                <Button className="flex-1 gold-gradient" onClick={handleDownload}>
                  <Download className="w-4 h-4 mr-2" />
                  Download Certificate
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
