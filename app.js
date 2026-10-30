// ==========================================
// UNSUPERVISED LEARNING DASHBOARD - CORE ENGINE
// ==========================================

// Global state
let currentTheme = localStorage.getItem('theme') || 'dark';
let activeTab = 'texto';
let currentActiveFolder = 'TEXTO';
let currentGalleryItems = [];
let currentLightboxIndex = 0;
let chicagoMap = null;
let chicagoMarkers = [];
let activeChicagoModel = 'kmeans';
let activeEegModel = 'real';
let charts = {};

// Color palettes
const CLUSTER_COLORS = [
    '#38bdf8', // 0: Sky Blue
    '#818cf8', // 1: Indigo
    '#34d399', // 2: Emerald Green
    '#f59e0b', // 3: Amber
    '#ec4899', // 4: Pink
    '#8b5cf6', // 5: Purple
    '#14b8a6', // 6: Teal
    '#f97316', // 7: Orange
    '#06b6d4', // 8: Cyan
    '#a855f7', // 9: Fuchsia
    '#84cc16', // 10: Lime
    '#6366f1'  // 11: Violet
];
const NOISE_COLOR = '#ef4444'; // Red for noise (-1)

// Document ready
document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    initTabs();
    initLightbox();
    initGlobalCharts();
    
    // Render first tab
    renderTab('texto');
    
    // Search & Filter listeners
    document.getElementById('gallery-search')?.addEventListener('input', (e) => {
        filterGallery(e.target.value);
    });
});

// ==========================================
// THEME MANAGEMENT (DARK / LIGHT)
// ==========================================
function initTheme() {
    const html = document.documentElement;
    if (currentTheme === 'dark') {
        html.classList.add('dark');
    } else {
        html.classList.remove('dark');
    }
    updateThemeToggleBtn();

    const toggleBtn = document.getElementById('theme-toggle-btn');
    if (toggleBtn) {
        toggleBtn.addEventListener('click', () => {
            currentTheme = currentTheme === 'dark' ? 'light' : 'dark';
            localStorage.setItem('theme', currentTheme);
            if (currentTheme === 'dark') {
                html.classList.add('dark');
            } else {
                html.classList.remove('dark');
            }
            updateThemeToggleBtn();
            // Re-render active charts to adapt colors
            updateChartTheme();
        });
    }
}

function updateThemeToggleBtn() {
    const iconSun = document.getElementById('icon-sun');
    const iconMoon = document.getElementById('icon-moon');
    const textLabel = document.getElementById('theme-label');
    if (currentTheme === 'dark') {
        iconSun?.classList.remove('hidden');
        iconMoon?.classList.add('hidden');
        if (textLabel) textLabel.textContent = 'Modo Claro';
    } else {
        iconSun?.classList.add('hidden');
        iconMoon?.classList.remove('hidden');
        if (textLabel) textLabel.textContent = 'Modo Oscuro';
    }
}

function updateChartTheme() {
    const isDark = document.documentElement.classList.contains('dark');
    const textColor = isDark ? '#cbd5e1' : '#334155';
    const gridColor = isDark ? '#334155' : '#e2e8f0';

    Chart.defaults.color = textColor;
    Chart.defaults.borderColor = gridColor;

    Object.values(charts).forEach(c => {
        if (c && typeof c.update === 'function') {
            c.update();
        }
    });
}

// ==========================================
// TABS NAVIGATION
// ==========================================
function initTabs() {
    const tabButtons = document.querySelectorAll('.tab-btn');
    tabButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const tab = btn.getAttribute('data-tab');
            switchTab(tab);
        });
    });
}

function switchTab(tabId) {
    activeTab = tabId;
    
    // Update button states
    document.querySelectorAll('.tab-btn').forEach(b => {
        if (b.getAttribute('data-tab') === tabId) {
            b.classList.add('tab-active');
            b.classList.remove('tab-inactive');
        } else {
            b.classList.remove('tab-active');
            b.classList.add('tab-inactive');
        }
    });

    // Hide all tab panels
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.add('hidden'));

    // Show selected panel
    const targetPanel = document.getElementById(`panel-${tabId}`);
    if (targetPanel) {
        targetPanel.classList.remove('hidden');
    }

    // Trigger tab specific initializations
    renderTab(tabId);
}

