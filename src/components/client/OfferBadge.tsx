export function OfferBadge({
  type,
  discountValue,
}: {
  type: string;
  discountValue: number;
}) {
  let label = "";

  switch (type) {
    case "FREE_DELIVERY":
      label = "🚀 FRAIS OFFERTS";
      break;
    case "PERCENT":
      label = `💰 -${discountValue}%`;
      break;
    case "BOGO":
      label = "🎁 1+1 OFFERT";
      break;
    case "AMOUNT":
      label = `🏷️ -${discountValue}€`;
      break;
    case "BUNDLE":
      label = `📦 PACK -${discountValue}€`;
      break;
    default:
      label = `💰 -${discountValue}%`;
  }

  return (
    <span className="absolute top-2 left-2 bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-sm z-10">
      {label}
    </span>
  );
}
