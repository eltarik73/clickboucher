"use client";

import { useEffect } from "react";
import { MapContainer, TileLayer, Marker, Popup, Circle } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Fix default marker icon paths (Leaflet bug avec bundlers)
// On utilise des URLs CDN pour éviter d'avoir à gérer les assets locaux.
const DefaultIcon = L.icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

const UserIcon = L.divIcon({
  className: "user-pos-marker",
  html: `<div style="
    width: 20px;
    height: 20px;
    border-radius: 50%;
    background: #3B82F6;
    border: 3px solid white;
    box-shadow: 0 0 10px rgba(59, 130, 246, 0.6);
  "></div>`,
  iconSize: [20, 20],
  iconAnchor: [10, 10],
});

type ShopOnMap = {
  id: string;
  slug: string;
  name: string;
  city: string;
  address: string;
  latitude: number;
  longitude: number;
  rating: number | null;
  distance?: number;
};

type Props = {
  userPos: { lat: number; lng: number };
  shops: ShopOnMap[];
  maxDistanceKm: number;
};

export function MapView({ userPos, shops, maxDistanceKm }: Props) {
  useEffect(() => {
    // Force Leaflet to use our custom default icon
    L.Marker.prototype.options.icon = DefaultIcon;
  }, []);

  // Compute zoom based on radius (rough approximation)
  const zoom = maxDistanceKm <= 5 ? 13 : maxDistanceKm <= 10 ? 12 : maxDistanceKm <= 25 ? 11 : maxDistanceKm <= 50 ? 10 : maxDistanceKm <= 100 ? 9 : 8;

  return (
    <div className="rounded-2xl overflow-hidden border border-[#ece8e3] dark:border-white/[0.06] shadow-sm">
      <MapContainer
        center={[userPos.lat, userPos.lng]}
        zoom={zoom}
        style={{ height: "400px", width: "100%" }}
        scrollWheelZoom={false}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {/* Cercle du rayon de recherche */}
        <Circle
          center={[userPos.lat, userPos.lng]}
          radius={maxDistanceKm * 1000}
          pathOptions={{
            color: "#DC2626",
            fillColor: "#DC2626",
            fillOpacity: 0.05,
            weight: 1,
          }}
        />

        {/* Position utilisateur */}
        <Marker position={[userPos.lat, userPos.lng]} icon={UserIcon}>
          <Popup>
            <strong>Vous êtes ici</strong>
          </Popup>
        </Marker>

        {/* Marqueurs boucheries */}
        {shops.map((shop) => (
          <Marker key={shop.id} position={[shop.latitude, shop.longitude]}>
            <Popup>
              <div style={{ minWidth: 180 }}>
                <strong style={{ fontSize: 14 }}>{shop.name}</strong>
                <br />
                <span style={{ fontSize: 12, color: "#666" }}>{shop.address}</span>
                <br />
                <span style={{ fontSize: 12, color: "#666" }}>{shop.city}</span>
                {shop.distance != null && (
                  <>
                    <br />
                    <span style={{ fontSize: 11, color: "#DC2626", fontWeight: 600 }}>
                      🚗 {shop.distance.toFixed(1)} km
                    </span>
                  </>
                )}
                {shop.rating != null && (
                  <>
                    <br />
                    <span style={{ fontSize: 11 }}>⭐ {shop.rating.toFixed(1)}/5</span>
                  </>
                )}
                <br />
                <a
                  href={`/boutique/${shop.slug}`}
                  style={{
                    display: "inline-block",
                    marginTop: 6,
                    padding: "4px 10px",
                    background: "#DC2626",
                    color: "white",
                    borderRadius: 6,
                    fontSize: 11,
                    fontWeight: 600,
                    textDecoration: "none",
                  }}
                >
                  Commander →
                </a>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}
