"""
DataAnalyzer - Profiling and analysis of datasets
"""

import pandas as pd
import numpy as np
from scipy import stats


class DataAnalyzer:
    def __init__(self, df: pd.DataFrame):
        self.df = df

    def full_analysis(self) -> dict:
        return {
            "summary": self.summary_metrics(),
            "columns": self.column_analysis(),
            "duplicates": self.duplicate_info(),
            "outliers": self.outlier_summary(),
            "visualization_data": self.visualization_data(),
        }

    def summary_metrics(self) -> dict:
        df = self.df
        total_cells = df.shape[0] * df.shape[1]
        missing_cells = df.isnull().sum().sum()
        return {
            "rows": int(df.shape[0]),
            "columns": int(df.shape[1]),
            "total_cells": int(total_cells),
            "missing_cells": int(missing_cells),
            "missing_pct": round(missing_cells / total_cells * 100, 2) if total_cells > 0 else 0,
            "duplicate_rows": int(df.duplicated().sum()),
            "duplicate_pct": round(df.duplicated().sum() / len(df) * 100, 2) if len(df) > 0 else 0,
            "numeric_columns": int(df.select_dtypes(include=[np.number]).shape[1]),
            "categorical_columns": int(df.select_dtypes(include=['object', 'category']).shape[1]),
            "datetime_columns": int(df.select_dtypes(include=['datetime64']).shape[1]),
        }

    def column_analysis(self) -> list:
        df = self.df
        result = []
        for col in df.columns:
            series = df[col]
            col_info = {
                "name": col,
                "dtype": str(series.dtype),
                "inferred_type": self._infer_type(series),
                "missing_count": int(series.isnull().sum()),
                "missing_pct": round(series.isnull().sum() / len(series) * 100, 2),
                "unique_count": int(series.nunique()),
                "unique_pct": round(series.nunique() / len(series) * 100, 2) if len(series) > 0 else 0,
                "sample_values": [str(v) for v in series.dropna().head(5).tolist()],
            }

            if pd.api.types.is_numeric_dtype(series):
                desc = series.describe()
                col_info.update({
                    "min": self._safe_float(desc.get('min')),
                    "max": self._safe_float(desc.get('max')),
                    "mean": self._safe_float(desc.get('mean')),
                    "median": self._safe_float(series.median()),
                    "std": self._safe_float(desc.get('std')),
                    "q1": self._safe_float(desc.get('25%')),
                    "q3": self._safe_float(desc.get('75%')),
                    "outlier_count": int(self._count_outliers(series)),
                    "skewness": self._safe_float(series.skew()),
                })
            elif series.dtype == object:
                col_info.update({
                    "most_common": series.value_counts().head(3).to_dict() if series.notna().any() else {},
                    "has_mixed_case": self._has_mixed_case(series),
                    "has_whitespace_issues": self._has_whitespace(series),
                })

            result.append(col_info)
        return result

    def duplicate_info(self) -> dict:
        df = self.df
        dup_mask = df.duplicated()
        return {
            "total_duplicates": int(dup_mask.sum()),
            "duplicate_pct": round(dup_mask.sum() / len(df) * 100, 2) if len(df) > 0 else 0,
            "unique_rows": int(len(df) - dup_mask.sum()),
        }

    def outlier_summary(self) -> list:
        result = []
        for col in self.df.select_dtypes(include=[np.number]).columns:
            series = self.df[col].dropna()
            if len(series) < 4:
                continue
            iqr_count = int(self._count_outliers(series, method='iqr'))
            z_count = int(self._count_outliers(series, method='zscore'))
            if iqr_count > 0 or z_count > 0:
                result.append({
                    "column": col,
                    "iqr_outliers": iqr_count,
                    "zscore_outliers": z_count,
                    "iqr_pct": round(iqr_count / len(series) * 100, 2),
                })
        return result

    def visualization_data(self) -> dict:
        df = self.df
        numeric_cols = df.select_dtypes(include=[np.number]).columns.tolist()
        categorical_cols = df.select_dtypes(include=['object']).columns.tolist()

        viz = {
            "distributions": [],
            "correlation": None,
            "missing_heatmap": [],
            "top_categoricals": [],
        }

        # Distributions for numeric columns (up to 8)
        for col in numeric_cols[:8]:
            series = df[col].dropna()
            if len(series) == 0:
                continue
            hist, bin_edges = np.histogram(series, bins=20)
            viz["distributions"].append({
                "column": col,
                "hist": hist.tolist(),
                "bin_edges": [round(x, 4) for x in bin_edges.tolist()],
                "mean": self._safe_float(series.mean()),
                "median": self._safe_float(series.median()),
            })

        # Correlation matrix
        if len(numeric_cols) >= 2:
            corr = df[numeric_cols].corr()
            viz["correlation"] = {
                "columns": numeric_cols,
                "matrix": [[self._safe_float(v) for v in row] for row in corr.values.tolist()]
            }

        # Missing heatmap data
        missing = df.isnull().sum()
        viz["missing_heatmap"] = [
            {"column": col, "missing": int(cnt), "pct": round(cnt / len(df) * 100, 2)}
            for col, cnt in missing.items() if cnt > 0
        ]

        # Top categoricals (up to 5 cols, top 10 values each)
        for col in categorical_cols[:5]:
            vc = df[col].value_counts().head(10)
            viz["top_categoricals"].append({
                "column": col,
                "labels": vc.index.tolist(),
                "values": vc.values.tolist(),
            })

        return viz

    def quality_score(self) -> dict:
        df = self.df
        total = df.shape[0] * df.shape[1]

        # Completeness (40%)
        missing_pct = df.isnull().sum().sum() / total * 100 if total > 0 else 0
        completeness = max(0, 100 - missing_pct)

        # Uniqueness (20%)
        dup_pct = df.duplicated().sum() / len(df) * 100 if len(df) > 0 else 0
        uniqueness = max(0, 100 - dup_pct)

        # Consistency (20%) — no type-mixed columns
        numeric_cols = df.select_dtypes(include=[np.number]).columns
        bad_cols = 0
        for col in df.select_dtypes(include=['object']).columns:
            converted = pd.to_numeric(df[col], errors='coerce')
            if converted.notna().sum() > 0 and df[col].notna().sum() != converted.notna().sum():
                bad_cols += 1
        consistency = max(0, 100 - (bad_cols / max(1, len(df.columns)) * 100))

        # Outlier cleanliness (20%)
        outlier_pct = 0
        for col in numeric_cols:
            outlier_pct += self._count_outliers(df[col].dropna()) / max(1, len(df)) * 100
        outlier_pct /= max(1, len(numeric_cols))
        cleanliness = max(0, 100 - outlier_pct)

        total_score = (completeness * 0.4 + uniqueness * 0.2 + consistency * 0.2 + cleanliness * 0.2)

        return {
            "total": round(total_score, 1),
            "completeness": round(completeness, 1),
            "uniqueness": round(uniqueness, 1),
            "consistency": round(consistency, 1),
            "cleanliness": round(cleanliness, 1),
        }

    # ── Helpers ──────────────────────────────────────────────────────────────

    def _safe_float(self, val):
        try:
            if val is None or (isinstance(val, float) and np.isnan(val)):
                return None
            return round(float(val), 4)
        except Exception:
            return None

    def _infer_type(self, series):
        if pd.api.types.is_numeric_dtype(series):
            return "numeric"
        if pd.api.types.is_datetime64_any_dtype(series):
            return "datetime"
        # Try parsing as datetime
        sample = series.dropna().head(20)
        try:
            pd.to_datetime(sample)
            return "datetime-like"
        except Exception:
            pass
        # Try parsing as numeric
        try:
            pd.to_numeric(series.dropna().head(20))
            return "numeric-like"
        except Exception:
            pass
        return "categorical"

    def _count_outliers(self, series, method='iqr'):
        series = pd.to_numeric(series, errors='coerce').dropna()
        if len(series) < 4:
            return 0
        if method == 'iqr':
            Q1 = series.quantile(0.25)
            Q3 = series.quantile(0.75)
            IQR = Q3 - Q1
            return ((series < Q1 - 1.5 * IQR) | (series > Q3 + 1.5 * IQR)).sum()
        elif method == 'zscore':
            z = np.abs(stats.zscore(series))
            return (z > 3).sum()
        return 0

    def _has_mixed_case(self, series):
        sample = series.dropna().astype(str).head(100)
        has_upper = sample.str.contains('[A-Z]', regex=True).any()
        has_lower = sample.str.contains('[a-z]', regex=True).any()
        return bool(has_upper and has_lower)

    def _has_whitespace(self, series):
        sample = series.dropna().astype(str).head(100)
        return bool(sample.str.startswith(' ').any() or sample.str.endswith(' ').any())
