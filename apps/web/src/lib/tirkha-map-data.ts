import type { LatLngExpression } from "leaflet";
import { DISTRICTS } from "@/lib/districtBounds";

export type TirkhaRoad = {
  name?: string;
  kind: "expressway" | "arterial" | "connector" | "local";
  points: LatLngExpression[];
};

/** Curated Tirkha cartography: coordinate-anchored city corridors, rivers and civic landmarks. */
export const tirkhaRoads: TirkhaRoad[] = [
  // Kathmandu Valley ring and cross-valley corridors.
  { name: "Ring Road", kind: "expressway", points: [[27.694,85.279],[27.704,85.276],[27.716,85.277],[27.727,85.283],[27.736,85.292],[27.741,85.306],[27.742,85.321],[27.738,85.337],[27.729,85.348],[27.718,85.354],[27.705,85.355],[27.692,85.351],[27.679,85.344],[27.669,85.334],[27.664,85.321],[27.667,85.307],[27.675,85.295],[27.684,85.284],[27.694,85.279]] },
  { name: "Kantipath · New Road · Tripureshwor", kind: "arterial", points: [[27.713,85.315],[27.709,85.314],[27.704,85.314],[27.700,85.312],[27.697,85.310],[27.694,85.310]] },
  { name: "Durbar Marg · Maitighar · Baneshwor", kind: "arterial", points: [[27.7114,85.3174],[27.707,85.319],[27.703,85.321],[27.699,85.326],[27.695,85.335],[27.6915,85.342],[27.687,85.346],[27.682,85.350],[27.678,85.354]] },
  { name: "Thamel · Lazimpat · Maharajgunj", kind: "arterial", points: [[27.7153,85.3123],[27.721,85.315],[27.726,85.319],[27.731,85.323],[27.736,85.328],[27.7405,85.337]] },
  { name: "Kalanki · Balkhu · Kupondole", kind: "arterial", points: [[27.693,85.281],[27.690,85.290],[27.687,85.299],[27.684,85.307],[27.685,85.3164],[27.688,85.323],[27.694,85.330]] },
  { name: "Patan · Jawalakhel · Satdobato", kind: "arterial", points: [[27.678,85.316],[27.674,85.319],[27.670,85.322],[27.665,85.326],[27.658,85.327],[27.653,85.328]] },
  { name: "Pulchowk · Jhamsikhel", kind: "connector", points: [[27.681,85.318],[27.677,85.314],[27.6728,85.3104],[27.669,85.308],[27.666,85.307]] },
  { name: "Koteshwor · Jadibuti · Suryabinayak", kind: "arterial", points: [[27.678,85.354],[27.683,85.361],[27.689,85.370],[27.695,85.379],[27.702,85.388],[27.710,85.397],[27.718,85.406]] },
  { name: "Bhaktapur inner road", kind: "connector", points: [[27.672,85.427],[27.675,85.430],[27.679,85.432],[27.683,85.428],[27.686,85.424],[27.689,85.421]] },
  { name: "Bishnumati riverside", kind: "local", points: [[27.742,85.300],[27.735,85.303],[27.728,85.305],[27.721,85.307],[27.714,85.309],[27.706,85.307],[27.699,85.303]] },
  { name: "Bagmati riverside", kind: "local", points: [[27.728,85.353],[27.720,85.349],[27.712,85.344],[27.704,85.338],[27.697,85.333],[27.690,85.329],[27.683,85.323],[27.676,85.319],[27.668,85.316]] },
  { name: "Thamel lanes", kind: "local", points: [[27.718,85.308],[27.717,85.313],[27.714,85.317],[27.711,85.311],[27.708,85.316]] },
  { name: "Asan · Indra Chowk", kind: "local", points: [[27.713,85.312],[27.711,85.311],[27.709,85.310],[27.707,85.310],[27.704,85.309]] },
  { name: "Ratna Park · Jamal", kind: "local", points: [[27.710,85.314],[27.714,85.314],[27.718,85.314],[27.721,85.316],[27.725,85.319]] },
  { name: "Tripureshwor · Thapathali", kind: "local", points: [[27.694,85.310],[27.691,85.312],[27.688,85.314],[27.685,85.316],[27.682,85.317]] },
  { name: "Maitighar · Babar Mahal", kind: "local", points: [[27.700,85.320],[27.699,85.325],[27.697,85.329],[27.695,85.334],[27.693,85.338]] },
  { name: "New Baneshwor neighborhood", kind: "local", points: [[27.695,85.337],[27.693,85.341],[27.690,85.344],[27.687,85.341],[27.688,85.337],[27.692,85.335]] },
  { name: "Koteshwor neighborhood", kind: "local", points: [[27.683,85.348],[27.680,85.351],[27.677,85.355],[27.680,85.358],[27.684,85.356]] },
  { name: "Kupondole neighborhood", kind: "local", points: [[27.688,85.313],[27.686,85.3164],[27.683,85.313],[27.680,85.311],[27.677,85.314]] },
  { name: "Patan heritage loop", kind: "local", points: [[27.681,85.325],[27.677,85.324],[27.673,85.322],[27.670,85.317],[27.673,85.313],[27.677,85.314]] },
  { name: "Patan · Mangal Bazaar", kind: "local", points: [[27.678,85.324],[27.675,85.326],[27.672,85.325],[27.670,85.321],[27.672,85.317]] },
  { name: "Jawalakhel neighborhood", kind: "local", points: [[27.672,85.313],[27.670,85.316],[27.668,85.319],[27.665,85.321],[27.662,85.318]] },
  { name: "Jhamsikhel local streets", kind: "local", points: [[27.676,85.307],[27.673,85.3104],[27.670,85.313],[27.668,85.311],[27.667,85.306]] },
  { name: "Bhaktapur heritage loop", kind: "local", points: [[27.673,85.428],[27.676,85.424],[27.680,85.426],[27.682,85.431],[27.679,85.435],[27.675,85.434],[27.673,85.428]] },
  { name: "Bhaktapur · Sallaghari", kind: "local", points: [[27.690,85.420],[27.687,85.424],[27.684,85.428],[27.681,85.433],[27.679,85.438]] },
  { name: "Bhaktapur neighborhood", kind: "local", points: [[27.668,85.424],[27.672,85.421],[27.676,85.420],[27.680,85.421],[27.684,85.421]] },
  // Kirtipur municipality: historic ridge, Panga/Nagaun settlements and TU access.
  { name: "Balkhu · Kirtipur Road", kind: "arterial", points: [[27.6864,85.3024],[27.683,85.296],[27.680,85.290],[27.6781,85.282],[27.6781,85.2769]] },
  { name: "Kirtipur Ring Road · Layeku", kind: "connector", points: [[27.6862,85.2799],[27.688,85.276],[27.686,85.272],[27.682,85.270],[27.6799,85.271],[27.676,85.273],[27.673,85.276],[27.6712,85.279],[27.674,85.283],[27.6793,85.2865],[27.683,85.284],[27.6862,85.2799]] },
  { name: "Panga · Lachhi Road", kind: "connector", points: [[27.679,85.278],[27.676,85.279],[27.6735,85.2795],[27.6712,85.279],[27.668,85.281],[27.6652,85.282]] },
  { name: "Nagaun · Panga Dobato", kind: "local", points: [[27.679,85.276],[27.676,85.275],[27.6722,85.2743],[27.669,85.275],[27.666,85.277]] },
  { name: "Tyangla Chowk · TU approach", kind: "connector", points: [[27.679,85.278],[27.681,85.281],[27.682,85.286],[27.68123,85.28963],[27.679,85.292],[27.677,85.294]] },
  { name: "TU campus loop", kind: "local", points: [[27.678,85.282],[27.680,85.285],[27.684,85.287],[27.686,85.291],[27.683,85.294],[27.679,85.292],[27.678,85.282]] },
  { name: "Kirtipur Bazaar · Khasibazar", kind: "local", points: [[27.682,85.270],[27.681,85.273],[27.6799,85.271],[27.678,85.274],[27.676,85.277]] },
  { name: "Chobhar · Kirtipur south", kind: "arterial", points: [[27.6712,85.279],[27.668,85.280],[27.664,85.282],[27.659,85.2826],[27.655,85.284]] },
  // Pokhara city spine, lakeside and airport approach.
  { name: "Prithvi Chowk · Mahendrapul", kind: "arterial", points: [[28.197,83.981],[28.208,83.986],[28.218,83.989],[28.228,83.989],[28.237,83.987],[28.243,83.982]] },
  { name: "Lakeside Road", kind: "arterial", points: [[28.209,83.959],[28.213,83.963],[28.217,83.968],[28.220,83.973],[28.222,83.979],[28.224,83.984]] },
  { name: "Pokhara Airport approach", kind: "connector", points: [[28.197,83.981],[28.195,83.990],[28.194,83.999],[28.198,84.006]] },
  { name: "Zero KM · Lakeside", kind: "connector", points: [[28.220,83.973],[28.217,83.979],[28.211,83.984],[28.205,83.984],[28.201,83.980]] },
  { name: "Mahendrapul neighborhood", kind: "local", points: [[28.226,83.983],[28.230,83.986],[28.233,83.990],[28.237,83.988],[28.240,83.985]] },
  { name: "Pokhara city grid", kind: "local", points: [[28.201,83.976],[28.205,83.979],[28.210,83.980],[28.215,83.979],[28.220,83.981],[28.225,83.985]] },
  { name: "Lakeside access lanes", kind: "local", points: [[28.207,83.956],[28.212,83.960],[28.216,83.964],[28.219,83.970],[28.222,83.976]] },
  // Hetauda street spine and nearby neighborhoods. Coordinates are city-center references.
  { name: "Tribhuvan Highway · Hetauda spine", kind: "arterial", points: [[27.408,85.018],[27.416,85.023],[27.423,85.027],[27.4303,85.0322],[27.438,85.037],[27.446,85.042],[27.455,85.048]] },
  { name: "Mahendra Highway · Hetauda", kind: "expressway", points: [[27.425,84.997],[27.429,85.008],[27.431,85.020],[27.4303,85.0322],[27.431,85.046],[27.434,85.058],[27.439,85.071]] },
  { name: "Tribhuvan Highway · Hetauda–Pathlaiya", kind: "arterial", points: [[27.20054,84.98440],[27.238,84.988],[27.2797,84.9890],[27.320,84.997],[27.365,85.008],[27.400,85.022],[27.43075,85.03258]] },
  { name: "Nawalpur · Mahendra Highway approach", kind: "connector", points: [[27.43843,84.99293],[27.436,85.001],[27.434,85.012],[27.432,85.022],[27.43075,85.03258]] },
  { name: "Hetauda · Buddha Chowk to Hatiya", kind: "arterial", points: [[27.43075,85.03258],[27.421,85.046],[27.408,85.061],[27.394,85.077],[27.382,85.091],[27.3700,85.1000]] },
  { name: "Ratomate · Hetauda south connector", kind: "connector", points: [[27.43075,85.03258],[27.416,85.031],[27.401,85.030],[27.38617,85.02772]] },
  { name: "Buddha Chowk · Rapti Road", kind: "arterial", points: [[27.43075,85.03258],[27.4306,85.029],[27.4306,85.025],[27.4308,85.021],[27.4312,85.017]] },
  { name: "Raktim Road · Hetauda market corridor", kind: "connector", points: [[27.426,85.025],[27.428,85.029],[27.43075,85.03258],[27.433,85.036],[27.436,85.039],[27.439,85.042]] },
  { name: "Hetauda Bus Park approach", kind: "connector", points: [[27.4298,85.0288],[27.43075,85.03258],[27.433,85.035],[27.436,85.038],[27.440,85.040]] },
  { name: "Hetauda market · Ward 10", kind: "local", points: [[27.426,85.025],[27.428,85.028],[27.43075,85.03258],[27.433,85.036],[27.436,85.039]] },
  { name: "Hupra Chaur · Forestry Campus", kind: "connector", points: [[27.43075,85.03258],[27.434,85.029],[27.438,85.026],[27.442,85.023],[27.446,85.021]] },
  { name: "Sanopokhara · Hetauda east", kind: "local", points: [[27.420,85.036],[27.424,85.039],[27.428,85.042],[27.433,85.044],[27.437,85.047]] },
  { name: "Kamane connector", kind: "connector", points: [[27.414,85.034],[27.411,85.036],[27.408,85.038],[27.40379,85.03944]] },
  { name: "Hetauda neighborhood street grid", kind: "local", points: [[27.423,85.026],[27.423,85.034],[27.423,85.042],[27.423,85.050]] },
  { name: "Hetauda south neighborhood streets", kind: "local", points: [[27.417,85.027],[27.417,85.035],[27.417,85.043],[27.417,85.050]] },
  // Simara / Jeetpur-Simara and the Mahendra Highway corridor.
  { name: "Mahendra Highway · Jeetpur–Simara–Pathlaiya", kind: "expressway", points: [[27.147,84.957],[27.155,84.963],[27.163,84.970],[27.1666,84.9786],[27.177,84.980],[27.188,84.982],[27.20054,84.98440]] },
  { name: "Tribhuvan Highway · Pathlaiya approach", kind: "arterial", points: [[27.159,84.980],[27.169,84.982],[27.180,84.986],[27.192,84.991],[27.20054,84.98440]] },
  { name: "Simara Airport Road", kind: "connector", points: [[27.15944,84.98000],[27.162,84.980],[27.1666,84.9786],[27.171,84.976],[27.176,84.973]] },
  { name: "Simara Chowk · central streets", kind: "local", points: [[27.161,84.973],[27.163,84.976],[27.1666,84.9786],[27.170,84.982],[27.174,84.983]] },
  { name: "Simara east-west neighborhood road", kind: "local", points: [[27.164,84.969],[27.164,84.977],[27.164,84.984],[27.164,84.990]] },
  { name: "Simara north-south neighborhood road", kind: "local", points: [[27.158,84.975],[27.163,84.975],[27.168,84.975],[27.173,84.975]] },
  { name: "Narabasti · Simara neighborhood connector", kind: "connector", points: [[27.16764,84.96872],[27.168,84.973],[27.1666,84.9786],[27.164,84.984]] },
  { name: "Pathlaiya market approach", kind: "local", points: [[27.196,84.978],[27.198,84.982],[27.20054,84.98440],[27.204,84.989],[27.208,84.993]] },
  { name: "Dumarwana · Simara east connector", kind: "arterial", points: [[27.1666,84.9786],[27.158,84.987],[27.149,84.996],[27.140,85.007],[27.13214,85.01904]] },
  { name: "Simara airport-side access lanes", kind: "local", points: [[27.160,84.979],[27.164,84.977],[27.168,84.978],[27.171,84.981],[27.174,84.985]] },
  { name: "Jeetpur bazaar connector", kind: "connector", points: [[27.1604,84.9766],[27.158,84.981],[27.155,84.986],[27.151,84.990],[27.147,84.994]] },
  { name: "Dumarwana road", kind: "arterial", points: [[27.159,84.980],[27.153,84.989],[27.147,84.998],[27.140,85.008],[27.13214,85.01904]] },
];

