import {
  Eye,
  KeyRound,
  Monitor,
  MonitorPlay,
  Moon,
  RotateCcw,
  Settings,
  SkipForward,
  Sun,
  WifiOff,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { InputCopy } from "@/components/ui/input-copy";
import { InputField, InputGroup } from "@/components/ui/input-group";
import { Slider } from "@/components/ui/slider";
import { TabsSubtle, TabsSubtleItem } from "@/components/ui/tabs-subtle";
import { Tooltip } from "@/components/ui/tooltip";
import { useTheme } from "@/hooks/useTheme";
import { useTrmnl } from "@/hooks/useTrmnl";
import { THEMES } from "@/lib/theme";
import {
  describeFetchError,
  formatAge,
  formatInterval,
  REFRESH_STEPS,
} from "@/lib/trmnl-api";

// ?kiosk in the URL: show only the screen, full-bleed, for wall tablets.
// Tapping brings the normal controls back for 30 seconds.
const KIOSK = new URLSearchParams(window.location.search).has("kiosk");
const KIOSK_CHROME_MS = 30000;

// Extra pages to rotate with the TRMNL screen in kiosk mode, e.g.
// ?kiosk&rotate=https://a.example,http://b.local:8080&every=60
// Passing them once saves them, so the start URL can stay short afterwards;
// ?rotate= with nothing after it clears the list.
const ROTATE_KEY = "trmnl_kioskRotate";
const EVERY_KEY = "trmnl_kioskEvery";

function readRotation(): { pages: string[]; everyMs: number } {
  const params = new URLSearchParams(window.location.search);
  try {
    if (params.has("rotate")) {
      localStorage.setItem(ROTATE_KEY, params.get("rotate") ?? "");
    }
    if (params.has("every")) {
      localStorage.setItem(EVERY_KEY, params.get("every") ?? "");
    }
  } catch {
    // Storage unavailable; fall back to whatever the URL says.
  }
  let raw = params.get("rotate");
  let every = params.get("every");
  try {
    raw = raw ?? localStorage.getItem(ROTATE_KEY);
    every = every ?? localStorage.getItem(EVERY_KEY);
  } catch {
    // Ignore; use the URL values only.
  }
  const pages = (raw ?? "")
    .split(",")
    .map((page) => page.trim())
    .filter((page) => /^https?:\/\//.test(page));
  const seconds = Number(every) > 0 ? Number(every) : 60;
  return { pages, everyMs: Math.max(10, seconds) * 1000 };
}

const ROTATION = KIOSK ? readRotation() : { pages: [], everyMs: 60000 };

const THEME_OPTIONS = [
  { label: "Light", icon: Sun },
  { label: "Dark", icon: Moon },
  { label: "System", icon: Monitor },
];

// Order matters: index 0 is mirror, index 1 is virtual device.
const MODE_OPTIONS = [
  { label: "Mirror", icon: Eye },
  { label: "Virtual device", icon: MonitorPlay },
];

function ThemeTabs({ idPrefix }: { idPrefix: string }) {
  const { theme, changeTheme } = useTheme();

  return (
    <TabsSubtle
      selectedIndex={THEMES.indexOf(theme)}
      onSelect={(index) => changeTheme(THEMES[index])}
      idPrefix={idPrefix}
    >
      {THEME_OPTIONS.map((option, index) => (
        <TabsSubtleItem
          key={option.label}
          index={index}
          icon={option.icon}
          label={option.label}
          aria-label={option.label}
        />
      ))}
    </TabsSubtle>
  );
}

function App() {
  const {
    state,
    isLoading,
    error,
    countdown,
    forceRefresh,
    nextScreen,
    changeAdvancePlaylist,
    changeRefreshOverride,
    saveManualApiKey,
  } = useTrmnl();

  const {
    currentImage,
    selectedDevice,
    devices,
    advancePlaylist,
    refreshOverride,
    refreshRate,
    noScreenRendered,
    lastError,
    retryAfter,
    retryCount,
  } = state;
  const [showSettings, setShowSettings] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState("");
  const [confirmReset, setConfirmReset] = useState(false);
  const [showChrome, setShowChrome] = useState(false);
  // 0 is the TRMNL screen; 1..n are the extra rotation pages.
  const [slide, setSlide] = useState(0);
  const slideCount = ROTATION.pages.length + 1;

  useEffect(() => {
    if (slideCount < 2 || showChrome) return;
    const timer = setTimeout(
      () => setSlide((current) => (current + 1) % slideCount),
      ROTATION.everyMs
    );
    return () => clearTimeout(timer);
  }, [slide, slideCount, showChrome]);

  // Drop back to the bare screen once the controls have sat unused, but not
  // while settings are open.
  useEffect(() => {
    if (!KIOSK || !showChrome || showSettings) return;
    const timer = setTimeout(() => setShowChrome(false), KIOSK_CHROME_MS);
    return () => clearTimeout(timer);
  }, [showChrome, showSettings]);

  // The slider works in step indexes so the intervals are evenly spaced;
  // mapping by value would bunch the short ones up at the left.
  const intervalIndex = Math.max(0, REFRESH_STEPS.indexOf(refreshOverride ?? 0));

  // Recomputed each render; the 1s countdown tick keeps it live.
  const age = formatAge(currentImage?.renderedAt ?? null);
  const statusMessage = describeFetchError(lastError, retryAfter) ?? error;

  // One blip isn't worth alarming over, but a rejected key won't recover on its
  // own and a stale screen under a ticking countdown looks healthy when it
  // isn't.
  const showDisconnected =
    !!lastError && (lastError.kind === "unauthorized" || retryCount >= 2);

  const handleSaveApiKey = () => {
    if (apiKeyInput.trim()) {
      saveManualApiKey(apiKeyInput.trim());
      setApiKeyInput("");
      setShowSettings(false);
    }
  };

  // Render login prompt if no devices and no selected device with API key
  if (devices.length === 0 && !selectedDevice && !isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="bg-surface-3 shadow-surface-3 flex w-full max-w-md flex-col gap-5 rounded-xl p-7">
          <div className="flex flex-col gap-1.5">
            <h2 className="text-lg font-semibold">Welcome to TRMNL Web</h2>
            <p className="text-muted-foreground text-[13px]">
              View your TRMNL device display right in your browser.
            </p>
          </div>

          <div className="flex flex-col gap-2">
            <label
              htmlFor="setup-api-key"
              className="text-muted-foreground text-[13px]"
            >
              Device API key
            </label>
            <input
              id="setup-api-key"
              type="text"
              value={apiKeyInput}
              onChange={(e) => setApiKeyInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSaveApiKey()}
              placeholder="Paste your device API key"
              className="border-border bg-background placeholder:text-muted-foreground focus-visible:ring-ring h-9 w-full rounded-lg border px-3 text-[13px] outline-none focus-visible:ring-1"
            />
            <p className="text-muted-foreground text-[12px]">
              Find this in your{" "}
              <a
                href="https://usetrmnl.com/dashboard"
                target="_blank"
                rel="noopener noreferrer"
                className="text-foreground underline underline-offset-2"
              >
                TRMNL dashboard
              </a>{" "}
              under Device Settings.
            </p>
          </div>

          <Button onClick={handleSaveApiKey} disabled={!apiKeyInput.trim()}>
            Connect
          </Button>

          {error && <p className="text-destructive text-[13px]">{error}</p>}

          {/* Only appearance lives out here — the refresh settings need a
              connected device to mean anything. */}
          <div className="border-border flex items-center justify-between border-t pt-4">
            <span className="text-muted-foreground text-[13px]">
              Appearance
            </span>
            <ThemeTabs idPrefix="welcome-theme" />
          </div>
        </div>
      </div>
    );
  }

  if (KIOSK && !showChrome && (currentImage || slide > 0)) {
    return (
      <div className="fixed inset-0 bg-black">
        {/* The TRMNL screen. Tapping it brings the controls back. */}
        <div
          className="absolute inset-0 flex items-center justify-center"
          style={{ visibility: slide === 0 ? "visible" : "hidden" }}
          onClick={() => setShowChrome(true)}
        >
          {currentImage && (
            <img
              src={currentImage.url}
              alt="TRMNL display"
              className="h-full w-full object-contain"
            />
          )}
          {showDisconnected && (
            <div className="absolute top-3 right-3 text-white/60">
              <WifiOff size={18} />
            </div>
          )}
        </div>
        {/* Rotation pages stay loaded so they keep refreshing themselves
            and don't flash white each time they come round. Taps go to the
            page itself, so the controls are reached from the TRMNL slide. */}
        {ROTATION.pages.map((page, index) => (
          <iframe
            key={page}
            src={page}
            title={page}
            className="absolute inset-0 h-full w-full border-0 bg-white"
            style={{ visibility: slide === index + 1 ? "visible" : "hidden" }}
          />
        ))}
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="flex w-full max-w-[900px] flex-col gap-3">
        {/* Display */}
        <div className="bg-surface-2 shadow-surface-3 relative flex aspect-[5/3] items-center justify-center overflow-hidden rounded-xl">
          {isLoading && !currentImage && (
            <div className="text-muted-foreground flex flex-col items-center gap-3 text-[13px]">
              <div className="border-muted-foreground/30 border-t-foreground size-6 animate-spin rounded-full border-2" />
              <p>Loading TRMNL display…</p>
            </div>
          )}

          {currentImage && (
            <img
              src={currentImage.url}
              alt="TRMNL display"
              className="h-full w-full object-contain"
            />
          )}

          {currentImage && showDisconnected && (
            <div className="bg-surface-5 shadow-surface-4 text-foreground absolute top-3 left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-lg px-3 py-1.5 text-[12px]">
              <WifiOff size={14} className="text-destructive" />
              <span className="whitespace-nowrap">
                Not updating{age ? ` · last screen ${age}` : ""}
              </span>
            </div>
          )}

          {!isLoading && !currentImage && selectedDevice && (
            <div className="flex max-w-sm flex-col items-center gap-3 px-6 text-center">
              <p className="text-muted-foreground text-[13px]">
                {noScreenRendered
                  ? "This device hasn't rendered a screen yet, so there's nothing to mirror. Pulling the next screen will generate one."
                  : "No image available"}
              </p>
              {noScreenRendered ? (
                <Button
                  variant="secondary"
                  size="sm"
                  leadingIcon={SkipForward}
                  onClick={nextScreen}
                >
                  Generate a screen
                </Button>
              ) : (
                <Button variant="secondary" size="sm" onClick={forceRefresh}>
                  Refresh
                </Button>
              )}
            </div>
          )}
        </div>

        {/* Controls */}
        <div className="flex items-center justify-between gap-3">
          {/* Advance mode has a side effect on the real device, so which mode
              you're in shouldn't be hidden behind a dialog. */}
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <span className="text-muted-foreground truncate text-[13px]">
              {advancePlaylist ? "Virtual device" : "Mirroring"}
            </span>
          </div>

          <span className="text-muted-foreground shrink-0 text-[13px] tabular-nums">
            {advancePlaylist ? (
              <>
                Next screen in{" "}
                <span className="text-foreground">{countdown}</span>
              </>
            ) : age ? (
              <>
                Rendered <span className="text-foreground">{age}</span> · checking
                in {countdown}
              </>
            ) : (
              <>
                Checking in <span className="text-foreground">{countdown}</span>
              </>
            )}
          </span>

          <div className="flex flex-1 items-center justify-end gap-1">
            {/* Outlined rather than filled: distinct from Refresh because it
                changes the device, without reading as the primary action. */}
            <Tooltip
              content={
                <span className="block max-w-[220px]">
                  <span className="font-medium">Next screen</span>
                  <br />
                  {advancePlaylist
                    ? "Advances the playlist now instead of waiting for the timer."
                    : "Advances your device's playlist — it will skip past this screen."}
                </span>
              }
            >
              <Button
                variant="tertiary"
                size="icon"
                onClick={nextScreen}
                disabled={isLoading}
                aria-label="Next screen"
              >
                <SkipForward />
              </Button>
            </Tooltip>
            <Tooltip
              content={
                <span className="block max-w-[220px]">
                  <span className="font-medium">Refresh</span>
                  <br />
                  Re-checks for the current screen now. Never advances your
                  device.
                </span>
              }
            >
              <Button
                variant="ghost"
                size="icon"
                onClick={forceRefresh}
                disabled={isLoading}
                aria-label="Refresh"
              >
                <RotateCcw className={isLoading ? "animate-spin" : undefined} />
              </Button>
            </Tooltip>
            <Tooltip content="Settings">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowSettings(true)}
                active={showSettings}
                aria-label="Settings"
              >
                <Settings />
              </Button>
            </Tooltip>
          </div>
        </div>
      </div>

      {/* Settings */}
      <Dialog
        open={showSettings}
        onOpenChange={(open) => {
          setShowSettings(open);
          if (!open) setConfirmReset(false);
        }}
      >
        <DialogContent size="lg">
          <DialogHeader>
            <DialogTitle>Settings</DialogTitle>
            <DialogDescription>
              How this tab reads your TRMNL device.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-6">
            {/* Appearance */}
            <section className="flex flex-col gap-2">
              <span className="text-muted-foreground text-[13px]">
                Appearance
              </span>
              <ThemeTabs idPrefix="settings-theme" />
            </section>

            {/* Mode */}
            <section className="flex flex-col gap-2">
              <span className="text-muted-foreground text-[13px]">
                This tab acts as
              </span>
              <TabsSubtle
                selectedIndex={advancePlaylist ? 1 : 0}
                onSelect={(index) => changeAdvancePlaylist(index === 1)}
                idPrefix="mode"
              >
                {MODE_OPTIONS.map((option, index) => (
                  <TabsSubtleItem
                    key={option.label}
                    index={index}
                    icon={option.icon}
                    label={option.label}
                    aria-label={option.label}
                  />
                ))}
              </TabsSubtle>
              <p className="text-muted-foreground text-[12px]">
                {advancePlaylist
                  ? "Pulls the next screen itself, like a real device. Your device will skip the screens shown here."
                  : "Follows what your device is currently showing. Changes nothing on the device."}
              </p>
              <p className="text-muted-foreground/70 text-[12px]">
                Either way, <span className="text-muted-foreground">Refresh</span>{" "}
                only re-checks the current screen, and{" "}
                <span className="text-muted-foreground">Next</span> advances your
                device's playlist.
              </p>
            </section>

            {/* Refresh interval */}
            <section className="flex flex-col gap-3">
              {/* Label and value sit above the track rather than inline, so the
                  track doesn't shift as the value text changes width. */}
              <div className="flex items-baseline justify-between">
                <span className="text-muted-foreground text-[13px]">
                  Refresh interval
                </span>
                <span className="text-[13px] tabular-nums">
                  {formatInterval(refreshOverride ?? 0)}
                </span>
              </div>
              <Slider
                // Only used for the thumb's accessible name here: the visible
                // label lives above, and `showValue={false}` suppresses the
                // component's own inline rendering of it.
                label="Refresh interval"
                value={intervalIndex}
                onChange={(value) =>
                  changeRefreshOverride(
                    REFRESH_STEPS[Array.isArray(value) ? value[0] : value]
                  )
                }
                min={0}
                max={REFRESH_STEPS.length - 1}
                step={1}
                showSteps
                showValue={false}
                formatValue={(index) => formatInterval(REFRESH_STEPS[index])}
                // The component's thumb defaults to hardcoded white, which
                // vanishes against the light-mode track.
                thumbColor="var(--foreground)"
              />
              <p className="text-muted-foreground text-[12px]">
                {refreshOverride
                  ? `Pinned to ${formatInterval(refreshOverride)}. Your device asks for ${formatInterval(refreshRate)}.`
                  : `Following your device's own rate of ${formatInterval(refreshRate)}.`}
              </p>
            </section>

            {/* API key */}
            <section className="flex flex-col gap-3">
              {selectedDevice?.api_key && (
                <InputCopy
                  label="Device API key"
                  value={selectedDevice.api_key}
                />
              )}

              <div className="flex items-end gap-2">
                <div className="min-w-0 flex-1">
                  <InputGroup className="w-full">
                    <InputField
                      className="w-full"
                      label="Replace API key"
                      index={0}
                      value={apiKeyInput}
                      onChange={setApiKeyInput}
                      onKeyDown={(e) =>
                        e.key === "Enter" && handleSaveApiKey()
                      }
                      placeholder="Enter new API key"
                      icon={KeyRound}
                    />
                  </InputGroup>
                </div>
                <Button
                  size="sm"
                  onClick={handleSaveApiKey}
                  disabled={!apiKeyInput.trim()}
                >
                  Save
                </Button>
              </div>
            </section>

            <div className="border-border flex justify-end border-t pt-4">
              <Button
                variant="tertiary"
                size="sm"
                className="text-destructive"
                onClick={() => {
                  if (!confirmReset) {
                    setConfirmReset(true);
                    return;
                  }
                  localStorage.clear();
                  window.location.reload();
                }}
              >
                {confirmReset ? "Confirm reset — erases key" : "Reset"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Status toast — rate limiting is a "wait" not a "you broke it", so the
          wording and tone come from the error kind. */}
      {statusMessage && (
        <div
          className={`bg-surface-4 shadow-surface-4 fixed bottom-4 left-1/2 -translate-x-1/2 rounded-lg px-4 py-2 text-[13px] ${
            lastError?.kind === "rate-limited"
              ? "text-muted-foreground"
              : "text-destructive"
          }`}
        >
          {statusMessage}
        </div>
      )}
    </div>
  );
}

export default App;
