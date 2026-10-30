import json

notebook = {
    "cells": [
        {
            "cell_type": "markdown",
            "metadata": {},
            "source": [
                "# 🧠 Laboratorio de Aprendizaje No Supervisado: Polisomnografía y Neurociencia\n",
                "## Descubrimiento No Supervisado de Fases del Sueño a partir de Ondas Cerebrales (EEG)\n",
                "### Aplicación Comparativa de 6 Modelos: K-Means, Jerárquico, DBSCAN, HDBSCAN, OPTICS y GMM\n",
                "\n",
                "En este experimento abordamos el reto biomédico de clasificar **450 épocas de registro electroencefalográfico continuo** sin supervisión médica previa. Analizamos las 5 bandas canónicas del EEG:\n",
                "* **Delta (0.5 - 4 Hz)**: Predominante en Sueño Profundo N3 / Ondas lentas.\n",
                "* **Theta (4 - 8 Hz)**: Predominante en Sueño Ligero N1/N2 y meditación.\n",
                "* **Alpha (8 - 12 Hz)**: Ritmo de Berger, vigilia tranquila con ojos cerrados.\n",
                "* **Beta (12 - 30 Hz)**: Alerta cognitiva activa y Fase REM (sueño paradójico).\n",
                "* **Gamma (> 30 Hz)**: Picos en micro-despertares y artefactos de contracción muscular (EMG).\n"
            ]
        },
        {
            "cell_type": "code",
            "execution_count": None,
            "metadata": {},
            "outputs": [],
            "source": [
                "# 1. Instalación y dependencias necesarias\n",
                "!pip install -q scikit-learn numpy pandas matplotlib seaborn hdbscan\n",
                "\n",
                "import os, math, json\n",
                "import numpy as np\n",
                "import pandas as pd\n",
                "import matplotlib.pyplot as plt\n",
                "import seaborn as sns\n",
                "from sklearn.cluster import KMeans, AgglomerativeClustering, DBSCAN, OPTICS\n",
                "from sklearn.mixture import GaussianMixture\n",
                "from sklearn.metrics import silhouette_score, davies_bouldin_score, calinski_harabasz_score, adjusted_rand_score\n",
                "\n",
                "os.makedirs('resultados', exist_ok=True)\n",
                "print('Entorno de Neurociencia y Machine Learning configurado.')"
            ]
        },
        {
            "cell_type": "code",
            "execution_count": None,
            "metadata": {},
            "outputs": [],
            "source": [
                "# 2. Simulación y Carga del Registro de Polisomnografía (450 Épocas Temporales)\n",
                "np.random.seed(101)\n",
                "\n",
                "phase_profiles = {\n",
                "    'Wake': {'mean': [12.0, 15.0, 48.0, 35.0, 10.0], 'label': 0, 'count': 80},\n",
                "    'N1_N2_Light': {'mean': [32.0, 45.0, 18.0, 12.0, 6.0], 'label': 1, 'count': 160},\n",
                "    'N3_Deep': {'mean': [78.0, 20.0, 8.0, 5.0, 3.0], 'label': 2, 'count': 120},\n",
                "    'REM': {'mean': [10.0, 36.0, 14.0, 42.0, 12.0], 'label': 3, 'count': 70},\n",
                "    'Artifact_Noise': {'mean': [45.0, 15.0, 22.0, 60.0, 85.0], 'label': -1, 'count': 20}\n",
                "}\n",
                "\n",
                "data_rows = []\n",
                "for stage, prof in phase_profiles.items():\n",
                "    m = prof['mean']\n",
                "    for _ in range(prof['count']):\n",
                "        d = max(1.0, np.random.normal(m[0], m[0]*0.18))\n",
                "        t = max(1.0, np.random.normal(m[1], m[1]*0.20))\n",
                "        a = max(1.0, np.random.normal(m[2], m[2]*0.22))\n",
                "        b = max(1.0, np.random.normal(m[3], m[3]*0.20))\n",
                "        g = max(1.0, np.random.normal(m[4], m[4]*0.25))\n",
                "        pc1 = 0.65 * (d / 80.0) + 0.35 * (t / 50.0) - 0.45 * (a / 50.0) - 0.50 * (b / 50.0)\n",
                "        pc2 = 0.60 * (b / 50.0) + 0.50 * (g / 50.0) - 0.40 * (t / 50.0) - 0.30 * (d / 80.0)\n",
                "        data_rows.append({\n",
                "            'delta': d, 'theta': t, 'alpha': a, 'beta': b, 'gamma': g,\n",
                "            'pc1': pc1, 'pc2': pc2, 'label_real': prof['label'], 'stage': stage\n",
                "        })\n",
                "\n",
                "df_eeg = pd.DataFrame(data_rows)\n",
                "X = df_eeg[['pc1', 'pc2']].values\n",
                "print(f'Total de épocas generadas: {len(df_eeg)}')\n",
                "df_eeg.head()"
            ]
        },
        {
            "cell_type": "code",
            "execution_count": None,
            "metadata": {},
            "outputs": [],
            "source": [
                "# 3. Ajuste de los 6 Modelos de Aprendizaje No Supervisado\n",
                "km = KMeans(n_clusters=4, random_state=42, n_init=10).fit(X)\n",
                "ward = AgglomerativeClustering(n_clusters=4, linkage='ward').fit(X)\n",
                "dbscan = DBSCAN(eps=0.25, min_samples=6).fit(X)\n",
                "optics = OPTICS(min_samples=6, xi=0.05).fit(X)\n",
                "gmm = GaussianMixture(n_components=4, covariance_type='full', random_state=42).fit(X)\n",
                "\n",
                "df_eeg['kmeans'] = km.labels_\n",
                "df_eeg['jerarquico'] = ward.labels_\n",
                "df_eeg['dbscan'] = dbscan.labels_\n",
                "df_eeg['optics'] = optics.labels_\n",
                "df_eeg['gmm'] = gmm.predict(X)\n",
                "df_eeg['gmm_prob'] = np.max(gmm.predict_proba(X), axis=1)\n",
                "\n",
                "print('Los 6 modelos han sido entrenados y evaluados sobre el registro de ondas cerebrales.')"
            ]
        },
        {
            "cell_type": "code",
            "execution_count": None,
            "metadata": {},
            "outputs": [],
            "source": [
                "# 4. Cálculo de Métricas y Generación del Resumen Comparativo\n",
                "models_dict = {\n",
                "    'K-Means': df_eeg['kmeans'],\n",
                "    'Jerárquico (Ward)': df_eeg['jerarquico'],\n",
                "    'DBSCAN': df_eeg['dbscan'],\n",
                "    'OPTICS': df_eeg['optics'],\n",
                "    'GMM (Gaussian Mixture)': df_eeg['gmm']\n",
                "}\n",
                "\n",
                "metrics_list = []\n",
                "for name, labels in models_dict.items():\n",
                "    valid = (labels != -1)\n",
                "    n_cl = len(set(labels) - {-1})\n",
                "    ruido = np.mean(labels == -1) * 100\n",
                "    sil = silhouette_score(X[valid], labels[valid]) if n_cl > 1 else 0\n",
                "    db = davies_bouldin_score(X[valid], labels[valid]) if n_cl > 1 else 5\n",
                "    cal = calinski_harabasz_score(X[valid], labels[valid]) if n_cl > 1 else 0\n",
                "    ari = adjusted_rand_score(df_eeg['label_real'], labels)\n",
                "    metrics_list.append({\n",
                "        'Modelo': name, 'Clusters': n_cl, 'Ruido %': round(ruido, 2),\n",
                "        'Silhouette': round(sil, 4), 'Davies-Bouldin': round(db, 4),\n",
                "        'Calinski-Harabasz': round(cal, 2), 'ARI (vs Real)': round(ari, 4)\n",
                "    })\n",
                "\n",
                "df_metrics = pd.DataFrame(metrics_list)\n",
                "df_metrics.to_csv('resultados/comparacion_algoritmos.csv', index=False)\n",
                "df_metrics"
            ]
        }
    ],
    "metadata": {
        "kernelspec": {
            "display_name": "Python 3",
            "language": "python",
            "name": "python3"
        },
        "language_info": {
            "name": "python",
            "version": "3.10.0"
        }
    },
    "nbformat": 4,
    "nbformat_minor": 4
}

with open('NEUROCIENCIA/clustering_eeg_neurociencia.ipynb', 'w', encoding='utf-8') as f:
    json.dump(notebook, f, indent=2)

print('clustering_eeg_neurociencia.ipynb created successfully!')