export type TirkhaUrbanBlock = {
  id: string;
  region: "Kirtipur" | "Hetauda" | "Simara";
  landUse: "commercial" | "residential" | "industrial";
  outline: [number, number][];
  buildings: [number, number][][];
};

/**
 * Stylized block and parcel geometry for the local city centers. These shapes
 * communicate urban structure; they are not cadastral or survey-grade building
 * footprints. Curated roads are drawn above them for a readable street layer.
 */
function buildUrbanBlocks(config: {
  region: TirkhaUrbanBlock["region"];
  bounds: { south: number; north: number; west: number; east: number };
  openZones: { south: number; north: number; west: number; east: number }[];
  rows: number;
  columns: number;
  rowWidths: number[];
  commercialCenter: [number, number];
  idPrefix?: string;
}): TirkhaUrbanBlock[] {
  const latStep = (config.bounds.north - config.bounds.south) / config.rows;
  const lngStep = (config.bounds.east - config.bounds.west) / config.columns;
  const blocks: TirkhaUrbanBlock[] = [];

  for (let row = 0; row < config.rows; row += 1) {
    const width = config.rowWidths[row] ?? config.columns;
    const offset = (config.columns - width) / 2;
    for (let localColumn = 0; localColumn < width; localColumn += 1) {
      const column = localColumn + offset;
      // Keep larger gaps every few cells for neighborhood connectors and
      // municipal avenues; the named road layer is rendered on top of these.
      if ((row === 2 || row === config.rows - 3) && localColumn % 4 === 2) continue;
      if (row % 4 === 3 && localColumn % 5 === 4) continue;

      const jitterLat = (((row * 7 + localColumn * 3) % 5) - 2) * latStep * 0.025;
      const jitterLng = (((row * 5 + localColumn * 11) % 5) - 2) * lngStep * 0.025;
      const south = config.bounds.south + row * latStep + latStep * 0.12 + jitterLat;
      const north = config.bounds.south + (row + 1) * latStep - latStep * 0.12 + jitterLat;
      const west = config.bounds.west + column * lngStep + lngStep * 0.12 + jitterLng;
      const east = config.bounds.west + (column + 1) * lngStep - lngStep * 0.12 + jitterLng;
      const outline: [number, number][] = [
        [south, west + lngStep * 0.06],
        [south + latStep * 0.04, east],
        [north - latStep * 0.035, east - lngStep * 0.04],
        [north, west],
      ];

      const center: [number, number] = [(south + north) / 2, (west + east) / 2];
      if (config.openZones.some((zone) => center[0] >= zone.south && center[0] <= zone.north && center[1] >= zone.west && center[1] <= zone.east)) continue;
      const distanceToCore = Math.hypot(
        (center[0] - config.commercialCenter[0]) * 90,
        (center[1] - config.commercialCenter[1]) * 90,
      );
      const landUse = distanceToCore < 650
        ? "commercial"
        : config.region === "Hetauda" && center[0] >= 27.41 && center[0] <= 27.45 && center[1] > 85.047
          ? "industrial"
          : "residential";
      const buildings: [number, number][][] = [];
      const plotRows = 3;
      const plotColumns = 4;
      const plotLatStep = (north - south) / plotRows;
      const plotLngStep = (east - west) / plotColumns;

      for (let plotRow = 0; plotRow < plotRows; plotRow += 1) {
        for (let plotColumn = 0; plotColumn < plotColumns; plotColumn += 1) {
          if ((row + localColumn + plotRow * 2 + plotColumn) % 7 === 0) continue;
          const padLat = plotLatStep * (0.19 + ((plotRow + plotColumn) % 2) * 0.04);
          const padLng = plotLngStep * (0.18 + ((row + plotColumn) % 2) * 0.05);
          const plotSouth = south + plotRow * plotLatStep + padLat;
          const plotNorth = south + (plotRow + 1) * plotLatStep - padLat;
          const plotWest = west + plotColumn * plotLngStep + padLng;
          const plotEast = west + (plotColumn + 1) * plotLngStep - padLng;
          buildings.push([
            [plotSouth, plotWest],
            [plotSouth, plotEast],
            [plotNorth, plotEast - plotLngStep * 0.04],
            [plotNorth, plotWest],
          ]);
        }
      }

      blocks.push({ id: `${(config.idPrefix ?? config.region).toLowerCase()}-${row}-${localColumn}`, region: config.region, landUse, outline, buildings });
    }
  }
  return blocks;
}

