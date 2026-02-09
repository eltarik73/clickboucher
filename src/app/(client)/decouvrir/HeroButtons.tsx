"use client";

export function HeroButtons() {
  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <div className="mt-10 flex flex-col sm:flex-row gap-3 justify-center">
      <button
        onClick={() => scrollTo("butchers")}
        className="px-8 py-4 bg-[#DC2626] hover:bg-[#B91C1C] text-white text-base font-semibold rounded-2xl transition-all shadow-lg shadow-red-500/20 active:scale-[0.98]"
      >
        Voir les boucheries
      </button>
      <button
        onClick={() => scrollTo("how-it-works")}
        className="px-8 py-4 bg-white/5 hover:bg-white/10 text-white text-base font-medium rounded-2xl transition-all border border-white/10"
      >
        Comment ca marche
      </button>
    </div>
  );
}
