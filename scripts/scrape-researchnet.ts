import "dotenv/config";
import { ChatOpenAI } from "@langchain/openai";
import { PlaywrightWebBaseLoader } from "@langchain/community/document_loaders/web/playwright";
import { PromptTemplate } from "@langchain/core/prompts";
import { RunnableSequence } from "@langchain/core/runnables";
import { StringOutputParser } from "@langchain/core/output_parsers";
import * as fs from "fs";
import * as path from "path";

// Configuration
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const TARGET_URL = "https://www.researchnet-recherchenet.ca/rnr16/vwOpprtntyDtls.do?all=1&masterList=true&org=CIHR&prog=4361&resultCount=25&sort=program&type=EXACT&view=currentOpps&language=E";
const OUTPUT_FILE = "researchnet-parsed.md";

if (!OPENAI_API_KEY) {
  console.error("Please set OPENAI_API_KEY environment variable");
  process.exit(1);
}

// Initialize the language model
const model = new ChatOpenAI({
  modelName: "gpt-4o",
  temperature: 0,
  openAIApiKey: OPENAI_API_KEY,
});

// Function to scrape the website content
async function scrapeWebsite(url: string) {
  console.log("🔍 Scraping website content...");
  
  const loader = new PlaywrightWebBaseLoader(url, {
    launchOptions: {
      headless: true,
    },
    gotoOptions: {
      waitUntil: "networkidle",
    },
  });

  const docs = await loader.load();
  console.log(`✅ Scraped ${docs.length} document(s)`);
  
  // Extract main content from the HTML
  const fullContent = docs[0].pageContent;
  const mainContent = extractMainContent(fullContent);
  
  return mainContent;
}

// Function to extract main content from HTML
function extractMainContent(html: string): string {
  // Simple HTML parsing to extract main content
  let content = html;
  
  // Try to find and extract main element content
  const mainMatch = content.match(/<main[^>]*>([\s\S]*?)<\/main>/i);
  if (mainMatch) {
    return mainMatch[1];
  }
  
  // If no main element, try to find body content
  const bodyMatch = content.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  if (bodyMatch) {
    return bodyMatch[1];
  }
  
  // Fallback to full content
  return content;
}

// Function to split content into manageable chunks based on HTML headers
function splitContent(content: string) {
  console.log("📝 Splitting content into sections based on HTML headers...");
  
  // Split on HTML headers (h1, h2, h3, h4, h5, h6)
  const headerRegex = /<(h[1-6])[^>]*>(.*?)<\/\1>/gi;
  const sections: string[] = [];
  let currentSection = "";
  let lastIndex = 0;
  
  let match;
  while ((match = headerRegex.exec(content)) !== null) {
    const headerTag = match[1];
    const headerText = match[2];
    const matchStart = match.index;
    
    // If we have content before this header, add it to the current section
    if (matchStart > lastIndex) {
      currentSection += content.substring(lastIndex, matchStart);
    }
    
    // If we have a substantial section, save it and start a new one
    if (currentSection.trim().length > 100) {
      sections.push(currentSection.trim());
      currentSection = "";
    }
    
    // Start new section with this header
    currentSection += `<${headerTag}>${headerText}</${headerTag}>`;
    lastIndex = match.index + match[0].length;
  }
  
  // Add any remaining content
  if (lastIndex < content.length) {
    currentSection += content.substring(lastIndex);
  }
  
  // Add the last section if it has content
  if (currentSection.trim().length > 0) {
    sections.push(currentSection.trim());
  }
  
  // If no headers found or sections are too small, fall back to paragraph-based splitting
  if (sections.length <= 1) {
    console.log("⚠️ No headers found, falling back to paragraph-based splitting...");
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

// Function to parse a section into markdown
async function parseSection(section: string, sectionIndex: number, totalSections: number) {
  console.log(`🔄 Parsing section ${sectionIndex + 1}/${totalSections}...`);
  
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

IMPORTANT: Return only the formatted markdown content. Do NOT wrap your response in \`\`\`markdown\`\`\` code blocks or any other formatting envelopes. Return the raw markdown text directly.
`);

  const chain = RunnableSequence.from([
    prompt,
    model,
    new StringOutputParser(),
  ]);

  try {
    const result = await chain.invoke({ section });
    // Remove any markdown code block wrappers if they exist
    const cleanResult = result.replace(/^```markdown\s*\n?/, '').replace(/\n?```\s*$/, '');
    return cleanResult;
  } catch (error) {
    console.error(`❌ Error parsing section ${sectionIndex + 1}:`, error);
    return `## Section ${sectionIndex + 1}\n\n${section}\n\n*[Error occurred during parsing]*\n`;
  }
}

// Function to combine all sections into a final document
function createFinalDocument(parsedSections: string[]) {
  console.log("📄 Creating final document...");
  
  // Simply join all sections with double line breaks
  const finalDocument = parsedSections.join("\n\n");
  
  return finalDocument;
}

// Main function
async function main() {
  try {
    console.log("🚀 Starting ResearchNet content scraping and parsing...");
    console.log(`📋 Target URL: ${TARGET_URL}`);
    
    // Step 1: Scrape the website
    const content = await scrapeWebsite(TARGET_URL);
    
    // Step 2: Split content into sections
    const sections = await splitContent(content);
    console.log(`📊 Split content into ${sections.length} sections`);
    
    // Step 3: Parse each section
    const parsedSections: string[] = [];
    for (let i = 0; i < sections.length; i++) {
      const parsedSection = await parseSection(sections[i], i, sections.length);
      parsedSections.push(parsedSection);
      
      // Add a small delay to avoid rate limiting
      if (i < sections.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    // Step 4: Create final document
    const finalDocument = createFinalDocument(parsedSections);
    
    // Step 5: Save to file
    fs.writeFileSync(OUTPUT_FILE, finalDocument, 'utf8');
    
    console.log(`✅ Successfully created ${OUTPUT_FILE}`);
    console.log(`📁 File saved to: ${path.resolve(OUTPUT_FILE)}`);
    
  } catch (error) {
    console.error("❌ An error occurred:", error);
    process.exit(1);
  }
}

// Run the script
if (require.main === module) {
  main();
} 