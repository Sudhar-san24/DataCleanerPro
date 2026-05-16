# DataCleaner Pro

A full-stack Data Cleaning & Analysis Web Tool — like Excel/Google Sheets, but focused on **automated data cleaning, profiling, and insight generation**.

---

## 🗂 Project Structure

```
datacleaner/
├── backend/
│   ├── app.py          # Flask REST API (10 endpoints)
│   ├── analyzer.py     # Data profiling & quality scoring
│   ├── cleaner.py      # All cleaning operations
│   ├── insights.py     # Auto-generated observations & AI suggestions
│   └── requirements.txt
├── frontend/
│   └── src/
│       └── App.jsx     # Complete React single-file frontend
└── README.md
```

---

## ⚡ Quick Start

### 1. Backend (Python / Flask)

```bash
cd backend
pip install -r requirements.txt
python app.py
# → Running on http://localhost:5000
```

### 2. Frontend (React)

**Option A — Vite (recommended)**
```bash
npm create vite@latest frontend -- --template react
cd frontend
# Replace src/App.jsx with the provided App.jsx
npm install
npm run dev
# → Running on http://localhost:5173
```

**Option B — Create React App**
```bash
npx create-react-app frontend
cd frontend
# Replace src/App.js with App.jsx contents
npm start
```

---

## 🔌 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/health` | Health check |
| POST | `/api/upload` | Upload CSV/Excel → returns session_id + analysis |
| GET | `/api/analyze/:id` | Re-analyze current state |
| POST | `/api/clean/:id` | Apply cleaning config |
| POST | `/api/undo/:id` | Undo last cleaning step |
| POST | `/api/reset/:id` | Reset to original data |
| GET | `/api/insights/:id` | Get auto-generated insights |
| GET | `/api/visualize/:id` | Get visualization data (JSON) |
| GET | `/api/quality-score/:id` | Before/after quality score |
| GET | `/api/download/:id?format=csv` | Download cleaned data |

---

## 🧹 Cleaning Config (POST /api/clean)

```json
{
  "remove_duplicates": true,
  "missing_strategy": "mode",
  "missing_fill_value": "",
  "missing_threshold": 50,
  "fix_dtypes": true,
  "standardize_strings": true,
  "string_case": "title",
  "handle_outliers": "cap",
  "outlier_method": "iqr",
  "column_overrides": {
    "salary": { "missing_strategy": "median" }
  }
}
```

**Missing strategies:** `none | drop_rows | mean | median | mode | ffill | bfill | constant`  
**Outlier actions:** `none | remove | cap`  
**Outlier methods:** `iqr | zscore`

---

## 📊 Quality Score Breakdown

| Dimension | Weight | How it's measured |
|-----------|--------|-------------------|
| Completeness | 40% | Missing cells ratio |
| Uniqueness | 20% | Duplicate row ratio |
| Consistency | 20% | Mixed-type columns |
| Cleanliness | 20% | Outlier ratio |

---

## 🚀 Production Scaling

1. **Replace in-memory sessions** with Redis (`flask-session` + `redis-py`)
2. **Add file storage** with S3 or local disk (delete after TTL)
3. **Add authentication** via Flask-JWT or Auth0
4. **Use Gunicorn** in production: `gunicorn -w 4 app:app`
5. **Add rate limiting** with `flask-limiter`
6. **Containerize** with Docker:

```dockerfile
FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install -r requirements.txt
COPY . .
CMD ["gunicorn", "-w", "4", "-b", "0.0.0.0:5000", "app:app"]
```

7. **Large datasets** (>1M rows): use Dask or chunked Pandas processing
8. **Frontend**: Deploy to Vercel/Netlify. Set `VITE_API_URL` env var.

---

## 🔬 Test Results (verified)

```
Dataset: 315 rows × 7 cols (with 13 dupes, 141 nulls, 3 outliers)

CLEANING LOG:
  [remove_duplicates]    Removed 13 duplicate rows
  [fill_mode]            Filled nulls with column mode
  [standardize_strings]  Standardized strings (title case) in 2 columns
  [handle_outliers]      Capped 3 outliers via IQR

BEFORE vs AFTER:
  rows           315  → 302   (-13)
  missing_cells  141  →   0  (-141)
  duplicate_rows  13  →   0   (-13)
  Quality Score: 96.6 → 100.0  (+3.4 pts)
```
