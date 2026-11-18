import { useEffect, useRef, useState } from "react";
import { type MapSource, type SessionKind, startSession } from "@/application/app-session";
import { SHOWCASE_MAPS, type ShowcaseMap } from "@/data/showcase-maps";
import { MAP_LIBRARY_CHANGE_EVENT, MapLibrary, type MapLibraryEntry } from "@/services/io/map-library";
import { getShowcaseThumbnail } from "@/services/io/map-thumbnail";
import { VERSION } from "@/services/versioning";

type MenuPage = "home" | "play" | "editor" | "showcase";

const PAGE_TITLES: Record<Exclude<MenuPage, "home">, { title: string; subtitle: string }> = {
  play: { title: "Play", subtitle: "Choose a world, then a nation to lead" },
  editor: { title: "Editor", subtitle: "Forge new worlds or continue shaping your own" },
  showcase: { title: "Showcase", subtitle: "Curated worlds to explore" }
};

function useLibrary(): MapLibraryEntry[] | null {
  const [entries, setEntries] = useState<MapLibraryEntry[] | null>(null);
  useEffect(() => {
    const refresh = () =>
      void MapLibrary.list()
        .then(setEntries)
        .catch(() => setEntries([]));
    refresh();
    window.addEventListener(MAP_LIBRARY_CHANGE_EVENT, refresh);
    return () => window.removeEventListener(MAP_LIBRARY_CHANGE_EVENT, refresh);
  }, []);
  return entries;
}

const formatDate = (time: number): string =>
  new Date(time).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });

function MapArt({ thumbnail, accent = "#8a6a32" }: { thumbnail?: string; accent?: string }): React.JSX.Element {
  return (
    <span aria-hidden="true" className="fm-map-art" style={{ "--fm-accent": accent } as React.CSSProperties}>
      {thumbnail ? <img alt="" src={thumbnail} /> : <span className="fm-map-art__placeholder" />}
    </span>
  );
}

function MenuButton({
  label,
  hint,
  onClick,
  primary = false
}: {
  label: string;
  hint: string;
  onClick: () => void;
  primary?: boolean;
}): React.JSX.Element {
  return (
    <button className={`fm-menu-button${primary ? " fm-menu-button--primary" : ""}`} onClick={onClick} type="button">
      <span className="fm-menu-button__label">{label}</span>
      <span className="fm-menu-button__hint">{hint}</span>
    </button>
  );
}

function HomePage({ onNavigate }: { onNavigate: (page: MenuPage) => void }): React.JSX.Element {
  return (
    <nav aria-label="Main menu" className="fm-home">
      <MenuButton hint="Lead a nation of your chosen world" label="Play" onClick={() => onNavigate("play")} primary />
      <MenuButton hint="Create and shape fantasy maps" label="Editor" onClick={() => onNavigate("editor")} />
      <MenuButton hint="Explore curated worlds" label="Showcase" onClick={() => onNavigate("showcase")} />
    </nav>
  );
}

function LibraryRow({
  entry,
  actions
}: {
  entry: MapLibraryEntry;
  actions: React.ReactNode;
}): React.JSX.Element {
  return (
    <li className="fm-library-row">
      <MapArt thumbnail={entry.thumbnail} />
      <span className="fm-library-row__copy">
        <strong>{entry.name}</strong>
        <small>
          Edited {formatDate(entry.updatedAt)} · {(entry.size / 1024 / 1024).toFixed(1)} MB
        </small>
      </span>
      <span className="fm-library-row__actions">{actions}</span>
    </li>
  );
}

