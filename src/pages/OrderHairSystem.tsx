import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronDown,
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import hairColors from "@/assets/hair-colors.jpg";
import hairCurls from "@/assets/hair-curl-patterns.png";
import waveUnit from "@/assets/wave-unit.png";

type Step = "specs" | "delivery" | "review" | "success";
const choices = {
  density: ["100% Standard", "Custom"],
  customDensity: ["80%", "90%", "110%"],
};
const curlGuideChoices = [
  { value: "Standard", imageIndex: 9 },
  { value: "Extra straight", imageIndex: 10 },
  { value: "2.8 CM", imageIndex: 8 },
  { value: "2.5 CM", imageIndex: 7 },
  { value: "2.0 CM", imageIndex: 6 },
  { value: "1.8 CM", imageIndex: 5 },
  { value: "1.5 CM", imageIndex: 4 },
  { value: "1.2 CM", imageIndex: 3 },
  { value: "1.0 CM", imageIndex: 2 },
  { value: "0.6 CM", imageIndex: 1 },
  { value: "0.4 CM", imageIndex: 0 },
].map(({ value, imageIndex }) => ({
  value,
  column: imageIndex % 3,
  row: Math.floor(imageIndex / 3),
}));
const emptySystem = () => ({
  clientName: "",
  color: "",
  length: "Standard",
  lengthOther: "",
  density: "100% Standard",
  densityOther: "",
  curl: "Standard",
});
type SystemDetails = ReturnType<typeof emptySystem>;
const emptyForm = {
  barberFirstName: "",
  barberLastName: "",
  barberPhone: "",
  barberEmail: "",
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
  displayOption,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: string[];
  displayOption?: (option: string) => string;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="grid gap-2 sm:grid-cols-2">
        {options.map((option) => (
          <button
            key={option}
            type="button"
            aria-pressed={value === option}
            onClick={() => onChange(option)}
            className={`flex items-center justify-between gap-3 rounded-lg border px-3 py-2.5 text-left text-sm font-medium transition-colors ${value === option ? "border-primary bg-primary/10 ring-1 ring-primary/30" : "border-border bg-background hover:border-primary/40"}`}
          >
            <span>{displayOption?.(option) ?? option}</span>
            {value === option && (
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
                <Check className="h-3 w-3" aria-hidden="true" />
              </span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}

function CurlPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const [showChoices, setShowChoices] = useState(true);
  const selectedCurl = curlGuideChoices.find((choice) => choice.value === value);

  return (
    <div className="space-y-2">
      <Label>Curl pattern</Label>
      {!showChoices && value && (
        <button
          type="button"
          aria-label={`Selected curl: ${value}`}
          onClick={() => setShowChoices(true)}
          className="relative block w-[calc((100%-1.5rem)/4)] overflow-hidden rounded-xl border-2 border-primary bg-white text-left shadow-sm ring-2 ring-primary/30"
        >
          {value === "Wave unit" ? (
            <>
              <img src={waveUnit} alt="" className="block aspect-square w-full object-contain p-1" />
              <span className="block px-1 pb-2 pt-1 text-center text-xs font-medium text-black">Wave unit</span>
            </>
          ) : selectedCurl ? (
            <>
              <span
                aria-hidden="true"
                className="block aspect-[0.81] bg-[length:300%_400%] bg-no-repeat"
                style={{
                  backgroundImage: `url(${hairCurls})`,
                  backgroundPosition: `${selectedCurl.column * 50}% ${selectedCurl.row * (100 / 3)}%`,
                }}
              />
              {(value === "Extra straight" || value === "Standard") && (
                <span className="absolute inset-x-0 bottom-0 bg-white/95 px-1 py-1 text-center text-xs font-normal text-black">
                  {value === "Standard" ? "Standard · 3.0 CM" : "Extra straight · 4.0 CM"}
                </span>
              )}
            </>
          ) : null}
          <span className="absolute right-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
            <Check className="h-3 w-3" aria-hidden="true" />
          </span>
        </button>
      )}
      {!showChoices && (
        <button
          type="button"
          aria-expanded={false}
          onClick={() => setShowChoices(true)}
          className="flex w-full items-center justify-between rounded-lg border border-primary bg-primary/10 px-3 py-2.5 text-left text-sm font-medium transition-colors"
        >
          <span>Change curl pattern</span>
          <ChevronDown className="h-4 w-4" />
        </button>
      )}
      {showChoices && (
        <div className="grid grid-cols-4 gap-2 sm:gap-3">
          {curlGuideChoices.map(({ value: option, column, row }) => (
            <button
              key={option}
              type="button"
              aria-label={option === "Standard" ? "Standard — 3.0 CM" : option}
              aria-pressed={value === option}
              onClick={() => {
                onChange(option);
              }}
              className={`relative overflow-hidden rounded-xl border-2 bg-white text-left shadow-sm transition ${value === option ? "border-4 border-primary ring-2 ring-primary/40" : "border-transparent hover:border-primary/50"}`}
            >
              <span
                aria-hidden="true"
                className="block aspect-[0.81] bg-[length:300%_400%] bg-no-repeat"
                style={{
                  backgroundImage: `url(${hairCurls})`,
                  backgroundPosition: `${column * 50}% ${row * (100 / 3)}%`,
                }}
              />
              {(option === "Extra straight" || option === "Standard") && (
                <span className="absolute inset-x-0 bottom-0 bg-white/95 px-1 py-1 text-center text-xs font-normal text-black">
                  {option === "Standard" ? "Standard · 3.0 CM" : "Extra straight · 4.0 CM"}
                </span>
              )}
              {value === option && (
                <span className="absolute right-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm">
                  <Check className="h-3 w-3" aria-hidden="true" />
                </span>
              )}
            </button>
          ))}
          <button
            type="button"
            aria-label="Wave unit"
            aria-pressed={value === "Wave unit"}
            onClick={() => {
              onChange("Wave unit");
            }}
            className={`relative overflow-hidden rounded-xl border-2 bg-white text-left shadow-sm transition ${value === "Wave unit" ? "border-4 border-primary ring-2 ring-primary/40" : "border-transparent hover:border-primary/50"}`}
          >
            <img
              src={waveUnit}
              alt=""
              className="block aspect-square w-full object-contain p-1"
            />
            <span className="block px-1 pb-2 pt-1 text-center text-xs font-normal text-black">
              Wave unit
            </span>
            {value === "Wave unit" && (
              <span className="absolute right-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm">
                <Check className="h-3 w-3" aria-hidden="true" />
              </span>
            )}
          </button>
        </div>
      )}
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
  const [referenceGuide, setReferenceGuide] = useState<{
    src: string;
    label: string;
  } | null>(null);
  const change = (key: keyof Form) => (value: string) =>
    setForm((current) => ({ ...current, [key]: value }));
  const progress = step === "specs" ? 1 : step === "delivery" ? 2 : 3;
  const updateSystem = (
    index: number,
    key: keyof SystemDetails,
    value: SystemDetails[keyof SystemDetails],
  ) =>
    setSystems((current) =>
      current.map((system, itemIndex) =>
        itemIndex === index ? { ...system, [key]: value } : system,
      ),
    );
  useEffect(() => {
    if (!user) return;
    const metadata = (user.user_metadata || {}) as Record<string, unknown>;
    const stringValue = (...values: unknown[]) =>
      values.find((value): value is string => typeof value === "string" && value.trim().length > 0)?.trim() || "";
    const firstAndLastName = [metadata.first_name || metadata.given_name, metadata.last_name || metadata.family_name]
      .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
      .join(" ");
    const fallbackName = stringValue(metadata.full_name, metadata.name, metadata.fullName, firstAndLastName);
    const [fallbackFirstName = "", ...fallbackLastName] = fallbackName.split(/\s+/).filter(Boolean);
    const fallbackPhone = stringValue(metadata.phone, metadata.phone_number, metadata.mobile);
    const fillFromAccount = (account?: { full_name: string | null; email: string | null; phone: string | null } | null) => {
      setForm((current) => ({
        ...current,
        barberFirstName: current.barberFirstName || (account?.full_name || fallbackName).split(/\s+/).filter(Boolean)[0] || fallbackFirstName,
        barberLastName: current.barberLastName || (account?.full_name || fallbackName).split(/\s+/).filter(Boolean).slice(1).join(" ") || fallbackLastName.join(" "),
        barberPhone: current.barberPhone || account?.phone || fallbackPhone,
        barberEmail: current.barberEmail || account?.email || user.email || "",
      }));
    };
    fillFromAccount();
    supabase
      .from("profiles")
      .select("full_name, email, phone")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data }) => fillFromAccount(data));
  }, [user?.id]);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sessionId = params.get("session_id");
    if (params.get("checkout") === "cancelled") {
      toast.message("Checkout cancelled. Your order was not submitted.");
      window.history.replaceState({}, "", "/order-hair-system");
      return;
    }
    if (params.get("checkout") !== "success" || !sessionId) return;
    setSending(true);
    supabase.functions
      .invoke("hair-system-checkout", { body: { action: "verify", sessionId } })
      .then(({ data, error }) => {
        if (error) throw error;
        if (!data?.paid) throw new Error("Stripe has not confirmed payment yet.");
        setOrderId(data.order_ids?.[0] || null);
        setStep("success");
        window.history.replaceState({}, "", "/order-hair-system");
      })
      .catch((error: Error) =>
        toast.error(error.message || "We could not verify your Stripe payment yet."),
      )
      .finally(() => setSending(false));
  }, []);
  const setTotalQuantity = (value: string) => {
    const digits = value.replace(/[^0-9]/g, "").slice(0, 2);
    if (!digits) {
      setForm((current) => ({ ...current, quantity: "" }));
      return;
    }
    const quantity = Math.max(1, Math.min(12, Number.parseInt(digits, 10)));
    setForm((current) => ({ ...current, quantity: String(quantity) }));
    setSystems((current) =>
      Array.from(
        { length: quantity },
        (_, index) => current[index] || emptySystem(),
      ),
    );
  };
  const normalizeTotalOrders = () => {
    if (form.quantity) return;
    setForm((current) => ({ ...current, quantity: "1" }));
    setSystems((current) => current.slice(0, 1));
  };

  const goDelivery = () => {
    if (
      ![
        form.barberFirstName,
        form.barberLastName,
        form.barberPhone,
        ...systems.flatMap((system) => [
          system.color,
          system.length === "Other" ? system.lengthOther : system.length,
          system.density === "Custom"
            ? system.densityOther
            : system.density,
        ]),
      ].every((value) => value.trim())
    )
      return toast.error(
        "Add your first name, last name, phone number, color, and length first.",
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
        "hair-system-checkout",
        { body: { ...form, systems } },
      );
      if (error) throw error;
      if (!data?.url) throw new Error("Unable to start secure checkout.");
      window.location.assign(data.url);
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
                    label="Your first name"
                    id="barber-first-name"
                    value={form.barberFirstName}
                    onChange={change("barberFirstName")}
                    placeholder="First name"
                  />
                  <Field
                    label="Your last name"
                    id="barber-last-name"
                    value={form.barberLastName}
                    onChange={change("barberLastName")}
                    placeholder="Last name"
                  />
                  <Field
                    label="Your phone"
                    id="barber-phone"
                    value={form.barberPhone}
                    onChange={change("barberPhone")}
                    placeholder="(555) 555-5555"
                    type="tel"
                  />
                  <Field
                    label="Your email"
                    id="barber-email"
                    value={form.barberEmail}
                    onChange={change("barberEmail")}
                    placeholder="you@example.com"
                    type="email"
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
                <p className="-mt-3 text-xs text-muted-foreground">
                  Each system is entered and sent as its own order.
                </p>
                {systems.map((system, index) => (
                  <div
                    key={index}
                    className="space-y-5 rounded-xl border border-border bg-background/30 p-4 sm:p-5"
                  >
                    <h3 className="font-semibold text-primary">
                      Order {index + 1}
                    </h3>
                    <Field
                      label="Client name (optional)"
                      id={`client-name-${index}`}
                      value={system.clientName}
                      onChange={(value) => updateSystem(index, "clientName", value)}
                      placeholder="Internal reference for past orders"
                    />
                    <Field
                      label="Hair color"
                      id={`hair-color-${index}`}
                      value={system.color}
                      onChange={(value) => updateSystem(index, "color", value)}
                      placeholder="e.g. #1B, #2, or #350"
                    />
                    <Picker
                      label="Hair length"
                      value={system.length}
                      onChange={(value) => updateSystem(index, "length", value)}
                      options={["Standard", "Other"]}
                      displayOption={(value) =>
                        value === "Standard" ? 'Standard Men’s System: 5" · $200' : value
                      }
                    />
                    {system.length === "Other" && (
                      <Picker
                        label="Custom hair length"
                        value={system.lengthOther}
                        onChange={(value) =>
                          updateSystem(index, "lengthOther", value)
                        }
                        options={['14" hair', '16" hair']}
                      />
                    )}
                    {system.length === "Other" && system.lengthOther === '14" hair' && (
                      <p className="rounded-lg border border-primary/30 bg-primary/10 px-3 py-2 text-sm font-medium text-primary">
                        Custom 14-inch unit added to this order · $262.50
                      </p>
                    )}
                    {system.length === "Other" && system.lengthOther === '16" hair' && (
                      <p className="rounded-lg border border-primary/30 bg-primary/10 px-3 py-2 text-sm font-medium text-primary">
                        Custom 16-inch unit added to this order · $315
                      </p>
                    )}
                    <Picker
                      label="Density"
                      value={system.density}
                      onChange={(value) =>
                        updateSystem(index, "density", value)
                      }
                      options={choices.density}
                    />
                    {system.density === "Custom" && (
                      <Picker
                        label="Choose custom density"
                        value={system.densityOther}
                        onChange={(value) =>
                          updateSystem(index, "densityOther", value)
                        }
                        options={choices.customDensity}
                      />
                    )}
                    <CurlPicker
                      value={system.curl}
                      onChange={(value) => updateSystem(index, "curl", value)}
                    />
                    {system.curl === "Wave unit" && (
                      <p className="rounded-lg border border-primary/30 bg-primary/10 px-3 py-2 text-sm font-medium text-primary">
                        Wave Unit added to this order · $50
                      </p>
                    )}
                    {system.curl && system.curl !== "Standard" && system.curl !== "Wave unit" && (
                      <p className="rounded-lg border border-primary/30 bg-primary/10 px-3 py-2 text-sm font-medium text-primary">
                        Curly added to this order · $30
                      </p>
                    )}
                  </div>
                ))}
              </div>
              <div className="mt-8 flex">
                <Button className="gold-gradient h-14 w-full text-base sm:ml-auto sm:w-auto" onClick={goDelivery}>
                  Continue to delivery <ArrowRight className="ml-2 h-5 w-5" />
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
              <div className="grid grid-cols-2 items-start gap-3 lg:grid-cols-1">
                {[
                  [hairColors, "Hair color guide"],
                ].map(([src, label]) => (
                  <button
                    type="button"
                    onClick={() =>
                      setReferenceGuide({
                        src: src as string,
                        label: label as string,
                      })
                    }
                    className="overflow-hidden rounded-xl border border-border bg-card text-left transition hover:border-primary/60 focus:outline-none focus:ring-2 focus:ring-primary/50"
                    key={label as string}
                  >
                    <img
                      src={src as string}
                      alt={label as string}
                      className="h-auto w-full object-contain"
                    />
                    <p className="p-3 text-xs font-medium">{label as string}</p>
                  </button>
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
                options={["Standard", "Rush Ship (3 Days) · $50"]}
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
                  <h2 className="text-xl font-bold">Review before checkout</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    You'll securely pay for the selected system and add-ons next.
                  </p>
                </div>
              </div>
            </div>
            <div className="grid gap-5 md:grid-cols-2">
              <div className="glass-card rounded-xl p-5">
                <h3 className="font-semibold">
                  {systems.length} system{systems.length === 1 ? "" : "s"}
                </h3>
                <dl className="mt-4 space-y-4 text-sm">
                  {systems.map((system, index) => (
                    <div
                      key={index}
                      className="border-b border-border pb-3 last:border-0 last:pb-0"
                    >
                      <dt className="font-semibold text-primary">
                        Order {index + 1}
                      </dt>
                      {system.clientName && <dd className="mt-1 font-medium">{system.clientName}</dd>}
                      <dd className="text-muted-foreground">
                        {system.color} ·{" "}
                        {system.length === "Other"
                          ? system.lengthOther
                          : system.length}
                      </dd>
                      <dd className="text-muted-foreground">
                        {system.density === "Custom"
                          ? system.densityOther
                          : system.density} · {system.curl}
                      </dd>
                    </div>
                  ))}
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
                {sending ? "Opening secure checkout…" : "Continue to secure payment"}
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
              Your paid order is in
            </h2>
            <p className="mx-auto mt-3 max-w-lg text-muted-foreground">
              We saved your paid system and delivery details in the Barber
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
      <Dialog
        open={Boolean(referenceGuide)}
        onOpenChange={(open) => !open && setReferenceGuide(null)}
      >
        <DialogContent className="max-w-4xl p-3 sm:p-5">
          <DialogHeader className="pr-8">
            <DialogTitle>{referenceGuide?.label}</DialogTitle>
          </DialogHeader>
          <div className="max-h-[68vh] overflow-auto rounded-lg bg-white">
            {referenceGuide && (
              <img
                src={referenceGuide.src}
                alt={referenceGuide.label}
                className="h-auto w-full"
              />
            )}
          </div>
          <Button
            variant="outline"
            className="w-full"
            onClick={() => setReferenceGuide(null)}
          >
            Close guide
          </Button>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