export const tirkhaUrbanBlocks: TirkhaUrbanBlock[] = [
  ...buildUrbanBlocks({
    region: "Kirtipur",
    bounds: { south: 27.652, north: 27.691, west: 85.258, east: 85.296 },
    openZones: [
      { south: 27.677, north: 27.689, west: 85.282, east: 85.296 },
      { south: 27.654, north: 27.662, west: 85.279, east: 85.288 },
    ],
    rows: 13,
    columns: 12,
    rowWidths: [6, 8, 10, 12, 12, 12, 11, 12, 12, 12, 10, 8, 6],
    commercialCenter: [27.67806, 85.27694],
  }),
  ...buildUrbanBlocks({
    region: "Hetauda",
    bounds: { south: 27.402, north: 27.458, west: 85.005, east: 85.065 },
    // Preserve Hupra Chaur as open green space; keep the Buddha Chowk,
    // Raktim Road and bus-park corridors continuously covered by parcels.
    openZones: [{ south: 27.433, north: 27.438, west: 85.023, east: 85.030 }],
    rows: 14,
    columns: 15,
    rowWidths: [6, 8, 10, 12, 14, 15, 15, 15, 15, 15, 14, 12, 10, 8],
    commercialCenter: [27.43075, 85.03258],
  }),
  ...buildUrbanBlocks({
    region: "Hetauda",
    idPrefix: "Hetauda-Nawalpur",
    bounds: { south: 27.429, north: 27.449, west: 84.982, east: 85.006 },
    openZones: [],
    rows: 8,
    columns: 9,
    rowWidths: [5, 7, 9, 9, 9, 9, 7, 5],
    commercialCenter: [27.43843, 84.99293],
  }),
  ...buildUrbanBlocks({
    region: "Hetauda",
    idPrefix: "Hetauda-Hatiya",
    bounds: { south: 27.359, north: 27.382, west: 85.087, east: 85.114 },
    openZones: [],
    rows: 9,
    columns: 10,
    rowWidths: [5, 7, 9, 10, 10, 10, 9, 7, 5],
    commercialCenter: [27.3700, 85.1000],
  }),
  ...buildUrbanBlocks({
    region: "Hetauda",
    idPrefix: "Hetauda-Ratomate",
    bounds: { south: 27.376, north: 27.397, west: 85.014, east: 85.041 },
    openZones: [],
    rows: 8,
    columns: 9,
    rowWidths: [5, 7, 9, 9, 9, 9, 7, 5],
    commercialCenter: [27.38617, 85.02772],
  }),
  ...buildUrbanBlocks({
    region: "Simara",
    bounds: { south: 27.157, north: 27.178, west: 84.972, east: 84.991 },
    // Leave only the airport runway area open; residential and commercial
    // parcels continue through Simara Chowk and the Jeetpur highway strip.
    openZones: [{ south: 27.1575, north: 27.1612, west: 84.973, east: 84.986 }],
    rows: 11,
    columns: 12,
    rowWidths: [5, 7, 9, 11, 12, 12, 12, 12, 11, 9, 7],
    commercialCenter: [27.1666, 84.9786],
  }),
  ...buildUrbanBlocks({
    region: "Simara",
    idPrefix: "Simara-Jeetpur",
    bounds: { south: 27.137, north: 27.157, west: 84.947, east: 84.970 },
    openZones: [],
    rows: 8,
    columns: 9,
    rowWidths: [5, 7, 9, 9, 9, 9, 7, 5],
    commercialCenter: [27.147, 84.957],
  }),
  ...buildUrbanBlocks({
    region: "Simara",
    idPrefix: "Simara-Narabasti",
    bounds: { south: 27.158, north: 27.178, west: 84.958, east: 84.972 },
    openZones: [],
    rows: 8,
    columns: 9,
    rowWidths: [5, 7, 9, 9, 9, 9, 7, 5],
    commercialCenter: [27.16764, 84.96872],
  }),
  ...buildUrbanBlocks({
    region: "Simara",
    idPrefix: "Simara-Pathlaiya",
    bounds: { south: 27.191, north: 27.210, west: 84.973, east: 84.997 },
    openZones: [],
    rows: 8,
    columns: 9,
    rowWidths: [5, 7, 9, 9, 9, 9, 7, 5],
    commercialCenter: [27.20054, 84.98440],
  }),
  ...buildUrbanBlocks({
    region: "Simara",
    idPrefix: "Simara-Dumarwana",
    bounds: { south: 27.122, north: 27.142, west: 85.008, east: 85.031 },
    openZones: [],
    rows: 8,
    columns: 9,
    rowWidths: [5, 7, 9, 9, 9, 9, 7, 5],
    commercialCenter: [27.13214, 85.01904],
  }),
];

