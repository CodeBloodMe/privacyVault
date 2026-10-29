"""
PrivacyVault — Differential Privacy Engine (OpenDP 0.16.0)
Student Authors: KRISH (24BCE0846) & PARV (24BCE0870)
Course: BCSE302P Database Systems Lab (Slot L25+L26)

Mathematical Formalism:
- Privacy Unit: One individual patient record in the dataset.
- Neighboring Datasets D, D': differ by addition or deletion of at most one patient record.
- Pure epsilon-Differential Privacy (Laplace Mechanism):
    Pr[M(D) in S] <= exp(epsilon) * Pr[M(D') in S]
    Noise ~ Laplace(0, scale = Delta_f / epsilon)
- Approximate (epsilon, delta)-Differential Privacy (Gaussian Mechanism):
    Pr[M(D) in S] <= exp(epsilon) * Pr[M(D') in S] + delta
"""

import math
from dataclasses import dataclass
from typing import Optional
from decimal import Decimal

# Import verified OpenDP 0.16.0 core modules
import opendp.domains as dom
import opendp.metrics as met
import opendp.measurements as meas
from opendp.mod import enable_features

# Enable verified OpenDP numeric and contribution features
enable_features("idealized-numerics", "contrib")

@dataclass
class DPReleaseMetadata:
    noisy_result: float
    true_result_hidden: bool # Always True in production release payloads
    mechanism_used: str
    noise_scale: float
    sensitivity_applied: float
    epsilon_spent: float
    delta_spent: float
    author_signature: str = "REG_24BCE0846_24BCE0870_KRISH_PARV"