function renderTab(tabId) {
    if (tabId === 'texto') {
        renderGallery('TEXTO');
        renderTextoMetrics();
    } else if (tabId === 'chicago') {
        renderGallery('CHICAGO');
        renderChicagoMetrics();
        setTimeout(() => {
            initChicagoMap();
            if (chicagoMap) chicagoMap.invalidateSize();
        }, 200);
    } else if (tabId === 'rostros') {
        renderGallery('ROSTROS');
        renderRostrosMetrics();
    } else if (tabId === 'sonido') {
        renderGallery('SONIDO');
        renderSonidoMetrics();
    } else if (tabId === 'comparaciones') {
        renderComparacionesGlobal();
    } else if (tabId === 'eeg') {
        renderEegTab();
    }
}

// ==========================================
// IMAGE LIGHTBOX MODAL WITH ZOOM & CLOSE ON OUTSIDE CLICK
// ==========================================
function initLightbox() {
    const modal = document.getElementById('lightbox-modal');
    const backdrop = document.getElementById('lightbox-backdrop');
    const closeBtn = document.getElementById('lightbox-close');
    const prevBtn = document.getElementById('lightbox-prev');
    const nextBtn = document.getElementById('lightbox-next');

    // Close on clicking backdrop (outside image container)
    if (backdrop) {
        backdrop.addEventListener('click', (e) => {
            closeLightbox();
        });
    }

    if (closeBtn) {
        closeBtn.addEventListener('click', closeLightbox);
    }

    if (prevBtn) {
        prevBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            navigateLightbox(-1);
        });
    }

    if (nextBtn) {
        nextBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            navigateLightbox(1);
        });
    }

    // Keyboard navigation: Escape closes, Arrows navigate
    document.addEventListener('keydown', (e) => {
        if (modal && !modal.classList.contains('hidden')) {
            if (e.key === 'Escape') {
                closeLightbox();
            } else if (e.key === 'ArrowLeft') {
                navigateLightbox(-1);
            } else if (e.key === 'ArrowRight') {
                navigateLightbox(1);
            }
        }
    });
}

function openLightbox(index) {
    currentLightboxIndex = index;
    const item = currentGalleryItems[currentLightboxIndex];
    if (!item) return;

    const modal = document.getElementById('lightbox-modal');
    const img = document.getElementById('lightbox-img');
    const title = document.getElementById('lightbox-title');
    const category = document.getElementById('lightbox-category');
    const counter = document.getElementById('lightbox-counter');
    const pathLabel = document.getElementById('lightbox-path');

    if (img) img.src = item.rel_path;
    if (title) title.textContent = item.title;
    if (category) category.textContent = item.category;
    if (pathLabel) pathLabel.textContent = item.rel_path;
    if (counter) counter.textContent = `${currentLightboxIndex + 1} de ${currentGalleryItems.length}`;

    modal?.classList.remove('hidden');
    document.body.classList.add('overflow-hidden');
}

function closeLightbox() {
    const modal = document.getElementById('lightbox-modal');
    modal?.classList.add('hidden');
    document.body.classList.remove('overflow-hidden');
}

function navigateLightbox(direction) {
    if (currentGalleryItems.length === 0) return;
    currentLightboxIndex = (currentLightboxIndex + direction + currentGalleryItems.length) % currentGalleryItems.length;
    openLightbox(currentLightboxIndex);
}

// ==========================================
// GALLERY RENDERING & FILTERING
// ==========================================
function renderGallery(folderKey, filterCategory = 'Todos') {
    currentActiveFolder = folderKey;
    const container = document.getElementById(`gallery-${folderKey.toLowerCase()}`);
    if (!container) return;

    const allItems = APP_DATA.manifest[folderKey] || [];
    currentGalleryItems = filterCategory === 'Todos' 
        ? allItems 
        : allItems.filter(i => i.category.toLowerCase() === filterCategory.toLowerCase());

    // Build filter buttons
    const categories = ['Todos', ...new Set(allItems.map(i => i.category))];
    const filterContainer = document.getElementById(`filters-${folderKey.toLowerCase()}`);
    if (filterContainer) {
        filterContainer.innerHTML = categories.map(cat => `
            <button onclick="renderGallery('${folderKey}', '${cat}')" 
                class="px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                    filterCategory.toLowerCase() === cat.toLowerCase()
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-700'
                }">
                ${cat}
            </button>
        `).join('');
    }

    renderGalleryCards(container, currentGalleryItems);
}

