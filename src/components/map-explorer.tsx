"use client";

import { Check, ChevronDown, ChevronUp, LocateFixed, MapPin, Rows3 } from "lucide-react";
import dynamic from "next/dynamic";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";

import type { MapLocation } from "@/components/place-map";
import { PlaceBadges } from "@/components/status-badge";
import type { Place, VisitStatus } from "@/lib/domain";
import { matchesPlaceQuery } from "@/lib/places";

type FilterValue = "all" | VisitStatus;

const filterOptions: { label: string; value: FilterValue }[] = [
  { label: "All", value: "all" },
  { label: "Visited", value: "visited" },
  { label: "Planned", value: "planned" },
  { label: "Want", value: "want-to-visit" },
];

// Leaflet needs the browser, so the map loads after the page renders.
const PlaceMap = dynamic(() => import("@/components/place-map"), {
  ssr: false,
  loading: () => <div className="place-map place-map--loading" role="status">Loading map…</div>,
});

export function MapExplorer({ places, locationEnabled }: { places: Place[]; locationEnabled: boolean }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<FilterValue>("all");
  const [selectedId, setSelectedId] = useState("");
  const [listView, setListView] = useState(false);
  const [sheetCollapsed, setSheetCollapsed] = useState(false);
  const [locationMessage, setLocationMessage] = useState("");
  const [userLocation, setUserLocation] = useState<MapLocation | null>(null);
  const [pinMode, setPinMode] = useState(false);

  const filteredPlaces = places.filter((place) =>
    matchesPlaceQuery(place, query) && (filter === "all" || place.status === filter));

  const selectedPlace =
    filteredPlaces.find((place) => place.id === selectedId) ?? filteredPlaces[0];

  function locateUser() {
    if (!locationEnabled) {
      setLocationMessage("Location is off in Profile. Turn it on there to use Near me.");
      return;
    }
    if (!("geolocation" in navigator)) {
      setLocationMessage("Location is unavailable. Search or move through the list instead.");
      return;
    }
    setLocationMessage("Finding your approximate location…");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setUserLocation({ lat: position.coords.latitude, lng: position.coords.longitude, recenter: true });
        setLocationMessage("Showing your approximate location. It is not saved or shared.");
      },
      () => setLocationMessage("Location is off. Search and the manual list still work."),
      { enableHighAccuracy: false, timeout: 6000 },
    );
  }

  function selectPlace(id: string) {
    setSelectedId(id);
    setSheetCollapsed(false);
  }

  // Only a deliberate "Pin your location" turns the next map click into a pin.
  function handleMapClick(location: { lat: number; lng: number }) {
    if (!pinMode) return;
    setPinMode(false);
    setUserLocation({ ...location, recenter: false });
    setLocationMessage("Location pinned on the map. It is not saved or shared.");
  }

  return (
    <section className="map-explorer" aria-label="Explore saved places">
      <div className="map-toolbar">
        <label className="search-field">
          <Image src="/assets/search.svg" alt="" width={20} height={20} aria-hidden="true" />
          <span className="sr-only">Search by place, city, or category</span>
          <input
            type="search"
            value={query}
            placeholder="Search places or cities"
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
        <button type="button" className="button button--secondary map-near-me" onClick={locateUser}>
          <LocateFixed size={18} aria-hidden="true" />
          Near me
        </button>
      </div>

      <div className="filter-row" aria-label="Place filters">
        {filterOptions.map((option) => (
          <button
            key={option.value}
            type="button"
            className={filter === option.value ? "filter-chip is-selected" : "filter-chip"}
            aria-pressed={filter === option.value}
            onClick={() => setFilter(option.value)}
          >
            {option.label}
          </button>
        ))}
        <button
          type="button"
          className={listView ? "filter-chip map-view-toggle is-selected" : "filter-chip map-view-toggle"}
          aria-pressed={listView}
          onClick={() => setListView((current) => !current)}
        >
          <Rows3 size={17} aria-hidden="true" />
          {listView ? "Map view" : "List view"}
        </button>
      </div>

      {locationMessage && <p className="map-location-message" role="status">{locationMessage}</p>}

      <div className={listView ? "map-panel is-list-view" : "map-panel"}>
        <div className={pinMode ? "map-canvas is-pinning" : "map-canvas"}>
          <PlaceMap
            places={filteredPlaces}
            selectedId={selectedPlace?.id}
            userLocation={userLocation}
            onSelect={selectPlace}
            onMapClick={handleMapClick}
          />

          <button type="button" className="map-locate-control" onClick={locateUser} aria-label="Locate me">
            <LocateFixed size={22} aria-hidden="true" />
          </button>
        </div>

        <aside className={sheetCollapsed ? "map-results is-collapsed" : "map-results"} aria-label="Place results">
          <button
            type="button"
            className="map-sheet-toggle"
            onClick={() => setSheetCollapsed((current) => !current)}
            aria-expanded={!sheetCollapsed}
          >
            {sheetCollapsed ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
            {sheetCollapsed ? "Show selected place" : "Collapse"}
          </button>

          {!sheetCollapsed && selectedPlace && (
            <article className="map-preview">
              <div className="map-preview__identity">
                <span className="place-thumbnail" aria-hidden="true">{selectedPlace.initials}</span>
                <div>
                  <h2>{selectedPlace.name}</h2>
                  <p>{selectedPlace.city} · {selectedPlace.category}</p>
                </div>
              </div>
              <PlaceBadges place={selectedPlace} />
              <p>{selectedPlace.shortDescription}</p>
              <div className="map-preview__actions">
                <Link href={`/places/${selectedPlace.slug}`} className="button button--primary">
                  View place
                </Link>
                <Link href={`/visits/new?place=${selectedPlace.slug}`} className="button button--secondary">
                  Log visit
                </Link>
              </div>
              <button type="button" className="text-button map-pin-action" aria-pressed={pinMode} onClick={() => { setPinMode((current) => !current); setLocationMessage(pinMode ? "" : "Click the map where you are to pin your location."); }}>{pinMode ? "Cancel pinning" : "Pin your location"}</button>
            </article>
          )}

          <ul className="map-result-list" aria-label={`${filteredPlaces.length} matching places`}>
            {filteredPlaces.map((place) => (
              <li key={place.id}>
                <button
                  type="button"
                  className={place.id === selectedPlace?.id ? "is-selected" : ""}
                  onClick={() => selectPlace(place.id)}
                >
                  <span>{place.name}</span>
                  <small>{place.city} · {place.category}</small>
                  {place.id === selectedPlace?.id && <Check size={17} aria-hidden="true" />}
                </button>
              </li>
            ))}
          </ul>

          {!filteredPlaces.length && (
            <div className="empty-state">
              <MapPin size={28} aria-hidden="true" />
              <h2>No places match</h2>
              <p>Try another name, city, or visit status.</p>
            </div>
          )}
        </aside>
      </div>
    </section>
  );
}