class DifferentialPrivacyEngine:
    """
    Authoritative Differential Privacy Engine.
    Executes calibrated perturbation over raw aggregates using OpenDP 0.16.0.
    """

    @staticmethod
    def calculate_sensitivity(
        metric: str,
        clamp_low: float,
        clamp_high: float,
        bounded_record_count: Optional[int] = None
    ) -> float:
        """
        Calculates global sensitivity Delta_f based on the metric and contribution bounds.
        - Privacy Unit: One individual patient record.
        - Neighboring datasets differ by addition or deletion of at most one patient record.
        """
        metric = metric.upper()
        if metric == "COUNT":
            # Adding or removing one record changes the count by exactly 1
            return 1.0

        elif metric == "BOUNDED_SUM":
            # Each record is clamped to [clamp_low, clamp_high].
            # Adding or removing one record changes the sum by at most max(|clamp_low|, |clamp_high|).
            return float(max(abs(clamp_low), abs(clamp_high)))

        elif metric == "BOUNDED_AVG":
            # Numerator sensitivity for bounded mean
            return float(max(abs(clamp_low), abs(clamp_high)))

        else:
            raise ValueError(f"Unsupported metric for differential privacy sensitivity: {metric}")

    @classmethod
    def apply_laplace_mechanism(
        cls,
        true_value: float,
        sensitivity: float,
        epsilon: float
    ) -> DPReleaseMetadata:
        """
        Applies pure epsilon-differential privacy via OpenDP's Laplace measurement.
        """
        if epsilon <= 0:
            raise ValueError(f"Epsilon must be strictly positive, got {epsilon}")
        if sensitivity <= 0:
            raise ValueError(f"Sensitivity must be strictly positive, got {sensitivity}")

        scale = float(sensitivity) / float(epsilon)

        # OpenDP 0.16.0 measurement construction
        input_domain = dom.atom_domain(T=float, nan=False)
        input_metric = met.absolute_distance(T=float)
        laplace_meas = meas.make_laplace(input_domain, input_metric, scale=scale)

        # Draw calibrated noise
        noisy_val = float(laplace_meas(float(true_value)))

        return DPReleaseMetadata(
            noisy_result=noisy_val,
            true_result_hidden=True,
            mechanism_used="OPENDP_LAPLACE",
            noise_scale=round(scale, 6),
            sensitivity_applied=round(sensitivity, 4),
            epsilon_spent=round(epsilon, 4),
            delta_spent=0.0
        )

    @classmethod
    def apply_gaussian_mechanism(
        cls,
        true_value: float,
        sensitivity: float,
        epsilon: float,
        delta: float
    ) -> DPReleaseMetadata:
        """
        Applies (epsilon, delta)-differential privacy via Gaussian perturbation.
        sigma = (Delta_f * sqrt(2 * ln(1.25 / delta))) / epsilon
        Valid for delta in (0, 1.0).
        """
        if epsilon <= 0:
            raise ValueError(f"Epsilon must be strictly positive, got {epsilon}")
        if delta <= 0 or delta >= 1.0:
            raise ValueError(f"Delta must satisfy 0 < delta < 1.0 for Gaussian mechanism, got {delta}")
        if sensitivity <= 0:
            raise ValueError(f"Sensitivity must be strictly positive, got {sensitivity}")

        sigma = (sensitivity * math.sqrt(2.0 * math.log(1.25 / delta))) / epsilon

        input_domain = dom.atom_domain(T=float, nan=False)
        input_metric = met.absolute_distance(T=float)
        gauss_meas = meas.make_gaussian(input_domain, input_metric, scale=sigma)

        noisy_val = float(gauss_meas(float(true_value)))

        return DPReleaseMetadata(
            noisy_result=noisy_val,
            true_result_hidden=True,
            mechanism_used="OPENDP_GAUSSIAN",
            noise_scale=round(sigma, 6),
            sensitivity_applied=round(sensitivity, 4),
            epsilon_spent=round(epsilon, 4),
            delta_spent=round(delta, 8)
        )

    @classmethod
    def apply_composite_bounded_mean(
        cls,
        true_sum: float,
        true_count: float,
        clamp_low: float,
        clamp_high: float,
        epsilon: float,
        delta: float = 0.0
    ) -> DPReleaseMetadata:
        """
        Calculates Differential Privacy Bounded Mean via Sequential Composition:
        epsilon_sum = epsilon / 2.0, epsilon_count = epsilon / 2.0
        Total privacy budget spent: epsilon (pure DP).
        Prevents leaking the exact private record count N through variable sensitivity.
        """
        if epsilon <= 0:
            raise ValueError(f"Epsilon must be strictly positive, got {epsilon}")

        eps_sum = epsilon / 2.0
        eps_cnt = epsilon / 2.0

        sens_sum = float(max(abs(clamp_low), abs(clamp_high)))
        sens_cnt = 1.0

        scale_sum = sens_sum / eps_sum
        scale_cnt = sens_cnt / eps_cnt

        input_domain = dom.atom_domain(T=float, nan=False)
        input_metric = met.absolute_distance(T=float)

        laplace_sum = meas.make_laplace(input_domain, input_metric, scale=scale_sum)
        laplace_cnt = meas.make_laplace(input_domain, input_metric, scale=scale_cnt)

        noisy_sum = float(laplace_sum(float(true_sum)))
        noisy_cnt = max(1.0, float(laplace_cnt(float(true_count))))

        # Plug-in ratio estimation clamped to valid domain bounds [clamp_low, clamp_high]
        noisy_mean = min(float(clamp_high), max(float(clamp_low), noisy_sum / noisy_cnt))

        return DPReleaseMetadata(
            noisy_result=round(noisy_mean, 4),
            true_result_hidden=True,
            mechanism_used="OPENDP_COMPOSITE_MEAN",
            noise_scale=round(scale_sum, 6),
            sensitivity_applied=round(sens_sum, 4),
            epsilon_spent=round(epsilon, 4),
            delta_spent=0.0
        )

    @classmethod
    def execute_release(
        cls,
        metric: str,
        true_aggregate: float,
        epsilon: float,
        delta: float = 0.0,
        clamp_low: float = 0.0,
        clamp_high: float = 50000.0,
        record_count: Optional[int] = None
    ) -> DPReleaseMetadata:
        """
        Unified dispatch point for differential privacy query release.
        """
        metric = metric.upper()
        if metric == "BOUNDED_AVG" and record_count is not None:
            # true_aggregate is the true bounded sum in this dispatch
            return cls.apply_composite_bounded_mean(
                true_sum=true_aggregate,
                true_count=float(record_count),
                clamp_low=clamp_low,
                clamp_high=clamp_high,
                epsilon=epsilon,
                delta=delta
            )

        sensitivity = cls.calculate_sensitivity(metric, clamp_low, clamp_high, record_count)

        if delta > 0:
            return cls.apply_gaussian_mechanism(true_aggregate, sensitivity, epsilon, delta)
        else:
            return cls.apply_laplace_mechanism(true_aggregate, sensitivity, epsilon)
