import { asc, desc } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MarketingWorkspace } from "@/components/marketing-workspace";
import { sourcePerformance } from "@/lib/lead-source-stats";

export const dynamic = "force-dynamic";

export default async function MarketingPage() {
  const [vehicles, posts, leads, photoRows] = await Promise.all([
    db.select().from(schema.vehicles).orderBy(desc(schema.vehicles.createdAt)),
    db.select().from(schema.marketingPosts),
    db.select({ source: schema.leads.source, status: schema.leads.status }).from(schema.leads),
    db.select().from(schema.vehiclePhotos).orderBy(asc(schema.vehiclePhotos.sortOrder)),
  ]);

  const stats = sourcePerformance(leads);
  const totalLeads = leads.length;

  // First photo per vehicle (by sortOrder) is the cover — same "first in
  // the gallery" photo the Inventory grid and vehicle detail page use.
  const coverUrlByVehicle = new Map<string, string>();
  for (const p of photoRows) {
    if (coverUrlByVehicle.has(p.vehicleId)) continue;
    coverUrlByVehicle.set(p.vehicleId, p.editedStoragePath ? `/api/vehicle-photos/${p.id}/file?v=edited` : `/api/vehicle-photos/${p.id}/file`);
  }

  return (
    <div>
      <div className="mb-5">
        <h1 className="text-[19px] font-semibold tracking-[-.01em] text-[var(--color-text)]">Marketing</h1>
        <p className="mt-1 text-[12.5px] text-[var(--color-text-muted)]">
          Every vehicle in inventory gets an AI-written listing here as soon as it&apos;s added — nothing to do to
          make it show up.
        </p>
      </div>

      <Tabs defaultValue="listings">
        <TabsList>
          <TabsTrigger value="listings">Listings</TabsTrigger>
          <TabsTrigger value="channels">Channel performance</TabsTrigger>
        </TabsList>

        <TabsContent value="listings">
          <MarketingWorkspace
            vehicles={vehicles.map((v) => ({
              id: v.id,
              year: v.year,
              make: v.make,
              model: v.model,
              trim: v.trim,
              color: v.color,
              stockNumber: v.stockNumber,
              askingPrice: v.askingPrice,
              miles: v.miles,
              title: v.title,
              bodyType: v.bodyType,
              fuelType: v.fuelType,
              isThreeRowSuv: v.isThreeRowSuv,
              sold: v.sold,
              marketingStatus: v.marketingStatus,
              acquiredOn: v.acquiredOn,
              coverUrl: coverUrlByVehicle.get(v.id) ?? null,
            }))}
            posts={posts.map((p) => ({
              vehicleId: p.vehicleId,
              platform: p.platform,
              language: p.language,
              body: p.body,
              postedAt: p.postedAt ? p.postedAt.toISOString() : null,
              postedVia: p.postedVia,
              externalListingUrl: p.externalListingUrl,
              queuedForAutoPost: p.queuedForAutoPost,
              autoPostError: p.autoPostError,
            }))}
          />
        </TabsContent>

        <TabsContent value="channels">
          <Card>
            <div className="mb-3 text-[13.5px] font-semibold text-[var(--color-text)]">Channel performance</div>
            {totalLeads === 0 ? (
              <p className="text-[12.5px] text-[var(--color-text-muted)]">
                No leads yet — once you add some (with a source), this fills in.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[520px] border-collapse text-[12.5px]">
                  <thead>
                    <tr className="border-b border-[var(--color-header-rule)] text-left text-[10.5px] font-semibold uppercase tracking-[.05em] text-[var(--color-text-placeholder)]">
                      <th className="px-2 py-2">Channel</th>
                      <th className="px-2 py-2">Leads</th>
                      <th className="px-2 py-2">Sold</th>
                      <th className="px-2 py-2">Lost</th>
                      <th className="px-2 py-2">Conversion</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.map((s) => (
                      <tr key={s.source} className="border-b border-[var(--color-hairline)]">
                        <td className="px-2 py-2 font-medium text-[var(--color-text)]">{s.source}</td>
                        <td className="px-2 py-2 tabular-nums text-[var(--color-text-muted)]">{s.total}</td>
                        <td className="px-2 py-2 tabular-nums text-[var(--color-text-muted)]">{s.sold}</td>
                        <td className="px-2 py-2 tabular-nums text-[var(--color-text-muted)]">{s.lost}</td>
                        <td className="px-2 py-2">
                          <Badge tone={s.conversionPct >= 20 ? "positive" : "neutral"}>{s.conversionPct}%</Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
