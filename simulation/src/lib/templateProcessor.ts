export interface TemplateVariables {
  [key: string]: string | number | boolean;
}

export type FileLoader = (path: string) => Promise<string>;

export class TemplateProcessor {
  private fileLoader: FileLoader;

  constructor(fileLoader?: FileLoader) {
    this.fileLoader = fileLoader || this.defaultFileLoader;
  }

  /**
   * Default file loader that loads templates via HTTP fetch
   */
  private async defaultFileLoader(path: string): Promise<string> {
    try {
      const response = await fetch(path);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      return await response.text();
    } catch (error) {
      throw new Error(`Failed to load file "${path}": ${error}`);
    }
  }

  /**
   * Load a template file from the public/prompts directory
   */
  private async loadTemplate(templateName: string): Promise<string> {
    return this.fileLoader(`/prompts/${templateName}.md`);
  }

  /**
   * Load the game rules (a synced copy of docs/game-rules.md) plus the simulator-specific notes
   */
  private async loadGameRules(): Promise<string> {
    const rules = await this.fileLoader("/prompts/game-rules.md");
    const simulatorNotes = await this.fileLoader("/prompts/simulator-notes-for-ai.md");
    return `${rules}\n\n---\n\n${simulatorNotes}`;
  }

  /**
   * Process a template by replacing all {{variableName}} with provided values
   * and inserting game rules dynamically
   */
  async processTemplate(templateName: string, variables: TemplateVariables): Promise<string> {
    const template = await this.loadTemplate(templateName);

    // If this is the system prompt and it contains {{gameRules}}, load the game rules
    let processedTemplate = template;
    if (template.includes("{{gameRules}}")) {
      const gameRules = await this.loadGameRules();
      variables = { ...variables, gameRules };
    }

    return processedTemplate.replace(/\{\{(\w+)\}\}/g, (match, variableName) => {
      if (variableName in variables) {
        return String(variables[variableName]);
      }

      // Return the original match if variable is not found
      console.warn(`Template variable "${variableName}" not found in template "${templateName}"`);
      return match;
    });
  }
}