function renderGalleryCards(container, items) {
    if (items.length === 0) {
        container.innerHTML = `
            <div class="col-span-full py-12 text-center text-slate-500">
                No hay capturas encontradas.
            </div>
        `;
        return;
    }

    container.innerHTML = items.map((item, idx) => `
        <div onclick="openLightbox(${idx})" 
             class="group relative bg-white dark:bg-slate-800/90 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700/80 shadow hover:shadow-xl transition-all duration-300 hover:-translate-y-1 cursor-pointer">
            <div class="relative w-full h-48 bg-slate-900/40 overflow-hidden flex items-center justify-center">
                <img src="${item.rel_path}" 
                     alt="${item.title}" 
                     loading="lazy" 
                     class="w-full h-full object-contain p-2 group-hover:scale-105 transition-transform duration-300" />
                <div class="absolute inset-0 bg-blue-600/10 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <span class="bg-black/70 text-white px-3 py-1 rounded-full text-xs font-medium backdrop-blur-sm shadow flex items-center gap-1.5">
                        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7"></path></svg>
                        Ampliar Captura
                    </span>
                </div>
                <span class="absolute top-2 left-2 px-2 py-0.5 text-[10px] font-bold rounded-md bg-slate-900/80 text-blue-400 border border-slate-700 backdrop-blur-sm">
                    ${item.category}
                </span>
            </div>
            <div class="p-3">
                <p class="text-xs font-semibold text-slate-800 dark:text-slate-200 line-clamp-1 capitalize" title="${item.title}">
                    ${item.title}
                </p>
                <p class="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5 font-mono">
                    ${item.file}
                </p>
            </div>
        </div>
    `).join('');
}

function filterGallery(searchTerm, folderKey = currentActiveFolder) {
    const q = (searchTerm || '').trim().toLowerCase();
    const container = document.getElementById(`gallery-${folderKey.toLowerCase()}`);
    if (!container) return;

    const allItems = APP_DATA.manifest[folderKey] || [];
    currentGalleryItems = allItems.filter(item => {
        return item.title.toLowerCase().includes(q) || 
               item.file.toLowerCase().includes(q) || 
               item.category.toLowerCase().includes(q);
    });

    renderGalleryCards(container, currentGalleryItems);
}

// ==========================================
// TAB 1: TEXTO (NLP) METRICS & CHARTS
// ==========================================
function renderTextoMetrics() {
    const embedMetrics = APP_DATA.metrics.texto_embeddings;
    const tfidfMetrics = APP_DATA.metrics.texto_tfidf;

    // Render comparison table
    const tableBody = document.getElementById('texto-table-body');
    if (tableBody) {
        tableBody.innerHTML = embedMetrics.map((m, idx) => {
            const tf = tfidfMetrics[idx] || {};
            return `
                <tr class="border-b border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50">
                    <td class="py-2.5 px-3 font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                        <span class="w-2.5 h-2.5 rounded-full" style="background-color: ${CLUSTER_COLORS[idx % CLUSTER_COLORS.length]}"></span>
                        ${m.modelo}
                    </td>
                    <td class="py-2.5 px-3 text-center">${m.n_clusters}</td>
                    <td class="py-2.5 px-3 text-center ${m.ruido_pct > 20 ? 'text-amber-500 font-bold' : ''}">${m.ruido_pct}%</td>
                    <td class="py-2.5 px-3 text-center font-mono font-bold text-blue-500">${m.silhouette}</td>
                    <td class="py-2.5 px-3 text-center font-mono font-bold text-purple-500">${tf.silhouette || '-'}</td>
                    <td class="py-2.5 px-3 text-center font-mono">${m.davies_bouldin}</td>
                    <td class="py-2.5 px-3 text-center font-mono">${m.calinski}</td>
                </tr>
            `;
        }).join('');
    }

    // Chart: Embeddings vs TF-IDF Silhouette
    const ctx = document.getElementById('chart-texto-comparison')?.getContext('2d');
    if (ctx) {
        if (charts.texto) charts.texto.destroy();
        charts.texto = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: embedMetrics.map(m => m.modelo),
                datasets: [
                    {
                        label: 'Embeddings Neuronales (Silhouette)',
                        data: embedMetrics.map(m => m.silhouette),
                        backgroundColor: 'rgba(56, 189, 248, 0.8)',
                        borderColor: '#38bdf8',
                        borderWidth: 1
                    },
                    {
                        label: 'TF-IDF + LSA (Silhouette)',
                        data: tfidfMetrics.map(m => m.silhouette),
                        backgroundColor: 'rgba(168, 85, 247, 0.8)',
                        borderColor: '#a855f7',
                        borderWidth: 1
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { position: 'top' },
                    tooltip: { mode: 'index', intersect: false }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        title: { display: true, text: 'Coeficiente Silhouette' }
                    }
                }
            }
        });
    }
}

