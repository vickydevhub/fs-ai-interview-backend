import * as cheerio from "cheerio";
import { env } from "../config.js";

interface ResearchPage {
  url: string;
  title: string;
  text: string;
}

function isPrivateHost(hostname: string): boolean {
  const host = hostname.toLowerCase();

  return (
    host === "localhost" ||
    host === "127.0.0.1" ||
    host === "::1" ||
    host.startsWith("10.") ||
    host.startsWith("192.168.") ||
    host.startsWith("172.16.") ||
    host.startsWith("172.17.") ||
    host.startsWith("172.18.") ||
    host.startsWith("172.19.") ||
    host.startsWith("172.20.") ||
    host.startsWith("172.21.") ||
    host.startsWith("172.22.") ||
    host.startsWith("172.23.") ||
    host.startsWith("172.24.") ||
    host.startsWith("172.25.") ||
    host.startsWith("172.26.") ||
    host.startsWith("172.27.") ||
    host.startsWith("172.28.") ||
    host.startsWith("172.29.") ||
    host.startsWith("172.30.") ||
    host.startsWith("172.31.")
  );
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