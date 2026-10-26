import type { LatLngExpression } from "leaflet";

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
  // Pokhara city spine, lakeside and airport approach.
  { name: "Prithvi Chowk · Mahendrapul", kind: "arterial", points: [[28.197,83.981],[28.208,83.986],[28.218,83.989],[28.228,83.989],[28.237,83.987],[28.243,83.982]] },
  { name: "Lakeside Road", kind: "arterial", points: [[28.209,83.959],[28.213,83.963],[28.217,83.968],[28.220,83.973],[28.222,83.979],[28.224,83.984]] },
  { name: "Pokhara Airport approach", kind: "connector", points: [[28.197,83.981],[28.195,83.990],[28.194,83.999],[28.198,84.006]] },
  { name: "Zero KM · Lakeside", kind: "connector", points: [[28.220,83.973],[28.217,83.979],[28.211,83.984],[28.205,83.984],[28.201,83.980]] },
  { name: "Mahendrapul neighborhood", kind: "local", points: [[28.226,83.983],[28.230,83.986],[28.233,83.990],[28.237,83.988],[28.240,83.985]] },
  { name: "Pokhara city grid", kind: "local", points: [[28.201,83.976],[28.205,83.979],[28.210,83.980],[28.215,83.979],[28.220,83.981],[28.225,83.985]] },
  { name: "Lakeside access lanes", kind: "local", points: [[28.207,83.956],[28.212,83.960],[28.216,83.964],[28.219,83.970],[28.222,83.976]] },
];

export const tirkhaWaterways: LatLngExpression[][] = [
  [[27.744,85.296],[27.738,85.300],[27.732,85.303],[27.726,85.305],[27.720,85.307],[27.714,85.307],[27.708,85.305],[27.702,85.302],[27.696,85.300]],
  [[27.727,85.356],[27.720,85.351],[27.713,85.347],[27.706,85.342],[27.699,85.337],[27.692,85.333],[27.685,85.328],[27.678,85.323],[27.670,85.320]],
];

export const tirkhaLandmarks: { name: string; point: [number, number]; kind: "district" | "landmark" | "service"; minZoom: number }[] = [
  { name: "KATHMANDU", point: [27.7172,85.324], kind: "district", minZoom: 10 },
  { name: "LALITPUR · PATAN", point: [27.674,85.322], kind: "district", minZoom: 10 },
  { name: "BHAKTAPUR", point: [27.676,85.432], kind: "district", minZoom: 10 },
  { name: "POKHARA", point: [28.217,83.985], kind: "district", minZoom: 10 },
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
  { name: "Boudhanath", point: [27.721,85.362], kind: "service", minZoom: 13 },
  { name: "Balaju", point: [27.735,85.303], kind: "service", minZoom: 14 },
  { name: "Gongabu", point: [27.745,85.324], kind: "service", minZoom: 14 },
  { name: "Kalanki", point: [27.694,85.281], kind: "service", minZoom: 14 },
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
];

export const tirkhaParks: LatLngExpression[][][] = [
  [[[27.714,85.322],[27.716,85.322],[27.716,85.325],[27.714,85.325]]],
  [[[27.681,85.317],[27.683,85.317],[27.683,85.319],[27.681,85.319]]],
  [[[28.222,83.981],[28.224,83.981],[28.224,83.984],[28.222,83.984]]],
];

export const tirkhaCityViews = [
  { label: "Kathmandu", center: [27.7172,85.324] as [number,number], zoom: 13 },
  { label: "Lalitpur", center: [27.674,85.322] as [number,number], zoom: 14 },
  { label: "Bhaktapur", center: [27.676,85.432] as [number,number], zoom: 14 },
  { label: "Pokhara", center: [28.217,83.985] as [number,number], zoom: 13 },
];