type UrbanBounds = { south: number; west: number; north: number; east: number };
const URBAN_INDEX_CELL_DEGREES = 0.02;
const urbanBlockBounds = new Map<string, UrbanBounds>();
const urbanBlockIndex = new Map<string, Set<TirkhaUrbanBlock>>();

for (const block of tirkhaUrbanBlocks) {
  const bounds = block.outline.reduce<UrbanBounds>((current, [latitude, longitude]) => ({
    south: Math.min(current.south, latitude),
    west: Math.min(current.west, longitude),
    north: Math.max(current.north, latitude),
    east: Math.max(current.east, longitude),
  }), { south: Infinity, west: Infinity, north: -Infinity, east: -Infinity });
  urbanBlockBounds.set(block.id, bounds);
  const minRow = Math.floor(bounds.south / URBAN_INDEX_CELL_DEGREES);
  const maxRow = Math.floor(bounds.north / URBAN_INDEX_CELL_DEGREES);
  const minColumn = Math.floor(bounds.west / URBAN_INDEX_CELL_DEGREES);
  const maxColumn = Math.floor(bounds.east / URBAN_INDEX_CELL_DEGREES);
  for (let row = minRow; row <= maxRow; row += 1) {
    for (let column = minColumn; column <= maxColumn; column += 1) {
      const key = `${row}:${column}`;
      const cell = urbanBlockIndex.get(key) ?? new Set<TirkhaUrbanBlock>();
      cell.add(block);
      urbanBlockIndex.set(key, cell);
    }
  }
}

