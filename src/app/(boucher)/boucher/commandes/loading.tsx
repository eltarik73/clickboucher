export default function BoucherCommandesLoading() {
  return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
      <div className="text-center">
        <div className="w-10 h-10 border-[3px] border-[#DC2626] border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-sm text-gray-400 mt-4">Chargement du mode cuisine...</p>
      </div>
    </div>
  );
}
