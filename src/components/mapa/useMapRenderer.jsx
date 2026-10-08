/* global google */
import { useRef, useCallback } from "react";
import { MAPA_PALETA, corDaLinha, escurecer, suavizarCor } from "./mapaPaleta";

const escapeHtml = (valor) =>
String(valor ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const iconSizeCache = new Map();
const markerStateCache = new Map();
const blinkIntervals = new Map();
const areaPathSignature = (coords = []) => coords.map((c) => `${c[0] || c.lat},${c[1] || c.lng}`).join('|');

const setBlinkElement = (target, shouldBlink, applyVisibility) => {
  if (!target || typeof applyVisibility !== 'function') return;
  const targetId = target.__blinkId || `${Date.now()}_${Math.random()}`;
  target.__blinkId = targetId;

  if (!shouldBlink) {
    const existing = blinkIntervals.get(targetId);
    if (existing) {
      clearInterval(existing);
      blinkIntervals.delete(targetId);
    }
    applyVisibility(true);
    return;
  }

  if (blinkIntervals.has(targetId)) return;

  let visible = true;
  const interval = setInterval(() => {
    visible = !visible;
    applyVisibility(visible);
  }, 550);
  blinkIntervals.set(targetId, interval);
};

const setMarkerBlink = (marker, shouldBlink) => {
  setBlinkElement(marker, shouldBlink, (visible) => marker.setOpacity(visible ? 1 : 0.35));
};

const setOverlayBlink = (overlay, shouldBlink) => {
  setBlinkElement(overlay, shouldBlink, (visible) => {
    if (overlay?._div) {
      overlay._div.style.opacity = visible ? '1' : '0.2';
    }
  });
};

const applyMarkerIconPreservingAspectRatio = (marker, iconUrl, baseSize = 44, withLabel = false) => {
  if (!marker || !iconUrl || !window.google?.maps) return;

  const applyIcon = ({ width, height }) => {
    marker.setIcon({
      url: iconUrl,
      scaledSize: new google.maps.Size(width, height),
      anchor: new google.maps.Point(width / 2, height / 2),
      ...(withLabel ? { labelOrigin: new google.maps.Point(width / 2, Math.max(9, height * 0.34)) } : {})
    });
  };

  const cacheKey = `${iconUrl}_${baseSize}_${withLabel ? 1 : 0}`;
  const cached = iconSizeCache.get(cacheKey);
  if (cached) {
    applyIcon(cached);
    return;
  }

  const image = new Image();
  image.onload = () => {
    const widthRatio = image.naturalWidth || baseSize;
    const heightRatio = image.naturalHeight || baseSize;
    const ratio = widthRatio / heightRatio;
    const width = ratio >= 1 ? baseSize : Math.max(20, Math.round(baseSize * ratio));
    const height = ratio >= 1 ? Math.max(20, Math.round(baseSize / ratio)) : baseSize;
    const size = { width, height };
    iconSizeCache.set(cacheKey, size);
    applyIcon(size);
  };
  image.src = iconUrl;
};

/**
 * Hook de renderização incremental do mapa Google.
 * Suporta coloração dinâmica por modo, bordas grossas, visibilidade de nomes.
 */
export default function useMapRenderer(mapInstanceRef) {
  const polygonsRef = useRef(new Map());
  const labelsRef = useRef(new Map());
  const markersRef = useRef(new Map());
  const polylinesRef = useRef(new Map());
  const userMarkerRef = useRef(null);
  const userCircleRef = useRef(null);
  // Guardar cor atual de cada polígono para poder atualizar sem recriar
  const polyColorRef = useRef(new Map());
  const lotesIndicatorsRef = useRef(new Map());
  const clearAll = useCallback(() => {
    polygonsRef.current.forEach(p => p.setMap(null));
    polygonsRef.current.clear();
    labelsRef.current.forEach(l => l.setMap(null));
    labelsRef.current.clear();
    markersRef.current.forEach(m => {
      setMarkerBlink(m, false);
      m.setMap(null);
    });
    markersRef.current.clear();
    polylinesRef.current.forEach(entry => (entry.layers || [entry]).forEach(l => l.setMap(null)));
    polylinesRef.current.clear();
    polyColorRef.current.clear();
    lotesIndicatorsRef.current.forEach(i => i.setMap(null));
    lotesIndicatorsRef.current.clear();
    if (userMarkerRef.current) { userMarkerRef.current.setMap(null); userMarkerRef.current = null; }
    if (userCircleRef.current) { userCircleRef.current.setMap(null); userCircleRef.current = null; }
  }, []);

  // ─── Áreas (Polígonos) com coloração dinâmica ───
  const syncAreas = useCallback((areas, show, onClickArea, onRightClickArea, colorFn, fillOpacity = MAPA_PALETA.areaPreenchimento, hoverOpacity = MAPA_PALETA.areaPreenchimentoHover, strokeStyle = null) => {
    const map = mapInstanceRef.current;
    if (!map) return;

    const currentIds = new Set(show ? areas.map(a => a.id) : []);

    polygonsRef.current.forEach((poly, id) => {
      if (!currentIds.has(id)) {
        poly.setMap(null);
        polygonsRef.current.delete(id);
        polyColorRef.current.delete(id);
      }
    });

    if (!show) return;

    areas.forEach(area => {
      const coords = area.coordenadas?.coords || [];
      if (coords.length < 3) return;

      const paths = coords.map(c => ({ lat: c[0] || c.lat, lng: c[1] || c.lng }));
      const corSalva = area.coordenadas?.cor || area.cor;
      const corBase = corSalva ? suavizarCor(corSalva) : MAPA_PALETA.areaPadrao;
      const cor = colorFn ? (colorFn(area) || corBase) : corBase;
      const borda = strokeStyle?.color || escurecer(cor);
      const bordaOpacidade = strokeStyle?.opacity ?? 0.8;
      const bordaForca = strokeStyle?.weight ?? 1.2;

      if (polygonsRef.current.has(area.id)) {
        const poly = polygonsRef.current.get(area.id);
        const nextSignature = areaPathSignature(coords);

        if (poly._pathSignature !== nextSignature) {
          poly.setPaths(paths);
          poly._pathSignature = nextSignature;
        }

        poly.setOptions({ fillColor: cor, strokeColor: borda, strokeOpacity: bordaOpacidade, strokeWeight: bordaForca, fillOpacity });
        poly._fill = { base: fillOpacity, hover: hoverOpacity };
        poly._strokeOpacity = bordaOpacidade;
        poly._strokeWeight = bordaForca;
        polyColorRef.current.set(area.id, cor);

        poly._areaData = area;
        poly._color = cor;
        poly._stroke = borda;
        return;
      }

      const polygon = new google.maps.Polygon({
        paths,
        strokeColor: borda,
        strokeOpacity: bordaOpacidade,
        strokeWeight: bordaForca,
        fillColor: cor,
        fillOpacity,
        zIndex: 2,
      });
      polygon._areaData = area;
      polygon._color = cor;
      polygon._stroke = borda;
      polygon._strokeOpacity = bordaOpacidade;
      polygon._strokeWeight = bordaForca;
      polygon._fill = { base: fillOpacity, hover: hoverOpacity };
      polygon._pathSignature = areaPathSignature(coords);

      polygon.addListener('mouseover', function () {
        this.setOptions({ strokeColor: MAPA_PALETA.linhaContorno, strokeOpacity: 0.95, strokeWeight: 1.8, fillOpacity: this._fill?.hover ?? MAPA_PALETA.areaPreenchimentoHover, zIndex: 6 });
      });
      polygon.addListener('mouseout', function () {
        this.setOptions({ strokeColor: this._stroke, strokeOpacity: this._strokeOpacity ?? 0.8, strokeWeight: this._strokeWeight ?? 1.2, fillOpacity: this._fill?.base ?? MAPA_PALETA.areaPreenchimento, zIndex: 2 });
      });
      polygon.addListener('click', function (e) {
        if (e.vertex === undefined) {
          const coords = e?.latLng ? { lat: e.latLng.lat(), lng: e.latLng.lng() } : null;
          onClickArea(this._areaData, coords);
        }
      });
      polygon.addListener('rightclick', function (e) {
        const coords = e?.latLng ? { lat: e.latLng.lat(), lng: e.latLng.lng() } : null;
        onRightClickArea(this._areaData, coords);
      });

      polygon.setMap(map);
      polygonsRef.current.set(area.id, polygon);
      polyColorRef.current.set(area.id, cor);
    });
  }, [mapInstanceRef]);

  // ─── Labels dos nomes das áreas (separado para mostrar/esconder) ───
  // extraTextFn(area) => string | null — texto extra embaixo do nome
  const syncLabels = useCallback((areas, show, extraTextFn, showHectares = true) => {
    const map = mapInstanceRef.current;
    if (!map) return;

    const currentIds = new Set(show ? areas.map(a => a.id) : []);

    // Remover labels que não existem mais
    labelsRef.current.forEach((overlay, id) => {
      if (!currentIds.has(id)) {
        overlay.setMap(null);
        labelsRef.current.delete(id);
      }
    });

    if (!show) return;

    areas.forEach(area => {
      const extraText = extraTextFn ? extraTextFn(area) : null;
      const hectares = Number(area.area_pastejada || area.tamanho_hectares || 0);
      const hectaresText = showHectares && hectares > 0
        ? `ha ${hectares.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
        : null;

      // Se já existe, atualizar apenas o texto extra
      if (labelsRef.current.has(area.id)) {
        const existing = labelsRef.current.get(area.id);
        if (existing._labelDiv) {
          const titleLine = existing._labelDiv.querySelector('.label-title');
          const hectareLine = existing._labelDiv.querySelector('.label-hectares');
          const subLine = existing._labelDiv.querySelector('.label-extra');
          if (titleLine) titleLine.textContent = area.nome || '';
          if (hectareLine) {
            hectareLine.textContent = hectaresText || '';
            hectareLine.style.display = hectaresText ? 'block' : 'none';
          }
          if (subLine) {
            subLine.textContent = extraText || '';
            subLine.style.display = extraText ? 'block' : 'none';
          }
        }
        return;
      }

      const coords = area.coordenadas?.coords || [];
      if (coords.length < 3) return;

      const paths = coords.map(c => ({ lat: c[0] || c.lat, lng: c[1] || c.lng }));
      const center = calcCentroid(paths);

      const labelDiv = document.createElement('div');
      labelDiv.innerHTML = `
        <div style="display:flex;flex-direction:column;align-items:center;gap:1px;white-space:nowrap;pointer-events:none;font-family:Inter,Arial,sans-serif;text-align:center;text-shadow:0 1px 3px rgba(2,6,23,0.95),0 0 8px rgba(2,6,23,0.85);">
          <div class="label-title" style="font-size:11.5px;font-weight:700;color:#ffffff;letter-spacing:0.3px;line-height:1.25;">${escapeHtml(area.nome)}</div>
          <div class="label-hectares" style="font-size:10px;font-weight:600;color:#f1f5f9;line-height:1.25;${hectaresText ? '' : 'display:none;'}">${hectaresText || ''}</div>
          <div class="label-extra" style="font-size:10px;font-weight:700;color:#fde68a;line-height:1.25;${extraText ? '' : 'display:none;'}">${extraText || ''}</div>
        </div>`;

      const overlay = new google.maps.OverlayView();
      overlay._labelDiv = labelDiv;
      overlay.onAdd = function () { this.getPanes().markerLayer.appendChild(labelDiv); };
      overlay.draw = function () {
        const proj = this.getProjection();
        if (!proj) return;
        const pos = proj.fromLatLngToDivPixel(center);
        if (!pos) return;
        labelDiv.style.position = 'absolute';
        labelDiv.style.left = pos.x + 'px';
        labelDiv.style.top = pos.y + 'px';
        labelDiv.style.transform = 'translate(-50%, -50%)';
        labelDiv.style.zIndex = '100';
      };
      overlay.onRemove = function () { labelDiv.parentNode?.removeChild(labelDiv); };
      overlay.setMap(map);
      labelsRef.current.set(area.id, overlay);
    });
  }, [mapInstanceRef]);

  // ─── Pontos de Referência ───
  const syncPontos = useCallback((pontos, show, iconesConfig, onClickPonto) => {
    const map = mapInstanceRef.current;
    if (!map) return;
    const prefix = 'ponto_';
    const currentIds = new Set(show ? pontos.map(p => prefix + p.id) : []);
    markersRef.current.forEach((m, id) => { if (id.startsWith(prefix) && !currentIds.has(id)) { m.setMap(null); markersRef.current.delete(id); } });
    if (!show) return;
    pontos.forEach(ponto => {
      const key = prefix + ponto.id;
      const coords = ponto.coordenadas || {};
      if (!coords.lat || !coords.lng) return;
      const cfg = iconesConfig.find(ic => ic.id === ponto.configuracao_icone_id)
        || iconesConfig.find(ic => ic.tipo_entidade === 'Ponto' && ic.categoria?.toUpperCase().trim() === ponto.tipo?.toUpperCase().trim());
      const icon = cfg?.icone_url
        ? { path: google.maps.SymbolPath.CIRCLE, scale: 14, fillColor: 'transparent', fillOpacity: 0, strokeOpacity: 0 }
        : { path: google.maps.SymbolPath.CIRCLE, scale: 16, fillColor: cfg?.cor_padrao || ponto.cor || '#0066ff', fillOpacity: 1, strokeColor: '#fff', strokeWeight: 3 };

      if (markersRef.current.has(key)) {
        const marker = markersRef.current.get(key);
        const nextState = JSON.stringify({ lat: coords.lat, lng: coords.lng, title: ponto.nome, iconUrl: cfg?.icone_url || '', color: cfg?.cor_padrao || ponto.cor || '#0066ff' });
        if (markerStateCache.get(key) === nextState) { marker._ponto = ponto; marker.setClickable(true); return; }
        marker._ponto = ponto;
        marker.setPosition({ lat: coords.lat, lng: coords.lng });
        marker.setTitle(ponto.nome);
        marker._ponto = ponto;
        marker.setIcon(icon);
        if (cfg?.icone_url) applyMarkerIconPreservingAspectRatio(marker, cfg.icone_url, 30);
        markerStateCache.set(key, nextState);
        return;
      }

      const marker = new google.maps.Marker({ position: { lat: coords.lat, lng: coords.lng }, map, icon, title: ponto.nome, clickable: true, zIndex: 800 });
      marker._ponto = ponto;
      if (cfg?.icone_url) applyMarkerIconPreservingAspectRatio(marker, cfg.icone_url, 30);
      marker.addListener('click', () => {
        if (typeof onClickPonto === 'function') {
          onClickPonto(marker._ponto || ponto);
          return;
        }
        new google.maps.InfoWindow({ content: `<div style="padding:10px;"><strong>${ponto.nome}</strong><br/><span style="color:#666;">${ponto.tipo}</span></div>` }).open(map, marker);
      });
      markerStateCache.set(key, JSON.stringify({ lat: coords.lat, lng: coords.lng, title: ponto.nome, iconUrl: cfg?.icone_url || '', color: cfg?.cor_padrao || ponto.cor || '#0066ff' }));
      markersRef.current.set(key, marker);
    });
  }, [mapInstanceRef]);

  // ─── Linhas Geográficas (traçado cartográfico em camadas) ───
  const syncLinhas = useCallback((linhas, show) => {
    const map = mapInstanceRef.current;
    if (!map) return;
    const currentIds = new Set(show ? linhas.map(l => l.id) : []);

    polylinesRef.current.forEach((entry, id) => {
      if (!currentIds.has(id)) {
        (entry.layers || [entry]).forEach(layer => layer.setMap(null));
        entry.info?.close();
        polylinesRef.current.delete(id);
      }
    });

    if (!show) return;

    linhas.forEach((linha, index) => {
      const zIndex = 30 + index * 3;
      const coords = linha.coordenadas?.coords || [];
      if (coords.length < 2) return;

      const paths = coords.map(c => ({ lat: c[0] || c.lat, lng: c[1] || c.lng }));
      const cor = corDaLinha(linha);
      const assinatura = `${cor}|${paths.map(p => `${p.lat},${p.lng}`).join(';')}`;
      const existente = polylinesRef.current.get(linha.id);

      if (existente) {
        if (existente.assinatura !== assinatura) {
          existente.layers.forEach(layer => layer.setPath(paths));
          existente.assinatura = assinatura;
        }
        existente.layers[0].setOptions({ strokeColor: MAPA_PALETA.linhaSombra, strokeOpacity: 1, strokeWeight: 4.2, zIndex });
        existente.layers[1].setOptions({ strokeColor: MAPA_PALETA.linhaContorno, strokeOpacity: 0.8, strokeWeight: 3.2, zIndex: zIndex + 1 });
        existente.core.setOptions({ strokeColor: cor, strokeOpacity: 1, strokeWeight: 2.2, zIndex: zIndex + 2 });
        return;
      }

      const sombra = new google.maps.Polyline({ path: paths, strokeColor: MAPA_PALETA.linhaSombra, strokeOpacity: 1, strokeWeight: 4.2, zIndex, clickable: false, geodesic: true });
      const contorno = new google.maps.Polyline({ path: paths, strokeColor: MAPA_PALETA.linhaContorno, strokeOpacity: 0.8, strokeWeight: 3.2, zIndex: zIndex + 1, clickable: false, geodesic: true });
      const core = new google.maps.Polyline({ path: paths, strokeColor: cor, strokeOpacity: 1, strokeWeight: 2.2, zIndex: zIndex + 2, geodesic: true });

      const infoWindow = new google.maps.InfoWindow({ maxWidth: 260 });

      core.addListener('click', () => {
        const bounds = new google.maps.LatLngBounds();
        paths.forEach(p => bounds.extend(p));
        const metros = linha.comprimento_metros || (window.google?.maps?.geometry?.spherical ? google.maps.geometry.spherical.computeLength(paths) : null);
        const comprimento = metros ? `${(metros / 1000).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} km` : null;
        infoWindow.setContent(`
          <div style="font-family:Inter,Arial,sans-serif;min-width:150px;padding:2px 1px;">
            <div style="font-size:13px;font-weight:700;color:#0f172a;margin-bottom:3px;">${escapeHtml(linha.nome)}</div>
            <div style="display:flex;align-items:center;gap:6px;font-size:11px;color:#475569;">
              <span style="width:16px;height:4px;border-radius:2px;background:${cor};display:inline-block;"></span>
              ${escapeHtml(linha.tipo || '')}
            </div>
            ${comprimento ? `<div style="font-size:11px;color:#475569;margin-top:3px;">${comprimento}</div>` : ''}
          </div>`);
        infoWindow.setPosition(bounds.getCenter());
        infoWindow.open(map);
      });
      core.addListener('mouseover', () => core.setOptions({ strokeWeight: 2.8 }));
      core.addListener('mouseout', () => core.setOptions({ strokeWeight: 2.2 }));

      [sombra, contorno, core].forEach(layer => layer.setMap(map));
      polylinesRef.current.set(linha.id, { layers: [sombra, contorno, core], core, info: infoWindow, assinatura });
    });
  }, [mapInstanceRef]);

  // ─── Pontos de Suplementação ───
  const syncPontosSuplementacao = useCallback((pontosSupl, show, iconesConfig, onClick) => {
    const map = mapInstanceRef.current;
    if (!map) return;
    const prefix = 'supl_';
    const currentIds = new Set(show ? pontosSupl.map(p => prefix + p.id) : []);
    markersRef.current.forEach((m, id) => { if (id.startsWith(prefix) && !currentIds.has(id)) { m.setMap(null); markersRef.current.delete(id); } });
    if (!show) return;
    pontosSupl.forEach(ponto => {
      const key = prefix + ponto.id;
      const coords = ponto.coordenadas || {};
      if (!coords.lat || !coords.lng) return;
      const categoriaPonto = (ponto.categoria_ponto || ponto.tipo || 'COCHO').toUpperCase().trim();
      const cfg = iconesConfig.find((ic) => ic.tipo_entidade === 'Ponto' && ic.categoria?.toUpperCase().trim() === categoriaPonto)
        || iconesConfig.find((ic) => ic.tipo_entidade === 'Ponto' && ic.categoria?.toUpperCase().trim() === ponto.tipo?.toUpperCase().trim())
        || iconesConfig.find((ic) => ic.tipo_entidade === 'Ponto' && ic.categoria?.toUpperCase().trim() === 'COCHO');
      // Usar APENAS o ícone da ConfiguracaoIcone, não de PontoReferencia
      const iconUrl = cfg?.icone_url || null;
      const icon = iconUrl
        ? { path: google.maps.SymbolPath.CIRCLE, scale: 14, fillColor: 'transparent', fillOpacity: 0, strokeOpacity: 0 }
        : { path: google.maps.SymbolPath.CIRCLE, scale: 16, fillColor: cfg?.cor_padrao || '#10b981', fillOpacity: 1, strokeColor: '#fff', strokeWeight: 3 };

      if (markersRef.current.has(key)) {
        const marker = markersRef.current.get(key);
        const nextState = JSON.stringify({ lat: coords.lat, lng: coords.lng, title: ponto.nome_ponto, iconUrl: iconUrl || '', category: categoriaPonto });
        if (markerStateCache.get(key) === nextState) return;
        marker.setPosition({ lat: coords.lat, lng: coords.lng });
        marker.setTitle(ponto.nome_ponto);
        marker.setIcon(icon);
        if (iconUrl) applyMarkerIconPreservingAspectRatio(marker, iconUrl, 30);
        markerStateCache.set(key, nextState);
        return;
      }

      const marker = new google.maps.Marker({ position: { lat: coords.lat, lng: coords.lng }, map, icon, title: ponto.nome_ponto, zIndex: 500 });
      if (iconUrl) applyMarkerIconPreservingAspectRatio(marker, iconUrl, 30);
      marker.addListener('click', () => onClick(ponto));
      markerStateCache.set(key, JSON.stringify({ lat: coords.lat, lng: coords.lng, title: ponto.nome_ponto, iconUrl: iconUrl || '', category: categoriaPonto }));
      markersRef.current.set(key, marker);
    });
  }, [mapInstanceRef]);

  // ─── Lotes (agrupados por área) ───
  const syncLotes = useCallback((lotesFiltrados, areas, show, iconesConfig, onClickLotes, onDragLotes, canDragLotes = true, blinkAlerts = false) => {
    const map = mapInstanceRef.current;
    if (!map) return;
    const prefix = 'lote_area_';
    const lotesPorArea = {};
    if (show) {
      lotesFiltrados.forEach(lote => {
        if (!lote.area_atual_id) return;
        if (!lotesPorArea[lote.area_atual_id]) lotesPorArea[lote.area_atual_id] = [];
        lotesPorArea[lote.area_atual_id].push(lote);
      });
    }
    const currentIds = new Set(Object.keys(lotesPorArea).map(id => prefix + id));
    markersRef.current.forEach((m, id) => {
      if (id.startsWith(prefix) && !currentIds.has(id)) {
        setMarkerBlink(m, false);
        m.setMap(null);
        markersRef.current.delete(id);
      }
    });
    lotesIndicatorsRef.current.forEach((ind, id) => {
      if (id.startsWith(prefix) && !currentIds.has(id)) {
        setOverlayBlink(ind, false);
        ind.setMap(null);
        lotesIndicatorsRef.current.delete(id);
      }
    });
    if (!show) return;

    Object.entries(lotesPorArea).forEach(([areaId, lotesNaArea]) => {
      const key = prefix + areaId;
      const area = areas.find(a => a.id === areaId);
      if (!area || !area.coordenadas?.coords || area.coordenadas.coords.length < 3) return;
      const paths = area.coordenadas.coords.map(c => ({ lat: c[0] || c.lat, lng: c[1] || c.lng }));
      // Usar centróide real do polígono para centralizar melhor
      const centroid = calcCentroid(paths);
      const centroidLat = typeof centroid.lat === 'function' ? centroid.lat() : centroid.lat;
      const centroidLng = typeof centroid.lng === 'function' ? centroid.lng() : centroid.lng;
      // Deslocar levemente para cima para não sobrepor nome da área
      const bounds = new google.maps.LatLngBounds();
      paths.forEach(p => bounds.extend(p));
      const latSpan = bounds.getNorthEast().lat() - bounds.getSouthWest().lat();
      const offsetCenter = new google.maps.LatLng(centroidLat + latSpan * 0.12, centroidLng);
      const totalCabecas = lotesNaArea.reduce((sum, l) => sum + (l.quantidade_cabecas || 0), 0);
      const cats = [...new Set(lotesNaArea.map(l => l.categoria?.toUpperCase().trim()).filter(Boolean))].sort();
      const loteReferencia = lotesNaArea[0] || null;
      let cfg;
      if (cats.length === 1) {
        cfg = iconesConfig.find(ic => ic.tipo_entidade === 'Lote' && ic.categoria?.toUpperCase().trim() === cats[0]);
      } else if (cats.length > 1) {
        const mistos = iconesConfig.filter(ic => ic.tipo_entidade === 'Lote' && ic.categoria?.toUpperCase() === 'MISTO' && Array.isArray(ic.categorias_misto) && ic.categorias_misto.length > 0);
        const validos = mistos.filter(c => cats.every(cat => (c.categorias_misto || []).map(x => x.toUpperCase().trim()).includes(cat))).sort((a, b) => a.categorias_misto.length - b.categorias_misto.length);
        if (validos.length > 0) cfg = validos[0];
      }
      const icon = cfg?.icone_url
        ? { path: google.maps.SymbolPath.CIRCLE, scale: 14, fillColor: 'transparent', fillOpacity: 0, strokeOpacity: 0, labelOrigin: new google.maps.Point(0, 0) }
        : { path: google.maps.SymbolPath.CIRCLE, scale: 18, fillColor: '#10b981', fillOpacity: 1, strokeColor: '#fff', strokeWeight: 3, labelOrigin: new google.maps.Point(0, 0) };
      const totalAlertas = lotesNaArea.reduce((sum, l) => sum + (l.alertas?.length || 0), 0);

      // Helper para atualizar posição do indicador junto com o marcador
      const updateIndicatorPos = (marker, overlay) => {
        if (!overlay) return;
        const proj = overlay.getProjection?.();
        if (!proj) { try { overlay.draw(); } catch(e) {} return; }
        const pos = marker.getPosition();
        if (pos) { overlay._pos = pos; try { overlay.draw(); } catch(e) {} }
      };

      if (markersRef.current.has(key)) {
        const existing = markersRef.current.get(key);
        const nextState = JSON.stringify({
          lat: offsetCenter.lat(),
          lng: offsetCenter.lng(),
          totalCabecas,
          totalAlertas,
          title: area.nome,
          draggable: !!canDragLotes,
          iconUrl: cfg?.icone_url || '',
          categories: cats.join('|')
        });
        if (markerStateCache.get(key) !== nextState) {
          const lbl = existing.getLabel();
          if (lbl?.text !== String(totalCabecas)) existing.setLabel({ text: String(totalCabecas), color: '#fff', fontSize: '10px', fontWeight: 'bold' });
          existing.setPosition(offsetCenter);
          existing.setTitle(area.nome);
          existing.setZIndex(totalAlertas > 0 ? 2000 : 1000);
          existing.setDraggable(!!canDragLotes);
          existing.setIcon(icon);
          if (cfg?.icone_url) applyMarkerIconPreservingAspectRatio(existing, cfg.icone_url, 38, true);
          markerStateCache.set(key, nextState);
          const ind = lotesIndicatorsRef.current.get(key);
          if (ind) { ind._pos = offsetCenter; try { ind.draw(); } catch(e) {} }
        }
        setMarkerBlink(existing, false);
        existing._lotesNaArea = lotesNaArea;
        existing._center = offsetCenter;
        existing._areaId = areaId;
      } else {
        const marker = new google.maps.Marker({
          position: offsetCenter, map, icon,
          label: { text: String(totalCabecas), color: '#fff', fontSize: '10px', fontWeight: 'bold' },
          title: area.nome, zIndex: totalAlertas > 0 ? 2000 : 1000, draggable: !!canDragLotes
        });
        if (cfg?.icone_url) applyMarkerIconPreservingAspectRatio(marker, cfg.icone_url, 38, true);
        setMarkerBlink(marker, false);
        marker._lotesNaArea = lotesNaArea;
        marker._center = offsetCenter;
        marker._areaId = areaId;
        marker.addListener('click', () => onClickLotes(marker._lotesNaArea));
        // Durante o drag: mover indicador junto em tempo real
        marker.addListener('drag', () => {
          const ind = lotesIndicatorsRef.current.get(key);
          updateIndicatorPos(marker, ind);
        });
        marker.addListener('dragend', (e) => {
          const ind = lotesIndicatorsRef.current.get(key);
          updateIndicatorPos(marker, ind);
          onDragLotes(e.latLng, marker._lotesNaArea, areaId, areas);
        });
        markerStateCache.set(key, JSON.stringify({
          lat: offsetCenter.lat(),
          lng: offsetCenter.lng(),
          totalCabecas,
          totalAlertas,
          title: area.nome,
          draggable: !!canDragLotes,
          iconUrl: cfg?.icone_url || '',
          categories: cats.join('|')
        }));

        markersRef.current.set(key, marker);
      }

      // --- Identificador visual do lote (acoplado ao marcador) ---
      const identificadoresUnicos = [...new Map(
        lotesNaArea
          .filter((lote) => lote.identificador_cor || lote.identificador_sigla || lote.identificador_nome)
          .map((lote) => {
            const cor = lote.identificador_cor || '#64748b';
            const sigla = lote.identificador_sigla || lote.identificador_nome || '';
            const nome = lote.identificador_nome || sigla;
            return [`${cor}_${sigla}_${nome}`, { cor, sigla, nome }];
          })
      ).values()];

      const identificadores = identificadoresUnicos.length <= 1
        ? identificadoresUnicos
        : [{
            cor: 'linear-gradient(90deg, #000000 50%, #ffffff 50%)',
            nome: 'MISTO',
            sigla: ''
          }];
      let indicatorOverlay = lotesIndicatorsRef.current.get(key);
      const stateStr = JSON.stringify({
        identificadores,
        lat: offsetCenter.lat(),
        lng: offsetCenter.lng()
      });

      if (identificadores.length > 0) {
        if (!indicatorOverlay) {
          indicatorOverlay = new google.maps.OverlayView();
          const div = document.createElement('div');
          div.style.position = 'absolute';
          div.style.display = 'flex';
          div.style.alignItems = 'center';
          div.style.gap = '0';
          div.style.pointerEvents = 'none';
          div.style.zIndex = '2500';
          indicatorOverlay._div = div;
          indicatorOverlay._markerRef = markersRef.current.get(key);
          indicatorOverlay.onAdd = function() { this.getPanes().overlayMouseTarget.appendChild(div); };
          indicatorOverlay.draw = function() {
            const proj = this.getProjection();
            if (!proj) return;
            // Usar posição atual do marcador (se disponível) para seguir durante drag
            const m = this._markerRef || markersRef.current.get(key);
            const currentPos = m ? m.getPosition() : this._pos;
            if (!currentPos) return;
            const pos = proj.fromLatLngToDivPixel(currentPos);
            if (!pos) return;
            // Posição personalizada do identificador em relação ao ícone (ajustado para ícone 38px)
            div.style.left = `${pos.x + 15}px`;
            div.style.top = `${pos.y - 19}px`;
            div.style.transform = 'translate(-50%, -50%)';
          };
          indicatorOverlay.onRemove = function() { div.parentNode?.removeChild(div); };
          indicatorOverlay.setMap(map);
          lotesIndicatorsRef.current.set(key, indicatorOverlay);
        }
        // Atualizar referência ao marcador (pode ter sido recriado)
        indicatorOverlay._markerRef = markersRef.current.get(key);
        indicatorOverlay._pos = offsetCenter;
        if (indicatorOverlay._state !== stateStr) {
          indicatorOverlay._div.innerHTML = identificadores.map((i) => `<div title="${i.nome || i.sigla || ''}" style="width:12px;height:12px;border-radius:9999px;background:${i.cor};border:1.5px solid white;box-shadow:0 1px 3px rgba(0,0,0,0.4);display:flex;align-items:center;justify-content:center;font-size:6px;font-weight:700;color:#fff;line-height:1;overflow:hidden;">${i.sigla ? String(i.sigla).substring(0,2) : ''}</div>`).join('');
          indicatorOverlay._state = stateStr;
        }
        setOverlayBlink(indicatorOverlay, blinkAlerts && totalAlertas > 0);
        try { indicatorOverlay.draw(); } catch(e) {}
      } else if (indicatorOverlay) {
        setOverlayBlink(indicatorOverlay, false);
        indicatorOverlay.setMap(null);
        lotesIndicatorsRef.current.delete(key);
      }
    });
  }, [mapInstanceRef]);

  // ─── Tarefas ───
  const syncTarefas = useCallback((tarefasMapa, areas, iconesConfig, onClickTarefa) => {
    const map = mapInstanceRef.current;
    if (!map) return;
    const prefix = 'tarefa_';
    const currentIds = new Set(tarefasMapa.map(t => prefix + t.id));
    markersRef.current.forEach((m, id) => { if (id.startsWith(prefix) && !currentIds.has(id)) { m.setMap(null); markersRef.current.delete(id); } });
    const cores = { 'Baixa': '#94a3b8', 'Normal': '#3b82f6', 'Alta': '#f59e0b', 'Urgente': '#ef4444' };
    const normalizar = (valor) => (valor || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toUpperCase();
    tarefasMapa.forEach(t => {
      const key = prefix + t.id;

      let position = null;
      if (t.coordenadas?.lat && t.coordenadas?.lng) {
        position = { lat: t.coordenadas.lat, lng: t.coordenadas.lng };
      } else if (t.area_id) {
        const area = areas.find((item) => item.id === t.area_id);
        const coords = area?.coordenadas?.coords || [];
        if (coords.length >= 3) {
          const paths = coords.map(c => ({ lat: c[0] || c.lat, lng: c[1] || c.lng }));
          const center = calcCentroid(paths);
          position = { lat: center.lat(), lng: center.lng() };
        }
      }

      if (!position) return;

      const c = cores[t.prioridade] || '#3b82f6';
      const cfg = iconesConfig.find((icone) => icone.tipo_entidade === 'Prioridade Tarefa' && normalizar(icone.categoria) === normalizar(t.prioridade));
      const icon = cfg?.icone_url
        ? { path: google.maps.SymbolPath.CIRCLE, scale: 14, fillColor: 'transparent', fillOpacity: 0, strokeOpacity: 0 }
        : { path: 'M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z', fillColor: c, fillOpacity: 1, strokeColor: '#fff', strokeWeight: 2, scale: 1.8, anchor: new google.maps.Point(12, 22) };

      if (markersRef.current.has(key)) {
        const marker = markersRef.current.get(key);
        const nextState = JSON.stringify({ lat: position.lat, lng: position.lng, title: t.titulo, prioridade: t.prioridade, iconUrl: cfg?.icone_url || '' });
        if (markerStateCache.get(key) !== nextState) {
          marker.setPosition(position);
          marker.setTitle(t.titulo);
          marker.setZIndex(t.prioridade === 'Urgente' ? 3000 : 2500);
          marker.setIcon(icon);
          if (cfg?.icone_url) applyMarkerIconPreservingAspectRatio(marker, cfg.icone_url, 22);
          markerStateCache.set(key, nextState);
        }
        marker._tarefa = t;
        return;
      }

      const m = new google.maps.Marker({
        position, map, icon,
        title: t.titulo, zIndex: t.prioridade === 'Urgente' ? 3000 : 2500
      });
      if (cfg?.icone_url) applyMarkerIconPreservingAspectRatio(m, cfg.icone_url, 22);
      m._tarefa = t;
      m.addListener('click', () => onClickTarefa(m._tarefa));
      markerStateCache.set(key, JSON.stringify({ lat: position.lat, lng: position.lng, title: t.titulo, prioridade: t.prioridade, iconUrl: cfg?.icone_url || '' }));
      markersRef.current.set(key, m);
    });
  }, [mapInstanceRef]);

  // ─── Localização do Usuário ───
  const syncUserLocation = useCallback((userLocation, show) => {
    const map = mapInstanceRef.current;
    if (!map) return;
    if (!show || !userLocation) {
      if (userMarkerRef.current) { userMarkerRef.current.setMap(null); userMarkerRef.current = null; }
      if (userCircleRef.current) { userCircleRef.current.setMap(null); userCircleRef.current = null; }
      return;
    }
    if (!userMarkerRef.current) {
      userMarkerRef.current = new google.maps.Marker({ position: userLocation, map, icon: { path: google.maps.SymbolPath.CIRCLE, scale: 12, fillColor: '#4285F4', fillOpacity: 1, strokeColor: '#fff', strokeWeight: 3 }, title: 'Sua localização', zIndex: 10000 });
      userCircleRef.current = new google.maps.Circle({ map, center: userLocation, radius: 20, fillColor: '#4285F4', fillOpacity: 0.15, strokeColor: '#4285F4', strokeOpacity: 0.3, strokeWeight: 1, zIndex: 9999 });
    } else {
      userMarkerRef.current.setPosition(userLocation);
      userCircleRef.current.setCenter(userLocation);
    }
  }, [mapInstanceRef]);

  return { clearAll, syncAreas, syncLabels, syncPontos, syncLinhas, syncPontosSuplementacao, syncLotes, syncTarefas, syncUserLocation };
}

function calcCentroid(paths) {
  let cLat = 0, cLng = 0, sA = 0;
  for (let i = 0; i < paths.length; i++) {
    const x0 = paths[i].lat, y0 = paths[i].lng;
    const x1 = paths[(i + 1) % paths.length].lat, y1 = paths[(i + 1) % paths.length].lng;
    const a = x0 * y1 - x1 * y0;
    sA += a; cLat += (x0 + x1) * a; cLng += (y0 + y1) * a;
  }
  sA *= 0.5; cLat /= (6 * sA); cLng /= (6 * sA);
  if (!isFinite(cLat) || !isFinite(cLng) || !sA) {
    const b = new google.maps.LatLngBounds(); paths.forEach(p => b.extend(p)); return b.getCenter();
  }
  return new google.maps.LatLng(cLat, cLng);
}