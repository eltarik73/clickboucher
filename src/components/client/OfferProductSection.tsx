import { Gift } from "lucide-react";
import Image from "next/image";

type OfferProduct = {
  id: string;
  name: string;
  imageUrl: string | null;
  priceCents: number;
  unit: string;
  offerName: string;
  offerType: string;
  discountValue: number;
  offerCode: string;
};

function getOfferLabel(type: string, discountValue: number): string {
  switch (type) {
    case "FREE_DELIVERY":
      return "Frais offerts";
    case "PERCENT":
      return `-${discountValue}%`;
    case "BOGO":
      return "1+1 Offert";
    case "AMOUNT":
      return `-${discountValue}€`;
    case "BUNDLE":
      return `Pack -${discountValue}€`;
    default:
      return `-${discountValue}%`;
  }
}

function formatPrice(cents: number, unit: string): string {
  const euros = (cents / 100).toFixed(2).replace(".", ",");
  const unitLabel =
    unit === "KG" ? "/kg" : unit === "PIECE" ? "/pce" : `/${unit.toLowerCase()}`;
  return `${euros}€${unitLabel}`;
}

export function OfferProductSection({
  products,
}: {
  products: OfferProduct[];
}) {
  if (products.length === 0) return null;

  return (
    <section className="mb-6">
      {/* Header */}
      <div className="flex items-center gap-2 mb-3">
        <Gift className="w-5 h-5 text-red-600" />
        <h2 className="text-lg font-bold text-gray-900 dark:text-white">
          Offres en cours
        </h2>
        <span className="bg-red-100 dark:bg-red-500/20 text-red-600 text-xs font-bold px-2 py-0.5 rounded-full">
          {products.length}
        </span>
      </div>

      {/* Horizontal scroll */}
      <div className="flex overflow-x-auto gap-3 pb-2 scrollbar-hide [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {products.map((product) => (
          <div
            key={product.id}
            className="w-40 flex-shrink-0 bg-white dark:bg-[#141414] rounded-xl border border-gray-200 dark:border-white/10 overflow-hidden"
          >
            {/* Image */}
            {product.imageUrl ? (
              <div className="relative h-28 w-full">
                <Image
                  src={product.imageUrl}
                  alt={product.name}
                  fill
                  className="object-cover"
                  sizes="160px"
                />
              </div>
            ) : (
              <div className="h-28 w-full bg-gray-100 dark:bg-white/5 flex items-center justify-center">
                <Gift className="w-8 h-8 text-gray-300 dark:text-gray-600" />
              </div>
            )}

            {/* Content */}
            <div className="p-2.5">
              <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                {product.name}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                {formatPrice(product.priceCents, product.unit)}
              </p>
              <span className="inline-block mt-1.5 text-[10px] bg-red-50 dark:bg-red-500/10 text-red-600 rounded-full px-2 py-0.5 font-medium">
                {getOfferLabel(product.offerType, product.discountValue)}
              </span>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
