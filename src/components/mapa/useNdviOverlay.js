import { useEffect, useRef } from 'react';
import { assinaturaDosPoligonos, criarOverlayNdvi } from './mapaNdvi';

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

    // Quando uma imagem do satélite termina de baixar, os tiles são pedidos de
    // novo para o mapa desenhar o recorte correto de cada área.
    const recarregarTiles = () => {
      if (!camadaAtiva) return;
      removerOverlay();
      overlayRef.current = criarOverlayNdvi(poligonosRef.current, recarregarTiles);
      mapa.overlayMapTypes.push(overlayRef.current);
    };

    if (!ativo) {
      removerOverlay();
      return;
    }

    if (!overlayRef.current) {
      overlayRef.current = criarOverlayNdvi(poligonosRef.current, recarregarTiles);
      mapa.overlayMapTypes.push(overlayRef.current);
    }

    return () => {
      camadaAtiva = false;
      removerOverlay();
    };
  }, [mapInstanceRef, mapReady, ativo, assinatura]);
}