/** Return only parcel blocks intersecting the current map viewport. */
export function getTirkhaUrbanBlocksInBounds(bounds: UrbanBounds): TirkhaUrbanBlock[] {
  const candidates = new Set<TirkhaUrbanBlock>();
  const minRow = Math.floor(bounds.south / URBAN_INDEX_CELL_DEGREES);
  const maxRow = Math.floor(bounds.north / URBAN_INDEX_CELL_DEGREES);
  const minColumn = Math.floor(bounds.west / URBAN_INDEX_CELL_DEGREES);
  const maxColumn = Math.floor(bounds.east / URBAN_INDEX_CELL_DEGREES);
  for (let row = minRow; row <= maxRow; row += 1) {
    for (let column = minColumn; column <= maxColumn; column += 1) {
      for (const block of urbanBlockIndex.get(`${row}:${column}`) ?? []) candidates.add(block);
    }
  }
  return [...candidates].filter((block) => {
    const blockBounds = urbanBlockBounds.get(block.id);
    return blockBounds !== undefined
      && blockBounds.north >= bounds.south && blockBounds.south <= bounds.north
      && blockBounds.east >= bounds.west && blockBounds.west <= bounds.east;
  });
}

export const tirkhaWaterways: LatLngExpression[][] = [
  [[27.744,85.296],[27.738,85.300],[27.732,85.303],[27.726,85.305],[27.720,85.307],[27.714,85.307],[27.708,85.305],[27.702,85.302],[27.696,85.300]],
  [[27.727,85.356],[27.720,85.351],[27.713,85.347],[27.706,85.342],[27.699,85.337],[27.692,85.333],[27.685,85.328],[27.678,85.323],[27.670,85.320]],
  // Hetauda's Rapti, Samari and Karra river corridors, placed from the local
  // municipality's published river/ward relationships and kept schematic.
  [[27.459,85.025],[27.450,85.022],[27.441,85.018],[27.434,85.015],[27.429,85.011],[27.424,85.006],[27.419,85.000]],
  [[27.449,85.045],[27.443,85.040],[27.438,85.036],[27.432,85.031],[27.427,85.026],[27.422,85.021]],
  [[27.420,85.049],[27.417,85.043],[27.414,85.037],[27.411,85.030],[27.408,85.023],[27.405,85.016]],
];

