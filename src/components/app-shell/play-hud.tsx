import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { returnToMenu } from "@/application/app-session";
import { getApplicationState } from "@/application/application-state";
import {
  getPlaySession,
  setCampaignSpeed,
  startCampaign,
  subscribeToPlaySession,
  toggleCampaignPause
} from "@/application/play-session";
import { formatCampaignDate } from "@/generators/campaign/campaign-simulation";
import type { CampaignSpeed } from "@/types/campaign/campaign";
import { si } from "@/utils";
import { COUNTRY_SELECTION_CHANGE_EVENT, getSelectedCountryId, selectCountry } from "../country-selection";

interface CountrySummary {
  id: number;
  name: string;
  fullName: string;
  form: string;
  color: string;
  capital: string;
  population: number;
  provinces: number;
  burgs: number;
  treasury: number;
}

// Population settings can be unset until the Units editor initializes them; use its defaults meanwhile.
const finiteOr = (value: number, fallback: number): number => (Number.isFinite(value) ? value : fallback);

/** Read-only presentation of a country; the HUD never writes to `pack`. */
function summarizeCountry(id: number): CountrySummary | null {
  const app = getApplicationState();
  const { pack } = app;
  const populationRate = finiteOr(app.populationRate, 1000);
  const urbanization = finiteOr(app.urbanization, 1);
  const state = pack.states?.[id];
  if (!id || !state || state.removed) return null;
  return {
    id,
    name: state.name,
    fullName: state.fullName || state.name,
    form: state.formName || state.form || "Realm",
    color: state.color || "#888",
    capital: pack.burgs[state.capital]?.name ?? "—",
    population: ((state.rural || 0) + (state.urban || 0) * urbanization) * populationRate,
    provinces: state.provinces?.length ?? 0,
    burgs: state.burgs ?? 0,
    treasury: state.treasury ?? 0
  };
}

function listCountries(): CountrySummary[] {
  const { pack } = getApplicationState();
  return (pack.states ?? [])
    .map(state => summarizeCountry(state.i))
    .filter((country): country is CountrySummary => country !== null)
    .sort((a, b) => b.population - a.population);
}

function useSelectedCountryId(): number | null {
  const [id, setId] = useState(getSelectedCountryId);
  useEffect(() => {
    const update = () => setId(getSelectedCountryId());
    window.addEventListener(COUNTRY_SELECTION_CHANGE_EVENT, update);
    return () => window.removeEventListener(COUNTRY_SELECTION_CHANGE_EVENT, update);
  }, []);
  return id;
}

const Swatch = ({ color }: { color: string }) => (
  <span aria-hidden="true" className="fm-swatch" style={{ background: color }} />
);

