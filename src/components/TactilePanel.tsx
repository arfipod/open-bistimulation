import { useEffect, useId, useState } from 'react';
import type { TactileSettings } from '../domain/sessionTypes';
import type { JoyConTactileOutputStatus } from '../hooks/useJoyConTactileOutput';
import type { JoyConBatterySummary, JoyConDeviceSummary, JoyConIntensity, JoyConSide } from '../lib/joyconTypes';
import { useI18n } from '../lib/i18n';
import { ConnectionBadge } from './ConnectionBadge';

interface TactilePanelProps {
  tactile: TactileSettings;
  onChange?: (next: TactileSettings) => void;
  webHidSupported: boolean;
  requestingDevices: boolean;
  devices: JoyConDeviceSummary[];
  leftConnected: boolean;
  rightConnected: boolean;
  error: string | null;
  outputStatus: JoyConTactileOutputStatus;
  panelCollapsible?: boolean;
  defaultPanelCollapsed?: boolean;
  autoCollapse?: boolean;
  deviceStatusCollapsible?: boolean;
  defaultDeviceStatusCollapsed?: boolean;
  onRequestDevices?: () => void;
  onDisconnectDevices?: () => void;
  onRefresh?: () => void;
  onTestPulse?: (options: { side: JoyConSide; intensity: JoyConIntensity; duration: number; repeats: number }) => void;
}

const INTENSITIES: Array<{
  value: JoyConIntensity;
  labelKey: 'tactile.intensity.low' | 'tactile.intensity.medium' | 'tactile.intensity.high';
}> = [
  { value: 'low', labelKey: 'tactile.intensity.low' },
  { value: 'medium', labelKey: 'tactile.intensity.medium' },
  { value: 'high', labelKey: 'tactile.intensity.high' },
];

function findDevice(devices: JoyConDeviceSummary[], side: 'left' | 'right'): JoyConDeviceSummary | undefined {
  return devices.find((device) => device.side === side);
}

interface BatteryDisplay {
  text: string;
  activeBars: number;
  tone: 'full' | 'medium' | 'low' | 'unknown';
}

const BATTERY_BAR_COUNT = 4;

function batteryDisplay(device: JoyConDeviceSummary | undefined, batteryUnknown: string): BatteryDisplay {
  const battery = device?.battery;
  const percent = typeof battery?.percent === 'number' ? battery.percent : typeof battery?.level === 'number' ? battery.level * 25 : null;
  const normalizedPercent = percent === null ? null : Math.min(100, Math.max(0, percent));

  if (normalizedPercent !== null) {
    return {
      text: `${normalizedPercent}%`,
      activeBars: normalizedPercent === 0 ? 0 : Math.max(1, Math.ceil(normalizedPercent / 25)),
      tone: normalizedPercent <= 25 ? 'low' : normalizedPercent <= 50 ? 'medium' : 'full',
    };
  }

  if (battery?.label && battery.label !== 'Unknown') {
    return {
      text: battery.label,
      activeBars: batteryBarsFromLabel(battery),
      tone: batteryToneFromLabel(battery),
    };
  }

  return { text: batteryUnknown, activeBars: 0, tone: 'unknown' };
}

function batteryBarsFromLabel(battery: JoyConBatterySummary): number {
  const label = battery.label?.toLowerCase();
  if (label === 'full') return 4;
  if (label === 'medium') return 2;
  if (label === 'low' || label === 'critical') return 1;
  return 0;
}

function batteryToneFromLabel(battery: JoyConBatterySummary): BatteryDisplay['tone'] {
  const label = battery.label?.toLowerCase();
  if (label === 'empty' || label === 'critical' || label === 'low') return 'low';
  if (label === 'medium') return 'medium';
  if (label === 'full') return 'full';
  return 'unknown';
}

