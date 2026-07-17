from flask import Flask, request, jsonify, send_from_directory
import numpy as np
from sklearn.linear_model import LinearRegression
from sklearn.metrics import r2_score
import csv
import io
import os

app = Flask(__name__, static_folder='.', static_url_path='')


# Serve the frontend
@app.route('/')
def index():
    return send_from_directory('.', 'index.html')


@app.route('/train', methods=['POST'])
def train():
    """
    Accepts JSON: { "x": [1,2,3,...], "y": [4,5,6,...] }
    Runs sklearn LinearRegression and returns results.
    """
    data = request.get_json()

    x_vals = data.get('x', [])
    y_vals = data.get('y', [])

    if len(x_vals) < 2 or len(y_vals) < 2:
        return jsonify({'error': 'Need at least 2 data points'}), 400

    if len(x_vals) != len(y_vals):
        return jsonify({'error': 'X and Y must have the same length'}), 400

    # Convert to numpy arrays and reshape for sklearn
    X = np.array(x_vals).reshape(-1, 1)
    y = np.array(y_vals)

    # ── Train the Linear Regression model ──
    model = LinearRegression()
    model.fit(X, y)

    # ── Extract results ──
    slope = model.coef_[0]
    intercept = model.intercept_
    y_pred = model.predict(X)
    r2 = r2_score(y, y_pred)

    return jsonify({
        'slope': round(float(slope), 4),
        'intercept': round(float(intercept), 4),
        'r2': round(float(r2), 4),
        'n': len(x_vals),
        'predictions': [round(float(p), 4) for p in y_pred]
    })


@app.route('/predict', methods=['POST'])
def predict():
    """
    Accepts JSON: { "slope": m, "intercept": b, "x_new": value }
    Returns predicted Y using the trained model parameters.
    """
    data = request.get_json()
    slope = data.get('slope')
    intercept = data.get('intercept')
    x_new = data.get('x_new')

    if slope is None or intercept is None or x_new is None:
        return jsonify({'error': 'Missing slope, intercept, or x_new'}), 400

    y_pred = slope * x_new + intercept

    return jsonify({
        'x': x_new,
        'y_predicted': round(float(y_pred), 4)
    })


@app.route('/upload-csv', methods=['POST'])
def upload_csv():
    """
    Accepts a CSV file upload, parses it, trains the model, and returns results.
    """
    if 'file' not in request.files:
        return jsonify({'error': 'No file uploaded'}), 400

    file = request.files['file']
    if file.filename == '':
        return jsonify({'error': 'No file selected'}), 400

    try:
        content = file.read().decode('utf-8')
        reader = csv.reader(io.StringIO(content))
        rows = list(reader)

        if len(rows) < 2:
            return jsonify({'error': 'CSV must have a header and at least 1 data row'}), 400

        x_vals = []
        y_vals = []
        for row in rows[1:]:  # skip header
            if len(row) >= 2:
                try:
                    x_vals.append(float(row[0].strip()))
                    y_vals.append(float(row[1].strip()))
                except ValueError:
                    continue

        if len(x_vals) < 2:
            return jsonify({'error': 'Need at least 2 valid numeric rows'}), 400

        # Train model
        X = np.array(x_vals).reshape(-1, 1)
        y = np.array(y_vals)

        model = LinearRegression()
        model.fit(X, y)

        slope = model.coef_[0]
        intercept = model.intercept_
        y_pred = model.predict(X)
        r2 = r2_score(y, y_pred)

        return jsonify({
            'x': x_vals,
            'y': y_vals,
            'slope': round(float(slope), 4),
            'intercept': round(float(intercept), 4),
            'r2': round(float(r2), 4),
            'n': len(x_vals),
            'predictions': [round(float(p), 4) for p in y_pred]
        })

    except Exception as e:
        return jsonify({'error': str(e)}), 400


if __name__ == '__main__':
    print("=" * 50)
    print("  Linear Regression ML App")
    print("  Open http://127.0.0.1:5000 in your browser")
    print("=" * 50)
    app.run(debug=True, port=5000)
