export type Hub = {
  id: string;
  name: string;
  city: "yangon" | "mandalay";
  lat: number;
  lng: number;
};

export const HUBS: Hub[] = [
  {
    id: "yangon-hub-1",
    name: "Yangon Hub - Hlaing",
    city: "yangon",
    lat: 16.8416,
    lng: 96.1234,
  },
  {
    id: "yangon-hub-2",
    name: "Yangon Hub - Tamwe",
    city: "yangon",
    lat: 16.8044,
    lng: 96.1675,
  },
  {
    id: "mandalay-hub-1",
    name: "Mandalay Hub - Chanayethazan",
    city: "mandalay",
    lat: 21.9747,
    lng: 96.0836,
  },
  {
    id: "mandalay-hub-2",
    name: "Mandalay Hub - Maha Aungmye",
    city: "mandalay",
    lat: 21.9603,
    lng: 96.0958,
  },
];
