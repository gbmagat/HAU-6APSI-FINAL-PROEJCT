"use client";

import "leaflet/dist/leaflet.css";

import L from "leaflet";
import { useEffect, useRef, useState } from "react";

import type { Place, VisitStatus } from "@/lib/domain";
import { framingPlaces, placesBounds } from "@/lib/places";

export type MapLocation = { lat: number; lng: number; recenter: boolean };

// OpenStreetMap's own tiles need no API key; CSS softens them so the status pins stay dominant.
// Light use with attribution fits the tile usage policy: https://operations.osmfoundation.org/policies/tiles/
const TILE_URL = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
const ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';
const MANILA: L.LatLngTuple = [14.5995, 120.9842];

const statusLabels: Record<VisitStatus, string> = { "want-to-visit": "Want to Visit", planned: "Planned", visited: "Visited" };

// Lucide icon paths (ISC) drawn in the pin head, so status never relies on color alone.
const statusIcons: Record<VisitStatus, string> = {
  "want-to-visit": '<path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z"/>',
  planned: '<rect width="18" height="18" x="3" y="4" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
  visited: '<path d="M20 6 9 17l-5-5"/>',
};
const favoriteStar = '<svg class="place-pin__favorite" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>';

// No place text goes into this HTML; names are set as attributes below, so nothing can inject markup.
function pinHtml(status: VisitStatus, favorite: boolean) {
  return `<span class="place-pin place-pin--${status}">`
    + '<svg class="place-pin__shape" viewBox="0 0 36 46" aria-hidden="true"><path d="M18 1C9.2 1 2 8 2 16.6 2 28 18 45 18 45s16-17 16-28.4C34 8 26.8 1 18 1z"/></svg>'
    + `<svg class="place-pin__icon" viewBox="0 0 24 24" aria-hidden="true">${statusIcons[status]}</svg>`
    + (favorite ? favoriteStar : "")
    + "</span>";
}

// A search result that is not saved yet: slate pin with a plus.
const draftPinHtml = '<span class="place-pin place-pin--draft">'
  + '<svg class="place-pin__shape" viewBox="0 0 36 46" aria-hidden="true"><path d="M18 1C9.2 1 2 8 2 16.6 2 28 18 45 18 45s16-17 16-28.4C34 8 26.8 1 18 1z"/></svg>'
  + '<svg class="place-pin__icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>'
  + "</span>";

