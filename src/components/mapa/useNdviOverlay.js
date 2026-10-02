import { useEffect, useRef } from 'react';
import { criarOverlayNdvi, NDVI_FILTRO } from './mapaNdvi';

const ESTILO_ID = 'ndvi-vegetacao-realce';

/** Aplica e remove a camada de vegetação (NDVI) sobre o mapa. */
export default function useNdviOverlay(mapInstanceRef, mapReady, ativo) {
  const overlayRef = useRef(null);

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

    if (!ativo) {
      removerOverlay();
      document.getElementById(ESTILO_ID)?.remove();
      return;
    }

    if (!overlayRef.current) {
      overlayRef.current = criarOverlayNdvi();
      mapa.overlayMapTypes.push(overlayRef.current);
    }

    // Realce de cor somente nas imagens da camada de vegetação.
    if (!document.getElementById(ESTILO_ID)) {
      const estilo = document.createElement('style');
      estilo.id = ESTILO_ID;
      estilo.textContent = `img[src*="gibs.earthdata.nasa.gov"]{filter:${NDVI_FILTRO};}`;
      document.head.appendChild(estilo);
    }

    return () => {
      document.getElementById(ESTILO_ID)?.remove();
    };
  }, [mapInstanceRef, mapReady, ativo]);
}