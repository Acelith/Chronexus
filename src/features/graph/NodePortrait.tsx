import { useEffect, useState } from "react";
import { command } from "../journal/api";
import type { Attachment } from "../images/ImageGallery";
import { Icon } from "../../components/Ornaments";
const kindIcons: Record<string, string> = {
  place: "castle",
  npc: "helmet",
  session: "scroll",
  faction: "party",
};
export default function NodePortrait({
  campaignId,
  pageId,
  kind,
}: {
  campaignId: string;
  pageId: string;
  kind: string;
}) {
  const [portrait, setPortrait] = useState({ pageId: "", url: "" });
  useEffect(() => {
    let active = true;
    void command<Attachment[]>("list_images", {
      campaignId,
      target: { kind: "page", id: pageId },
    })
      .then(async (images) => {
        const image = images.find((i) => i.role === "portrait");
        if (!image) return;
        const url = await command<string>("read_image", {
          campaignId,
          id: image.id,
          thumbnail: true,
        });
        if (active) setPortrait({ pageId, url });
      })
      .catch(() => {
        /* The gallery exposes file errors; this optional decoration keeps a truthful icon fallback. */
      });
    return () => {
      active = false;
    };
  }, [campaignId, pageId]);
  return (
    <div className="node-medallion">
      {portrait.pageId === pageId && portrait.url ? (
        <img src={portrait.url} alt="Ritratto allegato alla voce" />
      ) : (
        <Icon name={kindIcons[kind] ?? "star"} />
      )}
    </div>
  );
}