export function TactilePanel({
  tactile,
  onChange,
  webHidSupported,
  requestingDevices,
  devices,
  leftConnected,
  rightConnected,
  error,
  outputStatus,
  panelCollapsible = false,
  defaultPanelCollapsed = false,
  autoCollapse = false,
  deviceStatusCollapsible = false,
  defaultDeviceStatusCollapsed = false,
  onRequestDevices,
  onDisconnectDevices,
  onRefresh,
  onTestPulse,
}: TactilePanelProps) {
  const { t } = useI18n();
  const panelBodyId = useId();
  const deviceStatusId = useId();
  const [panelCollapsed, setPanelCollapsed] = useState(Boolean(defaultPanelCollapsed || autoCollapse));
  const [deviceStatusCollapsed, setDeviceStatusCollapsed] = useState(defaultDeviceStatusCollapsed);

  const leftDevice = findDevice(devices, 'left');
  const rightDevice = findDevice(devices, 'right');
  const anyConnected = leftConnected || rightConnected;
  const tactileReady = leftConnected && rightConnected;
  const intensity = tactile.intensity ?? 'medium';
  const settingsEditable = Boolean(onChange);
  const showDeviceActions = Boolean(onRequestDevices || onDisconnectDevices || onRefresh || onTestPulse);

  useEffect(() => {
    if (panelCollapsible) {
      setPanelCollapsed(Boolean(defaultPanelCollapsed || autoCollapse));
    }
  }, [autoCollapse, defaultPanelCollapsed, panelCollapsible]);

  const testSide = (side: JoyConSide) => {
    onTestPulse?.({ side, intensity, duration: tactile.pulseDurationMs, repeats: 1 });
  };

  const statusBadgeLabel = !webHidSupported ? t('tactile.webHidUnsupported') : tactileReady ? t('tactile.joyConsReady') : t('tactile.joyConsMissing');
  const deviceStatusBody = (
    <>
      <div className="joycon-device-grid">
        <JoyConStatusRow
          label={t('tactile.leftJoyCon')}
          connected={leftConnected}
          battery={batteryDisplay(leftDevice, t('tactile.batteryUnknown'))}
        />
        <JoyConStatusRow
          label={t('tactile.rightJoyCon')}
          connected={rightConnected}
          battery={batteryDisplay(rightDevice, t('tactile.batteryUnknown'))}
        />
      </div>
      {error ? <p className="panel-note tactile-error">{error}</p> : null}
      {outputStatus.lastError ? <p className="panel-note tactile-error">{t('tactile.outputError', { error: outputStatus.lastError })}</p> : null}
    </>
  );

  const deviceStatus = (
    <div className="tactile-status-block" aria-live="polite">
      {deviceStatusCollapsible ? (
        <>
          <button
            className="tactile-status-row tactile-disclosure-button"
            type="button"
            aria-expanded={!deviceStatusCollapsed}
            aria-controls={deviceStatusId}
            onClick={() => setDeviceStatusCollapsed((collapsed) => !collapsed)}
          >
            <strong>{t('tactile.browserJoyConAccess')}</strong>
            <span className="tactile-status-summary">
              <CollapseGlyph collapsed={deviceStatusCollapsed} />
              <ConnectionBadge connected={webHidSupported && tactileReady} label={statusBadgeLabel} />
            </span>
          </button>
          {!deviceStatusCollapsed ? (
            <div id={deviceStatusId} className="tactile-status-details">
              {deviceStatusBody}
            </div>
          ) : null}
        </>
      ) : (
        <>
          <div className="tactile-status-row">
            <strong>{t('tactile.browserJoyConAccess')}</strong>
            <ConnectionBadge connected={webHidSupported && tactileReady} label={statusBadgeLabel} />
          </div>
          {deviceStatusBody}
        </>
      )}
    </div>
  );

  const panelHeader = panelCollapsible && !settingsEditable ? (
    <header className="panel-header">
      <button
        className="tactile-panel-header-button"
        type="button"
        aria-expanded={!panelCollapsed}
        aria-controls={panelBodyId}
        aria-label={panelCollapsed ? t('tactile.expandPanel') : t('tactile.collapsePanel')}
        onClick={() => setPanelCollapsed((collapsed) => !collapsed)}
      >
        <h2>{t('tactile.title')}</h2>
        <CollapseGlyph collapsed={panelCollapsed} />
      </button>
    </header>
  ) : (
    <header className="panel-header">
      <h2>{t('tactile.title')}</h2>
      <div className="panel-header-actions">
        {settingsEditable ? (
          <label className="switch">
            <input
              type="checkbox"
              checked={tactile.enabled}
              onChange={(event) => onChange?.({ ...tactile, enabled: event.target.checked })}
            />
            <span />
          </label>
        ) : null}
        {panelCollapsible ? (
          <button
            className="collapse-toggle-button"
            type="button"
            aria-expanded={!panelCollapsed}
            aria-controls={panelBodyId}
            aria-label={panelCollapsed ? t('tactile.expandPanel') : t('tactile.collapsePanel')}
            onClick={() => setPanelCollapsed((collapsed) => !collapsed)}
          >
            <CollapseGlyph collapsed={panelCollapsed} />
          </button>
        ) : null}
      </div>
    </header>
  );

  return (
    <section className={`control-panel tactile-panel ${panelCollapsed ? 'is-collapsed' : ''}`}>
      {panelHeader}

      {!panelCollapsed ? (
        <div id={panelBodyId} className="tactile-panel-body">
          <p className="panel-note">{t('tactile.webHidRequirement')}</p>

          <details className="joycon-instructions" open={!anyConnected}>
            <summary>{t('tactile.instructionsTitle')}</summary>
            <ol>
              <li>{t('tactile.instructions.pairBluetooth')}</li>
              <li>{t('tactile.instructions.openParticipant')}</li>
              <li>{t('tactile.instructions.addJoyCons')}</li>
              <li>{t('tactile.instructions.selectBoth')}</li>
              <li>{t('tactile.instructions.testBoth')}</li>
              <li>{t('tactile.instructions.keepTabOpen')}</li>
            </ol>
          </details>

          {deviceStatus}

          {showDeviceActions ? (
            <div className="tactile-actions">
              {onRequestDevices ? (
                <button className="secondary-button compact-button" type="button" disabled={!webHidSupported || requestingDevices} onClick={onRequestDevices}>
                  {requestingDevices ? t('common.loading') : t('tactile.addJoyCons')}
                </button>
              ) : null}
              {onDisconnectDevices ? (
                <button className="secondary-button compact-button" type="button" disabled={!webHidSupported || !anyConnected} onClick={onDisconnectDevices}>
                  {t('tactile.disconnectJoyCons')}
                </button>
              ) : null}
              {onRefresh ? (
                <button className="secondary-button compact-button" type="button" disabled={!webHidSupported} onClick={onRefresh}>
                  {t('tactile.refreshDevices')}
                </button>
              ) : null}
              {onTestPulse ? (
                <>
                  <button className="secondary-button compact-button" type="button" disabled={!webHidSupported || !leftConnected} onClick={() => testSide('left')}>
                    {t('tactile.testLeft')}
                  </button>
                  <button className="secondary-button compact-button" type="button" disabled={!webHidSupported || !rightConnected} onClick={() => testSide('right')}>
                    {t('tactile.testRight')}
                  </button>
                  <button
                    className="secondary-button compact-button"
                    type="button"
                    disabled={!webHidSupported || !leftConnected || !rightConnected}
                    onClick={() => testSide('both')}
                  >
                    {t('tactile.testBoth')}
                  </button>
                </>
              ) : null}
            </div>
          ) : null}

          {settingsEditable ? (
            <>
              <div className="field-group">
                <label htmlFor="pulse-duration">{t('tactile.pulseDuration', { value: tactile.pulseDurationMs })}</label>
                <input
                  id="pulse-duration"
                  type="range"
                  min="40"
                  max="600"
                  step="10"
                  value={tactile.pulseDurationMs}
                  onChange={(event) => onChange?.({ ...tactile, pulseDurationMs: Number(event.target.value) })}
                />
              </div>

              <div className="field-group">
                <label>{t('tactile.intensity')}</label>
                <div className="segmented-grid three">
                  {INTENSITIES.map((nextIntensity) => (
                    <button
                      key={nextIntensity.value}
                      type="button"
                      className={intensity === nextIntensity.value ? 'is-selected' : ''}
                      onClick={() => onChange?.({ ...tactile, intensity: nextIntensity.value })}
                    >
                      {t(nextIntensity.labelKey)}
                    </button>
                  ))}
                </div>
              </div>
            </>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

function CollapseGlyph({ collapsed }: { collapsed: boolean }) {
  return (
    <span className={`collapse-glyph ${collapsed ? 'is-collapsed' : ''}`} aria-hidden="true">
      {collapsed ? '+' : '-'}
    </span>
  );
}

function JoyConStatusRow({ label, connected, battery }: { label: string; connected: boolean; battery: BatteryDisplay }) {
  const { t } = useI18n();
  const bars = Array.from({ length: BATTERY_BAR_COUNT }, (_, index) => index < battery.activeBars);

  return (
    <div className={`joycon-device-row ${connected ? 'is-connected' : 'is-disconnected'}`}>
      <strong>{label}</strong>
      <span>{connected ? t('common.connected') : t('tactile.notDetected')}</span>
      <small className={`battery-status is-${battery.tone}`} aria-label={battery.text}>
        <span className="battery-icon" aria-hidden="true">
          {bars.map((active, index) => (
            <span key={index} className={active ? 'is-active' : ''} />
          ))}
        </span>
        <span>{battery.text}</span>
      </small>
    </div>
  );
}