export const tirkhaLandmarks: { name: string; point: [number, number]; kind: "district" | "landmark" | "service"; minZoom: number }[] = [
  { name: "KATHMANDU", point: [27.7172,85.324], kind: "district", minZoom: 10 },
  { name: "KIRTIPUR", point: [27.67806,85.27694], kind: "district", minZoom: 10 },
  { name: "LALITPUR · PATAN", point: [27.674,85.322], kind: "district", minZoom: 10 },
  { name: "BHAKTAPUR", point: [27.676,85.432], kind: "district", minZoom: 10 },
  { name: "POKHARA", point: [28.217,83.985], kind: "district", minZoom: 10 },
  { name: "HETAUDA", point: [27.4303,85.0322], kind: "district", minZoom: 10 },
  { name: "SIMARA · JEETPUR-SIMARA", point: [27.1666,84.9786], kind: "district", minZoom: 10 },
  { name: "THAMEL", point: [27.7153,85.3123], kind: "landmark", minZoom: 13 },
  { name: "DURBAR MARG", point: [27.7114,85.3174], kind: "landmark", minZoom: 14 },
  { name: "NEW BANESHWOR", point: [27.6915,85.342], kind: "landmark", minZoom: 13 },
  { name: "JHAMSIKHEL", point: [27.6728,85.3104], kind: "landmark", minZoom: 13 },
  { name: "KUPONDOLE", point: [27.685,85.3164], kind: "landmark", minZoom: 13 },
  { name: "BHAKTAPUR DURBAR SQUARE", point: [27.6729,85.428], kind: "landmark", minZoom: 13 },
  { name: "POKHARA LAKESIDE", point: [28.209,83.959], kind: "landmark", minZoom: 13 },
  { name: "PRITHVI CHOWK", point: [28.197,83.981], kind: "landmark", minZoom: 13 },
  { name: "Ason", point: [27.7106,85.3112], kind: "service", minZoom: 15 },
  { name: "Indra Chowk", point: [27.7109,85.3094], kind: "service", minZoom: 15 },
  { name: "New Road", point: [27.7049,85.3104], kind: "service", minZoom: 15 },
  { name: "Basantapur", point: [27.7045,85.3072], kind: "service", minZoom: 15 },
  { name: "Ratna Park", point: [27.7105,85.3146], kind: "service", minZoom: 15 },
  { name: "Lazimpat", point: [27.7214,85.3185], kind: "service", minZoom: 14 },
  { name: "Gairidhara", point: [27.727,85.325], kind: "service", minZoom: 15 },
  { name: "Baluwatar", point: [27.73,85.328], kind: "service", minZoom: 14 },
  { name: "Maharajgunj", point: [27.738,85.334], kind: "service", minZoom: 13 },
  { name: "Naxal", point: [27.7165,85.332], kind: "service", minZoom: 14 },
  { name: "Dillibazar", point: [27.7115,85.326], kind: "service", minZoom: 15 },
  { name: "Maitidevi", point: [27.704,85.327], kind: "service", minZoom: 15 },
  { name: "Battisputali", point: [27.706,85.341], kind: "service", minZoom: 15 },
  { name: "Gaushala", point: [27.707,85.347], kind: "service", minZoom: 14 },
  { name: "Chabahil", point: [27.717,85.347], kind: "service", minZoom: 14 },
  { name: "BOUDDHA · BOUDHANATH", point: [27.721,85.362], kind: "service", minZoom: 13 },
  { name: "Balaju", point: [27.735,85.303], kind: "service", minZoom: 14 },
  { name: "Gongabu", point: [27.745,85.324], kind: "service", minZoom: 14 },
  { name: "Kalanki", point: [27.694,85.281], kind: "service", minZoom: 14 },
  { name: "BALKHU", point: [27.6864,85.3024], kind: "service", minZoom: 14 },
  { name: "TRIPURESHWOR", point: [27.6947,85.3151], kind: "service", minZoom: 14 },
  { name: "MAITIGHAR", point: [27.6946,85.3224], kind: "service", minZoom: 14 },
  { name: "SINAMANGAL", point: [27.7002,85.3538], kind: "service", minZoom: 14 },
  { name: "KOTESHWOR", point: [27.6781,85.3493], kind: "service", minZoom: 14 },
  { name: "Pulchowk", point: [27.679,85.318], kind: "service", minZoom: 14 },
  { name: "Patan Durbar Square", point: [27.6729,85.325], kind: "service", minZoom: 14 },
  { name: "Jawalakhel", point: [27.672,85.316], kind: "service", minZoom: 14 },
  { name: "Sanepa", point: [27.683,85.309], kind: "service", minZoom: 14 },
  { name: "Satdobato", point: [27.658,85.327], kind: "service", minZoom: 14 },
  { name: "Gwarko", point: [27.666,85.34], kind: "service", minZoom: 14 },
  { name: "Bhaisepati", point: [27.664,85.302], kind: "service", minZoom: 14 },
  { name: "Thimi", point: [27.681,85.388], kind: "service", minZoom: 14 },
  { name: "Sallaghari", point: [27.684,85.424], kind: "service", minZoom: 14 },
  { name: "Kamalbinayak", point: [27.682,85.434], kind: "service", minZoom: 15 },
  { name: "Dattatreya", point: [27.673,85.435], kind: "service", minZoom: 15 },
  { name: "Suryabinayak", point: [27.664,85.429], kind: "service", minZoom: 14 },
  { name: "Gatthaghar", point: [27.672,85.386], kind: "service", minZoom: 15 },
  { name: "Hallan Chowk", point: [28.210,83.957], kind: "service", minZoom: 15 },
  { name: "Barahi Chowk", point: [28.209,83.959], kind: "service", minZoom: 15 },
  { name: "Zero KM", point: [28.220,83.973], kind: "service", minZoom: 14 },
  { name: "Mahendrapul", point: [28.226,83.983], kind: "service", minZoom: 14 },
  { name: "Bagar", point: [28.238,83.981], kind: "service", minZoom: 14 },
  { name: "Birauta", point: [28.184,83.968], kind: "service", minZoom: 14 },
  { name: "Chhorepatan", point: [28.185,83.946], kind: "service", minZoom: 14 },
  { name: "Srijana Chowk", point: [28.215,83.987], kind: "service", minZoom: 15 },
  { name: "BANGEMUDHA", point: [27.713,85.312], kind: "service", minZoom: 15 },
  { name: "MAKHAN TOLE", point: [27.707,85.309], kind: "service", minZoom: 15 },
  { name: "ITUMBAHAL", point: [27.708,85.312], kind: "service", minZoom: 16 },
  { name: "JYATHA", point: [27.713,85.315], kind: "service", minZoom: 15 },
  { name: "THAHITY", point: [27.714,85.311], kind: "service", minZoom: 16 },
  { name: "PUTALISADAK", point: [27.705,85.323], kind: "service", minZoom: 15 },
  { name: "ANAMNAGAR", point: [27.700,85.326], kind: "service", minZoom: 14 },
  { name: "MID-BANESHWOR", point: [27.700,85.338], kind: "service", minZoom: 14 },
  { name: "OLD BANESHWOR", point: [27.700,85.333], kind: "service", minZoom: 15 },
  { name: "SHANKHAMUL", point: [27.686,85.337], kind: "service", minZoom: 15 },
  { name: "SIFAL", point: [27.711,85.348], kind: "service", minZoom: 15 },
  { name: "SAMAKHUSI", point: [27.735,85.319], kind: "service", minZoom: 14 },
  { name: "BALAJU BYPASS", point: [27.735,85.302], kind: "service", minZoom: 15 },
  { name: "GOTHATAR", point: [27.697,85.376], kind: "service", minZoom: 14 },
  { name: "GODAWARI ROAD · DHOBIGHAT", point: [27.665,85.309], kind: "service", minZoom: 15 },
  { name: "KUMARIPATI", point: [27.666,85.324], kind: "service", minZoom: 15 },
  { name: "LAGANKHEL", point: [27.666,85.328], kind: "service", minZoom: 15 },
  { name: "IMADOL", point: [27.665,85.354], kind: "service", minZoom: 14 },
  { name: "BALKUMARI", point: [27.671,85.350], kind: "service", minZoom: 14 },
  { name: "DHAPAKHEL", point: [27.653,85.316], kind: "service", minZoom: 14 },
  { name: "NAKHIPOT", point: [27.657,85.321], kind: "service", minZoom: 15 },
  { name: "MAHALAXMISTHAN", point: [27.670,85.318], kind: "service", minZoom: 15 },
  { name: "JAGATI", point: [27.665,85.441], kind: "service", minZoom: 14 },
  { name: "TAUMADHI SQUARE", point: [27.671,85.429], kind: "service", minZoom: 15 },
  { name: "POTTERY SQUARE", point: [27.674,85.430], kind: "service", minZoom: 16 },
  { name: "CHYAMASINGH", point: [27.674,85.441], kind: "service", minZoom: 15 },
  { name: "BUDDHA CHOWK", point: [27.43075,85.03258], kind: "landmark", minZoom: 13 },
  { name: "RAKTIM ROAD", point: [27.43075,85.03258], kind: "landmark", minZoom: 13 },
  { name: "HETAUDA BUS PARK", point: [27.43018,85.02882], kind: "service", minZoom: 13 },
  { name: "HETAUDA HOSPITAL", point: [27.43231,85.02772], kind: "service", minZoom: 14 },
  { name: "SANOPOKHARA CHOWK", point: [27.420,85.040], kind: "service", minZoom: 14 },
  { name: "RAPTI ROAD", point: [27.424,85.039], kind: "service", minZoom: 15 },
  { name: "HETAUDA MARKET LANES", point: [27.429,85.034], kind: "service", minZoom: 16 },
  { name: "HUPRA CHAUR APPROACH", point: [27.436,85.025], kind: "service", minZoom: 16 },
  { name: "KAMANE RESIDENTIAL AREA", point: [27.408,85.039], kind: "service", minZoom: 15 },
  { name: "RATOMATE MARKET", point: [27.431,85.046], kind: "service", minZoom: 15 },
  { name: "CHAU KITOL ROAD", point: [27.442,85.023], kind: "service", minZoom: 16 },
  { name: "NAWALPUR · HETAUDA", point: [27.43843,84.99293], kind: "landmark", minZoom: 12 },
  { name: "HATIYA · HETAUDA", point: [27.3700,85.1000], kind: "landmark", minZoom: 12 },
  { name: "RATOMATE · HETAUDA", point: [27.38617,85.02772], kind: "landmark", minZoom: 12 },
  { name: "SIMARA CHOWK", point: [27.1666,84.9786], kind: "landmark", minZoom: 13 },
  { name: "JEETPUR · SIMARA CORRIDOR", point: [27.178,84.981], kind: "landmark", minZoom: 13 },
  { name: "SIMARA AIRPORT", point: [27.164201,84.980135], kind: "service", minZoom: 13 },
  { name: "PIPARA SIMARA", point: [27.162,84.975], kind: "service", minZoom: 15 },
  { name: "AIRPORT ROAD", point: [27.164,84.982], kind: "service", minZoom: 15 },
  { name: "SIMARA BAZAAR LANES", point: [27.167,84.981], kind: "service", minZoom: 16 },
  { name: "JEETPUR", point: [27.147,84.957], kind: "landmark", minZoom: 12 },
  { name: "JEETPUR BAZAAR", point: [27.147,84.957], kind: "service", minZoom: 14 },
  { name: "JEETPUR APPROACH", point: [27.178,84.987], kind: "service", minZoom: 16 },
  { name: "NARABASTI", point: [27.16764,84.96872], kind: "landmark", minZoom: 12 },
  { name: "PATHLAIYA", point: [27.20054,84.98440], kind: "landmark", minZoom: 12 },
  { name: "HUPRA CHAUR", point: [27.434,85.029], kind: "service", minZoom: 14 },
  { name: "BHUTANDEVI TEMPLE", point: [27.429,85.031], kind: "service", minZoom: 15 },
  { name: "GORAKHESHWOR TEMPLE", point: [27.4306,85.025], kind: "service", minZoom: 15 },
  { name: "RAPTI BRIDGE", point: [27.429,85.011], kind: "landmark", minZoom: 14 },
  { name: "RATOMATE", point: [27.431,85.046], kind: "service", minZoom: 14 },
  { name: "CHAUKITOL", point: [27.442,85.023], kind: "service", minZoom: 14 },
  { name: "KIRTIPUR BAZAAR", point: [27.6799,85.2710], kind: "landmark", minZoom: 12 },
  { name: "PANGA · LACHHI", point: [27.6712,85.2790], kind: "landmark", minZoom: 12 },
  { name: "NAGAUN · PANGA DOBATO", point: [27.6722,85.2743], kind: "landmark", minZoom: 12 },
  { name: "TYANGLA CHOWK", point: [27.681,85.287], kind: "landmark", minZoom: 12 },
  { name: "NAGAUN POKHARI", point: [27.6742,85.2749], kind: "service", minZoom: 14 },
  { name: "TYANGLAPOKHARI", point: [27.679,85.281], kind: "service", minZoom: 14 },
  { name: "TRIBHUVAN UNIVERSITY", point: [27.68123,85.28963], kind: "landmark", minZoom: 12 },
  { name: "BAGH BHAIRAB · LAYEKU", point: [27.6862,85.2799], kind: "landmark", minZoom: 12 },
  { name: "UMA MAHESHWOR · KWACHO", point: [27.6858,85.2752], kind: "service", minZoom: 13 },
  { name: "KHASIBAZAR · SAMAL", point: [27.6799,85.2710], kind: "service", minZoom: 13 },
  { name: "BHAJANGAL", point: [27.6703,85.2841], kind: "service", minZoom: 13 },
  { name: "CHILANCHO · NAYA BAZAR", point: [27.6793,85.2865], kind: "service", minZoom: 13 },
  { name: "CHOBHAR", point: [27.6590,85.2826], kind: "service", minZoom: 13 },
  { name: "GAMCHA · GODAM CHAUR", point: [27.6634,85.2591], kind: "service", minZoom: 14 },
  { name: "DHUSI · BHATKYAPATI", point: [27.6652,85.2722], kind: "service", minZoom: 14 },
  { name: "KAMANE", point: [27.40379,85.03944], kind: "service", minZoom: 13 },
  { name: "DUMARWANA", point: [27.13214,85.01904], kind: "service", minZoom: 13 },
  { name: "HATTISAR", point: [27.137,85.015], kind: "service", minZoom: 14 },
  { name: "POTA", point: [27.129,85.021], kind: "service", minZoom: 14 },
  { name: "PHATTEPUR", point: [27.125,85.015], kind: "service", minZoom: 14 },
  { name: "KICHHA POKHARI", point: [27.703,85.312], kind: "service", minZoom: 16 },
  { name: "DALLU", point: [27.716,85.296], kind: "service", minZoom: 15 },
  { name: "NAYABAZAR", point: [27.722,85.309], kind: "service", minZoom: 15 },
  { name: "DHUMBARAHI", point: [27.735,85.341], kind: "service", minZoom: 15 },
  { name: "INACHO", point: [27.671,85.431], kind: "service", minZoom: 16 },
  { name: "BOLACHHEN", point: [27.673,85.430], kind: "service", minZoom: 16 },
  { name: "SUKULDHOKA", point: [27.676,85.433], kind: "service", minZoom: 16 },
  { name: "TACHAPAL", point: [27.668,85.435], kind: "service", minZoom: 16 },
];

