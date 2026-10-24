import { localizeLabels, tr } from "../../i18n/store";
import { Text } from "../../i18n/Text";
import {
  useContext,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import { command, errorMessage } from "../journal/api";
import { OperationContext } from "../../operations";
export interface ImageTarget {
  kind: "page" | "character" | "asset";
  id: string;
}
export interface Attachment {
  id: string;
  campaignId: string;
  caption: string;
  role: "portrait" | "map" | "image" | "reference";
  filename: string;
  width: number;
  height: number;
  size: number;
  sha256: string;
  createdAt: string;
}
const roleLabels = localizeLabels({
  portrait: "Ritratto",
  map: "Mappa",
  image: "Immagine",
  reference: "Riferimento",
});
export default function ImageGallery({
  campaignId,
  target,
  busy = false,
}: {
  campaignId: string;
  target: ImageTarget;
  busy?: boolean;
}) {
  const run = useContext(OperationContext);
  const [images, setImages] = useState<Attachment[]>([]),
    [loading, setLoading] = useState(true),
    [pending, setPending] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const [role, setRole] = useState<Attachment["role"]>(
    target.kind === "character" ? "portrait" : "image",
  );
  const [caption, setCaption] = useState("");
  const [viewer, setViewer] = useState<{
      image: Attachment;
      url: string;
    } | null>(null),
    [remove, setRemove] = useState<Attachment | null>(null),
    [refresh, setRefresh] = useState(0);
  const [zoom, setZoom] = useState(100);
  const file = useRef<HTMLInputElement>(null),
    previewButton = useRef<HTMLButtonElement | null>(null),
    modal = useRef<HTMLElement>(null);
  useEffect(() => {
    let active = true;
    command<Attachment[]>("list_images", {
      campaignId,
      target: { kind: target.kind, id: target.id },
    })
      .then((rows) => {
        if (active) {
          setImages(rows);
          setError("");
        }
      })
      .catch((e) => {
        if (active) setError(errorMessage(e));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [campaignId, target.kind, target.id, refresh]);
  const disabled = busy || pending;
  async function perform(action: () => Promise<void>) {
    if (disabled) return;
    setPending(true);
    setError("");
    setNotice("");
    try {
      await run(async () => {
        try {
          await action();
        } catch (e) {
          setError(errorMessage(e));
        }
      });
    } finally {
      setPending(false);
    }
  }
  async function add(selected: File) {
    await perform(async () => {
      if (selected.size > 20 * 1024 * 1024)
        throw Error(tr("Immagine troppo grande: massimo 20 MiB."));
      const encoded = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () =>
          resolve(String(reader.result).split(",")[1] ?? "");
        reader.onerror = () =>
          reject(Error(tr("Impossibile leggere il file scelto.")));
        reader.readAsDataURL(selected);
      });
      const saved = await command<Attachment>("add_image", {
        campaignId,
        target,
        caption: caption.trim() || selected.name.slice(0, 200),
        role,
        dataBase64: encoded,
      });
      setImages((rows) => [...rows, saved]);
      setCaption("");
      setNotice(
        tr("Immagine copiata nell’archivio e inclusa nei prossimi backup."),
      );
    });
    if (file.current) file.current.value = "";
  }
  function close() {
    setViewer(null);
    setRemove(null);
    previewButton.current?.focus();
  }
  function keyboard(e: KeyboardEvent) {
    if (e.key === "Escape") {
      e.preventDefault();
      close();
    }
    if (e.key === "Tab") {
      const buttons = modal.current?.querySelectorAll<HTMLElement>(
        "button:not(:disabled),select,input",
      );
      if (!buttons?.length) return;
      const first = buttons[0],
        last = buttons[buttons.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  }
  function detach() {
    if (!remove) return;
    void perform(async () => {
      await command("detach_image", {
        campaignId,
        id: remove.id,
      });
      setImages((rows) => rows.filter((i) => i.id !== remove.id));
      close();
      setNotice(
        tr(
          "Collegamento immagine rimosso. Il file è conservato nell’archivio.",
        ),
      );
    });
  }
  return (
    <section
      className="image-gallery"
      aria-label={tr("Immagini della voce")}
      aria-busy={disabled}
    >
      <details open={images.length > 0}>
        <summary>
          <Text source={"Immagini ("} />
          {images.length})
        </summary>
        <p className="muted">
          <Text
            source={
              "Aggiungi un ritratto, una mappa o un’immagine. PNG, JPEG e WebP, massimo 20 MiB e 8192 px per lato. Copie locali incluse nel backup."
            }
          />
        </p>
        <div className="player-fields">
          <label>
            <Text source={"Didascalia immagine"} />
            <input
              value={caption}
              maxLength={200}
              onChange={(e) => setCaption(e.target.value)}
              disabled={disabled}
            />
          </label>
          <label>
            <Text source={"Tipo immagine"} />
            <select
              aria-label={tr("Tipo immagine")}
              value={role}
              disabled={disabled}
              onChange={(e) => setRole(e.target.value as Attachment["role"])}
            >
              {Object.entries(roleLabels).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label className="image-file">
          <Text source={"Aggiungi immagine"} />
          <input
            ref={file}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            disabled={disabled || images.length >= 100}
            onChange={(e) => {
              const selected = e.target.files?.[0];
              if (selected) void add(selected);
            }}
          />
        </label>
        {loading ? (
          <p role="status">
            <Text source={"Apertura immagini…"} />
          </p>
        ) : !images.length ? (
          <p>
            <Text source={"Nessuna immagine aggiunta."} />
          </p>
        ) : null}
        {error ? (
          <div role="alert" className="error">
            <p>{error}</p>
            <button
              disabled={disabled}
              onClick={() => {
                setLoading(true);
                setRefresh((v) => v + 1);
              }}
            >
              <Text source={"Ricarica immagini"} />
            </button>
          </div>
        ) : null}
        <p role="status">
          {pending ? tr("Operazione immagine in corso…") : notice}
        </p>
        <div className="image-grid">
          {images.map((image) => (
            <ImageCard
              key={image.id}
              image={image}
              disabled={disabled}
              onOpen={(button) => {
                previewButton.current = button;
                void perform(async () => {
                  const url = await command<string>("read_image", {
                    campaignId,
                    id: image.id,
                    thumbnail: false,
                  });
                  setZoom(100);
                  setViewer({ image, url });
                });
              }}
              onRemove={(button) => {
                previewButton.current = button;
                setRemove(image);
              }}
            />
          ))}
        </div>
      </details>
      {viewer || remove ? (
        <ImageDialog
          viewer={viewer}
          remove={remove}
          modal={modal}
          keyboard={keyboard}
          close={close}
          disabled={disabled}
          zoom={zoom}
          setZoom={setZoom}
          onDetach={detach}
        />
      ) : null}
    </section>
  );
}
function ImageCard({
  image,
  disabled,
  onOpen,
  onRemove,
}: {
  image: Attachment;
  disabled: boolean;
  onOpen: (b: HTMLButtonElement) => void;
  onRemove: (b: HTMLButtonElement) => void;
}) {
  const [url, setUrl] = useState(""),
    [error, setError] = useState("");
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    let active = true;
    let started = false;
    const load = () => {
      if (started) return;
      started = true;
      command<string>("read_image", {
        campaignId: image.campaignId,
        id: image.id,
        thumbnail: true,
      })
        .then((url) => {
          if (active) setUrl(url);
        })
        .catch((e) => {
          if (active) setError(errorMessage(e));
        });
    };
    if (typeof IntersectionObserver === "undefined") {
      load();
      return () => {
        active = false;
      };
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          observer.disconnect();
          load();
        }
      },
      { rootMargin: "200px" },
    );
    if (ref.current) observer.observe(ref.current);
    return () => {
      active = false;
      observer.disconnect();
    };
  }, [image.campaignId, image.id]);
  return (
    <figure ref={ref}>
      <button
        disabled={disabled}
        onClick={(e) => onOpen(e.currentTarget)}
        aria-label={tr("Apri immagine: {0}", [image.caption])}
      >
        {url ? (
          <img src={url} alt={image.caption} loading="lazy" />
        ) : (
          <span>{error || tr("Anteprima immagine…")}</span>
        )}
      </button>
      <figcaption>
        {image.caption}
        <small>
          {roleLabels[image.role]} · {image.width} <Text source={" × "} />
          {image.height}
        </small>
      </figcaption>
      <button disabled={disabled} onClick={(e) => onRemove(e.currentTarget)}>
        <Text source={"Rimuovi dalla voce"} />
      </button>
    </figure>
  );
}