function EditorPage({ open }: { open: (kind: SessionKind, source: MapSource) => void }): React.JSX.Element {
  const entries = useLibrary();
  const fileInput = useRef<HTMLInputElement>(null);
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);

  return (
    <div className="fm-editor">
      <div className="fm-editor__start">
        <button className="fm-feature-card" onClick={() => open("editor", { kind: "new" })} type="button">
          <span aria-hidden="true" className="fm-feature-card__sigil">
            ✦
          </span>
          <strong>Forge a new world</strong>
          <small>Generate a random world and start editing it</small>
        </button>
        <button className="fm-feature-card" onClick={() => fileInput.current?.click()} type="button">
          <span aria-hidden="true" className="fm-feature-card__sigil">
            ⇪
          </span>
          <strong>Import a map file</strong>
          <small>Open a .map or .gz file from your computer</small>
        </button>
        <input
          accept=".map,.gz"
          className="fm-hidden"
          onChange={event => {
            const file = event.currentTarget.files?.[0];
            event.currentTarget.value = "";
            if (file) open("editor", { kind: "file", file });
          }}
          ref={fileInput}
          type="file"
        />
      </div>

      <section aria-labelledby="fmLibraryTitle" className="fm-section">
        <h3 className="fm-section__title" id="fmLibraryTitle">
          Your maps
        </h3>
        {entries === null ? (
          <p className="fm-empty">Opening the archive…</p>
        ) : entries.length === 0 ? (
          <p className="fm-empty">No maps yet. Forge a new world and it will be kept here automatically.</p>
        ) : (
          <ul className="fm-library">
            {entries.map(entry => (
              <LibraryRow
                actions={
                  pendingDelete === entry.id ? (
                    <>
                      <span className="fm-confirm-text">Delete forever?</span>
                      <button
                        className="fm-small-button fm-small-button--danger"
                        onClick={() => void MapLibrary.remove(entry.id).finally(() => setPendingDelete(null))}
                        type="button"
                      >
                        Delete
                      </button>
                      <button className="fm-small-button" onClick={() => setPendingDelete(null)} type="button">
                        Keep
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        className="fm-small-button fm-small-button--gold"
                        onClick={() => open("editor", { kind: "library", id: entry.id })}
                        type="button"
                      >
                        Edit
                      </button>
                      <button
                        className="fm-small-button"
                        onClick={() => void MapLibrary.download(entry.id)}
                        title="Download as a .map file"
                        type="button"
                      >
                        Download
                      </button>
                      <button className="fm-small-button" onClick={() => setPendingDelete(entry.id)} type="button">
                        Delete
                      </button>
                    </>
                  )
                }
                entry={entry}
                key={entry.id}
              />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function ShowcaseCard({
  map,
  children,
  selected,
  onSelect
}: {
  map: ShowcaseMap;
  children?: React.ReactNode;
  selected?: boolean;
  onSelect?: () => void;
}): React.JSX.Element {
  const content = (
    <>
      <MapArt accent={map.accent} thumbnail={getShowcaseThumbnail(map.id)} />
      <span className="fm-showcase-card__copy">
        <strong>{map.name}</strong>
        <em>{map.tagline}</em>
        <small>{map.description}</small>
      </span>
    </>
  );
  return onSelect ? (
    <button
      aria-pressed={selected}
      className={`fm-showcase-card${selected ? " fm-showcase-card--selected" : ""}`}
      onClick={onSelect}
      type="button"
    >
      {content}
    </button>
  ) : (
    <article className="fm-showcase-card">
      {content}
      <span className="fm-showcase-card__actions">{children}</span>
    </article>
  );
}

function ShowcasePage({ open }: { open: (kind: SessionKind, source: MapSource) => void }): React.JSX.Element {
  return (
    <div className="fm-showcase-grid">
      {SHOWCASE_MAPS.map(map => (
        <ShowcaseCard key={map.id} map={map}>
          <button
            className="fm-small-button fm-small-button--gold"
            onClick={() => open("showcase", { kind: "showcase", id: map.id })}
            type="button"
          >
            Explore
          </button>
          <button className="fm-small-button" onClick={() => open("play", { kind: "showcase", id: map.id })} type="button">
            Play this world
          </button>
        </ShowcaseCard>
      ))}
    </div>
  );
}

type PlayChoice = { kind: "library"; id: string } | { kind: "showcase"; id: string };

function PlayPage({ open }: { open: (kind: SessionKind, source: MapSource) => void }): React.JSX.Element {
  const entries = useLibrary();
  const [choice, setChoice] = useState<PlayChoice | null>(null);
  const isChosen = (kind: PlayChoice["kind"], id: string) => choice?.kind === kind && choice.id === id;

  return (
    <div className="fm-play">
      <section aria-labelledby="fmPlayShowcaseTitle" className="fm-section">
        <h3 className="fm-section__title" id="fmPlayShowcaseTitle">
          Showcase worlds
        </h3>
        <div className="fm-showcase-grid fm-showcase-grid--compact">
          {SHOWCASE_MAPS.map(map => (
            <ShowcaseCard
              key={map.id}
              map={map}
              onSelect={() => setChoice({ kind: "showcase", id: map.id })}
              selected={isChosen("showcase", map.id)}
            />
          ))}
        </div>
      </section>

      <section aria-labelledby="fmPlayLibraryTitle" className="fm-section">
        <h3 className="fm-section__title" id="fmPlayLibraryTitle">
          Your maps
        </h3>
        {entries?.length ? (
          <ul className="fm-library">
            {entries.map(entry => (
              <li key={entry.id}>
                <button
                  aria-pressed={isChosen("library", entry.id)}
                  className={`fm-library-pick${isChosen("library", entry.id) ? " fm-library-pick--selected" : ""}`}
                  onClick={() => setChoice({ kind: "library", id: entry.id })}
                  type="button"
                >
                  <MapArt thumbnail={entry.thumbnail} />
                  <span className="fm-library-row__copy">
                    <strong>{entry.name}</strong>
                    <small>Edited {formatDate(entry.updatedAt)}</small>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="fm-empty">{entries ? "Maps you create in the Editor will appear here." : "Opening the archive…"}</p>
        )}
      </section>

      <footer className="fm-page-footer">
        <button
          className="fm-menu-button fm-menu-button--primary fm-menu-button--inline"
          disabled={!choice}
          onClick={() => choice && open("play", choice)}
          type="button"
        >
          <span className="fm-menu-button__label">Choose nation</span>
        </button>
      </footer>
    </div>
  );
}

export function MainMenu({ hasBackdropMap }: { hasBackdropMap: boolean }): React.JSX.Element {
  const [page, setPage] = useState<MenuPage>("home");
  const [opening, setOpening] = useState(false);

  useEffect(() => {
    if (page === "home") return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setPage("home");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [page]);

  const open = (kind: SessionKind, source: MapSource) => {
    setOpening(true);
    void startSession(kind, source).then(started => {
      setOpening(false);
      if (started) setPage("home");
    });
  };

  return (
    <div
      aria-busy={opening}
      aria-label="Fantasia main menu"
      className={`fm-menu${hasBackdropMap ? " fm-menu--over-map" : ""}`}
      role="dialog"
    >
      <div aria-hidden="true" className="fm-menu__backdrop" />
      <div aria-hidden="true" className="fm-menu__vignette" />

      <div className={`fm-menu__layout fm-menu__layout--${page}`}>
        <header className="fm-brand">
          <span aria-hidden="true" className="fm-brand__ornament" />
          <h1 className="fm-brand__title">Fantasia</h1>
          <p className="fm-brand__subtitle">Forge worlds · Rule realms</p>
          <span aria-hidden="true" className="fm-brand__ornament fm-brand__ornament--bottom" />
        </header>

        {page === "home" ? (
          <HomePage onNavigate={setPage} />
        ) : (
          <section aria-labelledby="fmPageTitle" className="fm-panel">
            <header className="fm-panel__header">
              <button className="fm-back" onClick={() => setPage("home")} type="button">
                ‹ Back
              </button>
              <div>
                <h2 className="fm-panel__title" id="fmPageTitle">
                  {PAGE_TITLES[page].title}
                </h2>
                <p className="fm-panel__subtitle">{PAGE_TITLES[page].subtitle}</p>
              </div>
            </header>
            <div className="fm-panel__body">
              {page === "play" ? <PlayPage open={open} /> : null}
              {page === "editor" ? <EditorPage open={open} /> : null}
              {page === "showcase" ? <ShowcasePage open={open} /> : null}
            </div>
          </section>
        )}
      </div>

      <footer className="fm-menu__footer">
        <span>v{VERSION}</span>
        <span>
          Built on{" "}
          <a href="https://github.com/Azgaar/Fantasy-Map-Generator" rel="noreferrer" target="_blank">
            Azgaar's Fantasy Map Generator
          </a>
        </span>
      </footer>
    </div>
  );
}
