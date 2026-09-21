import { db, schema } from "@/lib/db";
import { Card } from "@/components/ui/card";
import { WarrantyProductCard } from "@/components/warranty-product-card";
import { WarrantyProductForm } from "@/components/warranty-product-form";
import { createWarrantyProduct } from "@/app/warranty/actions";

export default async function WarrantyPage() {
  const products = await db.select().from(schema.warrantyProducts);
  products.sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="mb-1 text-[19px] font-semibold tracking-[-.01em] text-[var(--color-text)]">Warranty & F&I products</h1>
      <p className="mb-5 text-[12.5px] text-[var(--color-text-muted)]">
        The product catalog behind the &ldquo;Warranty & F&I match&rdquo; tool on a deal — cost, price, coverage
        limits, and eligibility caps. A deal&apos;s own back-end numbers (Money & trade) are still entered by hand;
        this just tells you which product fits and what it&apos;s worth.
      </p>

      <Card className="mb-4">
        <div className="mb-2 text-[13.5px] font-semibold text-[var(--color-text)]">Add a product</div>
        <WarrantyProductForm action={createWarrantyProduct} />
      </Card>

      {products.length === 0 ? (
        <div className="rounded-[var(--radius-card)] bg-[var(--color-surface)] p-8 text-center">
          <div className="text-[15px] font-semibold text-[var(--color-text)]">No products yet</div>
          <p className="mt-1 text-[12.5px] text-[var(--color-text-muted)]">Add one above to start getting recommendations on deals.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {products.map((p) => (
            <WarrantyProductCard key={p.id} product={p} />
          ))}
        </div>
      )}
    </div>
  );
}