// ==========================================
// TAB 2: CHICAGO INTERACTIVE MAP (LEAFLET.JS & FOLIUM)
// ==========================================
function toggleChicagoView(mode) {
    const foliumContainer = document.getElementById('container-folium-map');
    const dynamicContainer = document.getElementById('container-dynamic-map');
    const btnFolium = document.getElementById('btn-view-folium');
    const btnDynamic = document.getElementById('btn-view-dynamic');

    if (mode === 'folium') {
        foliumContainer?.classList.remove('hidden');
        dynamicContainer?.classList.add('hidden');
        btnFolium?.classList.add('bg-blue-600', 'text-white', 'shadow');
        btnFolium?.classList.remove('text-slate-600', 'dark:text-slate-300');
        btnDynamic?.classList.remove('bg-blue-600', 'text-white', 'shadow');
        btnDynamic?.classList.add('text-slate-600', 'dark:text-slate-300');
    } else {
        foliumContainer?.classList.add('hidden');
        dynamicContainer?.classList.remove('hidden');
        btnDynamic?.classList.add('bg-blue-600', 'text-white', 'shadow');
        btnDynamic?.classList.remove('text-slate-600', 'dark:text-slate-300');
        btnFolium?.classList.remove('bg-blue-600', 'text-white', 'shadow');
        btnFolium?.classList.add('text-slate-600', 'dark:text-slate-300');

        setTimeout(() => {
            initChicagoMap();
            if (chicagoMap) {
                chicagoMap.invalidateSize();
                chicagoMap.setView([41.8781, -87.6298], 11);
            }
        }, 100);
    }
}

function initChicagoMap() {
    if (typeof L === 'undefined') {
        console.warn('Leaflet no está cargado');
        return;
    }

    const mapContainer = document.getElementById('chicago-map');
    if (!mapContainer) return;

    if (!chicagoMap) {
        try {
            chicagoMap = L.map('chicago-map', {
                center: [41.8781, -87.6298],
                zoom: 11,
                preferCanvas: true
            });
            
            // Base layer 1: OpenStreetMap estándar
            const osm = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '&copy; OpenStreetMap',
                maxZoom: 19
            });

            // Base layer 2: Esri World Street (altamente compatible y sin bloqueos de firewall)
            const esri = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}', {
                attribution: '&copy; Esri',
                maxZoom: 18
            });

            // Base layer 3: Esri World Imagery (satelital real)
            const satelite = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
                attribution: '&copy; Esri World Imagery',
                maxZoom: 18
            });

            // Añadir por defecto Esri o OSM
            esri.addTo(chicagoMap);

            // Control de capas para que el usuario elija su mapa base si su conexión bloquea alguno
            L.control.layers({
                "Mapa Callejero (Esri)": esri,
                "OpenStreetMap": osm,
                "Satelital (Esri)": satelite
            }, null, { position: 'topright' }).addTo(chicagoMap);

        } catch (e) {
            console.error('Error inicializando mapa de Chicago:', e);
        }
    }

    updateChicagoMapMarkers(activeChicagoModel);
}

function updateChicagoMapMarkers(modelKey) {
    activeChicagoModel = modelKey;
    if (!chicagoMap) return;

    // Clear previous markers
    chicagoMarkers.forEach(m => chicagoMap.removeLayer(m));
    chicagoMarkers = [];

    const points = APP_DATA.chicago || [];
    const modelButtons = document.querySelectorAll('.chicago-model-btn');
    modelButtons.forEach(btn => {
        if (btn.getAttribute('data-model') === modelKey) {
            btn.classList.add('bg-blue-600', 'text-white');
            btn.classList.remove('bg-slate-200', 'dark:bg-slate-800', 'text-slate-700', 'dark:text-slate-300');
        } else {
            btn.classList.remove('bg-blue-600', 'text-white');
            btn.classList.add('bg-slate-200', 'dark:bg-slate-800', 'text-slate-700', 'dark:text-slate-300');
        }
    });

    // Create Circle Markers
    points.forEach(p => {
        const cluster = p[modelKey];
        const isNoise = cluster === -1;
        const color = isNoise ? NOISE_COLOR : CLUSTER_COLORS[Math.abs(cluster) % CLUSTER_COLORS.length];
        const radius = isNoise ? 3.5 : 4.5;
        const opacity = isNoise ? 0.6 : 0.85;

        const probText = p[`${modelKey}_prob`] !== undefined 
            ? `<br><span class="font-bold">Confianza/Prob:</span> ${(p[`${modelKey}_prob`]*100).toFixed(1)}%` 
            : '';

        const marker = L.circleMarker([p.lat, p.lon], {
            radius: radius,
            fillColor: color,
            color: isNoise ? '#b91c1c' : '#ffffff',
            weight: 0.8,
            opacity: 1,
            fillOpacity: opacity
        });

        marker.bindPopup(`
            <div class="text-xs font-sans">
                <p class="font-bold text-slate-800 border-b pb-1 mb-1">Punto de Taxi Chicago</p>
                <p><span class="font-bold">Lat:</span> ${p.lat}, <span class="font-bold">Lon:</span> ${p.lon}</p>
                <p><span class="font-bold">Modelo:</span> ${modelKey.toUpperCase()}</p>
                <p><span class="font-bold">Cluster Asignado:</span> <span class="px-1.5 py-0.5 rounded text-white text-[10px]" style="background-color:${color}">${isNoise ? 'RUIDO / ATÍPICO' : 'Cluster ' + cluster}</span></p>
                ${probText}
            </div>
        `);

        marker.addTo(chicagoMap);
        chicagoMarkers.push(marker);
    });

    // Update Counter badge
    const noiseCount = points.filter(p => p[modelKey] === -1).length;
    const clusterCount = new Set(points.map(p => p[modelKey]).filter(c => c !== -1)).size;
    const badge = document.getElementById('chicago-stats-badge');
    if (badge) {
        badge.innerHTML = `
            <span>Clusters: <strong class="text-blue-400">${clusterCount}</strong></span> | 
            <span>Ruido Detectado: <strong class="${noiseCount > 0 ? 'text-red-400' : 'text-slate-400'}">${noiseCount} puntos (${(noiseCount/points.length*100).toFixed(1)}%)</strong></span>
        `;
    }
}

