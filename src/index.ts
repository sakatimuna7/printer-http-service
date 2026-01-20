console.log("==========================================");
console.log("   PRINTER SERVICE STARTING (DEBUG MODE)  ");
console.log("==========================================");

process.on("uncaughtException", (error) => {
  console.error("\n!!! FATAL UNCAUGHT EXCEPTION !!!");
  console.error(error);
  console.log("\nPress Enter to exit...");
  process.stdin.once("data", () => process.exit(1));
});

process.on("unhandledRejection", (reason) => {
  console.error("\n!!! FATAL UNHANDLED REJECTION !!!");
  console.error(reason);
  console.log("\nPress Enter to exit...");
  process.stdin.once("data", () => process.exit(1));
});

// Early wait to ensure terminal stays open even if something fails soon
console.log("Initializing core... (Please wait 2 seconds)");

// Use dynamic imports to catch loading errors
async function start() {
  try {
    console.log("Initializing USB environment...");
    const { ensureNativeLib } = await import("./portable-init.ts");
    const usbLib = await ensureNativeLib();

    console.log("Loading adapters...");
    const { CustomUSB, initializeUSB } = await import("./usb-adapter.ts");
    initializeUSB(usbLib);

    console.log("Loading printer library...");
    const { default: escpos } = await import("escpos");

    const port = process.env.PORT || 5001;

    function getPrinter(options?: { width?: number }) {
      try {
        const device = new CustomUSB();
        const printer = new (escpos as any).Printer(device, {
          width: options?.width || 24,
        });
        return { device, printer };
      } catch (err: any) {
        console.error("Printer Initialization Error:", err.message);
        throw err;
      }
    }

    const server = Bun.serve({
      port,
      async fetch(req) {
        const url = new URL(req.url);

        if (req.method === "POST" && url.pathname === "/print") {
          try {
            const body = await req.json();
            const { device, printer } = getPrinter({
              width: body.printer?.width,
            });

            return new Promise((resolve) => {
              device.open(async (error: any) => {
                if (error) {
                  console.error("USB Open Error:", error);
                  return resolve(
                    Response.json(
                      { success: false, error: "Could not open USB device" },
                      { status: 500 },
                    ),
                  );
                }

                try {
                  // Jika payload punya items, pakai layout generic
                  if (body.items) {
                    printer.font("a").align("CT").size(1, 1);

                    for (const item of body.items) {
                      const opt = item.options || {};

                      if (item.type === "text" && item.content) {
                        if (opt.align) printer.align(opt.align);
                        if (opt.style) printer.style(opt.style);
                        if (opt.size) printer.size(opt.size[0], opt.size[1]);
                        printer.text(String(item.content));
                      } else if (item.type === "line") {
                        const char = opt.char || "-";
                        printer.text(char.repeat(body.printer?.width || 24));
                      } else if (item.type === "drawLine") {
                        printer.drawLine();
                      } else if (item.type === "doubleLine") {
                        if (opt.align) printer.align(opt.align);
                        if (opt.style) printer.style(opt.style);
                        if (opt.size) printer.size(opt.size[0], opt.size[1]);
                        printer.text("=".repeat(body.printer?.width || 24));
                      } else if (item.type === "newLine") {
                        printer.newLine();
                      } else if (
                        item.type === "table" &&
                        Array.isArray(item.content)
                      ) {
                        printer.table(item.content);
                      } else if (
                        item.type === "tableCustom" &&
                        Array.isArray(item.content) &&
                        opt.columns
                      ) {
                        printer.tableCustom(
                          item.content.map((text: any, i: number) => ({
                            text: String(text),
                            align:
                              opt.columns![i]?.align?.toUpperCase() || "LEFT",
                            width: opt.columns![i]?.width || 0.33,
                          })),
                        );
                      } else if (item.type === "qr" && item.content) {
                        printer.qrcode(
                          String(item.content),
                          opt.model || 2,
                          opt.level || "L",
                          opt.cellSize || 6,
                        );
                      } else if (item.type === "barcode" && item.content) {
                        printer.barcode(String(item.content), "CODE128", {
                          width: opt.width_barcode || 2,
                          height: opt.height_barcode || 100,
                          position: opt.position || "BELOW",
                          font: opt.font_barcode || "A",
                        });
                      } else if (item.type === "feed") {
                        printer.feed(Number(item.content) || 1);
                      } else if (item.type === "cut") {
                        printer.cut();
                      }
                    }
                  }

                  printer.close();
                  resolve(Response.json({ success: true }));
                } catch (printError: any) {
                  console.error("Printing Error:", printError);
                  resolve(
                    Response.json(
                      { success: false, error: printError.message },
                      { status: 500 },
                    ),
                  );
                }
              });
            });
          } catch (err: any) {
            return Response.json(
              { success: false, error: "Invalid JSON body" },
              { status: 400 },
            );
          }
        }

        if (url.pathname === "/health") {
          return Response.json({ status: "ok", bun: Bun.version });
        }

        return new Response("Printer Service is running", { status: 200 });
      },
    });

    console.log(`\nOK! Server running at http://localhost:${server.port}`);
  } catch (e: any) {
    console.error("\n!!! FAILED TO START SERVICE !!!");
    console.error(e);
    console.log("\nPress Enter to exit...");
    process.stdin.once("data", () => process.exit(1));
  }
}

start();
