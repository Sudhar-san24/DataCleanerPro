"""
DataCleaner Pro - Backend API
Flask application for data cleaning and analysis
"""

from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
import pandas as pd
import numpy as np
import json
import io
import uuid
import os
import traceback
from datetime import datetime
from cleaner import DataCleaner
from analyzer import DataAnalyzer
from insights import InsightEngine

app = Flask(__name__)
CORS(app)

# In-memory session store (use Redis in production)
sessions = {}

ALLOWED_EXTENSIONS = {'csv', 'xlsx', 'xls'}

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

def df_to_json_safe(df, max_rows=500):
    """Convert DataFrame to JSON-serializable format safely."""
    sample = df.head(max_rows).copy()
    # Convert all types to JSON-safe
    for col in sample.columns:
        if sample[col].dtype == 'datetime64[ns]':
            sample[col] = sample[col].astype(str)
        elif sample[col].dtype == object:
            sample[col] = sample[col].astype(str)
    return {
        "columns": list(sample.columns),
        "data": sample.replace({np.nan: None}).to_dict(orient='records'),
        "total_rows": len(df),
        "showing_rows": min(max_rows, len(df))
    }

@app.route('/api/health', methods=['GET'])
def health():
    return jsonify({"status": "ok", "timestamp": datetime.now().isoformat()})

@app.route('/api/upload', methods=['POST'])
def upload_file():
    """Upload and parse a CSV or Excel file."""
    try:
        if 'file' not in request.files:
            return jsonify({"error": "No file provided"}), 400

        file = request.files['file']
        if file.filename == '':
            return jsonify({"error": "No file selected"}), 400

        if not allowed_file(file.filename):
            return jsonify({"error": "File type not supported. Use CSV or Excel."}), 400

        filename = file.filename.lower()
        if filename.endswith('.csv'):
            df = pd.read_csv(file, low_memory=False)
        else:
            df = pd.read_excel(file)

        # Generate session ID
        session_id = str(uuid.uuid4())

        # Store original and working copy
        sessions[session_id] = {
            "original": df.copy(),
            "current": df.copy(),
            "filename": file.filename,
            "history": [],
            "created_at": datetime.now().isoformat()
        }

        # Run initial analysis
        analyzer = DataAnalyzer(df)
        analysis = analyzer.full_analysis()

        return jsonify({
            "session_id": session_id,
            "filename": file.filename,
            "shape": {"rows": df.shape[0], "cols": df.shape[1]},
            "preview": df_to_json_safe(df, max_rows=100),
            "analysis": analysis
        })

    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500

@app.route('/api/analyze/<session_id>', methods=['GET'])
def analyze(session_id):
    """Get full analysis for current dataset state."""
    if session_id not in sessions:
        return jsonify({"error": "Session not found"}), 404

    df = sessions[session_id]["current"]
    analyzer = DataAnalyzer(df)
    analysis = analyzer.full_analysis()
    return jsonify(analysis)

@app.route('/api/clean/<session_id>', methods=['POST'])
def clean_data(session_id):
    """Apply cleaning operations."""
    if session_id not in sessions:
        return jsonify({"error": "Session not found"}), 404

    try:
        config = request.json or {}
        session = sessions[session_id]
        df_before = session["current"].copy()

        cleaner = DataCleaner(df_before.copy())
        df_after, log = cleaner.apply_cleaning(config)

        # Save history for undo
        session["history"].append({
            "df": df_before,
            "config": config,
            "timestamp": datetime.now().isoformat(),
            "log": log
        })
        session["current"] = df_after

        # Compare before/after
        analyzer_before = DataAnalyzer(df_before)
        analyzer_after = DataAnalyzer(df_after)

        metrics_before = analyzer_before.summary_metrics()
        metrics_after = analyzer_after.summary_metrics()

        # Insights
        engine = InsightEngine(df_after)
        insights = engine.generate_insights()

        return jsonify({
            "success": True,
            "log": log,
            "before": metrics_before,
            "after": metrics_after,
            "preview": df_to_json_safe(df_after),
            "insights": insights,
            "shape": {"rows": df_after.shape[0], "cols": df_after.shape[1]}
        })

    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500

@app.route('/api/undo/<session_id>', methods=['POST'])
def undo(session_id):
    """Undo last cleaning step."""
    if session_id not in sessions:
        return jsonify({"error": "Session not found"}), 404

    session = sessions[session_id]
    if not session["history"]:
        return jsonify({"error": "Nothing to undo"}), 400

    last = session["history"].pop()
    session["current"] = last["df"]

    return jsonify({
        "success": True,
        "message": "Reverted last cleaning step",
        "preview": df_to_json_safe(session["current"])
    })

@app.route('/api/reset/<session_id>', methods=['POST'])
def reset(session_id):
    """Reset to original uploaded data."""
    if session_id not in sessions:
        return jsonify({"error": "Session not found"}), 404

    session = sessions[session_id]
    session["current"] = session["original"].copy()
    session["history"] = []

    return jsonify({
        "success": True,
        "message": "Reset to original data",
        "preview": df_to_json_safe(session["current"])
    })

@app.route('/api/insights/<session_id>', methods=['GET'])
def get_insights(session_id):
    """Get AI-generated insights."""
    if session_id not in sessions:
        return jsonify({"error": "Session not found"}), 404

    df = sessions[session_id]["current"]
    engine = InsightEngine(df)
    insights = engine.generate_insights()
    return jsonify(insights)

@app.route('/api/visualize/<session_id>', methods=['GET'])
def get_visualizations(session_id):
    """Get visualization data (JSON for Plotly)."""
    if session_id not in sessions:
        return jsonify({"error": "Session not found"}), 404

    df = sessions[session_id]["current"]
    analyzer = DataAnalyzer(df)
    viz_data = analyzer.visualization_data()
    return jsonify(viz_data)

@app.route('/api/download/<session_id>', methods=['GET'])
def download(session_id):
    """Download the cleaned dataset."""
    if session_id not in sessions:
        return jsonify({"error": "Session not found"}), 404

    fmt = request.args.get('format', 'csv')
    df = sessions[session_id]["current"]
    filename = sessions[session_id]["filename"]
    base_name = os.path.splitext(filename)[0]

    output = io.BytesIO()
    if fmt == 'xlsx':
        df.to_excel(output, index=False, engine='openpyxl')
        output.seek(0)
        return send_file(
            output,
            mimetype='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            as_attachment=True,
            download_name=f"{base_name}_cleaned.xlsx"
        )
    else:
        df.to_csv(output, index=False)
        output.seek(0)
        return send_file(
            output,
            mimetype='text/csv',
            as_attachment=True,
            download_name=f"{base_name}_cleaned.csv"
        )

@app.route('/api/quality-score/<session_id>', methods=['GET'])
def quality_score(session_id):
    """Calculate a data quality score."""
    if session_id not in sessions:
        return jsonify({"error": "Session not found"}), 404

    df = sessions[session_id]["current"]
    original = sessions[session_id]["original"]

    analyzer = DataAnalyzer(df)
    score = analyzer.quality_score()
    orig_analyzer = DataAnalyzer(original)
    orig_score = orig_analyzer.quality_score()

    return jsonify({
        "current_score": score,
        "original_score": orig_score,
        "improvement": round(score["total"] - orig_score["total"], 1)
    })

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)
