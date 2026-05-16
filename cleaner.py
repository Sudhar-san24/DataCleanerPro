"""
DataCleaner - Applies cleaning operations to DataFrames
"""

import pandas as pd
import numpy as np
from typing import Tuple, List


class DataCleaner:
    def __init__(self, df: pd.DataFrame):
        self.df = df.copy()
        self.log: List[dict] = []

    def apply_cleaning(self, config: dict) -> Tuple[pd.DataFrame, List[dict]]:
        """
        Apply a cleaning configuration dict.
        config keys:
          - remove_duplicates: bool
          - missing_strategy: 'drop_rows' | 'drop_cols' | 'mean' | 'median' | 'mode' | 'ffill' | 'bfill' | 'constant'
          - missing_fill_value: str (for 'constant')
          - missing_threshold: float (drop cols with > X% missing)
          - fix_dtypes: bool
          - standardize_strings: bool (strip + title case)
          - handle_outliers: 'none' | 'remove' | 'cap'
          - outlier_method: 'iqr' | 'zscore'
          - column_overrides: {col_name: {strategy: ...}}  per-column overrides
        """
        df = self.df.copy()
        rows_before = len(df)
        cols_before = len(df.columns)

        # 1. Remove duplicates
        if config.get("remove_duplicates", False):
            dup_count = df.duplicated().sum()
            df = df.drop_duplicates().reset_index(drop=True)
            self._log("remove_duplicates", f"Removed {dup_count} duplicate rows", dup_count)

        # 2. Drop high-missing columns
        threshold = config.get("missing_threshold", None)
        if threshold is not None:
            pct_missing = df.isnull().mean() * 100
            drop_cols = pct_missing[pct_missing > threshold].index.tolist()
            if drop_cols:
                df = df.drop(columns=drop_cols)
                self._log("drop_high_missing_cols", f"Dropped {len(drop_cols)} columns with >{threshold}% missing: {drop_cols}", len(drop_cols))

        # 3. Handle missing values
        strategy = config.get("missing_strategy", "none")
        if strategy != "none":
            df = self._handle_missing(df, strategy, config.get("missing_fill_value", ""))

        # 4. Per-column overrides
        for col, col_cfg in config.get("column_overrides", {}).items():
            if col not in df.columns:
                continue
            col_strategy = col_cfg.get("missing_strategy")
            if col_strategy:
                df[col] = self._fill_column(df[col], col_strategy, col_cfg.get("fill_value", ""))
                self._log("column_override", f"Column '{col}': applied '{col_strategy}'", 1)

        # 5. Fix data types
        if config.get("fix_dtypes", False):
            df = self._fix_dtypes(df)

        # 6. Standardize strings
        if config.get("standardize_strings", False):
            df = self._standardize_strings(df, config.get("string_case", "title"))

        # 7. Outlier handling
        outlier_action = config.get("handle_outliers", "none")
        if outlier_action != "none":
            method = config.get("outlier_method", "iqr")
            df = self._handle_outliers(df, outlier_action, method)

        self._log("summary", f"Cleaning complete. Rows: {rows_before}→{len(df)}, Cols: {cols_before}→{len(df.columns)}", 0)
        return df, self.log

    # ── Private helpers ──────────────────────────────────────────────────────

    def _handle_missing(self, df: pd.DataFrame, strategy: str, fill_value="") -> pd.DataFrame:
        numeric_cols = df.select_dtypes(include=[np.number]).columns
        cat_cols = df.select_dtypes(include=['object']).columns
        missing_before = df.isnull().sum().sum()

        if strategy == "drop_rows":
            df = df.dropna().reset_index(drop=True)
            removed = missing_before - df.isnull().sum().sum()
            self._log("drop_rows", f"Dropped rows with any missing value. Removed ~{df.shape[0]} rows affected.", removed)

        elif strategy == "mean":
            for col in numeric_cols:
                count = df[col].isnull().sum()
                if count > 0:
                    df[col] = df[col].fillna(df[col].mean())
            self._log("fill_mean", f"Filled numeric nulls with column mean", missing_before)

        elif strategy == "median":
            for col in numeric_cols:
                if df[col].isnull().sum() > 0:
                    df[col] = df[col].fillna(df[col].median())
            self._log("fill_median", "Filled numeric nulls with column median", missing_before)

        elif strategy == "mode":
            for col in df.columns:
                if df[col].isnull().sum() > 0:
                    mode_val = df[col].mode()
                    if len(mode_val) > 0:
                        df[col] = df[col].fillna(mode_val[0])
            self._log("fill_mode", "Filled nulls with column mode (all columns)", missing_before)

        elif strategy == "ffill":
            df = df.ffill()
            self._log("ffill", "Applied forward fill for missing values", missing_before)

        elif strategy == "bfill":
            df = df.bfill()
            self._log("bfill", "Applied backward fill for missing values", missing_before)

        elif strategy == "constant":
            for col in cat_cols:
                df[col] = df[col].fillna(fill_value or "Unknown")
            for col in numeric_cols:
                try:
                    df[col] = df[col].fillna(float(fill_value) if fill_value else 0)
                except Exception:
                    df[col] = df[col].fillna(0)
            self._log("fill_constant", f"Filled nulls with constant value '{fill_value}'", missing_before)

        return df

    def _fill_column(self, series: pd.Series, strategy: str, fill_value="") -> pd.Series:
        if strategy == "mean" and pd.api.types.is_numeric_dtype(series):
            return series.fillna(series.mean())
        elif strategy == "median" and pd.api.types.is_numeric_dtype(series):
            return series.fillna(series.median())
        elif strategy == "mode":
            mode = series.mode()
            return series.fillna(mode[0] if len(mode) > 0 else np.nan)
        elif strategy == "ffill":
            return series.ffill()
        elif strategy == "bfill":
            return series.bfill()
        elif strategy == "drop_rows":
            return series.dropna()
        elif strategy == "constant":
            return series.fillna(fill_value)
        return series

    def _fix_dtypes(self, df: pd.DataFrame) -> pd.DataFrame:
        fixed = 0
        for col in df.columns:
            if df[col].dtype == object:
                # Try numeric
                converted = pd.to_numeric(df[col], errors='coerce')
                if converted.notna().sum() / max(1, df[col].notna().sum()) > 0.8:
                    df[col] = converted
                    fixed += 1
                    continue
                # Try datetime
                try:
                    dt = pd.to_datetime(df[col], errors='coerce', infer_datetime_format=True)
                    if dt.notna().sum() / max(1, df[col].notna().sum()) > 0.8:
                        df[col] = dt
                        fixed += 1
                except Exception:
                    pass
        self._log("fix_dtypes", f"Fixed/inferred data types for {fixed} columns", fixed)
        return df

    def _standardize_strings(self, df: pd.DataFrame, case: str = "title") -> pd.DataFrame:
        count = 0
        for col in df.select_dtypes(include=['object']).columns:
            original = df[col].copy()
            df[col] = df[col].astype(str).str.strip()
            if case == "lower":
                df[col] = df[col].str.lower()
            elif case == "upper":
                df[col] = df[col].str.upper()
            elif case == "title":
                df[col] = df[col].str.title()
            # Fix nan string artifacts
            df[col] = df[col].replace("Nan", np.nan).replace("nan", np.nan).replace("None", np.nan)
            if not df[col].equals(original):
                count += 1
        self._log("standardize_strings", f"Standardized strings ({case} case) in {count} columns", count)
        return df

    def _handle_outliers(self, df: pd.DataFrame, action: str, method: str) -> pd.DataFrame:
        numeric_cols = df.select_dtypes(include=[np.number]).columns
        total_affected = 0

        for col in numeric_cols:
            numeric_series = pd.to_numeric(df[col], errors='coerce')
            numeric_values = numeric_series.dropna()
            if len(numeric_values) < 4:
                continue

            if method == "iqr":
                Q1 = numeric_values.quantile(0.25)
                Q3 = numeric_values.quantile(0.75)
                IQR = Q3 - Q1
                lower = Q1 - 1.5 * IQR
                upper = Q3 + 1.5 * IQR
            else:  # zscore
                mean = numeric_values.mean()
                std = numeric_values.std()
                lower = mean - 3 * std
                upper = mean + 3 * std

            mask = (numeric_series < lower) | (numeric_series > upper)
            mask = mask.fillna(False)
            count = mask.sum()
            if count == 0:
                continue

            if action == "remove":
                df = df[~mask].reset_index(drop=True)
            elif action == "cap":
                capped = numeric_series.clip(lower=lower, upper=upper)
                df.loc[mask, col] = capped[mask]

            total_affected += int(count)

        self._log("handle_outliers", f"Outlier action='{action}' method='{method}': {total_affected} values affected", total_affected)
        return df

    def _log(self, action: str, message: str, affected: int):
        self.log.append({
            "action": action,
            "message": message,
            "affected": int(affected),
        })