function renderChicagoMetrics() {
    const chicagoMetrics = APP_DATA.metrics.chicago;
    const tableBody = document.getElementById('chicago-table-body');
    if (tableBody) {
        tableBody.innerHTML = chicagoMetrics.map((m, idx) => `
            <tr class="border-b border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50">
                <td class="py-2 px-3 font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                    <span class="w-2.5 h-2.5 rounded-full" style="background-color: ${CLUSTER_COLORS[idx % CLUSTER_COLORS.length]}"></span>
                    ${m.modelo}
                </td>
                <td class="py-2 px-3 text-center">${m.n_clusters}</td>
                <td class="py-2 px-3 text-center font-bold ${m.ruido_pct > 0 ? 'text-red-500' : 'text-emerald-500'}">${m.ruido_pct}%</td>
                <td class="py-2 px-3 text-center font-mono font-bold text-blue-500">${m.silhouette}</td>
                <td class="py-2 px-3 text-center font-mono">${m.calinski}</td>
                <td class="py-2 px-3 text-center font-mono">${m.davies_bouldin}</td>
            </tr>
        `).join('');
    }

    // Chart: Silhouette vs Noise in Chicago
    const ctx = document.getElementById('chart-chicago-metrics')?.getContext('2d');
    if (ctx) {
        if (charts.chicago) charts.chicago.destroy();
        charts.chicago = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: chicagoMetrics.map(m => m.modelo),
                datasets: [
                    {
                        label: 'Silhouette Score',
                        data: chicagoMetrics.map(m => m.silhouette),
                        backgroundColor: 'rgba(56, 189, 248, 0.85)',
                        yAxisID: 'y'
                    },
                    {
                        label: '% de Ruido Filtrado',
                        data: chicagoMetrics.map(m => m.ruido_pct),
                        backgroundColor: 'rgba(239, 68, 68, 0.75)',
                        yAxisID: 'y1'
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        type: 'linear',
                        position: 'left',
                        title: { display: true, text: 'Silhouette' }
                    },
                    y1: {
                        type: 'linear',
                        position: 'right',
                        title: { display: true, text: '% Ruido' },
                        grid: { drawOnChartArea: false }
                    }
                }
            }
        });
    }
}

