import { useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  ClipboardCheck,
  MapPin,
  PackageCheck,
  Play,
  Scissors,
  Sparkles,
  Truck,
} from "lucide-react";
import { toast } from "sonner";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import hairColors from "@/assets/hair-colors.jpg";
import hairCurls from "@/assets/hair-curls.jpg";

type Step = "specs" | "delivery" | "review" | "success";
const choices = {
  density: ["80%", "90%", "100% (regular)", "110%", "Custom density"],
  curl: ["0.4 CM", "0.6 CM", "1.0 CM", "1.2 CM", "1.5 CM", "1.8 CM", "2.0 CM", "2.5 CM", "2.8 CM"],
};
const emptySystem = () => ({
  clientName: "",
  color: "",
  length: "Standard",
  lengthOther: "",
  density: "100% (regular)",
  curl: "0.6 CM",
});
type SystemDetails = ReturnType<typeof emptySystem>;
const emptyForm = {
  barberName: "",
  barberPhone: "",
  quantity: "1",
  shippingSpeed: "Standard",
  address1: "",
  address2: "",
  city: "",
  state: "",
  zip: "",
  notes: "",
};
type Form = typeof emptyForm;

function Picker({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: string[];
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="grid gap-2 sm:grid-cols-2">
        {options.map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => onChange(option)}
            className={`rounded-lg border px-3 py-2.5 text-left text-sm font-medium transition-colors ${value === option ? "border-primary bg-primary/10 ring-1 ring-primary/30" : "border-border bg-background hover:border-primary/40"}`}
          >
            {option}
          </button>
        ))}
      </div>
    </div>
  );
}

function Field({
  label,
  id,
  value,
  onChange,
  placeholder,
  type = "text",
  optional = false,
  onBlur,
}: {
  label: string;
  id: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
  optional?: boolean;
  onBlur?: () => void;
}) {
  return (
    <div>
      <Label htmlFor={id}>
        {label}
        {optional && <span className="text-muted-foreground"> (optional)</span>}
      </Label>
      <Input
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        type={type}
        onBlur={onBlur}
        className="mt-2"
      />
    </div>
  );
}

