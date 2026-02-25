"use client";

export function HeroButtons() {
  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <div className="mt-10 flex flex-col sm:flex-row gap-3 justify-center">
      <button
        onClick={() => scrollTo("butchers")}
        className="px-8 py-4 bg-[#DC2626] hover:bg-[#b91c1c] text-white text-base font-semibold rounded-2xl transition-all shadow-lg shadow-[#DC2626]/20 active:scale-[0.98]"
      >
        Voir les boucheries
      </button>
      <button
        onClick={() => scrollTo("how-it-works")}
        className="px-8 py-4 bg-gray-100 hover:bg-gray-200 text-gray-900 dark:bg-white/5 dark:hover:bg-white/10 dark:text-white text-base font-medium rounded-2xl transition-all border border-gray-200 dark:border-white/10"
      >
        Comment ca marche
      </button>
    </div>
  );
}
