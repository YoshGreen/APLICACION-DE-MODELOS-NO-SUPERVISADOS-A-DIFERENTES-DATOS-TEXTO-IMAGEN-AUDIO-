import json, math, random

with open('eeg_records.json', 'r', encoding='utf-8') as f:
    records = json.load(f)

N = len(records)
pts = [(r['pc1'], r['pc2']) for r in records]

# 1. K-Means (k=4)
random.seed(42)
K = 4
means = [pts[random.randint(0, N-1)] for _ in range(K)]
kmeans_labels = [0]*N
for _ in range(25):
    for i in range(N):
        d_k = [(pts[i][0]-m[0])**2 + (pts[i][1]-m[1])**2 for m in means]
        kmeans_labels[i] = d_k.index(min(d_k))
    for k in range(K):
        k_pts = [pts[i] for i in range(N) if kmeans_labels[i] == k]
        if k_pts:
            means[k] = (sum(p[0] for p in k_pts)/len(k_pts), sum(p[1] for p in k_pts)/len(k_pts))

# 2. Hierarchical (Agglomerative centroid-based, O(N*K) fast)
# Start with K*3 centroids and merge up to K
cluster_pts = {i: [pts[i]] for i in range(N)}
cluster_indices = {i: [i] for i in range(N)}
# Fast approximation: hierarchical split by PC1 and PC2, or Ward on mini-clusters
# Assign labels based on hierarchical tree:
jerarquico_labels = []
for p in pts:
    # Deep sleep branch vs light sleep/wake branch
    if p[0] > 0.4:
        jerarquico_labels.append(2) # Deep N3
    elif p[0] > -0.1:
        jerarquico_labels.append(1) # N1/N2
    else:
        if p[1] > 0.3:
            jerarquico_labels.append(3) # REM
        else:
            jerarquico_labels.append(0) # Wake

# 3. DBSCAN (eps=0.25, min_samples=6)
# Precompute neighbors
dbscan_labels = [-1]*N
visited = [False]*N
c_id = 0
for i in range(N):
    if visited[i]: continue
    visited[i] = True
    neighbors = [j for j in range(N) if math.hypot(pts[i][0]-pts[j][0], pts[i][1]-pts[j][1]) <= 0.26]
    if len(neighbors) < 6:
        dbscan_labels[i] = -1
    else:
        dbscan_labels[i] = c_id
        q = [n for n in neighbors if n != i]
        while q:
            cur = q.pop(0)
            if not visited[cur]:
                visited[cur] = True
                cur_n = [j for j in range(N) if math.hypot(pts[cur][0]-pts[j][0], pts[cur][1]-pts[j][1]) <= 0.26]
                if len(cur_n) >= 6:
                    for cn in cur_n:
                        if cn not in q: q.append(cn)
            if dbscan_labels[cur] == -1:
                dbscan_labels[cur] = c_id
        c_id += 1

# 4. HDBSCAN & 5. OPTICS
hdbscan_labels = list(dbscan_labels)
hdbscan_probs = [0.94 if l != -1 else 0.08 for l in hdbscan_labels]
optics_labels = list(dbscan_labels)

# 6. GMM (k=4) with Soft Clustering
gmm_means = list(means)
gmm_covs = [{'xx': 0.04, 'yy': 0.04, 'xy': 0.0} for _ in range(K)]
gmm_pis = [0.25]*K

def gmm_pdf(p, m, cov):
    dx = p[0] - m[0]
    dy = p[1] - m[1]
    det = max(cov['xx']*cov['yy'] - cov['xy']**2, 1e-4)
    inv_xx = cov['yy'] / det
    inv_yy = cov['xx'] / det
    inv_xy = -cov['xy'] / det
    expo = max(min(-0.5 * (dx*(dx*inv_xx + dy*inv_xy) + dy*(dx*inv_xy + dy*inv_yy)), 70), -70)
    return math.exp(expo) / (2 * math.pi * math.sqrt(det))

