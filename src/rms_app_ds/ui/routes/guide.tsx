import { createFileRoute } from "@tanstack/react-router";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  LayoutDashboard,
  Hotel,
  Target,
  Calendar,
  TrendingUp,
  Users,
  BarChart3,
  DollarSign,
  Shield,
  ArrowRight,
  Lightbulb,
  CheckCircle,
  Globe,
  LineChart,
} from "lucide-react";

export const Route = createFileRoute("/guide")({
  component: GuidePage,
});

function GuidePage() {
  return (
    <div className="p-6 space-y-8 max-w-4xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">
          Getting Started
        </h1>
        <p className="text-muted-foreground mt-1">
          Learn how to use the Hotel Revenue Management System to optimize
          pricing, track performance, and stay ahead of competitors.
        </p>
      </div>

      <Card className="border-primary/30 bg-primary/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lightbulb className="h-5 w-5 text-primary" />
            What is this app?
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm leading-relaxed space-y-3">
          <p>
            The <strong>Hotel Revenue Management System (RMS)</strong> is a
            pricing intelligence platform that helps revenue managers across
            800+ hotel properties maximize{" "}
            <strong>RevPAR (Revenue Per Available Room)</strong> — the key
            metric that balances room rates with occupancy.
          </p>
          <p>
            The system uses demand forecasting, competitor analysis, and
            occupancy predictions to suggest optimal prices for each room type
            and date. You can accept suggestions, override them manually, or
            use them as guidance for your own pricing strategy.
          </p>
        </CardContent>
      </Card>

      <div className="space-y-6">
        <h2 className="text-xl font-semibold">App Pages</h2>

        <div className="grid gap-4">
          <FeatureCard
            icon={LayoutDashboard}
            title="Dashboard"
            route="/dashboard"
            description="Portfolio-wide overview of revenue, occupancy, and booking trends."
          >
            <ul className="space-y-2">
              <li className="flex gap-2">
                <DollarSign className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                <span>
                  <strong>KPI cards</strong> — revenue MTD, average occupancy,
                  RevPAR, and bookings with period-over-period changes.
                </span>
              </li>
              <li className="flex gap-2">
                <LineChart className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                <span>
                  <strong>Revenue trend</strong> — daily revenue over the last 7,
                  14, or 30 days. Filter by region to focus on specific markets.
                </span>
              </li>
              <li className="flex gap-2">
                <Globe className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                <span>
                  <strong>Occupancy by region</strong> — compare performance
                  across geographic markets.
                </span>
              </li>
              <li className="flex gap-2">
                <TrendingUp className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                <span>
                  <strong>Pickup curve</strong> — how occupancy builds as the
                  stay date approaches, by region or individual hotel.
                </span>
              </li>
            </ul>
          </FeatureCard>

          <FeatureCard
            icon={Target}
            title="Pricing Opportunities"
            route="/opportunities"
            description="Identify the highest-impact pricing adjustments across all properties."
          >
            <ul className="space-y-2">
              <li className="flex gap-2">
                <BarChart3 className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                <span>
                  Hotels are ranked by potential RevPAR uplift — the difference
                  between current and optimized pricing.
                </span>
              </li>
              <li className="flex gap-2">
                <Shield className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                <span>
                  <strong>Displacement risk</strong> flags hotels priced
                  significantly above competitors, where guests may switch to
                  rival brands.
                </span>
              </li>
              <li className="flex gap-2">
                <CheckCircle className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                <span>
                  <strong>Confidence scores</strong> indicate how reliable each
                  suggestion is, based on forecast quality and data coverage.
                </span>
              </li>
            </ul>
          </FeatureCard>

          <FeatureCard
            icon={Hotel}
            title="Hotels"
            route="/hotels"
            description="Browse and search across all hotel properties."
          >
            <ul className="space-y-2">
              <li className="flex gap-2">
                <Users className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                <span>
                  Search by hotel name or city, and filter by region. Each card
                  shows live occupancy, ADR, and RevPAR.
                </span>
              </li>
              <li className="flex gap-2">
                <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                <span>
                  Click any hotel to open its detailed pricing and analytics view.
                </span>
              </li>
            </ul>
          </FeatureCard>

          <FeatureCard
            icon={Calendar}
            title="Hotel Detail & Pricing Calendar"
            route="/hotels/:hotelId"
            description="Deep dive into a single hotel's pricing, forecasts, and competitive landscape."
          >
            <ul className="space-y-2">
              <li className="flex gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                <span>
                  <strong>Pricing calendar</strong> — monthly view showing
                  average price, suggested price, occupancy, and booking status
                  for each day. Click a day to see all room types, accept a
                  suggestion, or set a manual override.
                </span>
              </li>
              <li className="flex gap-2">
                <TrendingUp className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                <span>
                  <strong>Forecasts tab</strong> — demand and occupancy
                  predictions with confidence intervals, powered by ML models.
                </span>
              </li>
              <li className="flex gap-2">
                <Shield className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                <span>
                  <strong>Competitors tab</strong> — how competitor brands price
                  equivalent room types, and whether you are priced above or
                  below the market.
                </span>
              </li>
              <li className="flex gap-2">
                <Globe className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                <span>
                  <strong>Web traffic tab</strong> — search volume, page views,
                  booking attempts, and conversion rates over time.
                </span>
              </li>
            </ul>
          </FeatureCard>
        </div>
      </div>

      <div className="space-y-6">
        <h2 className="text-xl font-semibold">Key Concepts</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <ConceptCard
            term="RevPAR"
            definition="Revenue Per Available Room = ADR × Occupancy Rate. The primary metric balancing price and demand."
          />
          <ConceptCard
            term="ADR"
            definition="Average Daily Rate — the mean selling price across all sold rooms for a given day."
          />
          <ConceptCard
            term="Competitor Displacement"
            definition="When your hotel's price exceeds market rates, guests switch to competitors. The system caps suggestions at 15% above competitor average."
          />
          <ConceptCard
            term="Pricing Suggestion"
            definition="The algorithm sweeps candidate prices and models expected occupancy using base elasticity and competitive displacement to find the RevPAR-maximizing price."
          />
          <ConceptCard
            term="Demand Score"
            definition="A 0–100 score derived from occupancy patterns and seasonal factors, indicating how strong demand is for a given hotel and date."
          />
          <ConceptCard
            term="Pickup Curve"
            definition="Shows how occupancy builds over time before the stay date. Steep late curves suggest last-minute demand; flat early ones suggest steady advance bookings."
          />
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Typical Workflow</CardTitle>
          <CardDescription>
            A recommended approach for daily revenue management
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ol className="space-y-4">
            {[
              {
                step: "1",
                title: "Check the Dashboard",
                desc: "Start with the portfolio overview to spot any regions or trends that need attention.",
              },
              {
                step: "2",
                title: "Review Opportunities",
                desc: "Look at the top pricing opportunities to see which hotels have the most RevPAR improvement potential.",
              },
              {
                step: "3",
                title: "Analyze High-Priority Hotels",
                desc: "Click through to the hotel detail page for properties with high uplift or high displacement risk.",
              },
              {
                step: "4",
                title: "Review Pricing Calendar",
                desc: "Check the upcoming 14 days on the pricing calendar. Focus on dates with significant gaps between current and suggested prices.",
              },
              {
                step: "5",
                title: "Accept or Override Suggestions",
                desc: "For each room type and date, accept the system suggestion or enter a manual override based on your market knowledge.",
              },
              {
                step: "6",
                title: "Monitor Competitor & Demand Signals",
                desc: "Use the Competitors and Web Traffic tabs to validate your decisions with market data.",
              },
            ].map((item) => (
              <li key={item.step} className="flex gap-4">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-bold">
                  {item.step}
                </div>
                <div>
                  <p className="font-medium">{item.title}</p>
                  <p className="text-sm text-muted-foreground">{item.desc}</p>
                </div>
              </li>
            ))}
          </ol>
        </CardContent>
      </Card>
    </div>
  );
}

function FeatureCard({
  icon: Icon,
  title,
  route,
  description,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  route: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Icon className="h-5 w-5" />
          </div>
          <div>
            <CardTitle className="text-base">{title}</CardTitle>
            <CardDescription>{description}</CardDescription>
          </div>
        </div>
        <code className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded w-fit">
          {route}
        </code>
      </CardHeader>
      <CardContent className="text-sm">{children}</CardContent>
    </Card>
  );
}

function ConceptCard({
  term,
  definition,
}: {
  term: string;
  definition: string;
}) {
  return (
    <div className="rounded-lg border p-4">
      <p className="font-medium text-sm">{term}</p>
      <p className="text-sm text-muted-foreground mt-1">{definition}</p>
    </div>
  );
}
