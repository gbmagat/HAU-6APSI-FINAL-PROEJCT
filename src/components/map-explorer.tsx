"use client";

import { Check, ChevronDown, ChevronUp, LocateFixed, MapPin, Rows3 } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";

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

const markerPositions = [
  { left: "24%", top: "24%" },
  { left: "60%", top: "30%" },
  { left: "72%", top: "62%" },
  { left: "39%", top: "66%" },
  { left: "47%", top: "44%" },
  { left: "82%", top: "42%" },
  { left: "18%", top: "54%" },
] as const;

export function MapExplorer({ places, locationEnabled }: { places: Place[]; locationEnabled: boolean }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<FilterValue>("all");
  const [selectedId, setSelectedId] = useState("");
  const [listView, setListView] = useState(false);
  const [sheetCollapsed, setSheetCollapsed] = useState(false);
  const [locationMessage, setLocationMessage] = useState("");
  const [userPin, setUserPin] = useState<{ left: string; top: string } | null>(null);

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
      () => setLocationMessage("Approximate location found. Use the markers or search to choose a place."),
      () => setLocationMessage("Location is off. Search and the manual list still work."),
      { enableHighAccuracy: false, timeout: 6000 },
    );
  }

  function selectPlace(id: string) {
    setSelectedId(id);
    setSheetCollapsed(false);
  }

  function pinLocation(event: React.MouseEvent<HTMLDivElement>) {
    if ((event.target as HTMLElement).closest("button")) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    const left = `${Math.round(((event.clientX - bounds.left) / bounds.width) * 100)}%`;
    const top = `${Math.round(((event.clientY - bounds.top) / bounds.height) * 100)}%`;
    setUserPin({ left, top });
    setLocationMessage("Location pinned on this map preview. It is not shared or saved yet.");
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
        <div className="map-canvas" aria-label="Place map preview. Click an open area to pin your location." onClick={pinLocation}>
          <div className="map-grid" aria-hidden="true" />
          <Image className="map-route" src="/assets/map-route.svg" alt="" width={420} height={260} aria-hidden="true" />
          <span className="map-label map-label--one">Manila</span>
          <span className="map-label map-label--two">Makati</span>
          <span className="map-label map-label--three">Taguig</span>

          {filteredPlaces.map((place) => {
            const originalIndex = places.findIndex((item) => item.id === place.id);
            const position = markerPositions[originalIndex % markerPositions.length];
            const selected = place.id === selectedPlace?.id;
            return (
              <button
                key={place.id}
                type="button"
                className={`map-marker map-marker--${place.status}${selected ? " is-selected" : ""}`}
                style={position}
                aria-label={`${place.name}, ${place.status.replaceAll("-", " ")}`}
                aria-pressed={selected}
                onClick={() => selectPlace(place.id)}
              >
                <MapPin size={42} fill="currentColor" aria-hidden="true" />
                <span>{place.initials.slice(0, 1)}</span>
              </button>
            );
          })}

          {userPin && <span className="map-user-pin" style={userPin} aria-label="Your pinned location">You</span>}

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
              <button type="button" className="text-button map-pin-action" onClick={() => setLocationMessage("Click an open spot on the map to pin your location.")}>Pin your location</button>
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
