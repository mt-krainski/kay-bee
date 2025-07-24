import { inngest } from "./inngest";
import { ChatOpenAI } from "@langchain/openai";
import { PlaywrightWebBaseLoader } from "@langchain/community/document_loaders/web/playwright";
import { PromptTemplate } from "@langchain/core/prompts";
import { RunnableSequence } from "@langchain/core/runnables";
import { StringOutputParser } from "@langchain/core/output_parsers";

// Helper: Extract main content from HTML
function extractMainContent(html: string): string {
  const content = html;
  const mainMatch = content.match(/<main[^>]*>([\s\S]*?)<\/main>/i);
  if (mainMatch) return mainMatch[1];
  const bodyMatch = content.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  if (bodyMatch) return bodyMatch[1];
  return content;
}

// Helper: Split content into sections
function splitContent(content: string) {
  const headerRegex = /<(h[1-6])[^>]*>(.*?)<\/\1>/gi;
  const sections: string[] = [];
  let currentSection = "";
  let lastIndex = 0;
  let match;
  while ((match = headerRegex.exec(content)) !== null) {
    const headerTag = match[1];
    const headerText = match[2];
    const matchStart = match.index;
    if (matchStart > lastIndex) {
      currentSection += content.substring(lastIndex, matchStart);
    }
    if (currentSection.trim().length > 100) {
      sections.push(currentSection.trim());
      currentSection = "";
    }
    currentSection += `<${headerTag}>${headerText}</${headerTag}>`;
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < content.length) {
    currentSection += content.substring(lastIndex);
  }
  if (currentSection.trim().length > 0) {
    sections.push(currentSection.trim());
  }
  if (sections.length <= 1) {
    const paragraphs = content.split(/\n\s*\n/);
    const chunkSize = 3000;
    const result: string[] = [];
    let currentChunk = "";
    for (const paragraph of paragraphs) {
      if ((currentChunk + paragraph).length > chunkSize && currentChunk.length > 0) {
        result.push(currentChunk.trim());
        currentChunk = paragraph;
      } else {
        currentChunk += (currentChunk ? "\n\n" : "") + paragraph;
      }
    }
    if (currentChunk.trim().length > 0) {
      result.push(currentChunk.trim());
    }
    return result;
  }
  return sections;
}

// Helper: Parse a section into markdown
async function parseSection(section: string, model: ChatOpenAI, sectionIndex: number) {
  const prompt = PromptTemplate.fromTemplate(`
You are an expert at parsing and formatting web content into clean, well-structured markdown.
Please parse the following section of a ResearchNet funding opportunity page and convert it into properly formatted markdown.
IMPORTANT INSTRUCTIONS:
- Focus ONLY on the main content of the funding opportunity (descriptions, requirements, guidelines, etc.)
- IGNORE all navigation elements, menus, breadcrumbs, headers, footers, and metadata
- IGNORE elements like "Top", "Back to Results", "Search Again", "Print Preview", "Watch this Opportunity", etc.
- IGNORE technical elements like scripts, styles, and accessibility features
- IGNORE language selection options and site navigation
- Focus on the actual funding opportunity content starting from "Funding Opportunity Details" or similar main content areas
When parsing, focus on:
- Maintaining the hierarchical structure with appropriate heading levels
- Preserving all important information about the funding opportunity
- Making the content readable and well-organized
- Using proper markdown formatting (headers, lists, tables, etc.)
- Keeping the original meaning and context intact
- Making each section self-contained and coherent
Section content:
{section}
IMPORTANT: Return only the formatted markdown content. Do NOT wrap your response in markdown code blocks or any other formatting envelopes. Return the raw markdown text directly.
`);
  const chain = RunnableSequence.from([
    prompt,
    model,
    new StringOutputParser(),
  ]);
  try {
    const result = await chain.invoke({ section });
    const cleanResult = result.replace(/^```markdown\s*\n?/, '').replace(/\n?```\s*$/, '');
    return cleanResult;
  } catch {
    return `## Section ${sectionIndex + 1}\n\n${section}\n\n*[Error occurred during parsing]*\n`;
  }
}

// Helper: Combine all sections into a final document
function createFinalDocument(parsedSections: string[]) {
  return parsedSections.join("\n\n");
}

export const scrapeResearchnetInngest = inngest.createFunction(
  { id: "scrape-researchnet", name: "Scrape ResearchNet and Save to Supabase" },
  { event: "call_for_proposal.scrape" },
  async ({ event }) => {
    const { id, url } = event.data;
    if (!id || !url) throw new Error("Missing id or url");

    // 1. Scrape the website
    const loader = new PlaywrightWebBaseLoader(url, {
      launchOptions: { headless: true },
      gotoOptions: { waitUntil: "networkidle" },
    });
    const docs = await loader.load();
    const fullContent = docs[0].pageContent;
    const mainContent = extractMainContent(fullContent);

    // 2. Split content into sections
    const sections = splitContent(mainContent);

    // 3. Parse each section
    const model = new ChatOpenAI({
      modelName: "gpt-4o",
      temperature: 0,
      openAIApiKey: process.env.OPENAI_API_KEY,
    });
    const parsedSections: string[] = [];
    for (let i = 0; i < sections.length; i++) {
      const parsedSection = await parseSection(sections[i], model, i);
      parsedSections.push(parsedSection);
    }
    const finalDocument = createFinalDocument(parsedSections);

    // 4. Write to Supabase via REST API
    const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) throw new Error("Missing Supabase env vars");
    const response = await fetch(`${SUPABASE_URL}/rest/v1/call_for_proposal?id=eq.${id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        "apikey": SUPABASE_SERVICE_ROLE_KEY,
        "Authorization": `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        "Prefer": "return=representation",
      },
      body: JSON.stringify({ description_markdown: finalDocument }),
    });
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Supabase update failed: ${response.status} ${errorText}`);
    }
    const updated = await response.json();
    return { updated };
  }
); 