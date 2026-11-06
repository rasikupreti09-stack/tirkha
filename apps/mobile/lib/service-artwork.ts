import type { ImageSourcePropType } from "react-native";

// Local bundled copies of the marketplace artwork keep category imagery available
// offline and avoid remote image loading failures in standalone Android builds.
const ARTWORK: Record<string, ImageSourcePropType> = {
  "tirkha-astrologer.webp": require("../assets/services/tirkha-astrologer.webp"),
  "tirkha-beautician.webp": require("../assets/services/tirkha-beautician.webp"),
  "tirkha-carpenter.webp": require("../assets/services/tirkha-carpenter.webp"),
  "tirkha-decorator.webp": require("../assets/services/tirkha-decorator.webp"),
  "tirkha-electrician.webp": require("../assets/services/tirkha-electrician.webp"),
  "tirkha-hero-team.webp": require("../assets/services/tirkha-hero-team.webp"),
  "tirkha-home-care.webp": require("../assets/services/tirkha-home-care.webp"),
  "tirkha-home-doctor.webp": require("../assets/services/tirkha-home-doctor.webp"),
  "tirkha-plumber.webp": require("../assets/services/tirkha-plumber.webp"),
  "tirkha-service-drain-clearing.webp": require("../assets/services/tirkha-service-drain-clearing.webp"),
  "tirkha-service-electrical-inspection.webp": require("../assets/services/tirkha-service-electrical-inspection.webp"),
  "tirkha-service-home-nurse.webp": require("../assets/services/tirkha-service-home-nurse.webp"),
  "tirkha-service-inverter-utility-room.webp": require("../assets/services/tirkha-service-inverter-utility-room.webp"),
  "tirkha-service-mcb-alcove.webp": require("../assets/services/tirkha-service-mcb-alcove.webp"),
  "tirkha-service-physiotherapy.webp": require("../assets/services/tirkha-service-physiotherapy.webp"),
  "tirkha-service-pipe-fitting.webp": require("../assets/services/tirkha-service-pipe-fitting.webp"),
  "tirkha-service-sofa-cleaning.webp": require("../assets/services/tirkha-service-sofa-cleaning.webp"),
  "tirkha-service-sump-pump.webp": require("../assets/services/tirkha-service-sump-pump.webp"),
  "tirkha-service-tap-installation.webp": require("../assets/services/tirkha-service-tap-installation.webp"),
  "tirkha-service-tap-leak.webp": require("../assets/services/tirkha-service-tap-leak.webp"),
  "tirkha-service-wiring-hall.webp": require("../assets/services/tirkha-service-wiring-hall.webp"),
  "tirkha-tank-care.webp": require("../assets/services/tirkha-tank-care.webp"),
  "tirkha-tutor.webp": require("../assets/services/tirkha-tutor.webp"),
};

const CATEGORY_ARTWORK: Record<string, ImageSourcePropType> = {
  plumbing: ARTWORK["tirkha-plumber.webp"],
  electrical: ARTWORK["tirkha-electrician.webp"],
  "home-cleaning": ARTWORK["tirkha-tank-care.webp"],
  "appliance-repair": ARTWORK["tirkha-service-inverter-utility-room.webp"],
  painting: ARTWORK["tirkha-hero-team.webp"],
  carpentry: ARTWORK["tirkha-carpenter.webp"],
  healthcare: ARTWORK["tirkha-home-doctor.webp"],
  "home-care": ARTWORK["tirkha-home-care.webp"],
  "beauty-wellness": ARTWORK["tirkha-beautician.webp"],
  astrology: ARTWORK["tirkha-astrologer.webp"],
  tutoring: ARTWORK["tirkha-tutor.webp"],
  events: ARTWORK["tirkha-decorator.webp"],
};

export function getServiceArtwork(imagePath?: string | null, categorySlug?: string): ImageSourcePropType {
  const filename = imagePath?.split("/").pop();
  return (filename && ARTWORK[filename]) || (categorySlug && CATEGORY_ARTWORK[categorySlug]) || ARTWORK["tirkha-hero-team.webp"];
}