function ImageDialog({
  viewer,
  remove,
  modal,
  keyboard,
  close,
  disabled,
  zoom,
  setZoom,
  onDetach,
}: {
  viewer: { image: Attachment; url: string } | null;
  remove: Attachment | null;
  modal: React.RefObject<HTMLElement | null>;
  keyboard: (event: KeyboardEvent) => void;
  close: () => void;
  disabled: boolean;
  zoom: number;
  setZoom: (zoom: number) => void;
  onDetach: () => void;
}) {
  return (
    <div className="image-overlay">
      <section
        className="image-viewer"
        ref={modal}
        role="dialog"
        aria-modal="true"
        aria-label={
          viewer ? viewer.image.caption : tr("Rimuovi collegamento immagine")
        }
        onKeyDown={keyboard}
      >
        <button autoFocus onClick={close}>
          <Text source={"Chiudi immagine"} />
        </button>
        {viewer ? (
          <>
            <h3>{viewer.image.caption}</h3>
            <label>
              <Text source={"Ingrandimento immagine"} />
              <select
                aria-label={tr("Ingrandimento immagine")}
                value={zoom}
                onChange={(e) => setZoom(Number(e.target.value))}
              >
                {[50, 100, 150, 200, 300].map((n) => (
                  <option key={n} value={n}>
                    {n === 100 ? tr("Adatta alla finestra") : tr("{0}%", [n])}
                  </option>
                ))}
              </select>
            </label>
            <div className="image-full">
              <img
                src={viewer.url}
                alt={viewer.image.caption}
                style={{ width: `${zoom}%`, maxWidth: "none" }}
              />
            </div>
            <p>
              {viewer.image.width} <Text source={" × "} />
              {viewer.image.height} <Text source={" px ·"} />{" "}
              {roleLabels[viewer.image.role]}
            </p>
          </>
        ) : remove ? (
          <>
            <h3>
              <Text source={"Rimuovere "} />
              {remove.caption} <Text source={" dalla voce?"} />
            </h3>
            <p>
              <Text
                source={
                  "Il file rimane nell’archivio per il recupero e continua a essere incluso nei backup. Le note sono conservate."
                }
              />
            </p>
            <button disabled={disabled} onClick={onDetach}>
              <Text source={"Rimuovi collegamento"} />
            </button>
          </>
        ) : null}
      </section>
    </div>
  );
}