function Stat({ label, value }: { label: string; value: string }): React.JSX.Element {
  return (
    <div className="fm-stat">
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function CountryPicker(): React.JSX.Element {
  const countries = useMemo(listCountries, []);
  const selectedId = useSelectedCountryId();
  const selected = selectedId ? summarizeCountry(selectedId) : null;

  const play = () => {
    if (!selected) return;
    const { seed, options } = getApplicationState();
    startCampaign({ playerCountryId: selected.id, mapSeed: seed, startYear: options.year });
  };

  return (
    <>
      <div className="fm-hud-banner" role="status">
        <strong>Choose your nation</strong>
        <span>Click a country on the map or pick one from the list</span>
      </div>
      <aside aria-label="Nation selection" className="fm-hud-panel fm-nation-picker">
        <header className="fm-hud-panel__header">
          <h2>Nations</h2>
          <button className="fm-small-button" onClick={() => void returnToMenu()} type="button">
            Main menu
          </button>
        </header>
        <ul className="fm-nation-list">
          {countries.map(country => (
            <li key={country.id}>
              <button
                aria-pressed={country.id === selectedId}
                className={`fm-nation${country.id === selectedId ? " fm-nation--selected" : ""}`}
                onClick={() => selectCountry(country.id)}
                type="button"
              >
                <Swatch color={country.color} />
                <span className="fm-nation__name">{country.name}</span>
                <span className="fm-nation__meta">{si(country.population)}</span>
              </button>
            </li>
          ))}
        </ul>
        {selected ? (
          <section className="fm-nation-details">
            <h3>
              <Swatch color={selected.color} />
              {selected.fullName}
            </h3>
            <dl className="fm-stats">
              <Stat label="Government" value={selected.form} />
              <Stat label="Capital" value={selected.capital} />
              <Stat label="Population" value={si(selected.population)} />
              <Stat label="Provinces" value={String(selected.provinces)} />
              <Stat label="Settlements" value={String(selected.burgs)} />
              <Stat label="Treasury" value={`${si(selected.treasury)} ¤`} />
            </dl>
            <button className="fm-menu-button fm-menu-button--primary fm-menu-button--inline" onClick={play} type="button">
              <span className="fm-menu-button__label">Play as {selected.name}</span>
            </button>
          </section>
        ) : (
          <p className="fm-empty">No nation selected yet.</p>
        )}
      </aside>
    </>
  );
}

const SPEEDS: { speed: Exclude<CampaignSpeed, 0>; label: string }[] = [
  { speed: 1, label: "▸" },
  { speed: 2, label: "▸▸" },
  { speed: 3, label: "▸▸▸" }
];

function CampaignTopBar({ playerCountryId }: { playerCountryId: number }): React.JSX.Element | null {
  const session = useSyncExternalStore(subscribeToPlaySession, getPlaySession);
  const country = summarizeCountry(playerCountryId);
  const selectedId = useSelectedCountryId();
  const inspected = selectedId && selectedId !== playerCountryId ? summarizeCountry(selectedId) : null;

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (event.code !== "Space" || target?.closest("input, textarea, select, [contenteditable]")) return;
      event.preventDefault();
      event.stopPropagation();
      toggleCampaignPause();
    };
    window.addEventListener("keydown", onKey, { capture: true });
    return () => window.removeEventListener("keydown", onKey, { capture: true });
  }, []);

  if (!session?.campaign || !country) return null;
  return (
    <>
      <header aria-label="Campaign" className="fm-topbar">
        <div className="fm-topbar__nation">
          <Swatch color={country.color} />
          <div>
            <strong>{country.name}</strong>
            <small>{country.form}</small>
          </div>
        </div>
        <dl className="fm-topbar__resources">
          <Stat label="Treasury" value={`${si(country.treasury)} ¤`} />
          <Stat label="Population" value={si(country.population)} />
          <Stat label="Provinces" value={String(country.provinces)} />
        </dl>
        <div className="fm-topbar__time">
          <span className="fm-topbar__date">{formatCampaignDate(session.campaign.date)}</span>
          <div aria-label="Game speed" className="fm-speed" role="group">
            <button
              aria-pressed={session.speed === 0}
              className="fm-speed__button"
              onClick={toggleCampaignPause}
              title="Pause / resume (Space)"
              type="button"
            >
              ❚❚
            </button>
            {SPEEDS.map(({ speed, label }) => (
              <button
                aria-pressed={session.speed === speed}
                className="fm-speed__button"
                key={speed}
                onClick={() => setCampaignSpeed(speed)}
                title={`Speed ${speed}`}
                type="button"
              >
                {label}
              </button>
            ))}
          </div>
          {session.speed === 0 ? <span className="fm-topbar__paused">Paused</span> : null}
        </div>
        <button className="fm-small-button" onClick={() => void returnToMenu()} type="button">
          Menu
        </button>
      </header>
      {inspected ? (
        <aside aria-label="Foreign nation" className="fm-hud-panel fm-inspector">
          <h3>
            <Swatch color={inspected.color} />
            {inspected.fullName}
          </h3>
          <dl className="fm-stats">
            <Stat label="Capital" value={inspected.capital} />
            <Stat label="Population" value={si(inspected.population)} />
            <Stat label="Provinces" value={String(inspected.provinces)} />
          </dl>
        </aside>
      ) : null}
    </>
  );
}

export function PlayHud(): React.JSX.Element | null {
  const session = useSyncExternalStore(subscribeToPlaySession, getPlaySession);
  if (!session) return null;
  return session.phase === "choosing-country" || !session.campaign ? (
    <CountryPicker />
  ) : (
    <CampaignTopBar playerCountryId={session.campaign.playerCountryId} />
  );
}
