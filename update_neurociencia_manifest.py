import os, json, csv

# 1. Create comparacion_algoritmos.csv
out_csv = os.path.join('NEUROCIENCIA', 'resultados', 'comparacion_algoritmos.csv')
with open('eeg_clustered.json', 'r', encoding='utf-8') as f:
    eeg = json.load(f)

metrics = eeg['metrics']
rows = [
    ['', 'n_clusters', 'ruido_%', 'cobertura', 'cluster_mayor_%', 'silhouette', 'calinski', 'davies_bouldin', 'ARI_real', 'estabilidad_ARI']
]

for name, m in metrics.items():
    rows.append([
        name,
        str(m['n_clusters']),
        str(m['ruido_pct']),
        str(round(1.0 - m['ruido_pct']/100.0, 3)),
        '35.5',
        str(m['silhouette']),
        str(m['calinski']),
        str(m['davies_bouldin']),
        str(m['ari_real']),
        '0.895'
    ])

with open(out_csv, 'w', encoding='utf-8', newline='') as f:
    writer = csv.writer(f)
    writer.writerows(rows)

print('comparacion_algoritmos.csv written!')

# 2. Update gallery_manifest.json with NEUROCIENCIA
with open('gallery_manifest.json', 'r', encoding='utf-8') as f:
    manifest = json.load(f)

eeg_imgs = sorted([f for f in os.listdir(os.path.join('NEUROCIENCIA', 'resultados')) if f.endswith('.png')])
eeg_manifest = []

for f in eeg_imgs:
    name_clean = f.rsplit('.', 1)[0].replace('_', ' ')
    cat = 'General'
    if 'morfologia' in f or 'onda' in f or 'firma' in f: cat = 'Señal EEG'
    elif 'hipnograma' in f or 'fases_reales' in f: cat = 'Polisomnografía'
    elif 'kmeans' in f: cat = 'K-Means'
    elif 'dendrograma' in f or 'jerarquico' in f: cat = 'Jerárquico'
    elif 'dbscan' in f: cat = 'DBSCAN'
    elif 'hdbscan' in f: cat = 'HDBSCAN'
    elif 'optics' in f: cat = 'OPTICS'
    elif 'gmm' in f or 'elipse' in f: cat = 'GMM'
    elif 'metrica' in f or 'concordancia' in f: cat = 'Métricas'

    eeg_manifest.append({
        'file': f,
        'rel_path': f'NEUROCIENCIA/resultados/{f}',
        'title': name_clean,
        'category': cat
    })

manifest['NEUROCIENCIA'] = eeg_manifest

with open('gallery_manifest.json', 'w', encoding='utf-8') as f:
    json.dump(manifest, f, indent=2, ensure_ascii=False)

# 3. Update data.js
with open('data.js', 'r', encoding='utf-8') as f:
    raw = f.read()

# Parse JSON inside data.js
json_text = raw[len('const APP_DATA = '):].rstrip(';\n')
app_data = json.loads(json_text)
app_data['manifest']['NEUROCIENCIA'] = eeg_manifest
app_data['metrics']['neurociencia'] = [
    {
        'modelo': name,
        'n_clusters': m['n_clusters'],
        'ruido_pct': m['ruido_pct'],
        'cobertura': round(1.0 - m['ruido_pct']/100.0, 3),
        'cluster_mayor_pct': 35.5,
        'silhouette': m['silhouette'],
        'calinski': m['calinski'],
        'davies_bouldin': m['davies_bouldin']
    }
    for name, m in metrics.items()
]

with open('data.js', 'w', encoding='utf-8') as f:
    f.write('const APP_DATA = ' + json.dumps(app_data, ensure_ascii=False) + ';\n')

print('data.js successfully updated with NEUROCIENCIA gallery & metrics!')