export default function PlaceMap({
  places,
  selectedId,
  draft,
  routePath,
  userLocation,
  onSelect,
  onMapClick,
}: {
  places: Place[];
  selectedId?: string;
  draft?: { latitude: number; longitude: number } | null;
  routePath?: [number, number][] | null;
  userLocation: MapLocation | null;
  onSelect: (id: string) => void;
  onMapClick: (location: { lat: number; lng: number }) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<L.LayerGroup | null>(null);
  const markersByIdRef = useRef(new Map<string, L.Marker>());
  const userMarkerRef = useRef<L.CircleMarker | null>(null);
  const draftMarkerRef = useRef<L.Marker | null>(null);
  const routeRef = useRef<L.FeatureGroup | null>(null);
  const fitRef = useRef<() => void>(() => undefined);
  const userLocationRef = useRef<MapLocation | null>(userLocation);
  const handlersRef = useRef({ onSelect, onMapClick });
  const [tilesFailed, setTilesFailed] = useState(false);

  useEffect(() => {
    handlersRef.current = { onSelect, onMapClick };
    userLocationRef.current = userLocation;
  });

  // Create the map once; Leaflet owns this element from here on.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const animate = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const map = L.map(container, { zoomControl: false, zoomAnimation: animate, fadeAnimation: animate, markerZoomAnimation: animate })
      .setView(MANILA, 11);
    L.control.zoom({ position: "topright" }).addTo(map);
    L.tileLayer(TILE_URL, { attribution: ATTRIBUTION, maxZoom: 19 })
      .on("tileerror", () => setTilesFailed(true))
      .addTo(map);
    markersRef.current = L.layerGroup().addTo(map);
    map.on("click", (event) => handlersRef.current.onMapClick({ lat: event.latlng.lat, lng: event.latlng.lng }));

    // Hidden (list view on phones) and shown again means a new size: re-measure, then re-frame the places.
    let wasHidden = false;
    const resize = new ResizeObserver(([entry]) => {
      const hidden = entry.contentRect.width === 0 || entry.contentRect.height === 0;
      if (hidden) { wasHidden = true; return; }
      map.invalidateSize();
      if (wasHidden) { wasHidden = false; fitRef.current(); }
    });
    resize.observe(container);
    mapRef.current = map;
    return () => {
      resize.disconnect();
      map.remove();
      mapRef.current = null;
      markersRef.current = null;
      userMarkerRef.current = null;
      draftMarkerRef.current = null;
      routeRef.current = null;
    };
  }, []);

  // Rebuild pins only when what they show changes. Selection is applied to the existing pins below,
  // because replacing a pin would drop keyboard focus from the pin someone just activated.
  const markerKey = places.map((place) => [place.id, place.status, place.favorite, place.latitude, place.longitude, place.name].join(":")).join("|");
  useEffect(() => {
    const layer = markersRef.current;
    if (!layer) return;
    layer.clearLayers();
    markersByIdRef.current.clear();
    for (const place of places) {
      if (!Number.isFinite(place.latitude) || !Number.isFinite(place.longitude)) continue;
      const status: VisitStatus = place.status in statusIcons ? place.status : "want-to-visit";
      const marker = L.marker([place.latitude, place.longitude], {
        icon: L.divIcon({ className: "place-pin-host", html: pinHtml(status, place.favorite), iconSize: [36, 46], iconAnchor: [18, 45] }),
        keyboard: true,
        riseOnHover: true,
      });
      marker.on("click", () => handlersRef.current.onSelect(place.id));
      // Leaflet's own Enter handling only opens popups, so pins select on Enter and Space here.
      marker.on("keydown", (event) => {
        const key = (event as L.LeafletKeyboardEvent).originalEvent;
        if (key.key !== "Enter" && key.key !== " ") return;
        key.preventDefault();
        handlersRef.current.onSelect(place.id);
      });
      marker.addTo(layer);
      marker.getElement()?.setAttribute("aria-label", `${place.name}, ${statusLabels[status]}${place.favorite ? ", favorite" : ""}`);
      markersByIdRef.current.set(place.id, marker);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- markerKey captures everything the pins display
  }, [markerKey]);

  useEffect(() => {
    for (const [id, marker] of markersByIdRef.current) {
      const selected = id === selectedId;
      const element = marker.getElement();
      element?.querySelector(".place-pin")?.classList.toggle("is-selected", selected);
      element?.setAttribute("aria-pressed", String(selected));
      marker.setZIndexOffset(selected ? 1000 : 0);
    }
  }, [selectedId, markerKey]);

  // Frame all visible places when the set of places changes (search or filter), not on every selection.
  const placeKey = places.map((place) => place.id).join("|");
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    fitRef.current = () => {
      const bounds = placesBounds(framingPlaces(places));
      if (bounds) map.fitBounds(bounds, { padding: [40, 40], maxZoom: 15, animate: false });
      else map.setView(MANILA, 11, { animate: false });
    };
    fitRef.current();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- re-frame only when which places are shown changes
  }, [placeKey]);

  // Bring a place picked from the list into view if it is off-screen.
  useEffect(() => {
    const map = mapRef.current;
    const place = places.find((item) => item.id === selectedId);
    if (!map || !place) return;
    const point = L.latLng(place.latitude, place.longitude);
    if (!map.getBounds().pad(-0.1).contains(point)) map.panTo(point);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- react to the selection, not to re-filtering
  }, [selectedId]);

  // Show the search result being considered, and take the map there.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    draftMarkerRef.current?.remove();
    draftMarkerRef.current = null;
    if (!draft) return;
    draftMarkerRef.current = L.marker([draft.latitude, draft.longitude], {
      icon: L.divIcon({ className: "place-pin-host", html: draftPinHtml, iconSize: [36, 46], iconAnchor: [18, 45] }),
      interactive: false,
      keyboard: false,
      zIndexOffset: 2000,
    }).addTo(map);
    const here = userLocationRef.current;
    if (here) map.fitBounds([[here.lat, here.lng], [draft.latitude, draft.longitude]], { padding: [60, 60], maxZoom: 16, animate: false });
    else map.setView([draft.latitude, draft.longitude], Math.max(map.getZoom(), 15), { animate: false });
  }, [draft]);

  // The shortest road route along the streets, drawn over a light casing so it reads on any road colour.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    routeRef.current?.remove();
    routeRef.current = null;
    if (!routePath?.length) return;
    routeRef.current = L.featureGroup([
      L.polyline(routePath, { color: "#ffffff", weight: 9, opacity: 0.9, interactive: false }),
      L.polyline(routePath, { color: "#315641", weight: 5, opacity: 0.95, interactive: false }),
    ]).addTo(map);
    map.fitBounds(routeRef.current.getBounds(), { padding: [48, 48], maxZoom: 17, animate: false });
  }, [routePath]);

  // Your location: a navy dot with a ring and a text label, never a place pin.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    userMarkerRef.current?.remove();
    userMarkerRef.current = null;
    if (!userLocation) return;
    userMarkerRef.current = L.circleMarker([userLocation.lat, userLocation.lng], {
      radius: 8, color: "#ffffff", weight: 3, fillColor: "#1e3054", fillOpacity: 1, interactive: false,
    }).bindTooltip("Your location", { permanent: true, direction: "top", offset: [0, -10], className: "place-map__you" }).addTo(map);
    if (userLocation.recenter) map.setView([userLocation.lat, userLocation.lng], Math.max(map.getZoom(), 14));
  }, [userLocation]);

  return (
    <div className="place-map">
      <div ref={containerRef} className="place-map__canvas" aria-label="Map of our places. The list beside it offers the same places for keyboard and screen reader use." />
      {tilesFailed && <p className="place-map__notice" role="status">The map couldn’t load. The list still has every place.</p>}
    </div>
  );
}