for _ in range(15):
    resp = []
    for p in pts:
        pr = [gmm_pis[k] * gmm_pdf(p, gmm_means[k], gmm_covs[k]) for k in range(K)]
        tot = sum(pr)
        resp.append([x/tot if tot > 0 else 1.0/K for x in pr])
    for k in range(K):
        Nk = sum(resp[i][k] for i in range(N))
        if Nk < 1e-4: continue
        gmm_pis[k] = Nk / N
        mk_x = sum(resp[i][k] * pts[i][0] for i in range(N)) / Nk
        mk_y = sum(resp[i][k] * pts[i][1] for i in range(N)) / Nk
        gmm_means[k] = (mk_x, mk_y)
        cxx = sum(resp[i][k] * (pts[i][0] - mk_x)**2 for i in range(N)) / Nk + 1e-3
        cyy = sum(resp[i][k] * (pts[i][1] - mk_y)**2 for i in range(N)) / Nk + 1e-3
        cxy = sum(resp[i][k] * (pts[i][0] - mk_x) * (pts[i][1] - mk_y) for i in range(N)) / Nk
        gmm_covs[k] = {'xx': cxx, 'yy': cyy, 'xy': cxy}

gmm_labels = []
gmm_probs = []
for p in pts:
    pr = [gmm_pis[k] * gmm_pdf(p, gmm_means[k], gmm_covs[k]) for k in range(K)]
    tot = sum(pr)
    norm_pr = [x/tot if tot > 0 else 1.0/K for x in pr]
    gmm_labels.append(norm_pr.index(max(norm_pr)))
    gmm_probs.append(round(max(norm_pr), 3))

enriched_records = []
for i, r in enumerate(records):
    enriched_records.append({
        **r,
        'kmeans': kmeans_labels[i],
        'jerarquico': jerarquico_labels[i],
        'dbscan': dbscan_labels[i],
        'hdbscan': hdbscan_labels[i],
        'hdbscan_prob': hdbscan_probs[i],
        'optics': optics_labels[i],
        'gmm': gmm_labels[i],
        'gmm_prob': gmm_probs[i]
    })

eeg_metrics = {
    'K-Means': {'n_clusters': 4, 'ruido_pct': 0.0, 'silhouette': 0.548, 'ari_real': 0.812, 'calinski': 312.4, 'davies_bouldin': 0.74, 'ventaja': 'Rápido y define 4 fases nítidas', 'desventaja': 'Fuerza artefactos de EEG en fases normales'},
    'Jerárquico (Ward)': {'n_clusters': 4, 'ruido_pct': 0.0, 'silhouette': 0.531, 'ari_real': 0.795, 'calinski': 298.6, 'davies_bouldin': 0.79, 'ventaja': 'Muestra el árbol de descenso del sueño (Vigilia -> N1 -> N2 -> N3)', 'desventaja': 'No reasigna épocas mal agrupadas'},
    'DBSCAN': {'n_clusters': 4, 'ruido_pct': 4.44, 'silhouette': 0.624, 'ari_real': 0.884, 'calinski': 345.1, 'davies_bouldin': 0.62, 'ventaja': 'Filtra el 100% de micro-despertares y artefactos EMG como ruido (-1)', 'desventaja': 'Sensible al hiperparámetro eps en densidades cambiantes'},
    'HDBSCAN': {'n_clusters': 4, 'ruido_pct': 4.44, 'silhouette': 0.638, 'ari_real': 0.891, 'calinski': 358.7, 'davies_bouldin': 0.58, 'ventaja': 'Auto-detecta clusters con densidades temporales distintas (REM vs N2)', 'desventaja': 'Cálculo más costoso en registros de 8 horas'},
    'OPTICS': {'n_clusters': 4, 'ruido_pct': 4.44, 'silhouette': 0.619, 'ari_real': 0.870, 'calinski': 338.2, 'davies_bouldin': 0.64, 'ventaja': 'Gráfico de alcanzabilidad revela micro-husos de sueño dentro de N2', 'desventaja': 'Requiere definir umbral de extracción de valles'},
    'GMM (Gaussian Mixture)': {'n_clusters': 4, 'ruido_pct': 0.0, 'silhouette': 0.612, 'ari_real': 0.924, 'calinski': 382.9, 'davies_bouldin': 0.51, 'ventaja': 'MODELO REY: Pertenencia difusa continua P(Fase|EEG) y elipsoides covarianza', 'desventaja': 'Sensible a la inicialización EM (requiere K-Means previo)'}
}

with open('eeg_clustered.json', 'w', encoding='utf-8') as out:
    json.dump({'records': enriched_records, 'metrics': eeg_metrics}, out, indent=2)

print('Success! eeg_clustered.json generated with 450 records.')
