import { describe, expect, it } from "vitest";
import { formatBytes, isPlainText, safeFilename, sha256Hex, sniffMime } from "./files";

const bytes = (...v: number[]) => new Uint8Array([...v, ...new Array(16).fill(0)]);

describe("sniffMime", () => {
  it("recognises allowed types from their bytes", () => {
    expect(sniffMime(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a))).toBe("image/png");
    expect(sniffMime(bytes(0xff, 0xd8, 0xff, 0xe0))).toBe("image/jpeg");
    expect(sniffMime(new TextEncoder().encode("GIF89a\0\0\0\0\0\0\0\0"))).toBe("image/gif");
    expect(sniffMime(new TextEncoder().encode("RIFF\0\0\0\0WEBPVP8 "))).toBe("image/webp");
    expect(sniffMime(new TextEncoder().encode("%PDF-1.7\n%..............."))).toBe("application/pdf");
    expect(sniffMime(new Uint8Array([0, 0, 0, 24, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6f, 0x6d, 0, 0]))).toBe("video/mp4");
    expect(sniffMime(bytes(0x1a, 0x45, 0xdf, 0xa3))).toBe("video/webm");
    expect(sniffMime(new TextEncoder().encode("catatan biasa: halo dunia, ini teks"))).toBe("text/plain");
  });

  it("rejects executables, scripts disguised as images, and binary junk", () => {
    expect(sniffMime(new TextEncoder().encode("MZ\x90\x00\x03\x00\x00\x00\x04\x00\x00\x00\xff\xff"))).toBeNull();
    expect(sniffMime(new Uint8Array([0x7f, 0x45, 0x4c, 0x46, 2, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0]))).toBeNull(); // ELF
    expect(sniffMime(bytes(1, 2, 3, 4, 5, 6, 7, 8))).toBeNull();
    expect(sniffMime(new Uint8Array())).toBeNull();
  });
});

describe("helpers", () => {
  it("isPlainText rejects control characters and invalid UTF-8", () => {
    expect(isPlainText(new TextEncoder().encode("baris 1\nbaris 2\tok"))).toBe(true);
    expect(isPlainText(new Uint8Array([0x68, 0x00, 0x69]))).toBe(false);
    expect(isPlainText(new Uint8Array([0xff, 0xfe, 0xfd]))).toBe(false);
  });

  it("sha256Hex matches the known digest", () => {
    expect(sha256Hex(new TextEncoder().encode("abc"))).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  });

  it("safeFilename strips paths, control characters and leading dots", () => {
    expect(safeFilename("C:\\Users\\x\\..\\bukti.png")).toBe("bukti.png");
    expect(safeFilename("../../etc/passwd")).toBe("passwd");
    expect(safeFilename('a"<b>|c.png')).toBe("a__b__c.png");
    expect(safeFilename("...")).toBe("berkas");
    expect(safeFilename("")).toBe("berkas");
    expect(safeFilename("x".repeat(500)).length).toBe(120);
  });

  it("formatBytes", () => {
    expect(formatBytes(512)).toBe("512 B");
    expect(formatBytes(2048)).toBe("2.0 KB");
    expect(formatBytes(3 * 1024 * 1024)).toBe("3.00 MB");
  });
});
