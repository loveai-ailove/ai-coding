import mammoth from "mammoth";
import xlsx from "node-xlsx";
import { PDFParse } from "pdf-parse";

function htmlToText(html: string) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeExtension(filename: string) {
  const ext = filename.split(".").pop()?.toLowerCase() || "";
  return ext;
}

export function assertSupportedKnowledgeFile(filename: string) {
  const ext = normalizeExtension(filename);
  if (!["txt", "md", "html", "pdf", "docx", "xlsx", "csv"].includes(ext)) {
    throw new Error("当前仅支持 txt、md、html、pdf、docx、xlsx、csv 文件");
  }
  return ext;
}

export async function parseKnowledgeFile(filename: string, buffer: Buffer) {
  const ext = assertSupportedKnowledgeFile(filename);

  switch (ext) {
    case "txt":
    case "md":
    case "csv":
      return buffer.toString("utf-8");
    case "html":
      return htmlToText(buffer.toString("utf-8"));
    case "pdf": {
      const parser = new PDFParse({ data: buffer });
      try {
        const result = await parser.getText();
        return result.text.trim();
      } finally {
        await parser.destroy();
      }
    }
    case "docx": {
      const result = await mammoth.extractRawText({ buffer });
      return result.value.trim();
    }
    case "xlsx": {
      const sheets = xlsx.parse(buffer);
      return sheets
        .map(({ name, data }) =>
          [`# ${name}`, ...data.map((row) => row.map((cell) => String(cell ?? "")).join(" | "))].join("\n")
        )
        .join("\n\n")
        .trim();
    }
    default:
      throw new Error("文件类型暂不支持");
  }
}