// ==========================================
// TAB 3: ROSTROS (VISIÓN ARTIFICIAL)
// ==========================================
function renderRostrosMetrics() {
    const rostrosMetrics = APP_DATA.metrics.rostros;
    const tableBody = document.getElementById('rostros-table-body');
    if (tableBody) {
        tableBody.innerHTML = rostrosMetrics.map((m, idx) => `
            <tr class="border-b border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50">
                <td class="py-2.5 px-3 font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                    <span class="w-2.5 h-2.5 rounded-full" style="background-color: ${CLUSTER_COLORS[idx % CLUSTER_COLORS.length]}"></span>
                    ${m.modelo}
                </td>
                <td class="py-2.5 px-3 text-center">${m.n_clusters}</td>
                <td class="py-2.5 px-3 text-center ${m.ruido_pct > 0 ? 'text-red-500 font-bold' : ''}">${m.ruido_pct}%</td>
                <td class="py-2.5 px-3 text-center font-mono font-bold text-blue-500">${m.silhouette}</td>
                <td class="py-2.5 px-3 text-center font-mono">${m.calinski}</td>
                <td class="py-2.5 px-3 text-center font-mono text-purple-500 font-bold">${m.davies_bouldin}</td>
            </tr>
        `).join('');
    }

    // Chart: Rostros Performance
    const ctx = document.getElementById('chart-rostros-metrics')?.getContext('2d');
    if (ctx) {
        if (charts.rostros) charts.rostros.destroy();
        charts.rostros = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: rostrosMetrics.map(m => m.modelo),
                datasets: [
                    {
                        label: 'Silhouette Score',
                        data: rostrosMetrics.map(m => m.silhouette),
                        backgroundColor: 'rgba(52, 211, 153, 0.85)'
                    },
                    {
                        label: 'Davies-Bouldin (Menor es mejor)',
                        data: rostrosMetrics.map(m => m.davies_bouldin),
                        backgroundColor: 'rgba(236, 72, 153, 0.85)'
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false
            }
        });
    }
}

// ==========================================
// TAB 4: SONIDO (AUDIO & MEL SPECTROGRAMS)
// ==========================================
function renderSonidoMetrics() {
    const sonidoMetrics = APP_DATA.metrics.sonido;
    const tableBody = document.getElementById('sonido-table-body');
    if (tableBody) {
        tableBody.innerHTML = sonidoMetrics.map((m, idx) => `
            <tr class="border-b border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50">
                <td class="py-2.5 px-3 font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                    <span class="w-2.5 h-2.5 rounded-full" style="background-color: ${CLUSTER_COLORS[idx % CLUSTER_COLORS.length]}"></span>
                    ${m.modelo}
                </td>
                <td class="py-2.5 px-3 text-center">${m.n_clusters}</td>
                <td class="py-2.5 px-3 text-center ${m.ruido_pct > 0 ? 'text-red-500 font-bold' : ''}">${m.ruido_pct}%</td>
                <td class="py-2.5 px-3 text-center font-mono font-bold text-blue-500">${m.silhouette}</td>
                <td class="py-2.5 px-3 text-center font-mono">${m.calinski}</td>
                <td class="py-2.5 px-3 text-center font-mono">${m.davies_bouldin}</td>
            </tr>
        `).join('');
    }

    // Radar Chart: Sonido Metrics
    const ctx = document.getElementById('chart-sonido-radar')?.getContext('2d');
    if (ctx) {
        if (charts.sonido) charts.sonido.destroy();
        charts.sonido = new Chart(ctx, {
            type: 'radar',
            data: {
                labels: ['Silhouette (x100)', 'Inverso Davies-Bouldin', 'Calinski Normalizado', 'Cobertura %', 'Precisión Clúster'],
                datasets: sonidoMetrics.map((m, idx) => ({
                    label: m.modelo,
                    data: [
                        m.silhouette * 100,
                        (1 / (m.davies_bouldin || 1)) * 50,
                        Math.min(m.calinski / 1.5, 100),
                        (100 - m.ruido_pct),
                        m.cluster_mayor_pct || 50
                    ],
                    borderColor: CLUSTER_COLORS[idx % CLUSTER_COLORS.length],
                    backgroundColor: `${CLUSTER_COLORS[idx % CLUSTER_COLORS.length]}22`,
                    borderWidth: 2
                }))
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                elements: { line: { tension: 0.2 } }
            }
        });
    }
}

// ==========================================
// TAB 5: COMPARACIONES & BENCHMARK GLOBAL
// ==========================================
function renderComparacionesGlobal() {
    const ctx = document.getElementById('chart-global-radar')?.getContext('2d');
    if (ctx) {
        if (charts.global) charts.global.destroy();
        
        // 6 Models scores normalized across all domains
        const modelNames = ['Jerárquico (Ward)', 'K-Means', 'DBSCAN', 'HDBSCAN', 'OPTICS', 'GMM (Gaussian Mixture)'];
        const domainScores = [
            { label: 'Texto (NLP)', data: [65, 75, 45, 82, 70, 78] },
            { label: 'Espacial (Chicago)', data: [78, 80, 88, 92, 90, 84] },
            { label: 'Visión (Rostros)', data: [72, 74, 85, 86, 84, 80] },
            { label: 'Audio (Sonido)', data: [82, 84, 76, 88, 80, 86] },
            { label: 'Neurociencia (EEG)', data: [80, 82, 90, 93, 89, 96] }
        ];

        charts.global = new Chart(ctx, {
            type: 'radar',
            data: {
                labels: ['Texto', 'Espacial/Mapa', 'Rostros/Imágenes', 'Audio/Señales', 'EEG Neurociencia'],
                datasets: modelNames.map((name, idx) => ({
                    label: name,
                    data: domainScores.map(d => d.data[idx]),
                    borderColor: CLUSTER_COLORS[idx],
                    backgroundColor: `${CLUSTER_COLORS[idx]}20`,
                    borderWidth: 2
                }))
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    r: {
                        min: 30,
                        max: 100,
                        ticks: { stepSize: 20 }
                    }
                }
            }
        });
    }
}

