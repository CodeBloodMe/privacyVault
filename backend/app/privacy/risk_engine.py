"""
PrivacyVault — Query-History-Aware Risk Analysis Engine
Student Authors: KRISH (24BCE0846) & PARV (24BCE0870)
Course: BCSE302P Database Systems Lab (Slot L25+L26)

Core Mission:
Provides deterministic, explainable risk detection against:
1. Differencing Attacks: Reconstructing individual microdata via narrow predicate differences (Q1 - Q2).
2. Noise Averaging Attacks: Repeated identical queries designed to cancel Laplace noise.
"""

from typing import Optional, Any
from dataclasses import dataclass
from datetime import datetime, timezone
from backend.app.schemas.query import AggregateQueryRequest, FilterCriterion

@dataclass
class RiskEvaluationResult:
    risk_level: str # 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL'
    is_blocked: bool
    risk_summary: str
    differencing_detected: bool
    overlapping_prior_query_id: Optional[str] = None
    recommended_action: Optional[str] = None
    author_signature: str = "REG_24BCE0846_24BCE0870_KRISH_PARV"


class QueryHistoryRiskEngine:
    """
    Deterministic query-history analyzer evaluating disclosures across sequential aggregates.
    """

    @classmethod
    def normalize_filters(cls, filters: list[FilterCriterion]) -> dict[str, tuple[str, str]]:
        """Transforms filter criteria into a normalized canonical dictionary."""
        normalized = {}
        for f in filters:
            # key: column name, value: (operator, str(value))
            val_str = str(f.value).strip().lower()
            normalized[f.column.lower()] = (f.operator.value, val_str)
        return normalized

    @classmethod
    def evaluate_risk(
        cls,
        candidate_request: AggregateQueryRequest,
        prior_releases: list[dict[str, Any]]
    ) -> RiskEvaluationResult:
        """
        Analyzes a candidate query against the analyst's prior released queries on this grant.
        """
        cand_metric = candidate_request.metric.value
        cand_col = (candidate_request.target_column or "").lower()
        cand_filters = cls.normalize_filters(candidate_request.filters)

        # 1. Check for Exact Repeated Query (Noise Averaging Attack)
        identical_count = 0
        for prior in prior_releases:
            p_metric = prior.get("metric")
            p_col = (prior.get("target_column") or "").lower()
            p_filters = {
                f["column"].lower(): (f["operator"], str(f["value"]).strip().lower())
                for f in prior.get("filter_criteria", [])
            }

            if p_metric == cand_metric and p_col == cand_col and p_filters == cand_filters:
                identical_count += 1
                if identical_count >= 2:
                    return RiskEvaluationResult(
                        risk_level="HIGH",
                        is_blocked=False, # Allowed with warning & budget deduction
                        risk_summary=(
                            f"Repetition Risk: This aggregate query has been executed {identical_count} times previously. "
                            "Repeated execution under independent Laplace noise allows reconstruction via sample averaging."
                        ),
                        differencing_detected=False,
                        overlapping_prior_query_id=str(prior.get("id")),
                        recommended_action="Use previously released aggregate value or submit query with altered grouping."
                    )

        # 2. Check for Differencing Attack (Single Predicate Narrowing / Exclusion)
        for prior in prior_releases:
            p_filters = {
                f["column"].lower(): (f["operator"], str(f["value"]).strip().lower())
                for f in prior.get("filter_criteria", [])
            }
            p_id = str(prior.get("id"))
            p_target = (prior.get("target_column") or "").lower()

            # Analyze filter key symmetric difference
            cand_keys = set(cand_filters.keys())
            prior_keys = set(p_filters.keys())

            # Case A: Same filters except Candidate has 1 extra restrictive predicate isolating an individual
            # e.g., Prior = {diagnosis: Z99}, Candidate = {diagnosis: Z99, mrn: MRN-TARGET-9999}
            if cand_keys.issuperset(prior_keys) and len(cand_keys - prior_keys) == 1:
                diff_col = list(cand_keys - prior_keys)[0]
                # Direct identifiers always isolate single records; categorical attributes require a non-empty shared base cohort
                is_differencing = (diff_col in ["mrn", "patient_id"]) or (len(prior_keys) >= 1 and diff_col in ["admission_type", "gender", "age"])
                if is_differencing:
                    # Check if base filters match
                    shared_match = all(cand_filters[k] == p_filters[k] for k in prior_keys)
                    if shared_match:
                        return RiskEvaluationResult(
                            risk_level="CRITICAL",
                            is_blocked=True,
                            risk_summary=(
                                f"DIFFERENCING DISCLOSURE DETECTED: Candidate query restricts Prior Query [{p_id}] "
                                f"by narrow attribute '{diff_col}'. Computing the difference between these two aggregates "
                                f"isolates individual record attributes."
                            ),
                            differencing_detected=True,
                            overlapping_prior_query_id=p_id,
                            recommended_action="Broaden the filter criteria or remove single-individual exclusion predicates."
                        )

            # Case B: Prior has 1 extra restrictive predicate and Candidate removes it
            # e.g., Candidate = {diagnosis: Z99}, Prior = {diagnosis: Z99, admission_type: EMERGENCY}
            elif prior_keys.issuperset(cand_keys) and len(prior_keys - cand_keys) == 1:
                diff_col = list(prior_keys - cand_keys)[0]
                shared_match = all(cand_filters[k] == p_filters[k] for k in cand_keys)
                # Differencing disclosure occurs if diff_col is an identifier, OR if candidate still retains a shared base cohort
                is_differencing = (diff_col in ["mrn", "patient_id"]) or (len(cand_keys) >= 1 and diff_col in ["admission_type", "gender", "age"])
                if shared_match and is_differencing:
                    return RiskEvaluationResult(
                        risk_level="CRITICAL",
                        is_blocked=True,
                        risk_summary=(
                            f"DIFFERENCING DISCLOSURE DETECTED: Candidate query broadens Prior Query [{p_id}] "
                            f"by removing filter on '{diff_col}'. Differencing releases isolates the complementary subset."
                        ),
                        differencing_detected=True,
                        overlapping_prior_query_id=p_id,
                        recommended_action="Maintain consistent filter cohorts across sequential research queries."
                    )

            # Case C: Same filter columns, but value shifted by narrow interval (e.g. age > 80 vs age >= 80)
            elif cand_keys == prior_keys and len(cand_keys) > 0:
                differing_cols = [k for k in cand_keys if cand_filters[k] != p_filters[k]]
                if len(differing_cols) == 1:
                    d_col = differing_cols[0]
                    c_op, c_val = cand_filters[d_col]
                    p_op, p_val = p_filters[d_col]
                    # Check if operators are comparison and values are adjacent numbers
                    try:
                        if abs(float(c_val) - float(p_val)) <= 1.0:
                            return RiskEvaluationResult(
                                risk_level="HIGH",
                                is_blocked=False,
                                risk_summary=(
                                    f"Narrow Predicate Shift: Query differs from Prior Query [{p_id}] on '{d_col}' "
                                    f"by boundary shift ({c_val} vs {p_val}). High risk of boundary record identification."
                                ),
                                differencing_detected=True,
                                overlapping_prior_query_id=p_id,
                                recommended_action="Avoid querying adjacent boundary thresholds sequentially."
                            )
                    except ValueError:
                        pass

        # 3. Default: Compliant query
        return RiskEvaluationResult(
            risk_level="LOW",
            is_blocked=False,
            risk_summary="Query complies with historical overlap boundaries and differential privacy composition constraints.",
            differencing_detected=False,
            overlapping_prior_query_id=None,
            recommended_action=None
        )
