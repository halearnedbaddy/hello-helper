import { useState } from 'react';
import { XIcon, CheckCircleIcon, LoaderIcon } from '@/components/icons';
import { getPlanById } from '@/config/subscriptionPlans';
import { validateTransactionCode } from '@/lib/transactionValidation';

type FlowStep = 'choose-method' | 'paybill' | 'processing' | 'success' | 'trial';

interface SubscriptionPaymentFlowProps {
  open: boolean;
  onClose: () => void;
  planId: string;
  billingCycle: 'monthly' | 'annual';
  mode: 'payment' | 'trial';
  onComplete: () => void;
}

export function SubscriptionPaymentFlow({ open, onClose, planId, billingCycle, mode, onComplete }: SubscriptionPaymentFlowProps) {
  const [step, setStep] = useState<FlowStep>(mode === 'trial' ? 'trial' : 'choose-method');
  const [processing, setProcessing] = useState(false);
  const [mpesaCode, setMpesaCode] = useState('');
  const [mpesaMessage, setMpesaMessage] = useState('');
  const [verifyError, setVerifyError] = useState('');
  

  const plan = getPlanById(planId);
  if (!open || !plan) return null;

  const price = billingCycle === 'monthly' ? plan.monthlyPrice : plan.annualPrice;

  const handlePaybillVerify = async () => {
    const code = mpesaCode.trim().toUpperCase();
    const validation = validateTransactionCode(code, 'MPESA');
    if (!validation.valid) {
      setVerifyError(validation.error || 'Invalid transaction code');
      return;
    }

    setVerifyError('');
    setProcessing(true);
    setStep('processing');

    await new Promise(resolve => setTimeout(resolve, 2000));

    setProcessing(false);
    setStep('success');
  };

  const handleStartTrial = async () => {
    setProcessing(true);
    await new Promise(resolve => setTimeout(resolve, 1000));
    setProcessing(false);
    setStep('success');
  };

  const resetFlow = () => {
    setStep('choose-method');
    setMpesaCode('');
    setMpesaMessage('');
    setVerifyError('');
    setProcessing(false);
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-card rounded-2xl w-full max-w-md shadow-2xl max-h-[90vh] overflow-y-auto">

        {/* Choose Payment Method */}
        {step === 'choose-method' && (
          <div className="p-6">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-bold text-foreground">Upgrade to {plan.name} Plan</h3>
              <button onClick={onClose} className="p-2 hover:bg-muted rounded-lg transition">
                <XIcon size={20} />
              </button>
            </div>

            <div className="bg-muted/50 rounded-xl p-4 mb-5">
              <div className="flex justify-between text-sm mb-1">
                <span className="text-muted-foreground">Plan</span>
                <span className="font-medium text-foreground">{plan.name}</span>
              </div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-muted-foreground">Amount</span>
                <span className="font-bold text-foreground">KES {price.toLocaleString()}/{billingCycle === 'monthly' ? 'mo' : 'yr'}</span>
              </div>
            </div>

            <p className="text-sm font-medium text-foreground mb-3">Choose payment method:</p>

            <div className="space-y-3">
              {/* M-Pesa Paybill Option */}
              <button
                onClick={() => setStep('paybill')}
                className="w-full flex items-center gap-4 p-4 border-2 border-border rounded-xl hover:border-primary/60 hover:bg-primary/5 transition text-left"
              >
                <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 font-bold text-lg" style={{ background: '#d4f4dd', color: '#00a86b' }}>
                  M-P
                </div>
                <div>
                  <p className="font-semibold text-foreground text-sm">Pay via M-Pesa Paybill</p>
                  <p className="text-xs text-muted-foreground">Paybill 522522 • Account 1348763280</p>
                </div>
              </button>
            </div>

            <button onClick={onClose} className="w-full mt-4 text-sm text-muted-foreground hover:text-foreground transition py-2">
              Maybe Later
            </button>
          </div>
        )}


        {/* Paybill Instructions + Verify */}
        {step === 'paybill' && (
          <div className="p-6">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-bold text-foreground">Pay via M-Pesa Paybill</h3>
              <button onClick={onClose} className="p-2 hover:bg-muted rounded-lg transition">
                <XIcon size={20} />
              </button>
            </div>

            <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 mb-5">
              <p className="text-sm font-bold text-foreground mb-3">📱 M-Pesa Steps:</p>
              <ol className="space-y-2 text-sm text-foreground">
                <li className="flex gap-2"><span className="font-bold shrink-0">1.</span><span>Go to M-Pesa → <strong>Lipa Na M-Pesa</strong> → <strong>Pay Bill</strong></span></li>
                <li className="flex gap-2"><span className="font-bold shrink-0">2.</span><span>Business Number: <strong className="text-primary text-base">522522</strong></span></li>
                <li className="flex gap-2"><span className="font-bold shrink-0">3.</span><span>Account Number: <strong className="text-primary text-base">1348763280</strong></span></li>
                <li className="flex gap-2"><span className="font-bold shrink-0">4.</span><span>Amount: <strong className="text-primary text-base">KES {price.toLocaleString()}</strong></span></li>
                <li className="flex gap-2"><span className="font-bold shrink-0">5.</span><span>Enter your M-Pesa PIN and confirm</span></li>
              </ol>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">
                  M-Pesa Confirmation Message <span className="text-muted-foreground">(optional)</span>
                </label>
                <textarea value={mpesaMessage} onChange={e => setMpesaMessage(e.target.value)}
                  placeholder="Paste the full M-Pesa SMS confirmation message here..." rows={3}
                  className="w-full px-3 py-2.5 rounded-lg border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none" />
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">
                  M-Pesa Transaction Code <span className="text-destructive">*</span>
                </label>
                <input type="text" value={mpesaCode}
                  onChange={e => { setMpesaCode(e.target.value.toUpperCase()); setVerifyError(''); }}
                  placeholder="e.g. SJK7Y6H4TQ" maxLength={12}
                  className="w-full px-3 py-3 rounded-lg border border-input bg-background text-foreground font-mono text-base tracking-wider focus:outline-none focus:ring-2 focus:ring-primary/20 uppercase" />
                {verifyError && <p className="text-xs text-destructive mt-1">{verifyError}</p>}
              </div>
            </div>

            <div className="flex gap-3 mt-5">
              <button onClick={resetFlow} className="flex-1 px-4 py-3 border border-input rounded-lg hover:bg-muted transition font-medium text-foreground text-sm">
                ← Back
              </button>
              <button onClick={handlePaybillVerify} disabled={!mpesaCode.trim()}
                className="flex-1 px-4 py-3 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition font-medium text-sm disabled:opacity-50 flex items-center justify-center gap-2">
                Submit for Verification
              </button>
            </div>
          </div>
        )}

        {/* Processing */}
        {step === 'processing' && (
          <div className="p-8 text-center">
            <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <LoaderIcon size={28} className="text-primary animate-spin" />
            </div>
            <h3 className="text-lg font-bold text-foreground mb-2">Submitting Payment...</h3>
            <p className="text-sm text-muted-foreground">
              Verifying transaction code <strong className="font-mono">{mpesaCode}</strong>
            </p>
          </div>
        )}

        {/* Success */}
        {step === 'success' && (
          <div className="p-8 text-center">
            <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircleIcon size={32} className="text-primary" />
            </div>
            <h3 className="text-lg font-bold text-foreground mb-2">
              {mode === 'trial' ? `🎉 Welcome to ${plan.name} Plan!` : '✅ Payment Submitted!'}
            </h3>
            <p className="text-sm text-muted-foreground mb-4">
              {mode === 'trial'
                ? `Your 14-day free trial has started! Enjoy all ${plan.name} features.`
                : 'Your payment is being reviewed by our team. You\'ll be notified once approved.'}
            </p>

            <div className="bg-muted/50 rounded-xl p-4 mb-5 text-left">
              <p className="text-sm font-medium text-foreground mb-2">You can now:</p>
              <ul className="space-y-1.5">
                <li className="flex items-center gap-2 text-sm text-foreground">
                  <CheckCircleIcon size={14} className="text-primary" />
                  {plan.productLimit ? `Add up to ${plan.productLimit} products` : 'Add unlimited products'}
                </li>
                <li className="flex items-center gap-2 text-sm text-foreground">
                  <CheckCircleIcon size={14} className="text-primary" />
                  No transaction fees — flat fee only
                </li>
              </ul>
            </div>

            <button onClick={() => { onComplete(); onClose(); }}
              className="w-full px-4 py-3 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition font-medium">
              {mode === 'trial' ? 'Start Adding Products' : 'Got It'}
            </button>
          </div>
        )}

        {/* Trial Step */}
        {step === 'trial' && (
          <div className="p-6">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-bold text-foreground">Start Your 14-Day Free Trial</h3>
              <button onClick={onClose} className="p-2 hover:bg-muted rounded-lg transition"><XIcon size={20} /></button>
            </div>

            <p className="text-sm text-muted-foreground mb-4">Try {plan.name} Plan free for 14 days — no payment required now!</p>

            <div className="bg-muted/50 rounded-xl p-4 mb-5">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">What you get</p>
              <ul className="space-y-1.5">
                {plan.features.filter(f => f.included).slice(0, 4).map((f, i) => (
                  <li key={i} className="flex items-center gap-2 text-sm text-foreground">
                    <CheckCircleIcon size={14} className="text-primary" /> {f.text}
                  </li>
                ))}
              </ul>
            </div>

            <div className="bg-accent/10 rounded-xl p-4 mb-5 text-sm text-foreground">
              <p className="font-medium mb-1">After 14 days:</p>
              <ul className="list-disc ml-4 space-y-1 text-xs text-muted-foreground">
                <li>We'll send a reminder 2 days before trial ends</li>
                <li>You'll be charged KES {plan.monthlyPrice}/month if you continue</li>
                <li>Cancel anytime during trial — no charges</li>
              </ul>
            </div>

            <div className="flex gap-3">
              <button onClick={handleStartTrial} disabled={processing}
                className="flex-1 px-4 py-3 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition font-medium flex items-center justify-center gap-2 disabled:opacity-50">
                {processing && <LoaderIcon size={16} className="animate-spin" />} Start Free Trial
              </button>
              <button onClick={() => setStep('choose-method')}
                className="flex-1 px-4 py-3 border border-input text-foreground rounded-lg hover:bg-muted transition font-medium">
                Skip Trial & Pay Now
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}