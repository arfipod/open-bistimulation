import { useEffect, useId, useState } from 'react';
import { BACKGROUND_COLORS, VISUAL_COLORS } from '../domain/defaults';
import type { MotionOrder, VisualDirection, VisualSettings, VerticalPosition } from '../domain/sessionTypes';
import { VISUAL_STIMULI } from '../domain/visualStimuli';
import { useI18n } from '../lib/i18n';

interface VisualPanelProps {
  visual: VisualSettings;
  onChange: (next: VisualSettings) => void;
  panelCollapsible?: boolean;
  defaultPanelCollapsed?: boolean;
  autoCollapse?: boolean;
}

type DirectionLabelKey =
  | 'visual.horizontal'
  | 'visual.vertical'
  | 'visual.diagonalDown'
  | 'visual.diagonalUp'
  | 'visual.infinity';

type MotionOrderLabelKey = 'visual.leftToRight' | 'visual.rightToLeft' | 'visual.randomOrder';
type DirectionIconName = 'horizontal' | 'vertical' | 'diagonal-down' | 'diagonal-up' | 'infinity';

const directions: Array<{ value: VisualDirection; labelKey: DirectionLabelKey; icon: DirectionIconName }> = [
  { value: 'horizontal', labelKey: 'visual.horizontal', icon: 'horizontal' },
  { value: 'diagonal-down', labelKey: 'visual.diagonalDown', icon: 'diagonal-down' },
  { value: 'diagonal-up', labelKey: 'visual.diagonalUp', icon: 'diagonal-up' },
  { value: 'vertical', labelKey: 'visual.vertical', icon: 'vertical' },
  { value: 'infinity', labelKey: 'visual.infinity', icon: 'infinity' },
];

const motionOrders: Array<{ value: MotionOrder; labelKey: MotionOrderLabelKey }> = [
  { value: 'left-to-right', labelKey: 'visual.leftToRight' },
  { value: 'right-to-left', labelKey: 'visual.rightToLeft' },
  { value: 'random', labelKey: 'visual.randomOrder' },
];

const positions: Array<{ value: VerticalPosition; labelKey: 'visual.top' | 'visual.center' | 'visual.bottom' }> = [
  { value: 'top', labelKey: 'visual.top' },
  { value: 'center', labelKey: 'visual.center' },
  { value: 'bottom', labelKey: 'visual.bottom' },
];