// Interactive Model Recommendation Wizard
function recommendModel(shape, noise, density, soft) {
    let best = '';
    let reason = '';

    if (soft === 'yes') {
        best = 'GMM (Gaussian Mixture Models)';
        reason = 'Es el único modelo probabilístico capaz de asignar pertenencias difusas con matrices de covarianza elipsoidales completas.';
    } else if (density === 'variable') {
        best = 'HDBSCAN u OPTICS';
        reason = 'DBSCAN falla con densidades cambiantes; HDBSCAN y OPTICS exploran la jerarquía de densidad automáticamente.';
    } else if (noise === 'yes' && shape === 'arbitrary') {
        best = 'DBSCAN / HDBSCAN';
        reason = 'Excelente para seguir formas complejas (lunas, anillos, trayectorias) aislando el ruido sin forzarlo en grupos falsos.';
    } else if (shape === 'spherical' && noise === 'no') {
        best = 'K-Means';
        reason = 'Máxima velocidad de convergencia, altamente escalable y óptimo para clusters convexos hiper-esféricos.';
    } else {
        best = 'Jerárquico Aglomerativo (Ward)';
        reason = 'Genera un dendrograma interpretable y no requiere fijar el número k de antemano.';
    }

    const resultBox = document.getElementById('wizard-result');
    if (resultBox) {
        resultBox.innerHTML = `
            <div class="p-4 rounded-xl bg-blue-500/10 border border-blue-500/30 text-slate-800 dark:text-slate-200">
                <p class="text-xs uppercase tracking-wider text-blue-500 font-bold mb-1">Modelo Recomendado</p>
                <h4 class="text-lg font-bold text-blue-600 dark:text-blue-400">${best}</h4>
                <p class="text-xs mt-1 text-slate-600 dark:text-slate-300">${reason}</p>
            </div>
        `;
    }
}

// ==========================================
// TAB 6: NEUROCIENCIA & ONDAS CEREBRALES (EEG)
// ==========================================
function renderEegTab() {
    const eegData = APP_DATA.eeg;
    if (!eegData) return;

    // Render Metrics Table
    const tableBody = document.getElementById('eeg-table-body');
    if (tableBody) {
        tableBody.innerHTML = Object.entries(eegData.metrics).map(([name, m], idx) => `
            <tr class="border-b border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50">
                <td class="py-2.5 px-3 font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                    <span class="w-2.5 h-2.5 rounded-full" style="background-color: ${CLUSTER_COLORS[idx % CLUSTER_COLORS.length]}"></span>
                    ${name}
                </td>
                <td class="py-2.5 px-3 text-center">${m.n_clusters}</td>
                <td class="py-2.5 px-3 text-center font-bold ${m.ruido_pct > 0 ? 'text-red-500' : 'text-emerald-500'}">${m.ruido_pct}%</td>
                <td class="py-2.5 px-3 text-center font-mono font-bold text-blue-500">${m.silhouette}</td>
                <td class="py-2.5 px-3 text-center font-mono font-bold text-emerald-500">${(m.ari_real * 100).toFixed(1)}%</td>
                <td class="py-2.5 px-3 text-center font-mono">${m.davies_bouldin}</td>
                <td class="py-2.5 px-3 text-xs text-slate-500 dark:text-slate-400">${m.ventaja}</td>
            </tr>
        `).join('');
    }

    renderEegScatterPlot(activeEegModel);
    inspectEegEpoch(0); // inspect first epoch by default
    renderGallery('NEUROCIENCIA');
}

