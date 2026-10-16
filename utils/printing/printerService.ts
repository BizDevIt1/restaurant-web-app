/**
 * Thermal Printer Network Dispatcher & Queue Engine
 * Handles direct IP ESC/POS dispatch, 3-attempt retry logic, and browser print bridge.
 */

import { KitchenTicket } from "@/app/admin/types";
import {
  formatTicketToEscPos,
  formatTicketToPlainText,
  EscPosFormattingOptions,
} from "./escposFormatter";

export interface PrintJob {
  id: string;
  ticket: KitchenTicket;
  options?: EscPosFormattingOptions;
  printerIp: string;
  port: number;
  attempts: number;
  maxAttempts: number;
  status: "pending" | "printing" | "success" | "failed";
  error?: string;
  createdAt: number;
  lastAttemptAt?: number;
}

export type PrintQueueListener = (queue: PrintJob[]) => void;

class ThermalPrinterService {
  private queue: PrintJob[] = [];
  private listeners: Set<PrintQueueListener> = new Set();
  private isProcessing: boolean = false;
  private defaultPrinterIp: string = "192.168.1.180";
  private defaultPort: number = 9100;

  constructor() {
    if (typeof window !== "undefined") {
      // Restore cached printer IP from local storage if configured
      const cachedIp = localStorage.getItem("kitchen_printer_ip");
      if (cachedIp) this.defaultPrinterIp = cachedIp;
    }
  }

  public getPrinterIp(): string {
    return this.defaultPrinterIp;
  }

  public setPrinterIp(ip: string): void {
    this.defaultPrinterIp = ip.trim();
    if (typeof window !== "undefined") {
      localStorage.setItem("kitchen_printer_ip", this.defaultPrinterIp);
    }
  }

  public subscribe(listener: PrintQueueListener): () => void {
    this.listeners.add(listener);
    listener([...this.queue]);
    return () => this.listeners.delete(listener);
  }

  private notify() {
    const snapshot = [...this.queue];
    this.listeners.forEach((fn) => {
      try {
        fn(snapshot);
      } catch (err) {
        console.warn("[PrinterService] Listener exception:", err);
      }
    });
  }

  public getQueue(): PrintJob[] {
    return [...this.queue];
  }

  public getFailedJobs(): PrintJob[] {
    return this.queue.filter((job) => job.status === "failed");
  }

  /**
   * Main function to print a Kitchen Order Ticket.
   * Enqueues the job and executes the 3-attempt dispatch pipeline.
   */
  public async printKOT(
    ticket: KitchenTicket,
    options: EscPosFormattingOptions = {},
    customIp?: string
  ): Promise<{ success: boolean; job: PrintJob; error?: string }> {
    const printerIp = customIp || this.defaultPrinterIp;
    const jobId = `kot-${ticket.id}-${Date.now()}`;

    const job: PrintJob = {
      id: jobId,
      ticket,
      options,
      printerIp,
      port: this.defaultPort,
      attempts: 0,
      maxAttempts: 3,
      status: "pending",
      createdAt: Date.now(),
    };

    this.queue.unshift(job);
    this.notify();

    const result = await this.executeJobWithRetries(job);
    return result;
  }

  /**
   * Execute single job with up to 3 retry attempts.
   */
  private async executeJobWithRetries(
    job: PrintJob
  ): Promise<{ success: boolean; job: PrintJob; error?: string }> {
    job.status = "printing";
    this.notify();

    while (job.attempts < job.maxAttempts) {
      job.attempts += 1;
      job.lastAttemptAt = Date.now();

      try {
        const success = await this.sendEscPosToNetworkPrinter(job);
        if (success) {
          job.status = "success";
          job.error = undefined;
          this.notify();
          return { success: true, job };
        }
      } catch (err: any) {
        job.error = err?.message || "Printer communication failure";
      }

      // If not the final attempt, brief backoff before retrying
      if (job.attempts < job.maxAttempts) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }

    // All 3 attempts failed: mark as failed and keep in queue for manual retry
    job.status = "failed";
    this.notify();
    return {
      success: false,
      job,
      error: job.error || `Printer offline at ${job.printerIp} after 3 attempts`,
    };
  }

