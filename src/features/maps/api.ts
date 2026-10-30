import { command } from "../journal/api";
export interface MapImage {
  id: string;
  caption: string;
  width: number;
  height: number;
  pageId: string | null;
}
export interface PinInput {
  sourceKind: "page" | "session" | "clue";
  sourceId: string;
  label: string;
  x: number;
  y: number;
}
export interface Pin {
  id: string;
  campaignId: string;
  imageId: string;
  input: PinInput;
  revision: number;
}
export interface Route {
  id: string;
  campaignId: string;
  imageId: string;
  fromPinId: string;
  toPinId: string;
  label: string;
  revision: number;
}
export const mapsApi = {
  images: (campaignId: string) =>
    command<MapImage[]>("list_map_images", { campaignId }),
  pins: (campaignId: string, imageId: string) =>
    command<Pin[]>("list_map_pins", { campaignId, imageId }),
  routes: (campaignId: string, imageId: string) =>
    command<Route[]>("list_map_routes", { campaignId, imageId }),
  image: (campaignId: string, id: string) =>
    command<string>("read_image", { campaignId, id, thumbnail: false }),
  savePin: (campaignId: string, imageId: string, input: PinInput, pin?: Pin) =>
    command<Pin>("save_map_pin", {
      campaignId,
      imageId,
      input,
      id: pin?.id ?? null,
      revision: pin?.revision ?? null,
    }),
  deletePin: (campaignId: string, imageId: string, pin: Pin) =>
    command<void>("delete_map_pin", {
      campaignId,
      imageId,
      id: pin.id,
      revision: pin.revision,
    }),
  addRoute: (
    campaignId: string,
    imageId: string,
    fromPinId: string,
    toPinId: string,
    label: string,
  ) =>
    command<Route>("add_map_route", {
      campaignId,
      imageId,
      fromPinId,
      toPinId,
      label,
    }),
  deleteRoute: (campaignId: string, imageId: string, route: Route) =>
    command<void>("delete_map_route", {
      campaignId,
      imageId,
      id: route.id,
      revision: route.revision,
    }),
  relink: (campaignId: string, oldImageId: string, newImageId: string) =>
    command<void>("relink_map_image", { campaignId, oldImageId, newImageId }),
};
