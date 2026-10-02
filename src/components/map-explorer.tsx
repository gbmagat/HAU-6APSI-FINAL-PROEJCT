"use client";

import { Check, ChevronDown, ChevronUp, LocateFixed, MapPin, Plus, Rows3, Search } from "lucide-react";
import dynamic from "next/dynamic";
import Image from "next/image";
import Link from "next/link";
import { type FormEvent, useState } from "react";

import { usePassport } from "@/components/passport-provider";
import type { MapLocation } from "@/components/place-map";
import { PlaceBadges } from "@/components/status-badge";
import { placeCategories, type Place, type PlaceCategory, type VisitStatus } from "@/lib/domain";
import { placeInitials } from "@/lib/place-input";
import { formatDistance, sortByDistance } from "@/lib/geo";
import type { PlaceSearchResult } from "@/lib/place-search";
import { matchesPlaceQuery, placeLocation } from "@/lib/places";

type FilterValue = "all" | VisitStatus;

type SearchState =
  | { status: "idle" }
  | { status: "loading"; query: string }
  | { status: "done"; query: string; results: PlaceSearchResult[] }
  | { status: "error"; query: string; message: string };

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
  const passport = usePassport();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<FilterValue>("all");
  const [selectedId, setSelectedId] = useState("");
  const [listView, setListView] = useState(false);
  const [sheetCollapsed, setSheetCollapsed] = useState(false);
  const [locationMessage, setLocationMessage] = useState("");
  const [userLocation, setUserLocation] = useState<MapLocation | null>(null);
  const [pinMode, setPinMode] = useState(false);
  const [search, setSearch] = useState<SearchState>({ status: "idle" });
  const [draft, setDraft] = useState<PlaceSearchResult | null>(null);
  const [draftCategory, setDraftCategory] = useState<PlaceCategory>("District");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  const origin = userLocation ? { latitude: userLocation.lat, longitude: userLocation.lng } : null;
  const filteredPlaces = sortByDistance(places.filter((place) =>
    matchesPlaceQuery(place, query) && (filter === "all" || place.status === filter)), origin);
  const searchResults = search.status === "done" ? sortByDistance(search.results, origin) : [];
  const draftDistance = draft && origin ? sortByDistance([draft], origin)[0].distanceKm : undefined;
  const selectedPlace = draft ? undefined : filteredPlaces.find((place) => place.id === selectedId) ?? filteredPlaces[0];
  const trimmedQuery = query.trim();

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
      () => setLocationMessage("Your browser blocked location. Search and the list still work."),
      { enableHighAccuracy: false, timeout: 6000 },
    );
  }

  function selectPlace(id: string) {
    setDraft(null);
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

  function changeQuery(value: string) {
    setQuery(value);
    setSearch({ status: "idle" });
    setDraft(null);
  }

  // Typing filters our saved places; Enter or Search looks the place up on OpenStreetMap.
  async function searchMap(event?: FormEvent) {
    event?.preventDefault();
    if (trimmedQuery.length < 2 || search.status === "loading") return;
    setSearch({ status: "loading", query: trimmedQuery });
    setDraft(null);
    setSheetCollapsed(false);
    try {
      const near = origin ? `&lat=${origin.latitude.toFixed(4)}&lng=${origin.longitude.toFixed(4)}` : "";
      const response = await fetch(`/api/places/search?q=${encodeURIComponent(trimmedQuery)}${near}`, { credentials: "same-origin" });
      const data = await response.json().catch(() => null) as { results?: PlaceSearchResult[]; error?: string } | null;
      if (!response.ok) throw new Error(data?.error || "Place search is unavailable right now.");
      const results = data?.results ?? [];
      setSearch({ status: "done", query: trimmedQuery, results });
      // With a pinned location, go straight to the nearest match.
      const nearest = origin ? sortByDistance(results, origin)[0] : undefined;
      if (nearest) pickResult(nearest);
    } catch (error) {
      setSearch({ status: "error", query: trimmedQuery, message: error instanceof Error ? error.message : "Place search is unavailable right now." });
    }
  }

  function pickResult(result: PlaceSearchResult) {
    setDraft(result);
    setDraftCategory(result.category);
    setSaveError("");
    setSheetCollapsed(false);
  }

  async function saveDraft() {
    if (!draft || saving) return;
    setSaving(true);
    setSaveError("");
    try {
      const saved = await passport.addPlace({
        name: draft.name,
        category: draftCategory,
        address: draft.address,
        city: draft.city,
        country: draft.country,
        latitude: draft.latitude,
        longitude: draft.longitude,
      });
      setLocationMessage(`${draft.name} is saved to our places.`);
      setDraft(null);
      setSearch({ status: "idle" });
      setQuery("");
      setFilter("all");
      setSelectedId(saved.id);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "This place could not be saved.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="map-explorer" aria-label="Explore saved places">
      <div className="map-toolbar">
        <form className="search-field" role="search" onSubmit={(event) => void searchMap(event)}>
          <Image src="/assets/search.svg" alt="" width={20} height={20} aria-hidden="true" />
          <label className="sr-only" htmlFor="map-search">Search our places, or press Enter to find a new place</label>
          <input
            id="map-search"
            type="search"
            value={query}
            placeholder="Search places or cities"
            enterKeyHint="search"
            onChange={(event) => changeQuery(event.target.value)}
          />
          <button type="submit" className="search-field__submit" disabled={trimmedQuery.length < 2 || search.status === "loading"}>
            {search.status === "loading" ? "Searching…" : "Search"}
          </button>
        </form>
        <div className="filter-row" role="group" aria-label="Place filters">
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
        <button type="button" className="button button--secondary map-near-me" onClick={locateUser}>
          <LocateFixed size={18} aria-hidden="true" />
          Near me
        </button>
      </div>

      {locationMessage && <p className="map-location-message" role="status">{locationMessage}</p>}

      <div className={listView ? "map-panel is-list-view" : "map-panel"}>
        <div className={pinMode ? "map-canvas is-pinning" : "map-canvas"}>
          <PlaceMap
            places={filteredPlaces}
            selectedId={selectedPlace?.id}
            draft={draft}
            target={draft ?? selectedPlace ?? null}
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

          {!sheetCollapsed && draft && (
            <article className="map-preview" aria-labelledby="draft-place-title">
              <div className="map-preview__identity">
                <span className="place-thumbnail" aria-hidden="true">{placeInitials(draft.name)}</span>
                <div>
                  <h2 id="draft-place-title">{draft.name}</h2>
                  <p>{placeLocation(draft)}{draftDistance !== undefined && ` · ${formatDistance(draftDistance)} from you`}</p>
                </div>
              </div>
              <span className="status-badge status-badge--draft"><MapPin size={14} aria-hidden="true" />Not saved</span>
              <p className="map-preview__address">{draft.address}</p>
              <label className="field">
                <span>Category</span>
                <select value={draftCategory} onChange={(event) => setDraftCategory(event.target.value as PlaceCategory)}>
                  {placeCategories.map((category) => <option key={category} value={category}>{category}</option>)}
                </select>
              </label>
              <div className="map-preview__actions">
                <button type="button" className="button button--primary" onClick={() => void saveDraft()} disabled={saving}>
                  <Plus size={17} aria-hidden="true" /> {saving ? "Saving…" : "Save to our places"}
                </button>
                <button type="button" className="button button--secondary" onClick={() => setDraft(null)} disabled={saving}>Cancel</button>
              </div>
              {saveError && <p className="field-error" role="alert">{saveError}</p>}
            </article>
          )}

          {!sheetCollapsed && selectedPlace && (
            <article className="map-preview">
              <div className="map-preview__identity">
                <span className="place-thumbnail" aria-hidden="true">{selectedPlace.initials}</span>
                <div>
                  <h2>{selectedPlace.name}</h2>
                  <p>{placeLocation(selectedPlace)} · {selectedPlace.category}</p>
                </div>
              </div>
              <PlaceBadges place={selectedPlace} />
              {selectedPlace.shortDescription && <p>{selectedPlace.shortDescription}</p>}
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

          {search.status !== "idle" && (
            <section className="map-search-results" aria-labelledby="map-search-title" aria-live="polite">
              <h2 id="map-search-title">Found on the map</h2>
              {search.status === "loading" && <p className="field-hint">Searching for “{search.query}”…</p>}
              {search.status === "error" && <p className="field-error">{search.message}</p>}
              {search.status === "done" && !search.results.length && (
                <p className="field-hint">Nothing found for “{search.query}”. Try adding the city or country.</p>
              )}
              {search.status === "done" && search.results.length > 0 && (
                <ul className="map-search-results__list">
                  {searchResults.map((result, index) => (
                    <li key={result.id}>
                      <button type="button" className={draft?.id === result.id ? "is-selected" : ""} aria-pressed={draft?.id === result.id} onClick={() => pickResult(result)}>
                        <span>{result.name}{origin && index === 0 && <em className="nearest-tag">Nearest</em>}</span>
                        <small>{placeLocation(result)} · {result.category}{result.distanceKm !== undefined && ` · ${formatDistance(result.distanceKm)}`}</small>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <p className="map-search-results__credit">{origin ? "Nearest to your pin first · " : "Pin your location to sort by distance · "}Search by OpenStreetMap</p>
            </section>
          )}

          {filteredPlaces.length > 0 && (
            <ul className="map-result-list" aria-label={`${filteredPlaces.length} of our places`}>
              {filteredPlaces.map((place) => (
                <li key={place.id}>
                  <button
                    type="button"
                    className={place.id === selectedPlace?.id ? "is-selected" : ""}
                    onClick={() => selectPlace(place.id)}
                  >
                    <span>{place.name}</span>
                    <small>{placeLocation(place)} · {place.category}{place.distanceKm !== undefined && ` · ${formatDistance(place.distanceKm)}`}</small>
                    {place.id === selectedPlace?.id && <Check size={17} aria-hidden="true" />}
                  </button>
                </li>
              ))}
            </ul>
          )}

          {!filteredPlaces.length && search.status === "idle" && (
            <div className="empty-state">
              <MapPin size={28} aria-hidden="true" />
              <h2>None of our places match</h2>
              {trimmedQuery.length >= 2 ? (
                <button type="button" className="button button--primary" onClick={() => void searchMap()}>
                  <Search size={17} aria-hidden="true" /> Find “{trimmedQuery}” on the map
                </button>
              ) : (
                <p>Try another name, city, or visit status.</p>
              )}
            </div>
          )}
        </aside>
      </div>
    </section>
  );
}