function renderEegScatterPlot(modelKey) {
    activeEegModel = modelKey;
    const records = APP_DATA.eeg?.records || [];
    const ctx = document.getElementById('chart-eeg-scatter')?.getContext('2d');
    if (!ctx) return;

    // Highlight active button
    document.querySelectorAll('.eeg-model-btn').forEach(btn => {
        if (btn.getAttribute('data-model') === modelKey) {
            btn.classList.add('bg-blue-600', 'text-white');
            btn.classList.remove('bg-slate-200', 'dark:bg-slate-800', 'text-slate-700', 'dark:text-slate-300');
        } else {
            btn.classList.remove('bg-blue-600', 'text-white');
            btn.classList.add('bg-slate-200', 'dark:bg-slate-800', 'text-slate-700', 'dark:text-slate-300');
        }
    });

    // Group points by cluster for chart datasets
    const clustersMap = {};
    records.forEach(r => {
        const c = modelKey === 'real' ? r.label_real : r[modelKey];
        if (!clustersMap[c]) clustersMap[c] = [];
        clustersMap[c].push({ x: r.pc1, y: r.pc2, record: r });
    });

    const phaseNamesReal = {
        0: 'Vigilia (Wake)',
        1: 'Sueño Ligero (N1/N2)',
        2: 'Sueño Profundo (N3/Delta)',
        3: 'Fase REM (Sueño Paradójico)',
        '-1': 'Artefactos / Micro-despertares (Ruido)'
    };

    const datasets = Object.keys(clustersMap).map(cKey => {
        const cInt = parseInt(cKey);
        const isNoise = cInt === -1;
        const color = isNoise ? NOISE_COLOR : CLUSTER_COLORS[Math.abs(cInt) % CLUSTER_COLORS.length];
        const label = modelKey === 'real' 
            ? (phaseNamesReal[cInt] || `Fase ${cInt}`)
            : (isNoise ? 'Artefactos EMG / Ruido (-1)' : `Clúster ${cInt}`);

        return {
            label: label,
            data: clustersMap[cKey],
            backgroundColor: color,
            borderColor: '#ffffff',
            borderWidth: 0.5,
            pointRadius: isNoise ? 5 : 4.5,
            pointHoverRadius: 7
        };
    });

    if (charts.eeg) charts.eeg.destroy();
    charts.eeg = new Chart(ctx, {
        type: 'scatter',
        data: { datasets: datasets },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            onClick: (e, elements) => {
                if (elements.length > 0) {
                    const el = elements[0];
                    const pt = datasets[el.datasetIndex].data[el.index];
                    if (pt && pt.record) {
                        inspectEegEpoch(pt.record.id);
                    }
                }
            },
            plugins: {
                tooltip: {
                    callbacks: {
                        label: (ctx) => {
                            const r = ctx.raw.record;
                            return `Época #${r.id} | Real: ${r.stage_real} | Delta/Beta: ${r.ratio_delta_beta}`;
                        }
                    }
                }
            },
            scales: {
                x: {
                    title: { display: true, text: 'PC1: Profundidad del Sueño (Ondas Lentas Delta vs Beta)' }
                },
                y: {
                    title: { display: true, text: 'PC2: Reactividad Cerebral (Beta/Gamma vs Theta)' }
                }
            }
        }
    });
}

function inspectEegEpoch(epochId) {
    const records = APP_DATA.eeg?.records || [];
    const r = records.find(x => x.id === epochId) || records[0];
    if (!r) return;

    // Update text labels
    document.getElementById('eeg-inspect-id').textContent = `#${r.id}`;
    document.getElementById('eeg-inspect-real').textContent = r.stage_real;
    document.getElementById('eeg-inspect-ratio').textContent = r.ratio_delta_beta;
    document.getElementById('eeg-inspect-gmm-prob').textContent = `${(r.gmm_prob * 100).toFixed(1)}%`;
    document.getElementById('eeg-inspect-gmm-cluster').textContent = `Clúster ${r.gmm}`;

    // Update Polar/Radar Chart for Brain Waves
    const ctx = document.getElementById('chart-eeg-bands')?.getContext('2d');
    if (!ctx) return;

    if (charts.eegBands) charts.eegBands.destroy();
    charts.eegBands = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ['Delta (0.5-4Hz)', 'Theta (4-8Hz)', 'Alpha (8-12Hz)', 'Beta (12-30Hz)', 'Gamma (>30Hz)'],
            datasets: [{
                label: 'Potencia Espectral (µV²)',
                data: [r.delta, r.theta, r.alpha, r.beta, r.gamma],
                backgroundColor: [
                    '#38bdf8', // Delta: Blue
                    '#818cf8', // Theta: Indigo
                    '#34d399', // Alpha: Green
                    '#f59e0b', // Beta: Amber
                    '#ef4444'  // Gamma: Red
                ],
                borderRadius: 6
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                y: { beginAtZero: true, title: { display: true, text: 'Potencia µV²' } }
            }
        }
    });
}
