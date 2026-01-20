import usb from "usb";
import EventEmitter from "events";

export class CustomUSB extends EventEmitter {
  private device: usb.Device | null = null;
  private endpoint: usb.OutEndpoint | null = null;

  constructor(vid?: number, pid?: number) {
    super();
    if (vid && pid) {
      this.device = usb.findByIds(vid, pid) || null;
    } else {
      this.device = this.findPrinter();
    }

    if (!this.device) {
      throw new Error("Printer not found");
    }
  }

  private findPrinter(): usb.Device | null {
    console.log("Searching for USB printers...");
    const devices = usb.getDeviceList();
    console.log(`Found ${devices.length} USB devices in total.`);

    for (const device of devices) {
      try {
        const descriptor = device.deviceDescriptor;
        console.log(
          `Checking device: VID 0x${descriptor.idVendor.toString(16)}, PID 0x${descriptor.idProduct.toString(16)}`,
        );

        const config = device.configDescriptor;
        if (!config || !config.interfaces) continue;

        const interfaces = config.interfaces;
        for (const iface of interfaces) {
          for (const alt of iface) {
            if (alt.bInterfaceClass === 0x07) {
              console.log("Found a device with PRINTER class (0x07)!");
              return device;
            }
          }
        }
      } catch (e: any) {
        // Ignore devices we can't read
        console.log(`Could not read descriptor for a device: ${e.message}`);
      }
    }
    console.log("No PRINTER class device found.");
    return null;
  }

  open(callback: (error: any) => void) {
    if (!this.device) return callback(new Error("No device"));

    try {
      this.device.open();
      const iface = this.device.interfaces[0]; // Usually first interface for printers

      // On non-Windows, detach kernel driver if active
      if (process.platform !== "win32") {
        if (iface.isKernelDriverActive()) {
          try {
            iface.detachKernelDriver();
          } catch (e) {
            console.error("Could not detach kernel driver:", e);
          }
        }
      }

      iface.claim();
      this.endpoint = iface.endpoints.find(
        (ep) => ep.direction === "out",
      ) as usb.OutEndpoint;

      if (!this.endpoint) {
        return callback(new Error("No out-endpoint found"));
      }

      callback(null);
    } catch (err) {
      callback(err);
    }
  }

  write(data: Buffer, callback?: (error: any) => void) {
    if (!this.endpoint) {
      if (callback) callback(new Error("Device not open"));
      return;
    }
    this.endpoint.transfer(data, (err) => {
      if (callback) callback(err);
    });
  }

  close(callback?: (error: any) => void) {
    if (this.device) {
      try {
        this.device.close();
        if (callback) callback(null);
      } catch (err) {
        if (callback) callback(err);
      }
    } else {
      if (callback) callback(null);
    }
  }
}
