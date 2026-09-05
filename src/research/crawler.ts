import * as cheerio from "cheerio";
import { env } from "../config.js";

interface ResearchPage {
  url: string;
  title: string;
  text: string;
}

function isPrivateHost(hostname: string): boolean {
  const host = hostname.toLowerCase().trim();

  if (process.env.NODE_ENV !== "production") {
    return false;
  }

  if (
    host === "localhost" ||
    host === "127.0.0.1" ||
    host === "::1" ||
    host === "[::1]"
  ) {
    return true;
  }

  const ipv4Parts = host.split(".").map(Number);

  if (
    ipv4Parts.length === 4 &&
    ipv4Parts.every((part) => Number.isInteger(part) && part >= 0 && part <= 255)
  ) {
    const [a, b] = ipv4Parts;

    // 10.0.0.0/8
    if (a === 10) {
      return true;
    }

    // 172.16.0.0/12
    if (a === 172 && b >= 16 && b <= 31) {
      return true;
    }

    // 192.168.0.0/16
    if (a === 192 && b === 168) {
      return true;
    }
  }

  return false;
}

async function fetchPage(url: string): Promise<ResearchPage | null> {
  try {
    const parsed = new URL(url);

    if (
      env.NODE_ENV === "production" &&
      isPrivateHost(parsed.hostname)
    ) {
      throw new Error("Private URL blocked in production");
    }

    const response = await fetch(url, {
      headers: {
        "User-Agent": env.RESEARCH_USER_AGENT
      }
    });

    if (!response.ok) {
      return null;
    }

    const contentType =
      response.headers.get("content-type") ?? "";

    if (!contentType.includes("text/html")) {
      return null;
    }

    const text = await response.text();

    const limited = text.slice(
      0,
      env.RESEARCH_MAX_BYTES
    );

    const $ = cheerio.load(limited);

    $("script, style, noscript").remove();

    const title = $("title").text().trim();

    const pageText = $("body")
      .text()
      .replace(/\s+/g, " ")
      .trim();

    return {
      url,
      title,
      text: pageText
    };
  } catch {
    return null;
  }
}

export async function researchCompany(
  companyUrl: string
): Promise<{
  pages: ResearchPage[];
  sources: string[];
}> {
  const pages: ResearchPage[] = [];

  const queue = [companyUrl];
  const visited = new Set<string>();

  while (
    queue.length > 0 &&
    pages.length < env.RESEARCH_MAX_PAGES
  ) {
    const current = queue.shift();

    if (!current || visited.has(current)) {
      continue;
    }

    visited.add(current);

    const page = await fetchPage(current);

    if (!page) {
      continue;
    }

    pages.push(page);

    const parsed = new URL(current);

    const links: string[] = [];

    const $ = cheerio.load(
      await (
        await fetch(current, {
          headers: {
            "User-Agent": env.RESEARCH_USER_AGENT
          }
        })
      ).text()
    );

    $("a[href]").each((_, element) => {
      const href = $(element).attr("href");

      if (!href) {
        return;
      }

      try {
        const absolute = new URL(href, current);

        if (
          absolute.hostname === parsed.hostname &&
          ["http:", "https:"].includes(absolute.protocol)
        ) {
          links.push(absolute.toString());
        }
      } catch {
        // Ignore invalid links.
      }
    });

    for (const link of links) {
      if (!visited.has(link) && !queue.includes(link)) {
        queue.push(link);
      }
    }

    if (env.RESEARCH_DELAY_MS > 0) {
      await new Promise((resolve) =>
        setTimeout(resolve, env.RESEARCH_DELAY_MS)
      );
    }
  }

  return {
    pages,
    sources: pages.map((page) => page.url)
  };
}