  /**
   * Sends raw ESC/POS byte stream to printer network IP.
   * Handles browser network sandbox safely with fallback capability.
   */
  private async sendEscPosToNetworkPrinter(job: PrintJob): Promise<boolean> {
    const rawBytes = formatTicketToEscPos(job.ticket, job.options);

    // 1. Direct fetch attempt with timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2500);

    try {
      // Some thermal network printers support direct HTTP POST on port 9100 or 80
      const response = await fetch(`http://${job.printerIp}:${job.port}/`, {
        method: "POST",
        mode: "no-cors", // Required in browser to bypass CORS when sending to local IP
        body: rawBytes as unknown as BodyInit,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      return true;
    } catch (netErr: any) {
      clearTimeout(timeoutId);

      // If in browser and direct socket refused (common browser sandbox constraint),
      // we check if a local print bridge or print agent exists on localhost:9100
      try {
        const localBridgeResponse = await fetch("http://127.0.0.1:9100/print", {
          method: "POST",
          headers: { "Content-Type": "application/octet-stream" },
          body: rawBytes as unknown as BodyInit,
          signal: AbortSignal.timeout(1000),
        });
        if (localBridgeResponse.ok) return true;
      } catch {
        // Bridge not present
      }

      // If network IP cannot be reached directly from browser,
      // simulate network offline failure so retry mechanism triggers properly
      throw new Error(
        `Unable to reach thermal printer at ${job.printerIp}:${job.port} (Attempt ${job.attempts}/3)`
      );
    }
  }

  /**
   * Retry all failed jobs currently in the print queue.
   */
  public async retryFailedJobs(): Promise<number> {
    if (this.isProcessing) return 0;
    this.isProcessing = true;
    let recovered = 0;

    const failed = this.queue.filter((j) => j.status === "failed");
    for (const job of failed) {
      job.attempts = 0; // Reset attempts counter for new retry cycle
      const res = await this.executeJobWithRetries(job);
      if (res.success) recovered += 1;
    }

    this.isProcessing = false;
    return recovered;
  }

  /**
   * Retry a specific print job by ID.
   */
  public async retryJob(jobId: string): Promise<boolean> {
    const job = this.queue.find((j) => j.id === jobId);
    if (!job) return false;
    job.attempts = 0;
    const res = await this.executeJobWithRetries(job);
    return res.success;
  }

  /**
   * Clear completed or failed jobs from queue.
   */
  public clearQueue(): void {
    this.queue = [];
    this.notify();
  }

  /**
   * Test Print Utility: Sends a standardized diagnostic test slip to the printer.
   */
  public async testPrint(
    printerIp?: string
  ): Promise<{ success: boolean; message: string }> {
    const targetIp = printerIp || this.defaultPrinterIp;
    const dummyTicket: KitchenTicket = {
      id: `TEST-${Math.floor(1000 + Math.random() * 9000)}`,
      tableOrChannel: "Diagnostic Test Station",
      orderType: "dine_in",
      elapsedMinutes: 0,
      serverName: "Thermal Diagnostics",
      status: "queued",
      priority: "normal",
      items: [
        {
          name: "Thermal 80mm Font A Self-Test",
          qty: 1,
          prepTime: "0m",
          notes: "Alignment: Center/Left/Right OK",
        },
        {
          name: "ESC/POS Cutter & Buzzer Test",
          qty: 1,
          prepTime: "0m",
          notes: "3-beep chime verified",
        },
      ],
      createdAt: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    const res = await this.printKOT(
      dummyTicket,
      {
        restaurantName: "THERMAL PRINTER TEST",
        branchName: "KDS Diagnostic Terminal",
        chefNotes: "Hardware communication operational. 80mm roll feed OK.",
      },
      targetIp
    );

    if (res.success) {
      return {
        success: true,
        message: `Test print successful! Sent to printer at ${targetIp}:${this.defaultPort}`,
      };
    } else {
      return {
        success: false,
        message:
          res.error || `Test print failed to reach printer at ${targetIp}:${this.defaultPort}`,
      };
    }
  }

  /**
   * Trigger standard browser print dialog as seamless fallback.
   */
  public triggerBrowserPrint(): void {
    if (typeof window !== "undefined") {
      window.print();
    }
  }
}

// Global Singleton Instance
export const printerService = new ThermalPrinterService();
