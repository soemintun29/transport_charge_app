"use client";

import { memo, useEffect, useMemo } from "react";
import {
  MapContainer,
  Marker,
  Polyline,
  TileLayer,
  useMapEvents,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { CITY_MAP_VIEW } from "@/lib/map-cities";

function fixLeafletIcons() {
  const icon = L.Icon.Default.prototype as unknown as {
    _getIconUrl?: string;
  };
  delete icon._getIconUrl;
  L.Icon.Default.mergeOptions({
    iconUrl:
      "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
    iconRetinaUrl:
      "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
    shadowUrl:
      "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  });
}

function MapClickHandler({
  onMapClick,
}: {
  onMapClick: (lat: number, lng: number) => void;
}) {
  useMapEvents({
    click(e) {
      onMapClick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

type CustomerMapProps = {
  city: "yangon" | "mandalay";
  markerLat: number;
  markerLng: number;
  onMarkerChange: (lat: number, lng: number) => void;
  /** [lat, lng][] for driving route */
  routeLine?: [number, number][] | null;
};

function CustomerMapInner({
  city,
  markerLat,
  markerLng,
  onMarkerChange,
  routeLine,
}: CustomerMapProps) {
  const view = CITY_MAP_VIEW[city];

  useEffect(() => {
    fixLeafletIcons();
  }, []);

  const polyPositions = useMemo(() => {
    if (!routeLine?.length) return null;
    return routeLine.map(([lat, lng]) => [lat, lng] as L.LatLngTuple);
  }, [routeLine]);

  return (
    <div className="relative z-0 h-[min(52vh,420px)] w-full min-h-[240px] overflow-hidden rounded-xl border border-slate-200 shadow-inner">
      <MapContainer
        key={city}
        center={view.center}
        zoom={view.zoom}
        className="h-full w-full"
        scrollWheelZoom
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <MapClickHandler onMapClick={onMarkerChange} />
        <Marker
          position={[markerLat, markerLng]}
          draggable
          eventHandlers={{
            dragend: (e) => {
              const p = e.target.getLatLng();
              onMarkerChange(p.lat, p.lng);
            },
          }}
        />
        {polyPositions && polyPositions.length > 1 && (
          <Polyline
            positions={polyPositions}
            pathOptions={{ color: "#0098D1", weight: 5, opacity: 0.85 }}
          />
        )}
      </MapContainer>
    </div>
  );
}

const CustomerMap = memo(CustomerMapInner);
CustomerMap.displayName = "CustomerMap";

export default CustomerMap;
