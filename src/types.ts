export interface PrintItem {
  type:
    | "text"
    | "image"
    | "barcode"
    | "qr"
    | "feed"
    | "cut"
    | "line"
    | "drawLine"
    | "doubleLine"
    | "newLine"
    | "table"
    | "tableCustom";
  content?: string | any[];
  options?: {
    align?: "lt" | "ct" | "rt" | "left" | "center" | "right";
    width?: number;
    height?: number;
    size?: [number, number]; // [width, height]
    font?: "a" | "b";
    style?: "normal" | "b" | "i" | "u" | "u2" | "bi" | "biu" | "biu2";
    // QR/Barcode specific
    model?: number;
    level?: "L" | "M" | "Q" | "H";
    cellSize?: number;
    width_barcode?: number;
    height_barcode?: number;
    position?: "OFF" | "ABOVE" | "BELOW" | "BOTH";
    font_barcode?: "A" | "B";
    // Line specific
    char?: string;
    // Table specific
    columns?: {
      width: number;
      align?: "left" | "center" | "right";
    }[];
  };
}

export interface PrintJob {
  items?: PrintItem[];
  printer?: {
    width?: number;
  };
}