export function VisualPanel({
  visual,
  onChange,
  panelCollapsible = false,
  defaultPanelCollapsed = false,
  autoCollapse = false,
}: VisualPanelProps) {
  const { t } = useI18n();
  const panelBodyId = useId();
  const selectedDirection = visual.direction === 'diagonal' ? 'diagonal-down' : visual.direction;
  const selectedMotionOrder = visual.motionOrder ?? 'left-to-right';
  const selectedStimulus = visual.stimulus ?? 'dot';
  const canAlternateStimulusSides = selectedStimulus !== 'dot';
  const stimulusAlternatesSides = visual.stimulusAlternatesSides ?? true;
  const [panelCollapsed, setPanelCollapsed] = useState(Boolean(panelCollapsible && (defaultPanelCollapsed || autoCollapse)));

  useEffect(() => {
    if (panelCollapsible) {
      setPanelCollapsed(Boolean(defaultPanelCollapsed || autoCollapse));
    }
  }, [autoCollapse, defaultPanelCollapsed, panelCollapsible]);

  return (
    <section className={`control-panel ${panelCollapsed ? 'is-collapsed' : ''}`}>
      <header className="panel-header">
        <h2>{t('visual.title')}</h2>
        <div className="panel-header-actions">
          <label className="switch">
            <input
              type="checkbox"
              checked={visual.enabled}
              onChange={(event) => onChange({ ...visual, enabled: event.target.checked })}
            />
            <span />
          </label>
          {panelCollapsible ? (
            <button
              className="collapse-toggle-button"
              type="button"
              aria-expanded={!panelCollapsed}
              aria-controls={panelBodyId}
              aria-label={panelCollapsed ? t('common.expandPanel') : t('common.collapsePanel')}
              onClick={() => setPanelCollapsed((collapsed) => !collapsed)}
            >
              <CollapseGlyph collapsed={panelCollapsed} />
            </button>
          ) : null}
        </div>
      </header>

      {!panelCollapsed ? (
        <div id={panelBodyId} className="panel-body">

      <div className="field-group">
        <label>{t('visual.color')}</label>
        <div className="swatch-row">
          {VISUAL_COLORS.map((color) => (
            <button
              key={color}
              className={`swatch ${visual.color === color ? 'is-selected' : ''}`}
              style={{ backgroundColor: color }}
              type="button"
              aria-label={t('visual.colorAria', { color })}
              onClick={() => onChange({ ...visual, color })}
            />
          ))}
          <input
            className="color-input"
            type="color"
            value={visual.color}
            onChange={(event) => onChange({ ...visual, color: event.target.value })}
          />
        </div>
      </div>

      <div className="field-group">
        <label>{t('visual.background')}</label>
        <div className="swatch-row">
          {BACKGROUND_COLORS.map((background) => (
            <button
              key={background}
              className={`swatch ${visual.background === background ? 'is-selected' : ''}`}
              style={{ backgroundColor: background }}
              type="button"
              aria-label={t('visual.backgroundAria', { color: background })}
              onClick={() => onChange({ ...visual, background })}
            />
          ))}
          <input
            className="color-input"
            type="color"
            value={visual.background}
            onChange={(event) => onChange({ ...visual, background: event.target.value })}
          />
        </div>
      </div>

      <div className="field-group">
        <label>{t('visual.stimulus')}</label>
        <div className="stimulus-grid">
          {VISUAL_STIMULI.map((stimulus) => (
            <button
              key={stimulus.value}
              type="button"
              className={`stimulus-option ${selectedStimulus === stimulus.value ? 'is-selected' : ''}`}
              aria-label={`${t('visual.stimulus')}: ${t(stimulus.labelKey)}`}
              onClick={() => onChange({ ...visual, stimulus: stimulus.value })}
            >
              <span aria-hidden="true">{stimulus.preview}</span>
              <small>{t(stimulus.labelKey)}</small>
            </button>
          ))}
        </div>
        <p className="panel-note compact-note">{t('visual.stimulusHint')}</p>
        {canAlternateStimulusSides ? (
          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={stimulusAlternatesSides}
              onChange={(event) => onChange({ ...visual, stimulusAlternatesSides: event.target.checked })}
            />
            {t('visual.stimulusAlternateSides')}
          </label>
        ) : null}
      </div>

      <div className="field-group">
        <label htmlFor="speed">{t('visual.speed', { value: visual.speed })}</label>
        <input
          id="speed"
          type="range"
          min="1"
          max="20"
          step="0.5"
          value={visual.speed}
          onChange={(event) => onChange({ ...visual, speed: Number(event.target.value) })}
        />
      </div>

      <div className="field-group">
        <label>{t('visual.direction')}</label>
        <div className="direction-grid">
          {directions.map((direction) => (
            <button
              key={direction.value}
              type="button"
              className={selectedDirection === direction.value ? 'is-selected' : ''}
              title={t(direction.labelKey)}
              aria-label={t(direction.labelKey)}
              onClick={() => onChange({ ...visual, direction: direction.value })}
            >
              <DirectionIcon name={direction.icon} />
              <span className="sr-only">{t(direction.labelKey)}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="field-group">
        <label>{t('visual.motionOrder')}</label>
        <div className="segmented-grid three">
          {motionOrders.map((motionOrder) => (
            <button
              key={motionOrder.value}
              type="button"
              className={selectedMotionOrder === motionOrder.value ? 'is-selected' : ''}
              onClick={() => onChange({ ...visual, motionOrder: motionOrder.value })}
            >
              {t(motionOrder.labelKey)}
            </button>
          ))}
        </div>
      </div>

      <div className="field-group">
        <label>{t('visual.position')}</label>
        <div className="segmented-grid three">
          {positions.map((position) => (
            <button
              key={position.value}
              type="button"
              className={visual.verticalPosition === position.value ? 'is-selected' : ''}
              onClick={() => onChange({ ...visual, verticalPosition: position.value })}
            >
              {t(position.labelKey)}
            </button>
          ))}
        </div>
      </div>

      <div className="field-group">
        <label htmlFor="dot-size">{t('visual.size', { value: visual.dotSize })}</label>
        <input
          id="dot-size"
          type="range"
          min="20"
          max="100"
          step="2"
          value={visual.dotSize}
          onChange={(event) => onChange({ ...visual, dotSize: Number(event.target.value) })}
        />
      </div>
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

function DirectionIcon({ name }: { name: DirectionIconName }) {
  if (name === 'horizontal') {
    return (
      <svg className="direction-icon horizontal" viewBox="0 0 42 20" fill="none" aria-hidden="true">
        <path
          fill="currentColor"
          fillRule="evenodd"
          clipRule="evenodd"
          d="M0.788024 11.7818C0.254948 11.2485 0 10.6909 0 10.0121C0 9.30909 0.278126 8.75152 0.788024 8.21818L8.25108 0.606061C8.6451 0.19394 9.08547 0 9.6649 0C10.731 0 11.5191 0.872728 11.5191 2.01212C11.5191 2.59394 11.2873 3.12727 10.8933 3.49091L8.27426 6.06061L6.13067 7.80606H10.337H14.6472C14.7498 7.79007 14.8554 7.78182 14.9637 7.78182H31.6629H35.8692L33.7025 6.03636L31.1066 3.46667C30.7358 3.10303 30.4808 2.5697 30.4808 1.98788C30.4808 0.848485 31.2689 0 32.335 0C32.9144 0 33.3548 0.169697 33.7488 0.581818L41.2119 8.21818C41.7449 8.75152 41.9999 9.30909 41.9999 9.98788C41.9999 10.6909 41.7218 11.2485 41.2119 11.7818L33.7488 19.3939C33.3548 19.8061 32.9144 20 32.335 20C31.2689 20 30.4808 19.1273 30.4808 17.9879C30.4808 17.4061 30.7126 16.8727 31.1066 16.5091L33.7256 13.9394L35.8692 12.1939H31.6629H27.3527C27.2501 12.2099 27.1445 12.2182 27.0362 12.2182H10.337H6.13067L8.29744 13.9636L10.8933 16.5333C11.2641 16.897 11.5191 17.4303 11.5191 18.0121C11.5191 19.1515 10.731 20 9.6649 20C9.08547 20 8.6451 19.8303 8.25108 19.4182L0.788024 11.7818Z"
        />
      </svg>
    );
  }

  if (name === 'diagonal-down') {
    return (
      <svg className="direction-icon diagonal" viewBox="0 0 36 32" fill="none" aria-hidden="true">
        <path
          fill="currentColor"
          fillRule="evenodd"
          clipRule="evenodd"
          d="M0.42143 5.86652C0.290667 5.12388 0.401638 4.52091 0.790974 3.96488C1.19422 3.38899 1.74186 3.09178 2.46545 2.94736L12.945 0.992512C13.5041 0.880919 13.9761 0.974637 14.4507 1.30698C15.3241 1.9185 15.469 3.08539 14.8155 4.01873C14.4817 4.49533 13.986 4.79927 13.4546 4.87115L9.83535 5.47391L7.07827 5.67418L10.5239 8.08686L14.0546 10.5591C14.1478 10.6048 14.2391 10.6586 14.3278 10.7207L28.0069 20.299L31.4526 22.7117L30.6788 20.0391L30.0263 16.4452C29.9311 15.9346 30.0282 15.3515 30.3619 14.8749C31.0154 13.9415 32.1476 13.6985 33.021 14.31C33.4956 14.6424 33.759 15.034 33.8454 15.5976L35.5787 26.1335C35.7095 26.8762 35.5985 27.4791 35.2092 28.0352C34.8059 28.6111 34.2583 28.9083 33.5347 29.0527L23.0552 31.0075C22.4961 31.1191 22.0241 31.0254 21.5494 30.6931C20.6761 30.0815 20.5312 28.9147 21.1847 27.9813C21.5184 27.5047 22.0142 27.2008 22.5455 27.1289L26.1648 26.5261L28.9219 26.3259L25.4762 23.9132L21.9455 21.441C21.8524 21.3952 21.7611 21.3414 21.6724 21.2793L7.99323 11.7011L4.54758 9.28838L5.32134 11.961L5.97382 15.5549C6.06902 16.0655 5.97195 16.6486 5.63823 17.1252C4.9847 18.0585 3.85252 18.3015 2.97918 17.69C2.50454 17.3577 2.24115 16.9661 2.15477 16.4025L0.42143 5.86652Z"
        />
      </svg>
    );
  }

  if (name === 'diagonal-up') {
    return (
      <svg className="direction-icon diagonal" viewBox="0 0 36 32" fill="none" aria-hidden="true">
        <path
          fill="currentColor"
          fillRule="evenodd"
          clipRule="evenodd"
          d="M2.4653 29.0526C1.72272 28.9215 1.19407 28.611 0.804729 28.055C0.401487 27.4791 0.309502 26.8628 0.421279 26.1335L2.16853 15.6173C2.2549 15.0538 2.50439 14.6423 2.97903 14.31C3.85237 13.6984 4.99846 13.9613 5.65199 14.8947C5.98571 15.3713 6.10176 15.9411 5.98757 16.465L5.31611 20.0722L4.56133 22.7315L8.00699 20.3188L11.5377 17.8466C11.6125 17.7746 11.6943 17.7073 11.783 17.6452L25.4622 8.06694L28.9078 5.65426L26.1318 5.46728L22.5315 4.85122C22.0191 4.76605 21.5044 4.47541 21.1706 3.99881C20.5171 3.06547 20.676 1.91844 21.5493 1.30692C22.0239 0.974572 22.482 0.860995 23.0411 0.972588L33.5346 2.9473C34.2771 3.07842 34.8058 3.38892 35.1951 3.94495C35.5984 4.52084 35.6904 5.13711 35.5786 5.86646L33.8313 16.3826C33.745 16.9462 33.4955 17.3576 33.0208 17.69C32.1475 18.3015 31.0014 18.0386 30.3479 17.1052C30.0141 16.6286 29.8981 16.0588 30.0123 15.535L30.6837 11.9278L31.4385 9.26846L27.9929 11.6811L24.4622 14.1534C24.3873 14.2253 24.3055 14.2926 24.2168 14.3547L10.5377 23.933L7.09202 26.3457L9.86809 26.5326L13.4684 27.1487C13.9807 27.2339 14.4955 27.5245 14.8292 28.0011C15.4827 28.9345 15.3239 30.0815 14.4506 30.693C13.9759 31.0253 13.5179 31.1389 12.9587 31.0273L2.4653 29.0526Z"
        />
      </svg>
    );
  }

  if (name === 'vertical') {
    return (
      <svg className="direction-icon vertical" viewBox="0 0 20 35" fill="none" aria-hidden="true">
        <path
          fill="currentColor"
          fillRule="evenodd"
          clipRule="evenodd"
          d="M11.7818 34.212C11.2485 34.7451 10.6909 35 10.0121 35C9.30909 35 8.75152 34.7219 8.21818 34.212L0.606061 26.7489C0.19394 26.3549 0 25.9145 0 25.3351C0 24.269 0.872728 23.4809 2.01212 23.4809C2.59394 23.4809 3.12727 23.7127 3.49091 24.1067L6.06061 26.7257L7.80606 28.8693L7.80606 27.3528C7.79007 27.2502 7.78182 27.1446 7.78182 27.0363L7.78182 10.3371V6.13077L6.03636 8.29754L3.46667 10.8934C3.10303 11.2642 2.5697 11.5192 1.98788 11.5192C0.848485 11.5192 0 10.7311 0 9.665C0 9.08557 0.169697 8.6452 0.581818 8.25119L8.21818 0.788128C8.75152 0.255051 9.30909 0.000102997 9.98788 0.000102997C10.6909 0.000102997 11.2485 0.278229 11.7818 0.788128L19.3939 8.25119C19.8061 8.6452 20 9.08557 20 9.665C20 10.7311 19.1273 11.5192 17.9879 11.5192C17.4061 11.5192 16.8727 11.2874 16.5091 10.8934L13.9394 8.27436L12.1939 6.13077V7.64732C12.2099 7.74988 12.2182 7.85552 12.2182 7.96379L12.2182 24.663V28.8693L13.9636 26.7026L16.5333 24.1067C16.897 23.7359 17.4303 23.4809 18.0121 23.4809C19.1515 23.4809 20 24.269 20 25.3351C20 25.9145 19.8303 26.3549 19.4182 26.7489L11.7818 34.212Z"
        />
      </svg>
    );
  }

  return (
    <svg className="direction-icon infinity" viewBox="0 0 256 256" fill="none" aria-hidden="true">
      <path
        fill="currentColor"
        d="M252 128a60 60 0 0 1-102.43 42.43l-.49-.53l-59.86-67.59a36 36 0 1 0 0 51.38l3.08-3.48a12 12 0 1 1 18 15.91l-3.35 3.78l-.49.53a60 60 0 1 1 0-84.86l.49.53l59.86 67.59a36 36 0 1 0 0-51.38l-3.08 3.48a12 12 0 1 1-18-15.91l3.35-3.78l.49-.53A60 60 0 0 1 252 128"
      />
    </svg>
  );
}
