import { useState } from "react";
import { Search, MapPin, Instagram, Calendar, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { searchSpecialists, SpecialistSearchResult } from "@/hooks/useSpecialistDirectory";
import { toast } from "sonner";

const FindASpecialist = () => {
  const [zip, setZip] = useState("");
  const [results, setResults] = useState<SpecialistSearchResult[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^\d{5}$/.test(zip)) {
      toast.error("Please enter a valid 5-digit ZIP code");
      return;
    }
    setLoading(true);
    setSearched(true);
    try {
      const data = await searchSpecialists(zip);
      setResults(data);
    } catch (err: any) {
      toast.error(err.message || "Search failed");
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Hero */}
      <header className="border-b border-border bg-card">
        <div className="max-w-5xl mx-auto px-6 py-16 text-center">
          <h1 className="text-4xl md:text-5xl font-display font-semibold text-foreground mb-4">
            Find a Certified Hair System Specialist
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-8">
            Connect with vetted, trained specialists near you. Every professional in our network is certified through The Barber Launch.
          </p>

          <form onSubmit={handleSearch} className="flex gap-2 max-w-md mx-auto">
            <Input
              type="text"
              inputMode="numeric"
              pattern="\d{5}"
              maxLength={5}
              value={zip}
              onChange={(e) => setZip(e.target.value.replace(/\D/g, ""))}
              placeholder="Enter ZIP code"
              className="h-12 text-base"
            />
            <Button type="submit" disabled={loading} className="h-12 px-6">
              <Search className="h-4 w-4 mr-2" />
              {loading ? "Searching…" : "Search"}
            </Button>
          </form>
        </div>
      </header>

      {/* Results */}
      <main className="max-w-5xl mx-auto px-6 py-12">
        {!searched && (
          <div className="text-center text-muted-foreground py-12">
            <MapPin className="h-12 w-12 mx-auto mb-4 opacity-30" />
            <p>Enter your ZIP code above to find specialists near you.</p>
          </div>
        )}

        {searched && results && results.length === 0 && !loading && (
          <div className="text-center py-16">
            <h2 className="text-2xl font-semibold text-foreground mb-2">No specialists nearby yet</h2>
            <p className="text-muted-foreground">
              We don't have a certified specialist in this area yet. Check back soon — our network is growing.
            </p>
          </div>
        )}

        {results && results.length > 0 && (
          <div className="grid gap-6 md:grid-cols-2">
            {results.map((s) => {
              const fullName = [s.first_name, s.last_name].filter(Boolean).join(" ");
              return (
                <article
                  key={s.id}
                  className="bg-card rounded-xl border border-border shadow-sm hover:shadow-md transition-shadow overflow-hidden"
                >
                  {s.hero_photo_url ? (
                    <div className="aspect-[4/3] bg-muted overflow-hidden">
                      <img
                        src={s.hero_photo_url}
                        alt={s.business_name}
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                    </div>
                  ) : (
                    <div className="aspect-[4/3] bg-muted flex items-center justify-center">
                      <MapPin className="h-12 w-12 text-muted-foreground/40" />
                    </div>
                  )}

                  <div className="p-5">
                    <h3 className="text-xl font-semibold text-foreground">{s.business_name}</h3>
                    {fullName && <p className="text-sm text-muted-foreground mb-1">{fullName}</p>}
                    <p className="text-sm text-muted-foreground flex items-center gap-1 mb-3">
                      <MapPin className="h-3.5 w-3.5" />
                      {s.city}, {s.state} · {s.distance_miles.toFixed(1)} mi
                    </p>

                    {s.bio && <p className="text-sm text-foreground/80 mb-4 line-clamp-3">{s.bio}</p>}

                    <div className="flex flex-wrap gap-2">
                      {s.booking_url && (
                        <Button asChild size="sm">
                          <a href={s.booking_url} target="_blank" rel="noopener noreferrer">
                            <Calendar className="h-3.5 w-3.5 mr-1.5" />
                            Book
                          </a>
                        </Button>
                      )}
                      {s.instagram_handle && (
                        <Button asChild variant="outline" size="sm">
                          <a
                            href={`https://instagram.com/${s.instagram_handle.replace("@", "")}`}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <Instagram className="h-3.5 w-3.5 mr-1.5" />
                            Instagram
                          </a>
                        </Button>
                      )}
                      {s.phone && (
                        <Button asChild variant="outline" size="sm">
                          <a href={`tel:${s.phone}`}>
                            <Phone className="h-3.5 w-3.5 mr-1.5" />
                            Call
                          </a>
                        </Button>
                      )}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </main>

      <footer className="border-t border-border mt-16 py-8 text-center text-sm text-muted-foreground">
        <p>Powered by The Barber Launch · Certified Specialist Network</p>
      </footer>
    </div>
  );
};

export default FindASpecialist;