export default function OrderHairSystem() {
  const { user } = useAuth();
  const [step, setStep] = useState<Step>("specs");
  const [form, setForm] = useState<Form>(emptyForm);
  const [systems, setSystems] = useState<SystemDetails[]>([emptySystem()]);
  const [sending, setSending] = useState(false);
  const [orderId, setOrderId] = useState<string | null>(null);
  const change = (key: keyof Form) => (value: string) =>
    setForm((current) => ({ ...current, [key]: value }));
  const progress = step === "specs" ? 1 : step === "delivery" ? 2 : 3;
  const updateSystem = (index: number, key: keyof SystemDetails, value: string) =>
    setSystems((current) => current.map((system, itemIndex) => itemIndex === index ? { ...system, [key]: value } : system));
  const setTotalQuantity = (value: string) => {
    const digits = value.replace(/[^0-9]/g, "").slice(0, 2);
    if (!digits) {
      setForm((current) => ({ ...current, quantity: "" }));
      return;
    }
    const quantity = Math.max(1, Math.min(12, Number.parseInt(digits, 10)));
    setForm((current) => ({ ...current, quantity: String(quantity) }));
    setSystems((current) => Array.from({ length: quantity }, (_, index) => current[index] || emptySystem()));
  };
  const normalizeTotalOrders = () => {
    if (form.quantity) return;
    setForm((current) => ({ ...current, quantity: "1" }));
    setSystems((current) => current.slice(0, 1));
  };

  const goDelivery = () => {
    if (
      ![
        form.barberName,
        form.barberPhone,
        ...systems.flatMap((system) => [system.clientName, system.color, system.length === "Other" ? system.lengthOther : system.length]),
      ].every((value) => value.trim())
    )
      return toast.error(
        "Add your name, phone number, client name, color, and length first.",
      );
    setStep("delivery");
  };
  const goReview = () => {
    if (
      ![form.address1, form.city, form.state].every((value) => value.trim()) ||
      !/^\d{5}(-\d{4})?$/.test(form.zip.trim())
    )
      return toast.error("Add a complete shipping address and valid ZIP code.");
    setStep("review");
  };
  const submit = async () => {
    if (!user) return;
    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke(
        "submit-hair-system-order",
        { body: { ...form, systems } },
      );
      if (error) throw error;
      setOrderId(data?.order_ids?.[0] || data?.order_id || null);
      setStep("success");
    } catch (error: any) {
      toast.error(
        error.message || "Unable to send the order. Please try again.",
      );
    } finally {
      setSending(false);
    }
  };

  return (
    <DashboardLayout>
      <main className="mx-auto max-w-5xl space-y-6 pb-10">
        <section className="rounded-2xl border border-primary/25 bg-gradient-to-br from-primary/15 via-card to-card p-6 sm:p-8">
          <div className="flex flex-col justify-between gap-5 sm:flex-row">
            <div className="max-w-2xl">
              <p className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-[.18em] text-primary">
                <Sparkles className="h-4 w-4" /> Barber Launch orders
              </p>
              <h1 className="font-display text-3xl font-bold sm:text-4xl">
                Order a hair system
              </h1>
              <p className="mt-3 text-muted-foreground">
                Send complete specifications directly to the Barber Launch order
                queue. We review each order before it moves into production.
              </p>
            </div>
            <Link
              to="/courses/hair-system/lesson/60c268c9-5df7-4161-8d91-2c185fc791d0"
              className="inline-flex h-fit items-center gap-2 rounded-lg border border-primary/40 bg-background/60 px-4 py-2.5 text-sm font-semibold text-primary hover:bg-primary/10"
            >
              <Play className="h-4 w-4 fill-primary" /> Watch ordering lesson
            </Link>
          </div>
        </section>

        {step !== "success" && (
          <section className="glass-card rounded-xl p-4">
            <div className="grid grid-cols-3 gap-2">
              {[
                [1, "System details"],
                [2, "Delivery"],
                [3, "Review & send"],
              ].map(([number, label]) => (
                <div className="flex items-center gap-2" key={String(number)}>
                  <div
                    className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-xs font-bold ${progress >= Number(number) ? "border-primary bg-primary text-primary-foreground" : "border-border bg-muted text-muted-foreground"}`}
                  >
                    {progress > Number(number) ? (
                      <Check className="h-4 w-4" />
                    ) : (
                      number
                    )}
                  </div>
                  <span
                    className={`truncate text-xs font-semibold sm:text-sm ${progress === Number(number) ? "text-foreground" : "text-muted-foreground"}`}
                  >
                    {label as string}
                  </span>
                </div>
              ))}
            </div>
            <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full gold-gradient transition-all"
                style={{ width: `${(progress / 3) * 100}%` }}
              />
            </div>
          </section>
        )}

        {step === "specs" && (
          <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_260px]">
            <div className="glass-card rounded-xl p-5 sm:p-7">
              <div className="mb-6 flex gap-3">
                <div className="h-fit rounded-xl bg-primary/15 p-3 text-primary">
                  <Scissors className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-xl font-bold">System details</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Tell us exactly what you need for this client.
                  </p>
                </div>
              </div>
              <div className="space-y-6">
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field
                    label="Your name"
                    id="barber-name"
                    value={form.barberName}
                    onChange={change("barberName")}
                    placeholder="Your full name"
                  />
                  <Field
                    label="Your phone"
                    id="barber-phone"
                    value={form.barberPhone}
                    onChange={change("barberPhone")}
                    placeholder="(555) 555-5555"
                    type="tel"
                  />
                </div>
                <Field
                  label="Total orders"
                  id="total-orders"
                  value={form.quantity}
                  onChange={setTotalQuantity}
                  onBlur={normalizeTotalOrders}
                  type="text"
                />
                <p className="-mt-3 text-xs text-muted-foreground">Each system is entered and sent as its own order.</p>
                {systems.map((system, index) => (
                  <div key={index} className="space-y-5 rounded-xl border border-border bg-background/30 p-4 sm:p-5">
                    <h3 className="font-semibold text-primary">Order {index + 1}</h3>
                    <Field label="Client name" id={`client-name-${index}`} value={system.clientName} onChange={(value) => updateSystem(index, "clientName", value)} placeholder="Name used to identify this order" />
                    <Field label="Hair color" id={`color-${index}`} value={system.color} onChange={(value) => updateSystem(index, "color", value)} placeholder="Example: #1B, ash brown, or color match" />
                    <Picker label="Hair length" value={system.length} onChange={(value) => updateSystem(index, "length", value)} options={["Standard", "Other"]} />
                    {system.length === "Other" && <Field label="Other hair length" id={`length-other-${index}`} value={system.lengthOther} onChange={(value) => updateSystem(index, "lengthOther", value)} placeholder="Write the requested length" />}
                    <Picker label="Density" value={system.density} onChange={(value) => updateSystem(index, "density", value)} options={choices.density} />
                    <Picker label="Curl pattern" value={system.curl} onChange={(value) => updateSystem(index, "curl", value)} options={choices.curl} />
                  </div>
                ))}
              </div>
              <div className="mt-8 flex justify-end">
                <Button className="gold-gradient" onClick={goDelivery}>
                  Continue to delivery <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </div>
            <aside className="space-y-4">
              <div className="glass-card rounded-xl p-4">
                <h3 className="font-semibold">Quick references</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Use these while choosing specs.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-1">
                {[
                  [hairColors, "Hair color guide"],
                  [hairCurls, "Curl pattern guide"],
                ].map(([src, label]) => (
                  <div
                    className="overflow-hidden rounded-xl border border-border bg-card"
                    key={label as string}
                  >
                    <img
                      src={src as string}
                      alt={label as string}
                      className="aspect-square w-full object-cover"
                    />
                    <p className="p-3 text-xs font-medium">{label as string}</p>
                  </div>
                ))}
              </div>
            </aside>
          </section>
        )}

        {step === "delivery" && (
          <section className="glass-card mx-auto max-w-3xl rounded-xl p-5 sm:p-7">
            <div className="mb-6 flex gap-3">
              <div className="h-fit rounded-xl bg-primary/15 p-3 text-primary">
                <Truck className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-xl font-bold">Delivery details</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Where should we send this system once it’s ready?
                </p>
              </div>
            </div>
            <div className="space-y-5">
              <Picker
                label="Shipping speed"
                value={form.shippingSpeed}
                onChange={change("shippingSpeed")}
                options={["Standard", "Rush — confirm availability first"]}
              />
              <Field
                label="Street address"
                id="address1"
                value={form.address1}
                onChange={change("address1")}
                placeholder="123 Main Street"
              />
              <Field
                label="Apartment, suite, etc."
                id="address2"
                value={form.address2}
                onChange={change("address2")}
                optional
              />
              <div className="grid gap-4 sm:grid-cols-[1fr_100px_120px]">
                <Field
                  label="City"
                  id="city"
                  value={form.city}
                  onChange={change("city")}
                />
                <Field
                  label="State"
                  id="state"
                  value={form.state}
                  onChange={(value) =>
                    change("state")(value.toUpperCase().slice(0, 2))
                  }
                  placeholder="CA"
                />
                <Field
                  label="ZIP code"
                  id="zip"
                  value={form.zip}
                  onChange={change("zip")}
                  placeholder="90210"
                />
              </div>
              <div>
                <Label htmlFor="notes">
                  Order notes{" "}
                  <span className="text-muted-foreground">(optional)</span>
                </Label>
                <Textarea
                  id="notes"
                  value={form.notes}
                  onChange={(event) => change("notes")(event.target.value)}
                  placeholder="Anything we should know about this match, cut, or delivery?"
                  rows={4}
                  className="mt-2"
                />
              </div>
            </div>
            <div className="mt-8 flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
              <Button variant="outline" onClick={() => setStep("specs")}>
                <ArrowLeft className="mr-2 h-4 w-4" /> Back to details
              </Button>
              <Button className="gold-gradient" onClick={goReview}>
                Review order <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </section>
        )}

        {step === "review" && (
          <section className="mx-auto max-w-3xl space-y-5">
            <div className="glass-card rounded-xl p-5 sm:p-7">
              <div className="flex gap-3">
                <div className="h-fit rounded-xl bg-primary/15 p-3 text-primary">
                  <ClipboardCheck className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-xl font-bold">Review before sending</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    This goes into the Barber Launch queue as a pending request.
                  </p>
                </div>
              </div>
            </div>
            <div className="grid gap-5 md:grid-cols-2">
              <div className="glass-card rounded-xl p-5">
                <h3 className="font-semibold">{systems.length} system{systems.length === 1 ? "" : "s"}</h3>
                <dl className="mt-4 space-y-4 text-sm">
                  {systems.map((system, index) => <div key={index} className="border-b border-border pb-3 last:border-0 last:pb-0"><dt className="font-semibold text-primary">Order {index + 1}</dt><dd className="mt-1 font-medium">{system.clientName}</dd><dd className="text-muted-foreground">{system.color} · {system.length === "Other" ? system.lengthOther : system.length}</dd><dd className="text-muted-foreground">{system.density} · {system.curl}</dd></div>)}
                </dl>
                <Button
                  variant="ghost"
                  size="sm"
                  className="mt-4 -ml-2 text-primary"
                  onClick={() => setStep("specs")}
                >
                  Edit system details
                </Button>
              </div>
              <div className="glass-card rounded-xl p-5">
                <h3 className="font-semibold">Delivery</h3>
                <div className="mt-4 flex gap-3 text-sm">
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  <p>
                    {form.address1}
                    <br />
                    {form.address2 && (
                      <>
                        {form.address2}
                        <br />
                      </>
                    )}
                    {form.city}, {form.state} {form.zip}
                    <br />
                    <span className="text-muted-foreground">
                      {form.shippingSpeed}
                    </span>
                  </p>
                </div>
                {form.notes && (
                  <p className="mt-4 border-t border-border pt-4 text-sm">
                    <span className="text-muted-foreground">Notes: </span>
                    {form.notes}
                  </p>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  className="mt-4 -ml-2 text-primary"
                  onClick={() => setStep("delivery")}
                >
                  Edit delivery
                </Button>
              </div>
            </div>
            <p className="rounded-xl border border-primary/25 bg-primary/5 p-4 text-sm text-muted-foreground">
              Sending this request does not charge a card. The team reviews the
              specifications and confirms the next step.
            </p>
            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
              <Button variant="outline" onClick={() => setStep("delivery")}>
                <ArrowLeft className="mr-2 h-4 w-4" /> Back
              </Button>
              <Button
                className="gold-gradient min-w-52"
                onClick={submit}
                disabled={sending}
              >
                {sending ? "Sending order…" : "Send order request"}
                <PackageCheck className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </section>
        )}

        {step === "success" && (
          <section className="glass-card mx-auto max-w-2xl rounded-2xl p-8 text-center sm:p-12">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-500/15 text-green-400">
              <CheckCircle2 className="h-9 w-9" />
            </div>
            <h2 className="mt-5 text-2xl font-bold">
              Your order request is in
            </h2>
            <p className="mx-auto mt-3 max-w-lg text-muted-foreground">
              We saved the complete system and delivery details in the Barber
              Launch order queue for review.
            </p>
            {orderId && (
              <p className="mt-4 text-xs text-muted-foreground">
                Order reference: {orderId.slice(0, 8).toUpperCase()}
              </p>
            )}
            <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
              <Link to="/orders">
                <Button className="gold-gradient">View my orders</Button>
              </Link>
              <Button
                variant="outline"
                onClick={() => {
                  setForm(emptyForm);
                  setOrderId(null);
                  setStep("specs");
                }}
              >
                Start another order
              </Button>
            </div>
          </section>
        )}
      </main>
    </DashboardLayout>
  );
}
