export const CODE = { L: "LIBRE", O: "OCCUPE", M: "MAUVAIS" };

export const SC = {
  LIBRE: { bg: "#F4F6F8", tx: "#AAB4BE", bd: "#DDE3EA", dot: "#BDC3C7" },
  OCCUPE: { bg: "#C6EFCE", tx: "#1A5C28", bd: "#5A9E6A", dot: "#27AE60" },
  MAUVAIS: { bg: "#FCE4D6", tx: "#7B2000", bd: "#E06C3A", dot: "#E74C3C" },
};

export const NAVY = "#0F2744";
export const BLUE = "#1565C0";
export const ACCENT = "#E8F4FD";

export const CAN_EDIT = r => ["admin", "superviseur", "technicien"].includes(r);
export const CAN_ADMIN = r => ["admin", "superviseur"].includes(r);

export const spKey = (s, p) => `S${String(s).padStart(2, "0")}P${String(p).padStart(2, "0")}`;
export const tsNow = () => new Date().toISOString();
export const fmtDt = d => d ? new Date(d).toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" }) : "";
