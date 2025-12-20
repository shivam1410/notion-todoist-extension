function markdownToNotionPayload(markdownText) {
    // Define regex patterns
    const patterns = {
        heading_1: /^# (.+)/gm,
        heading_2: /^## (.+)/gm,
        heading_3: /^### (.+)/gm,
        bulleted_list_item: /^- (.+)/gm,
        numbered_list_item: /^\d+\. (.+)/gm,
        link: /\[([^\]]+)\]\(([^)]+)\)/gm,
        quote: /^> (.+)/gm,
        code: /`([^`]+)`/gm,
        code_block: /```([\s\S]*?)```/gm,
        bold: /\*\*([^*]+)\*\*/gm,
        italic: /\*([^*]+)\*/gm
    };

    // Function to wrap text in Notion format
    const createTextBlock = (text) => ({
        type: "text",
        text: { content: text }
    });

    // Store the extracted blocks
    let notionBlocks = [];

    // Extract each type of content and push into Notion format
    Object.keys(patterns).forEach(type => {
        const matches = [...markdownText.matchAll(patterns[type])];
        matches.forEach(match => {
            let block = null;
            const line = match[1];

            switch (type) {
                case "heading_1":
                    block = {
                        object: "block",
                        type: "heading_1",
                        heading_1: { rich_text: [createTextBlock(line)] }
                    };
                    break;
                case "heading_2":
                    block = {
                        object: "block",
                        type: "heading_2",
                        heading_2: { rich_text: [createTextBlock(line)] }
                    };
                    break;
                case "heading_3":
                    block = {
                        object: "block",
                        type: "heading_3",
                        heading_3: { rich_text: [createTextBlock(line)] }
                    };
                    break;
                case "bulleted_list_item":
                    block = {
                        object: "block",
                        type: "bulleted_list_item",
                        bulleted_list_item: { rich_text: [createTextBlock(line)] }
                    };
                    break;
                case "numbered_list_item":
                    block = {
                        object: "block",
                        type: "numbered_list_item",
                        numbered_list_item: { rich_text: [createTextBlock(line)] }
                    };
                    break;
                case "link":
                    block = {
                        object: "block",
                        type: "paragraph",
                        paragraph: {
                            rich_text: [{
                                type: "text",
                                text: { content: match[1], link: { url: match[2] } }
                            }]
                        }
                    };
                    break;
                case "quote":
                    block = {
                        object: "block",
                        type: "quote",
                        quote: { rich_text: [createTextBlock(line)] }
                    };
                    break;
                case "code":
                    block = {
                        object: "block",
                        type: "code",
                        code: { rich_text: [createTextBlock(line)], language: "plain text" }
                    };
                    break;
                case "code_block":
                    block = {
                        object: "block",
                        type: "code",
                        code: { rich_text: [createTextBlock(match[1].trim())], language: "plain text" }
                    };
                    break;
                case "bold":
                    block = {
                        object: "block",
                        type: "paragraph",
                        paragraph: {
                            rich_text: [{ type: "text", text: { content: line }, annotations: { bold: true } }]
                        }
                    };
                    break;
                case "italic":
                    block = {
                        object: "block",
                        type: "paragraph",
                        paragraph: {
                            rich_text: [{ type: "text", text: { content: line }, annotations: { italic: true } }]
                        }
                    };
                    break;
            }

            if (block) notionBlocks.push(block);
        });
    });

    // Add remaining unmatched content as a paragraph
    let cleanedText = markdownText.replace(/#+ |^- |^\d+\. |> |`|\*|\[|\]|\(|\)|```/g, "").trim();
    if (cleanedText.length > 0) {
        notionBlocks.push({
            object: "block",
            type: "paragraph",
            paragraph: { rich_text: [createTextBlock(cleanedText)] }
        });
    }

    return notionBlocks;
}

/* 
// Example Usage
const markdownText = `# Header 1

## Header 2

### Herder 3

- Unordered List 1
- Unordered List 2
- Unordered List 3

1. Ordered List 1
2. Ordered List 2
3. Ordered 3

