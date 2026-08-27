/* global google */
import { useRef, useCallback } from "react";

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
    polylinesRef.current.forEach(l => l.setMap(null));
    polylinesRef.current.clear();
    polyColorRef.current.clear();
    lotesIndicatorsRef.current.forEach(i => i.setMap(null));
    lotesIndicatorsRef.current.clear();
    if (userMarkerRef.current) { userMarkerRef.current.setMap(null); userMarkerRef.current = null; }
    if (userCircleRef.current) { userCircleRef.current.setMap(null); userCircleRef.current = null; }
  }, []);

  // ─── Áreas (Polígonos) com coloração dinâmica ───
  const syncAreas = useCallback((areas, show, onClickArea, onRightClickArea, colorFn) => {
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
      const corBase = area.coordenadas?.cor || area.cor || '#61aad9';
      const cor = colorFn ? (colorFn(area) || corBase) : corBase;

      if (polygonsRef.current.has(area.id)) {
        const poly = polygonsRef.current.get(area.id);
        const prevCor = polyColorRef.current.get(area.id);
        const nextSignature = areaPathSignature(coords);

        if (poly._pathSignature !== nextSignature) {
          poly.setPaths(paths);
          poly._pathSignature = nextSignature;
        }

        if (prevCor !== cor) {
          poly.setOptions({ fillColor: cor, strokeColor: cor });
          polyColorRef.current.set(area.id, cor);
        }

        poly._areaData = area;
        poly._color = cor;
        return;
      }

      const polygon = new google.maps.Polygon({
        paths,
        strokeColor: cor,
        strokeOpacity: 0.8,
        strokeWeight: 2,
        fillColor: cor,
        fillOpacity: 0.45,
      });
      polygon._areaData = area;
      polygon._color = cor;
      polygon._pathSignature = areaPathSignature(coords);

      polygon.addListener('mouseover', () => polygon.setOptions({ strokeColor: '#ffffff', strokeOpacity: 1, strokeWeight: 3 }));
      polygon.addListener('mouseout', function () { this.setOptions({ strokeColor: this._color, strokeOpacity: 0.8, strokeWeight: 2 }); });
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
        <div style="color:white;text-align:center;white-space:nowrap;text-shadow:1px 1px 3px rgba(0,0,0,0.8);pointer-events:none;font-family:Arial,sans-serif;">
          <div class="label-title" style="font-size:11px;font-weight:700;">${area.nome || ''}</div>
          <div class="label-hectares" style="font-size:10px;font-weight:400;opacity:0.95;${hectaresText ? '' : 'display:none;'}">${hectaresText || ''}</div>
          <div class="label-extra" style="font-size:10px;font-weight:600;color:#fef08a;${extraText ? '' : 'display:none;'}">${extraText || ''}</div>
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

  // ─── Linhas Geográficas ───
  const syncLinhas = useCallback((linhas, show) => {
    const map = mapInstanceRef.current;
    if (!map) return;
    const currentIds = new Set(show ? linhas.map(l => l.id) : []);
    polylinesRef.current.forEach((pl, id) => { if (!currentIds.has(id)) { pl.setMap(null); polylinesRef.current.delete(id); } });
    if (!show) return;
    linhas.forEach(linha => {
      if (polylinesRef.current.has(linha.id)) return;
      const coords = linha.coordenadas?.coords || [];
      if (coords.length < 2) return;
      const paths = coords.map(c => ({ lat: c[0] || c.lat, lng: c[1] || c.lng }));
      const cor = linha.coordenadas?.cor || linha.cor || '#f59e0b';
      const polyline = new google.maps.Polyline({ path: paths, strokeColor: cor, strokeOpacity: 1, strokeWeight: 3 });
      polyline.addListener('click', () => {
        const b = new google.maps.LatLngBounds(); paths.forEach(p => b.extend(p));
        new google.maps.InfoWindow({ content: `<div style="padding:10px;"><strong>${linha.nome}</strong><br/><span style="color:#666;">${linha.tipo} - ${linha.comprimento_metros ? (linha.comprimento_metros / 1000).toFixed(2) + ' km' : 'N/A'}</span></div>` }).setPosition(b.getCenter()) || void 0;
        const iw = new google.maps.InfoWindow({ content: `<div style="padding:10px;"><strong>${linha.nome}</strong><br/><span style="color:#666;">${linha.tipo}</span></div>` });
        iw.setPosition(b.getCenter()); iw.open(map);
      });
      polyline.setMap(map);
      polylinesRef.current.set(linha.id, polyline);
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
          if (lbl?.text !== String(totalCabecas)) existing.setLabel({ text: String(totalCabecas), color: '#fff', fontSize: '11px', fontWeight: 'bold' });
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
          label: { text: String(totalCabecas), color: '#fff', fontSize: '11px', fontWeight: 'bold' },
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
            // Posição personalizada do identificador em relação ao ícone
            div.style.left = `${pos.x + 20}px`;
            div.style.top = `${pos.y - 25}px`;
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
          indicatorOverlay._div.innerHTML = identificadores.map((i) => `<div title="${i.nome || i.sigla || ''}" style="width:15px;height:15px;border-radius:9999px;background:${i.cor};border:2px solid white;box-shadow:0 1px 4px rgba(0,0,0,0.4);display:flex;align-items:center;justify-content:center;font-size:7px;font-weight:700;color:#fff;line-height:1;overflow:hidden;">${i.sigla ? String(i.sigla).substring(0,2) : ''}</div>`).join('');
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