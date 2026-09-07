import type { City, CityId } from "./types";

export const CITIES: Record<CityId, City> = {
  mumbai: { id: "mumbai", name: "Mumbai", region: "West" },
  delhi: { id: "delhi", name: "Delhi", region: "North" },
  bengaluru: { id: "bengaluru", name: "Bengaluru", region: "South" },
  hyderabad: { id: "hyderabad", name: "Hyderabad", region: "South" },
  chennai: { id: "chennai", name: "Chennai", region: "South" },
  pune: { id: "pune", name: "Pune", region: "West" },
};

export function cityName(id: CityId): string {
  return CITIES[id].name;
}
