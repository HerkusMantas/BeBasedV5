'use server';

/**
 * @fileOverview Suggests related concepts for a selected node in a mind map.
 *
 * - suggestConcepts - A function that takes a node's text and suggests related concepts.
 * - SuggestConceptsInput - The input type for the suggestConcepts function.
 * - SuggestConceptsOutput - The return type for the suggestConcepts function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const SuggestConceptsInputSchema = z.object({
  nodeText: z.string().describe('The text content of the selected node.'),
});
export type SuggestConceptsInput = z.infer<typeof SuggestConceptsInputSchema>;

const SuggestConceptsOutputSchema = z.object({
  suggestions: z.array(z.string()).describe('An array of suggested concepts related to the node text.'),
});
export type SuggestConceptsOutput = z.infer<typeof SuggestConceptsOutputSchema>;

export async function suggestConcepts(input: SuggestConceptsInput): Promise<SuggestConceptsOutput> {
  return suggestConceptsFlow(input);
}

const prompt = ai.definePrompt({
  name: 'suggestConceptsPrompt',
  input: {schema: SuggestConceptsInputSchema},
  output: {schema: SuggestConceptsOutputSchema},
  prompt: `You are a creative assistant helping users expand their mind maps.

  Based on the following node text, suggest a list of related concepts that could be added to the mind map to further explore the topic. Return only a JSON array of strings.

  Node Text: {{{nodeText}}}

  Suggestions:`,
});

const suggestConceptsFlow = ai.defineFlow(
  {
    name: 'suggestConceptsFlow',
    inputSchema: SuggestConceptsInputSchema,
    outputSchema: SuggestConceptsOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
