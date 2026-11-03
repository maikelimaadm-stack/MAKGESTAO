// Exportação de áreas cadastradas (AreaPastagem) para KML.
// Função pura: recebe as áreas já carregadas e devolve o texto KML.
// Coordenadas armazenadas como [lat, lng] ou { lat, lng }; KML exige "lng,lat,alt".

const escapeXml = (value) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");

const toLatLng = (c) => {
  if (Array.isArray(c)) return [Number(c[0]), Number(c[1])];
  if (c && typeof c === "object") return [Number(c.lat), Number(c.lng ?? c.lon)];
  return [NaN, NaN];
};

// "#RRGGBB" -> KML "aabbggrr"
const hexToKmlColor = (hex, alpha = "ff") => {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(hex || "").trim());
  const rgb = m ? m[1] : "10b981";
  return `${alpha}${rgb.slice(4, 6)}${rgb.slice(2, 4)}${rgb.slice(0, 2)}`.toLowerCase();
};

const getAreaCoords = (area) => {
  const raw = area?.coordenadas?.coords || [];
  const pts = raw.map(toLatLng).filter(([lat, lng]) => Number.isFinite(lat) && Number.isFinite(lng));
  if (pts.length < 3) return null;
  const [fLat, fLng] = pts[0];
  const [lLat, lLng] = pts[pts.length - 1];
  if (fLat !== lLat || fLng !== lLng) pts.push([fLat, fLng]);
  return pts;
};

const DATA_FIELDS = [
  ["codigo", (a) => a.numero_area],
  ["sigla", (a) => a.sigla],
  ["setor", (a) => a.setor_nome],
  ["uso", (a) => a.tipo_cultura],
  ["cultura", (a) => a.tipo_pastagem],
  ["tamanho_ha", (a) => (a.tamanho_hectares != null ? Number(a.tamanho_hectares).toFixed(2) : null)],
  ["capacidade_maxima", (a) => a.capacidade_maxima],
  ["observacoes", (a) => a.observacoes],
];

export function buildAreasKml(areas = [], { documentName = "Áreas" } = {}) {
  const exportadas = [];
  const ignoradas = [];

  const placemarks = areas
    .map((area, idx) => {
      const pts = getAreaCoords(area);
      if (!pts) {
        ignoradas.push(area);
        return null;
      }
      exportadas.push(area);
      const cor = area.cor || area.coordenadas?.cor;
      const nome = area.nome || area.sigla || `Área ${idx + 1}`;
      const coordsText = pts.map(([lat, lng]) => `${lng},${lat},0`).join(" ");
      const extended = DATA_FIELDS.map(([key, get]) => {
        const v = get(area);
        if (v == null || v === "") return "";
        return `<Data name="${key}"><value>${escapeXml(v)}</value></Data>`;
      }).join("");

      return [
        "<Placemark>",
        `<name>${escapeXml(nome)}</name>`,
        "<Style>",
        `<LineStyle><color>${hexToKmlColor(cor)}</color><width>2</width></LineStyle>`,
        `<PolyStyle><color>${hexToKmlColor(cor, "66")}</color></PolyStyle>`,
        "</Style>",
        extended ? `<ExtendedData>${extended}</ExtendedData>` : "",
        "<Polygon><outerBoundaryIs><LinearRing>",
        `<coordinates>${coordsText}</coordinates>`,
        "</LinearRing></outerBoundaryIs></Polygon>",
        "</Placemark>",
      ].join("");
    })
    .filter(Boolean);

  const kml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<kml xmlns="http://www.opengis.net/kml/2.2">',
    "<Document>",
    `<name>${escapeXml(documentName)}</name>`,
    ...placemarks,
    "</Document>",
    "</kml>",
  ].join("\n");

  return { kml, exportadas, ignoradas };
}

export function downloadKml(kml, fileName = "areas.kml") {
  const blob = new Blob([kml], { type: "application/vnd.google-earth.kml+xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName.endsWith(".kml") ? fileName : `${fileName}.kml`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
