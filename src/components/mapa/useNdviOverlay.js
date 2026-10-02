import { useEffect, useRef } from 'react';
import { ZOOM_NATIVO, assinaturaDosPoligonos, criarOverlayNdvi, precarregarImagens } from './mapaNdvi';

/** Aplica e remove a camada de vegetação (NDVI) sobre o mapa, dentro dos polígonos das áreas. */
export default function useNdviOverlay(mapInstanceRef, mapReady, ativo, poligonos) {
  const overlayRef = useRef(null);
  const poligonosRef = useRef(poligonos);
  poligonosRef.current = poligonos;

  // A assinatura muda quando as áreas mudam, o que refaz os recortes da camada.
  const assinatura = assinaturaDosPoligonos(poligonos);

  useEffect(() => {
    const mapa = mapInstanceRef.current;
    if (!mapa || !mapReady) return;

    const removerOverlay = () => {
      if (!overlayRef.current) return;
      for (let i = mapa.overlayMapTypes.getLength() - 1; i >= 0; i--) {
        if (mapa.overlayMapTypes.getAt(i) === overlayRef.current) mapa.overlayMapTypes.removeAt(i);
      }
      overlayRef.current = null;
    };

    let camadaAtiva = true;

    // Monta a camada com os recortes das áreas. A imagem do satélite fica guardada,
    // então remontar custa pouco e não recarrega nada da internet.
    const montarCamada = () => {
      if (!camadaAtiva) return;
      removerOverlay();
      overlayRef.current = criarOverlayNdvi(poligonosRef.current, montarCamada);
      mapa.overlayMapTypes.push(overlayRef.current);
    };

    if (!ativo) {
      removerOverlay();
      return;
    }

    precarregarImagens(poligonosRef.current, mapa.getZoom() || ZOOM_NATIVO);
    montarCamada();

    const listenerZoom = mapa.addListener('zoom_changed', () => {
      if (camadaAtiva) precarregarImagens(poligonosRef.current, mapa.getZoom() || ZOOM_NATIVO);
    });

    return () => {
      camadaAtiva = false;
      if (listenerZoom) window.google?.maps?.event?.removeListener(listenerZoom);
      removerOverlay();
    };
  }, [mapInstanceRef, mapReady, ativo, assinatura]);
}