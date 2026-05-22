import type { TactileSettings } from '../domain/sessionTypes';
import type { JoyConTactileOutputStatus } from '../hooks/useJoyConTactileOutput';
import type { JoyConDeviceSummary, JoyConIntensity, JoyConSide } from '../lib/joyconTypes';
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
  onRequestDevices?: () => void;
  onRefresh?: () => void;
  onTestPulse?: (options: { side: JoyConSide; intensity: JoyConIntensity; duration: number; repeats: number }) => void;
  onNeutral?: (side: JoyConSide) => void;
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

function batteryText(device: JoyConDeviceSummary | undefined, batteryUnknown: string): string {
  const battery = device?.battery;

  if (typeof battery?.percent === 'number') {
    return `${battery.percent}%`;
  }

  if (battery?.label && battery.label !== 'Unknown') {
    return battery.label;
  }

  return batteryUnknown;
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
  onRequestDevices,
  onRefresh,
  onTestPulse,
  onNeutral,
}: TactilePanelProps) {
  const { t } = useI18n();

  const leftDevice = findDevice(devices, 'left');
  const rightDevice = findDevice(devices, 'right');
  const anyConnected = leftConnected || rightConnected;
  const tactileReady = leftConnected && rightConnected;
  const intensity = tactile.intensity ?? 'medium';
  const settingsEditable = Boolean(onChange);
  const showDeviceActions = Boolean(onRequestDevices || onRefresh || onTestPulse || onNeutral);

  const testSide = (side: JoyConSide) => {
    onTestPulse?.({ side, intensity, duration: tactile.pulseDurationMs, repeats: 1 });
  };

  return (
    <section className="control-panel">
      <header className="panel-header">
        <h2>{t('tactile.title')}</h2>
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
      </header>

      <p className="panel-note">{t('tactile.webHidRequirement')}</p>

      <div className="tactile-status-block" aria-live="polite">
        <div className="tactile-status-row">
          <strong>{t('tactile.browserJoyConAccess')}</strong>
          <ConnectionBadge
            connected={webHidSupported && tactileReady}
            label={!webHidSupported ? t('tactile.webHidUnsupported') : tactileReady ? t('tactile.joyConsReady') : t('tactile.joyConsMissing')}
          />
        </div>
        <div className="joycon-device-grid">
          <JoyConStatusRow
            label={t('tactile.leftJoyCon')}
            connected={leftConnected}
            battery={batteryText(leftDevice, t('tactile.batteryUnknown'))}
          />
          <JoyConStatusRow
            label={t('tactile.rightJoyCon')}
            connected={rightConnected}
            battery={batteryText(rightDevice, t('tactile.batteryUnknown'))}
          />
        </div>
        <div className="tactile-output-grid">
          <span>{t('tactile.lastPulse')}</span>
          <strong>{formatLastPulse(outputStatus, t)}</strong>
          <span>{t('tactile.pulseCount')}</span>
          <strong>
            {outputStatus.pulseCount}
            {outputStatus.skippedPulseCount > 0 ? ` / ${t('tactile.skippedPulseCount', { value: outputStatus.skippedPulseCount })}` : ''}
          </strong>
        </div>
        {error ? <p className="panel-note tactile-error">{error}</p> : null}
        {outputStatus.lastError ? <p className="panel-note tactile-error">{t('tactile.outputError', { error: outputStatus.lastError })}</p> : null}
      </div>

      {showDeviceActions ? (
        <div className="tactile-actions">
          {onRequestDevices ? (
            <button className="secondary-button compact-button" type="button" disabled={!webHidSupported || requestingDevices} onClick={onRequestDevices}>
              {requestingDevices ? t('common.loading') : t('tactile.addJoyCons')}
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
          {onNeutral ? (
            <button className="danger-button compact-button" type="button" disabled={!webHidSupported || !anyConnected} onClick={() => onNeutral('both')}>
              {t('tactile.stopRumble')}
            </button>
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

          <div className="field-group">
            <label htmlFor="tactile-gap">{t('tactile.internalPause', { value: tactile.gapMs })}</label>
            <input
              id="tactile-gap"
              type="range"
              min="0"
              max="300"
              step="10"
              value={tactile.gapMs}
              onChange={(event) => onChange?.({ ...tactile, gapMs: Number(event.target.value) })}
            />
          </div>
        </>
      ) : null}

      <p className="panel-note">{t('tactile.webHidNote')}</p>
    </section>
  );
}

function formatLastPulse(outputStatus: JoyConTactileOutputStatus, t: ReturnType<typeof useI18n>['t']): string {
  if (!outputStatus.lastPulseSide || outputStatus.lastPulseAt === null) {
    return t('tactile.noPulseYet');
  }

  const side = outputStatus.lastPulseSide === 'left' ? t('common.left') : t('common.right');
  const at = new Date(outputStatus.lastPulseAt).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  return t('tactile.lastPulseValue', { side, at });
}

function JoyConStatusRow({ label, connected, battery }: { label: string; connected: boolean; battery: string }) {
  const { t } = useI18n();

  return (
    <div className={`joycon-device-row ${connected ? 'is-connected' : 'is-disconnected'}`}>
      <strong>{label}</strong>
      <span>{connected ? t('common.connected') : t('tactile.notDetected')}</span>
      <small>{battery}</small>
    </div>
  );
}
