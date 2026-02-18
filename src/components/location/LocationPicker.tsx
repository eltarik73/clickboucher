// src/components/location/LocationPicker.tsx — Location banner with GPS + manual input
"use client";

import { useState, useEffect } from "react";
import { MapPin, Navigation, Loader2, X, ChevronDown } from "lucide-react";
import { useGeolocation } from "@/hooks/useGeolocation";

type Props = {
  onLocationChange?: (lat: number | null, lng: number | null, city: string | null) => void;
};

export default function LocationPicker({ onLocationChange }: Props) {
  const geo = useGeolocation();
  const [manualInput, setManualInput] = useState("");
  const [showInput, setShowInput] = useState(false);

  const handleGPS = async () => {
    await geo.requestGPS();
    // After GPS resolves, parent will get updated via effect
  };

  const handleManualSubmit = async () => {
    if (!manualInput.trim()) return;
    await geo.setManualCity(manualInput.trim());
    setShowInput(false);
    setManualInput("");
  };

  // Notify parent when location changes
  const { latitude, longitude, city } = geo;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    onLocationChange?.(latitude, longitude, city);
  }, [latitude, longitude, city]);

  // Already have location → compact display
  if (city) {
    return (
      <div className="flex items-center gap-2 px-4 py-2.5 bg-white dark:bg-[#141414] border border-gray-200 dark:border-white/10 rounded-xl">
        <MapPin className="w-4 h-4 text-red-600 flex-shrink-0" />
        <span className="text-sm font-medium text-gray-900 dark:text-white truncate">{city}</span>
        <button
          onClick={() => { geo.clear(); onLocationChange?.(null, null, null); }}
          className="ml-auto text-xs text-gray-400 hover:text-red-600 transition flex items-center gap-1"
        >
          Modifier <ChevronDown className="w-3 h-3" />
        </button>
      </div>
    );
  }

  // No location → prompt banner
  return (
    <div className="bg-white dark:bg-[#141414] border border-gray-200 dark:border-white/10 rounded-xl p-4 space-y-3">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 bg-red-50 dark:bg-red-950/30 rounded-xl flex items-center justify-center flex-shrink-0">
          <MapPin className="w-5 h-5 text-red-600" />
        </div>
        <div className="flex-1">
          <p className="text-sm font-semibold text-gray-900 dark:text-white">
            Où êtes-vous ?
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            Activez la localisation pour voir les boucheries proches
          </p>
        </div>
      </div>

      <div className="flex gap-2">
        <button
          onClick={handleGPS}
          disabled={geo.loading}
          className="flex-1 flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 text-white text-sm font-medium py-2.5 rounded-xl transition disabled:opacity-50"
        >
          {geo.loading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Navigation className="w-4 h-4" />
          )}
          {geo.loading ? "Localisation..." : "Activer GPS"}
        </button>

        <button
          onClick={() => setShowInput(!showInput)}
          className="px-4 py-2.5 border border-gray-200 dark:border-white/10 text-sm font-medium text-gray-700 dark:text-gray-300 rounded-xl hover:bg-gray-50 dark:hover:bg-white/5 transition"
        >
          Saisir ma ville
        </button>
      </div>

      {geo.error && (
        <p className="text-xs text-red-500 flex items-center gap-1">
          <X className="w-3 h-3" /> {geo.error}
        </p>
      )}

      {showInput && (
        <div className="flex gap-2">
          <input
            type="text"
            value={manualInput}
            onChange={(e) => setManualInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleManualSubmit()}
            placeholder="Ex: Chambéry, Lyon, Paris..."
            className="flex-1 px-3 py-2 text-sm border border-gray-200 dark:border-white/10 rounded-xl bg-gray-50 dark:bg-white/5 text-gray-900 dark:text-white placeholder-gray-400 outline-none focus:ring-2 focus:ring-red-500"
            autoFocus
          />
          <button
            onClick={handleManualSubmit}
            disabled={!manualInput.trim() || geo.loading}
            className="px-4 py-2 bg-gray-900 dark:bg-white dark:text-gray-900 text-white text-sm font-medium rounded-xl hover:opacity-90 transition disabled:opacity-50"
          >
            OK
          </button>
        </div>
      )}
    </div>
  );
}