Link : [Tracker](https://docs.google.com/spreadsheets/d/18n86FnoHeqY1HCvaSHPXf2vbzjDZmw2gcO1Iv2XeD0Y)

*Italic*

**Bold**

> Quotation

\`Single Line Code\`

\`\`\`
Multi line Code
\`\`\``;

console.log(JSON.stringify(markdownToNotionPayload(markdownText), null, 2));
*/


function markdownToNotionBlocks(markdownText) {
    const notionBlocks = [];
    const lines = markdownText.split("\n");

    lines.forEach((line) => {
        line = line.trim();
        if (!line) return; // Skip empty lines

        let block = null;

        // Headings
        if (/^# (.+)/.test(line)) {
            block = {
                object: "block",
                type: "heading_1",
                heading_1: { rich_text: [{ type: "text", text: { content: line.replace(/^# /, "") } }] }
            };
        } else if (/^## (.+)/.test(line)) {
            block = {
                object: "block",
                type: "heading_2",
                heading_2: { rich_text: [{ type: "text", text: { content: line.replace(/^## /, "") } }] }
            };
        } else if (/^### (.+)/.test(line)) {
            block = {
                object: "block",
                type: "heading_3",
                heading_3: { rich_text: [{ type: "text", text: { content: line.replace(/^### /, "") } }] }
            };
        }
        // Unordered List
        else if (/^- (.+)/.test(line)) {
            block = {
                object: "block",
                type: "bulleted_list_item",
                bulleted_list_item: { rich_text: [{ type: "text", text: { content: line.replace(/^- /, "") } }] }
            };
        }
        // Ordered List
        else if (/^\d+\. (.+)/.test(line)) {
            block = {
                object: "block",
                type: "numbered_list_item",
                numbered_list_item: { rich_text: [{ type: "text", text: { content: line.replace(/^\d+\. /, "") } }] }
            };
        }
        // Blockquote
        else if (/^> (.+)/.test(line)) {
            block = {
                object: "block",
                type: "quote",
                quote: { rich_text: [{ type: "text", text: { content: line.replace(/^> /, "") } }] }
            };
        }
        // Inline Code
        else if (/`([^`]+)`/.test(line)) {
            block = {
                object: "block",
                type: "paragraph",
                paragraph: {
                    rich_text: [{
                        type: "text",
                        text: { content: line.replace(/`([^`]+)`/g, "$1") },
                        annotations: { code: true }
                    }]
                }
            };
        }
        // Multi-line Code Block
        else if (/^```/.test(line)) {
            let codeContent = [];
            while (lines.length && !/^```/.test(lines[0])) {
                codeContent.push(lines.shift().trim());
            }
            block = {
                object: "block",
                type: "code",
                code: {
                    rich_text: [{ type: "text", text: { content: codeContent.join("\n") } }],
                    language: "plain text"
                }
            };
        }
        // Links
        else if (/\[([^\]]+)\]\(([^)]+)\)/.test(line)) {
            let richTextArray = [];
            let remainingText = line;
            
            while (/\[([^\]]+)\]\(([^)]+)\)/.test(remainingText)) {
                let match = remainingText.match(/\[([^\]]+)\]\(([^)]+)\)/);
                if (!match) break;
                
                const [fullMatch, text, url] = match;
                const splitIndex = remainingText.indexOf(fullMatch);

                // Add any preceding text
                if (splitIndex > 0) {
                    richTextArray.push({
                        type: "text",
                        text: { content: remainingText.substring(0, splitIndex) }
                    });
                }

                // Add the link
                richTextArray.push({
                    type: "text",
                    text: { content: text, link: { url } }
                });

                // Update remaining text
                remainingText = remainingText.substring(splitIndex + fullMatch.length);
            }

            // Add any trailing text
            if (remainingText.length > 0) {
                richTextArray.push({
                    type: "text",
                    text: { content: remainingText }
                });
            }

            block = {
                object: "block",
                type: "paragraph",
                paragraph: { rich_text: richTextArray }
            };
        }
        // Default case (Paragraph)
        else {
            block = {
                object: "block",
                type: "paragraph",
                paragraph: { rich_text: [{ type: "text", text: { content: line } }] }
            };
        }

        if (block) notionBlocks.push(block);
    });

    return notionBlocks;
}

/*
// Example usage:
const markdownText = `
# Header 1

## Header 2

### Header 3

- Unordered List 1
- Unordered List 2

1. Ordered List 1
2. Ordered List 2

> Quotation

\`Inline Code\`

\`\`\`
Multi-line Code
\`\`\`

Here is a [Google Spreadsheet](https://docs.google.com/spreadsheets/d/18n86FnoHeqY1HCvaSHPXf2vbzjDZmw2gcO1Iv2XeD0Y).

You can visit [GitHub](https://github.com) for code hosting.

Check out this website [example](https://example.com) for reference.

Some normal text here.
`;

console.log(JSON.stringify(markdownToNotionBlocks(markdownText), null, 2));
*/
