import React from 'react';
import { AlertTriangle, ArrowRight, Database, Info, ShieldCheck } from 'lucide-react';

interface LaplaceVisualizerProps {
  noisyResult: number;
  noiseScale: number;
  epsilonSpent: number;
  sensitivity: number;
  mechanism: string;
  metric: string;
}

const formatNumber = (value: number, maximumFractionDigits = 2) =>
  value.toLocaleString(undefined, { maximumFractionDigits });

export const LaplaceVisualizer: React.FC<LaplaceVisualizerProps> = ({
  noisyResult,
  noiseScale,
  epsilonSpent,
  sensitivity,
  mechanism,
  metric
}) => {
  const isLaplaceRelease = mechanism === 'OPENDP_LAPLACE';
  const canDrawDistribution = isLaplaceRelease && Number.isFinite(noiseScale) && noiseScale > 0;
  const calculatedLaplaceScale = epsilonSpent > 0 ? sensitivity / epsilonSpent : null;
  const width = 520;
  const height = 250;
  const left = 66;
  const right = 18;
  const top = 26;
  const bottom = 54;
  const plotWidth = width - left - right;
  const plotHeight = height - top - bottom;
  const maxDensity = canDrawDistribution ? 1 / (2 * noiseScale) : 0;
  const points = canDrawDistribution
    ? Array.from({ length: 81 }, (_, index) => {
        const noise = ((index / 80) * 8 - 4) * noiseScale;
        const density = Math.exp(-Math.abs(noise) / noiseScale) / (2 * noiseScale);
        return {
          x: left + (index / 80) * plotWidth,
          y: top + plotHeight * (1 - density / maxDensity)
        };
      })
    : [];
  const curvePath = points
    .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`)
    .join(' ');
  const areaPath = points.length
    ? `${curvePath} L ${left + plotWidth} ${top + plotHeight} L ${left} ${top + plotHeight} Z`
    : '';
  const zeroX = left + plotWidth / 2;

  return (
    <section className="dp-visualization" aria-label="Differential privacy explanation">
      <div className="dp-flow">
        <article className="dp-step">
          <div className="dp-step-heading">
            <span className="dp-step-number">1</span>
            <h4>Aggregate</h4>
          </div>
          <div className="dp-step-icon"><Database size={19} aria-hidden="true" /></div>
          <strong className="dp-undisclosed">Original value (not disclosed)</strong>
          <p>Statistic calculated from eligible records before privacy noise is applied.</p>
        </article>

        <ArrowRight className="dp-flow-arrow" size={20} aria-hidden="true" />

        <article className="dp-step">
          <div className="dp-step-heading">
            <span className="dp-step-number">2</span>
            <h4>Add Privacy Noise</h4>
          </div>
          <div className="dp-step-icon dp-shield"><ShieldCheck size={20} aria-hidden="true" /></div>
          <strong className="dp-mechanism">{mechanism}</strong>
          <p>Differential privacy adds mathematically calibrated random noise to reduce the risk of revealing information about an individual.</p>
          <div className="dp-noise-illustration" aria-label="Illustration of random noise that may be negative or positive">
            <span>−</span><i aria-hidden="true" /><span>0</span><i aria-hidden="true" /><span>+</span>
          </div>
          <span className="dp-illustration-caption">Illustration only; noise can be positive or negative.</span>
        </article>

        <ArrowRight className="dp-flow-arrow" size={20} aria-hidden="true" />

        <article className="dp-step dp-result-step">
          <div className="dp-step-heading">
            <span className="dp-step-number">3</span>
            <h4>Released private result</h4>
          </div>
          <output className="dp-result-value" aria-label={`Released differentially private result: ${formatNumber(noisyResult)}`}>
            {formatNumber(noisyResult)}
          </output>
          {metric === 'COUNT' && noisyResult < 0 && (
            <p className="dp-negative-count-warning" role="status">
              <AlertTriangle size={15} aria-hidden="true" />
              <span>
                This noisy COUNT estimate is negative. Differential privacy noise can produce negative numerical estimates, even though actual counts cannot be negative. The released value is shown unchanged.
              </span>
            </p>
          )}
          <p className="dp-result-caption">A privacy-protected statistical result, not necessarily the exact database value.</p>
          <div className="dp-release-metadata">
            <div>
              <span>Epsilon spent</span>
              <strong>{formatNumber(epsilonSpent, 4)} ε</strong>
              <details className="dp-epsilon-info">
                <summary aria-label="Explain epsilon"><Info size={14} /></summary>
                <span role="tooltip">Epsilon (ε) controls the privacy-accuracy trade-off. A lower epsilon generally provides a stronger differential privacy guarantee but introduces more noise, assuming the same query sensitivity and mechanism.</span>
              </details>
            </div>
            <div>
              <span title="The scale describes the spread of the mechanism's noise; larger values mean more spread.">Noise scale · noise spread</span>
              <strong>{formatNumber(noiseScale, 6)}</strong>
            </div>
            <div>
              <span title="Sensitivity measures how much the aggregate can change when one person's data changes.">Sensitivity · one-record impact</span>
              <strong>{formatNumber(sensitivity, 6)}</strong>
            </div>
          </div>
        </article>
      </div>

      <details className="dp-noise-details">
        <summary>How does the noise work?</summary>
        <div className="dp-graph-content">
          <p className="dp-graph-explanation">
            Noise values closer to zero have higher probability density; larger positive or negative deviations are less likely.
          </p>
          {canDrawDistribution ? (
            <svg
              className="dp-distribution-graph"
              viewBox={`0 0 ${width} ${height}`}
              role="img"
              aria-labelledby="dp-graph-title dp-graph-description"
            >
              <title id="dp-graph-title">Laplace noise probability density</title>
              <desc id="dp-graph-description">
                A symmetric Laplace distribution centered on zero noise. The probability density decreases as noise moves farther in either direction from zero.
              </desc>
              <line x1={left} y1={top} x2={left} y2={top + plotHeight} stroke="#64748b" />
              <line x1={left} y1={top + plotHeight} x2={left + plotWidth} y2={top + plotHeight} stroke="#64748b" />
              <path d={areaPath} fill="#dbeafe" />
              <path d={curvePath} fill="none" stroke="#1e40af" strokeWidth="3" />
              <line x1={zeroX} y1={top} x2={zeroX} y2={top + plotHeight} stroke="#64748b" strokeDasharray="4 4" />
              <text x={left - 8} y={top + 5} textAnchor="end" className="dp-axis-tick">{formatNumber(maxDensity, 5)}</text>
              <text x={left - 8} y={top + plotHeight} textAnchor="end" className="dp-axis-tick">0</text>
              <text x={left} y={top + plotHeight + 18} textAnchor="middle" className="dp-axis-tick">{formatNumber(-4 * noiseScale, 4)}</text>
              <text x={zeroX} y={top + plotHeight + 18} textAnchor="middle" className="dp-axis-tick">0</text>
              <text x={left + plotWidth} y={top + plotHeight + 18} textAnchor="middle" className="dp-axis-tick">{formatNumber(4 * noiseScale, 4)}</text>
              <text x={zeroX} y={top + 15} textAnchor="middle" className="dp-zero-label">Zero noise</text>
              <text x={left + plotWidth / 2} y={height - 5} textAnchor="middle" className="dp-axis-title">Noise value</text>
              <text
                x="17"
                y={top + plotHeight / 2}
                textAnchor="middle"
                className="dp-axis-title"
                transform={`rotate(-90 17 ${top + plotHeight / 2})`}
              >
                Probability density
              </text>
            </svg>
          ) : (
            <p className="dp-graph-unavailable">
              {isLaplaceRelease
                ? 'The backend did not return a positive noise scale, so a distribution graph cannot be shown.'
                : `A single Laplace curve would not accurately represent the ${mechanism} mechanism.`}
            </p>
          )}
          <p className="dp-scale-note">
            {isLaplaceRelease && calculatedLaplaceScale !== null
              ? `For this release, returned sensitivity ÷ epsilon is ${formatNumber(sensitivity, 4)} ÷ ${formatNumber(epsilonSpent, 4)} = ${formatNumber(calculatedLaplaceScale, 6)}. The plotted scale is the backend-reported value: ${formatNumber(noiseScale, 6)}.`
              : `The backend-reported noise scale is ${formatNumber(noiseScale, 6)}. Scale depends on the mechanism's sensitivity and epsilon configuration.`}
          </p>
        </div>
      </details>
    </section>
  );
};
