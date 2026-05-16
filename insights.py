"""
InsightEngine - Generates automated observations and recommendations
"""

import pandas as pd
import numpy as np
from scipy import stats


class InsightEngine:
    def __init__(self, df: pd.DataFrame):
        self.df = df

    def generate_insights(self) -> dict:
        observations = []
        recommendations = []
        auto_clean_suggestions = []

        df = self.df
        numeric_cols = df.select_dtypes(include=[np.number]).columns.tolist()
        cat_cols = df.select_dtypes(include=['object']).columns.tolist()

        # Missing values observations
        missing = df.isnull().sum()
        high_missing = missing[missing / len(df) > 0.3]
        if not high_missing.empty:
            cols = high_missing.index.tolist()
            observations.append({
                "type": "warning",
                "icon": "⚠️",
                "title": "High Missing Data",
                "text": f"{len(cols)} column(s) have >30% missing values: {', '.join(cols[:3])}{'...' if len(cols) > 3 else ''}"
            })
            auto_clean_suggestions.append({
                "action": "drop_high_missing_cols",
                "label": f"Drop columns with >30% missing ({len(cols)} cols)",
                "config": {"missing_threshold": 30}
            })

        low_missing = missing[(missing > 0) & (missing / len(df) <= 0.3)]
        if not low_missing.empty:
            observations.append({
                "type": "info",
                "icon": "ℹ️",
                "title": "Minor Missing Values",
                "text": f"{len(low_missing)} columns have small amounts of missing data — consider imputation."
            })
            auto_clean_suggestions.append({
                "action": "fill_missing_median",
                "label": "Fill numeric NaNs with median, categoricals with mode",
                "config": {"missing_strategy": "mode"}
            })

        # Duplicates
        dup_count = df.duplicated().sum()
        if dup_count > 0:
            observations.append({
                "type": "warning",
                "icon": "🔁",
                "title": "Duplicate Rows Found",
                "text": f"{dup_count} duplicate rows ({round(dup_count/len(df)*100,1)}% of data). Remove to avoid bias."
            })
            auto_clean_suggestions.append({
                "action": "remove_duplicates",
                "label": f"Remove {dup_count} duplicate rows",
                "config": {"remove_duplicates": True}
            })

        # Outliers
        outlier_cols = []
        for col in numeric_cols:
            series = pd.to_numeric(df[col], errors='coerce').dropna()
            if len(series) < 4:
                continue
            Q1, Q3 = series.quantile(0.25), series.quantile(0.75)
            IQR = Q3 - Q1
            outliers = ((series < Q1 - 1.5 * IQR) | (series > Q3 + 1.5 * IQR)).sum()
            if outliers / len(series) > 0.05:
                outlier_cols.append((col, int(outliers)))

        if outlier_cols:
            observations.append({
                "type": "warning",
                "icon": "📊",
                "title": "Outliers Detected",
                "text": f"Significant outliers in: {', '.join(c for c,_ in outlier_cols[:3])}. Consider capping or removal."
            })
            auto_clean_suggestions.append({
                "action": "cap_outliers",
                "label": "Cap outliers using IQR method",
                "config": {"handle_outliers": "cap", "outlier_method": "iqr"}
            })

        # Skewness
        for col in numeric_cols:
            skew = df[col].skew()
            if abs(skew) > 2:
                observations.append({
                    "type": "info",
                    "icon": "📈",
                    "title": f"Skewed Distribution: {col}",
                    "text": f"'{col}' is {'positively' if skew > 0 else 'negatively'} skewed (skew={round(skew,2)}). Consider log transformation."
                })

        # High-cardinality categoricals
        for col in cat_cols:
            unique_pct = df[col].nunique() / len(df) * 100
            if unique_pct > 90 and df[col].nunique() > 50:
                observations.append({
                    "type": "info",
                    "icon": "🏷️",
                    "title": f"High Cardinality: {col}",
                    "text": f"'{col}' has {df[col].nunique()} unique values ({round(unique_pct,1)}%). Might be an ID column."
                })

        # String inconsistency
        for col in cat_cols:
            sample = df[col].dropna().astype(str)
            has_mixed_case = sample.str.lower().nunique() < sample.nunique()
            if has_mixed_case:
                observations.append({
                    "type": "info",
                    "icon": "🔤",
                    "title": f"Case Inconsistency: {col}",
                    "text": f"'{col}' has mixed casing. Standardizing will reduce noise."
                })
                auto_clean_suggestions.append({
                    "action": "standardize_strings",
                    "label": "Standardize string casing and whitespace",
                    "config": {"standardize_strings": True, "string_case": "title"}
                })
                break  # Only suggest once

        # Strong correlations
        correlations = []
        if len(numeric_cols) >= 2:
            corr = df[numeric_cols].corr()
            for i, c1 in enumerate(numeric_cols):
                for j, c2 in enumerate(numeric_cols):
                    if j <= i:
                        continue
                    v = corr.loc[c1, c2]
                    if abs(v) > 0.8 and not np.isnan(v):
                        correlations.append((c1, c2, round(float(v), 3)))

        if correlations:
            for c1, c2, v in correlations[:3]:
                observations.append({
                    "type": "success",
                    "icon": "🔗",
                    "title": "Strong Correlation",
                    "text": f"'{c1}' and '{c2}' have a {'positive' if v > 0 else 'negative'} correlation of {v}."
                })

        # Positive notes
        if dup_count == 0:
            observations.append({
                "type": "success",
                "icon": "✅",
                "title": "No Duplicates",
                "text": "Dataset has no duplicate rows. Great!"
            })

        if missing.sum() == 0:
            observations.append({
                "type": "success",
                "icon": "✅",
                "title": "No Missing Values",
                "text": "Dataset is complete — no missing values detected."
            })

        # Recommendations
        recommendations = self._generate_recommendations(df, numeric_cols, cat_cols)

        return {
            "observations": observations,
            "recommendations": recommendations,
            "auto_clean_suggestions": list({v["action"]: v for v in auto_clean_suggestions}.values()),
        }

    def _generate_recommendations(self, df, numeric_cols, cat_cols):
        recs = []
        if len(numeric_cols) > 0:
            recs.append("Normalize numeric columns before ML training (StandardScaler / MinMaxScaler).")
        if len(cat_cols) > 0:
            recs.append("Encode categorical columns (One-Hot or Label Encoding) for modeling.")
        if df.isnull().sum().sum() > 0:
            recs.append("Handle missing values before running statistical models to avoid biased results.")
        if df.shape[0] > 10000:
            recs.append("Large dataset detected — consider sampling for exploratory analysis.")
        if df.select_dtypes(include=['datetime64']).shape[1] > 0:
            recs.append("Datetime columns detected — consider extracting year/month/day as features.")
        return recs
