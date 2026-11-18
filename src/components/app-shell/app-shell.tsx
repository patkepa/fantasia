// Top-level app chrome above the map workspace: the main menu and the Play HUD.

import { useEffect, useState, useSyncExternalStore } from "react";
import { createRoot } from "react-dom/client";
import { getAppShell, subscribeToAppShell } from "@/application/app-session";
import { MainMenu } from "./main-menu";
import { PlayHud } from "./play-hud";
import "./app-shell.css";

function useHasMap(): boolean {
  const [hasMap, setHasMap] = useState(false);
  useEffect(() => {
    const mark = () => setHasMap(true);
    window.addEventListener("map:generated", mark);
    window.addEventListener("map:loaded", mark);
    return () => {
      window.removeEventListener("map:generated", mark);
      window.removeEventListener("map:loaded", mark);
    };
  }, []);
  return hasMap;
}

function AppShell(): React.JSX.Element | null {
  const shell = useSyncExternalStore(subscribeToAppShell, getAppShell);
  const hasMap = useHasMap();
  if (shell.screen === "menu") return <MainMenu hasBackdropMap={hasMap} />;
  return shell.session?.kind === "play" ? <PlayHud /> : null;
}

const root = document.getElementById("appShellRoot");
if (root) createRoot(root).render(<AppShell />);