export const tirkhaParks: LatLngExpression[][][] = [
  [[[27.714,85.322],[27.716,85.322],[27.716,85.325],[27.714,85.325]]],
  [[[27.681,85.317],[27.683,85.317],[27.683,85.319],[27.681,85.319]]],
  [[[28.222,83.981],[28.224,83.981],[28.224,83.984],[28.222,83.984]]],
];

export const tirkhaCityViews = [
  { id: "kathmandu", label: "Kathmandu", subtitle: "The capital and its central neighborhoods", center: [27.7172,85.324] as [number,number], zoom: 14 },
  { id: "lalitpur", label: "Lalitpur", subtitle: "Patan and the southern valley", center: [27.674,85.322] as [number,number], zoom: 14 },
  { id: "bhaktapur", label: "Bhaktapur", subtitle: "Heritage streets and eastern valley", center: [27.676,85.432] as [number,number], zoom: 14 },
  { id: "kirtipur", label: "Kirtipur", subtitle: "Historic hill town and TU campus", center: [27.67806,85.27694] as [number,number], zoom: 15 },
  { id: "pokhara", label: "Pokhara", subtitle: "Lakeside and the city center", center: [28.217,83.985] as [number,number], zoom: 14 },
  { id: "hetauda", label: "Hetauda", subtitle: "Buddha Chowk and Rapti Road", center: [27.407,85.045] as [number,number], zoom: 12.5 },
  { id: "simara", label: "Simara", subtitle: "Simara Chowk and Jeetpur-Simara", center: [27.166,84.987] as [number,number], zoom: 12.5 },
  ...DISTRICTS.map((district) => ({
    id: district.key,
    label: district.name,
    subtitle: district.description,
    center: [district.center.latitude, district.center.longitude] as [number,number],
    zoom: district.zoom,
    bounds: district.bounds,
  })),
];
