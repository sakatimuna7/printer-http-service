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

        // CORS Headers
        const corsHeaders = {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
        };

        // Handle CORS preflight
        if (req.method === "OPTIONS") {
          return new Response(null, { headers: corsHeaders });
        }

        if (req.method === "POST" && url.pathname === "/print") {
          try {
            const body = await req.json();
            console.log(
              `[${new Date().toISOString()}] New print request received`,
            );
            const { device, printer } = getPrinter({
              width: body.printer?.width,
            });

            return new Promise((resolve) => {
              const timeout = setTimeout(() => {
                console.error(
                  `[${new Date().toISOString()}] Print request timed out! EXITING FOR RESTART...`,
                );
                try {
                  device.close();
                } catch (e) {}
                // Exit process to trigger restart (prevent memory leak/hang)
                process.exit(1);
              }, 15000); // 15 second timeout

              console.log(
                `[${new Date().toISOString()}] Opening USB device...`,
              );
              device.open(async (error: any) => {
                if (error) {
                  clearTimeout(timeout);
                  console.error(
                    `[${new Date().toISOString()}] USB Open Error:`,
                    error,
                  );
                  return resolve(
                    Response.json(
                      { success: false, error: "Could not open USB device" },
                      { status: 500, headers: corsHeaders },
                    ),
                  );
                }

                console.log(
                  `[${new Date().toISOString()}] USB device opened. Starting print...`,
                );
                try {
                  // Jika payload punya items, pakai layout generic
                  if (body.items) {
                    console.log(
                      `[${new Date().toISOString()}] Processing ${body.items.length} items...`,
                    );
                    printer.font("a").align("CT").size(1, 1);

                    let itemIdx = 0;
                    for (const item of body.items) {
                      itemIdx++;
                      console.log(
                        `[${new Date().toISOString()}] Item ${itemIdx}/${body.items.length}: type=${item.type}`,
                      );
                      const opt = item.options || {};

                      // Reset to default style and size for each item
                      printer.style("NORMAL").size(1, 1);

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
                        printer.align("CT");
                        printer.size(1, 1);
                        // If content is 2D array, loop through rows
                        if (Array.isArray(item.content[0])) {
                          for (const row of item.content) {
                            printer.table(row as any[]);
                          }
                        } else {
                          printer.table(item.content);
                        }
                      } else if (
                        item.type === "tableCustom" &&
                        Array.isArray(item.content)
                      ) {
                        printer.align("LT");
                        if (opt.align) printer.align(opt.align);
                        if (opt.style) printer.style(opt.style);
                        if (opt.size) printer.size(opt.size[0], opt.size[1]);

                        const tableOptions = opt.tableOptions || {};
                        const alignMap: Record<string, string> = {
                          LT: "LEFT",
                          RT: "RIGHT",
                          CT: "CENTER",
                        };

                        const processRow = (row: any[]) => {
                          const totalCols = printer.width || 24;
                          const rowLength = row.length || 1;

                          // VALIDATION: Prevent infinite recursion in escpos
                          // escpos does: let baseWidth = Math.floor(this.width / width)
                          // then: let cellWidth = Math.floor(baseWidth / data.length)
                          // if cellWidth is 0, it crashes (recursively).
                          const scaleWidth = tableOptions.size?.[0] || 1;
                          const baseWidth = Math.floor(totalCols / scaleWidth);

                          if (baseWidth < rowLength) {
                            console.error(
                              `[${new Date().toISOString()}] tableCustom Warning: baseWidth (${baseWidth}) < rowLength (${rowLength}). Skipping complex formatting to prevent hang.`,
                            );
                            // Fallback to simple text if it would crash
                            printer.text(
                              row
                                .map((v) =>
                                  typeof v === "object" ? v.text : String(v),
                                )
                                .join(" "),
                            );
                            return;
                          }

                          printer.tableCustom(
                            row.map((val: any, i: number) => {
                              const isObj =
                                val !== null && typeof val === "object";
                              const text = isObj ? val.text : String(val);
                              const rawAlign =
                                (isObj ? val.align : opt.columns?.[i]?.align) ||
                                "LEFT";
                              const align =
                                alignMap[rawAlign.toUpperCase()] ||
                                rawAlign.toUpperCase();

                              let width = isObj
                                ? val.width
                                : opt.columns?.[i]?.width;

                              if (width === undefined) {
                                width = 1 / rowLength;
                              }

                              // Still ensure at least 1 char width for individual columns
                              const minWidth = 1.1 / totalCols;
                              if (width < minWidth) {
                                width = minWidth;
                              }

                              const style =
                                (isObj ? val.style : opt.columns?.[i]?.style) ||
                                opt.style;

                              return {
                                text: String(text),
                                align: align as any,
                                width: width,
                                style: style,
                              };
                            }),
                            tableOptions,
                          );
                        };

                        if (Array.isArray(item.content[0])) {
                          for (const row of item.content) {
                            processRow(row as any[]);
                          }
                        } else {
                          processRow(item.content);
                        }
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

                  clearTimeout(timeout);
                  console.log(
                    `[${new Date().toISOString()}] Printing complete. Sending printer.close()...`,
                  );
                  printer.close(() => {
                    console.log(
                      `[${new Date().toISOString()}] printer.close() callback received. Processing finished.`,
                    );
                    resolve(
                      Response.json(
                        { success: true },
                        { headers: corsHeaders },
                      ),
                    );
                  });
                } catch (printError: any) {
                  clearTimeout(timeout);
                  console.error(
                    `[${new Date().toISOString()}] Printing Error:`,
                    printError,
                  );
                  try {
                    device.close();
                  } catch (e) {}
                  resolve(
                    Response.json(
                      { success: false, error: printError.message },
                      { status: 500, headers: corsHeaders },
                    ),
                  );
                }
              });
            });
          } catch (err: any) {
            return Response.json(
              { success: false, error: "Invalid JSON body" },
              { status: 400, headers: corsHeaders },
            );
          }
        }

        if (url.pathname === "/health") {
          return Response.json(
            { status: "ok", bun: Bun.version },
            { headers: corsHeaders },
          );
        }

        return new Response("Printer Service is running", {
          status: 200,
          headers: corsHeaders,
        });
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
